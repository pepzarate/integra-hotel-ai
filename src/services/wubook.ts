import xmlrpc from 'xmlrpc';
import { cacheGet, cacheSet, cacheKey } from './cache';

// ── Cliente XML-RPC ───────────────────────────────────────
const client = xmlrpc.createSecureClient('https://wired.wubook.net/xrws/');

const TOKEN = process.env.WUBOOK_TOKEN!;
const LCODE = parseInt(process.env.WUBOOK_LCODE!);

// ── Tipos ─────────────────────────────────────────────────
interface WubookRoom {
    id: number;
    name: string;
    shortname: string;
    occupancy: number;
    subroom: number;       // 0 = tipo base, >0 = variante
}

interface WubookDayValue {
    price: number;
    avail?: number;
    closed: number;
    booked?: number;
    no_ota?: number;
}

interface RoomAvailability {
    id: number;
    name: string;
    shortname: string;
    occupancy: number;
    price: number;
    availableRooms: number;
}

// ── Catálogo en memoria ───────────────────────────────────
let roomCatalog: WubookRoom[] = [];
let catalogLoaded = false;

// ── Helper: promisify XML-RPC ─────────────────────────────
function wubookCall<T>(method: string, params: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
        client.methodCall(method, params, (err: any, value: any) => {
            if (err) return reject(err);
            const [rc, info] = value;
            if (rc !== 0) return reject(new Error(`Wubook error ${rc}: ${info}`));
            resolve(info as T);
        });
    });
}

// ── Cargar catálogo de habitaciones ───────────────────────
export async function loadRoomCatalog(): Promise<void> {
    const rooms = await wubookCall<any[]>('fetch_rooms', [TOKEN, LCODE, 0]);

    // Solo tipos base (subroom === 0) y variantes por ocupación
    roomCatalog = rooms.map(r => ({
        id: r.id,
        name: r.name,
        shortname: r.shortname,
        occupancy: r.occupancy,
        subroom: r.subroom,
    }));

    catalogLoaded = true;
    console.log(`  ✓ Wubook: ${roomCatalog.length} tipos de habitación cargados`);
}

export function getRoomCatalog(): WubookRoom[] {
    return roomCatalog;
}

// ── Convertir fecha ISO a formato Wubook DD/MM/YYYY ───────
function toWubookDate(isoDate: string): string {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

// ── Consultar disponibilidad y precios ────────────────────
export async function fetchAvailability(
    fechaEntrada: string,
    fechaSalida: string,
    personas: number = 1
): Promise<RoomAvailability[]> {

    if (!catalogLoaded) await loadRoomCatalog();

    // ── Caché Redis — TTL 15 minutos ──────────────────────
    const key = cacheKey(`wubook:avail:${LCODE}:${fechaEntrada}:${fechaSalida}`);
    const cached = await cacheGet<Record<string, WubookDayValue[]>>(key);

    let roomValues: Record<string, WubookDayValue[]>;

    if (cached) {
        console.log(`[WUBOOK] CACHE HIT — ${fechaEntrada} → ${fechaSalida}`);
        roomValues = cached;
    } else {
        console.log(`[WUBOOK] CACHE MISS — consultando Wubook...`);
        const dfrom = toWubookDate(fechaEntrada);
        const dto = toWubookDate(fechaSalida);
        roomValues = await wubookCall<Record<string, WubookDayValue[]>>(
            'fetch_rooms_values',
            [TOKEN, LCODE, dfrom, dto]
        );
        await cacheSet(key, roomValues, 900); // 15 minutos
    }

    // ── Filtrar y calcular disponibilidad ─────────────────
    const noches = calcularNoches(fechaEntrada, fechaSalida);
    const resultado: RoomAvailability[] = [];

    for (const room of roomCatalog) {
        if (room.occupancy < personas) continue;

        const days = roomValues[room.id.toString()];
        if (!days || days.length === 0) continue;

        const estanciaDays = days.slice(0, noches);
        const algoCerrado = estanciaDays.some(d => d.closed === 1);
        if (algoCerrado) continue;

        const precios = estanciaDays.map(d => d.price).filter(p => p < 9000);
        if (precios.length === 0) continue;
        const precio = Math.min(...precios);

        const availValues = estanciaDays
            .map(d => d.avail)
            .filter((a): a is number => a !== undefined);

        const disponibles = availValues.length > 0 ? Math.min(...availValues) : 1;

        resultado.push({
            id: room.id,
            name: room.name,
            shortname: room.shortname,
            occupancy: room.occupancy,
            price: precio,
            availableRooms: disponibles,
        });
    }

    return resultado.sort((a, b) => a.price - b.price);
}

// ── Utilidad ──────────────────────────────────────────────
function calcularNoches(entrada: string, salida: string): number {
    const ms = new Date(salida).getTime() - new Date(entrada).getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}