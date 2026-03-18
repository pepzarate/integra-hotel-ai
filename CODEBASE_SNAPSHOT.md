# CODEBASE_SNAPSHOT.md
**Integra Hotel AI — Agente de Chat Sofía**
Versión: 2.0 — 14 de marzo 2026

> Este documento captura los fragmentos de código más importantes del proyecto: las estructuras base, configuraciones críticas y componentes clave. No es una copia del código fuente — es una referencia de las decisiones de implementación que importan. Útil para onboarding, revisiones de arquitectura y continuidad del proyecto.

---

## Índice

1. [Servidor principal — index.ts](#1-servidor-principal--indexts)
2. [Agente Sofía — system prompt v2](#2-agente-sofía--system-prompt-v2)
3. [Streaming con function calling — streamWithSofia](#3-streaming-con-function-calling--streamwithsofia)
4. [Schemas de tools — functions.ts](#4-schemas-de-tools--functionsts)
5. [Ejecutor de herramientas — functionExecutor.ts](#5-ejecutor-de-herramientas--functionexecutorts)
6. [Conector Wubook — wubook.ts](#6-conector-wubook--wubooks)
7. [Notificaciones email — email.ts](#7-notificaciones-email--emailts)
8. [Caché Redis — cache.ts](#8-caché-redis--cachets)
9. [Sesiones Redis — session.ts](#9-sesiones-redis--sessionts)
10. [Base de datos propia — ownDb.ts](#10-base-de-datos-propia--owndbs)
11. [Validación de fechas — dates.ts](#11-validación-de-fechas--datests)
12. [Widget — renderAvatar y sugerencias rápidas](#12-widget--renderavatar-y-sugerencias-rápidas)
13. [Widget — embed.js configuración](#13-widget--embedjs-configuración)
14. [Middlewares](#14-middlewares)
15. [Variables de entorno — .env.example](#15-variables-de-entorno--envexample)

---

## 1. Servidor principal — index.ts

**¿Para qué sirve?**
Punto de entrada del sistema. Configura Express, monta middlewares, define las rutas y arranca el servidor. Decisiones clave: `dotenv.config()` primera línea absoluta, CORS por lista de dominios, CORP para archivos del widget, `requireAdminToken` en rutas protegidas, y `0.0.0.0` como host para compatibilidad con Railway.

**Configuración de middlewares:**
```typescript
import dotenv from 'dotenv';
dotenv.config(); // ← PRIMERA LÍNEA — antes de cualquier import

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

const app = express();

// CORS restringido por dominio — no abierto globalmente
const ALLOWED_ORIGINS = [
  'https://integra-hotel-ai-production.up.railway.app',
  'http://localhost:3000',
  'https://hotelfrontiere.com',
  'https://www.hotelfrontiere.com',
  // Agregar dominio de cada nuevo hotel aquí
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl, Postman, server-to-server
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para origen: ${origin}`));
  },
}));

// CSP desactivado para /widget — necesario para Google Fonts
app.use((req, res, next) => {
  if (req.path.startsWith('/widget')) {
    helmet({ contentSecurityPolicy: false })(req, res, next);
  } else {
    helmet()(req, res, next);
  }
});

app.use(morgan('dev'));
app.use(express.json());

// CORP cross-origin para /widget — permite carga de embed.js desde sitios externos
// Sin esto, Railway bloquea la carga con ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
app.use('/widget', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../widget')));
```

**Middleware de autenticación admin:**
```typescript
function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  next();
}

// Endpoint protegido
app.get('/prereservaciones', requireAdminToken, wrap(async (req, res) => {
  const registros = await getPrereservaciones();
  res.json({ total: registros.length, registros });
}));
```

**Endpoint SSE — núcleo del streaming:**
```typescript
app.get('/chat/stream', async (req, res) => {
  const { message, session_id } = req.query as Record<string, string>;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sessionId = session_id || generateSessionId();
  const history = await getSession(sessionId);

  try {
    const { streamWithSofia } = await import('./services/sofia');
    const reply = await streamWithSofia(message, history, (token) => {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    });
    await appendToSession(sessionId, message, reply);
    res.write(`data: ${JSON.stringify({ done: true, session_id: sessionId })}\n\n`);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: 'No pude procesar tu mensaje' })}\n\n`);
  } finally {
    res.end();
  }
});
```

**Arranque del servidor — escucha en 0.0.0.0 para Railway:**
```typescript
const PORT = process.env.PORT || 3000;

// 0.0.0.0 requerido — sin esto Railway no puede alcanzar el servidor (502)
app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`\n✓ Integra Hotel AI corriendo en http://localhost:${PORT}`);
  try {
    const { loadRoomCatalog } = await import('./services/wubook');
    await loadRoomCatalog();
  } catch (err) {
    console.warn(`  ⚠ Wubook: no se pudo cargar el catálogo — ${err}`);
  }
  await initDb();
  console.log(`  ✓ Listo\n`);
});
```

---

## 2. Agente Sofía — system prompt v2

**¿Para qué sirve?**
Define la personalidad de Sofía y las reglas de comportamiento. El system prompt v2 incluye instrucciones de concisión, una pregunta a la vez, datos reales del Hotel Frontiere y fecha en zona `America/Tijuana`. Cualquier cambio aquí afecta todas las conversaciones activas.

```typescript
const getSystemPrompt = () => `Eres Sofía, la asistente virtual del Hotel Frontiere, ubicado en Tijuana, Baja California.

Tu personalidad:
- Amable, profesional y eficiente
- Respondes en el idioma del huésped (español o inglés)
- Eres concisa — máximo 3 líneas por respuesta a menos que el huésped pida detalles
- Haces solo UNA pregunta a la vez — nunca lances dos preguntas en el mismo mensaje
- Cuando el huésped pregunta por disponibilidad o precios, SIEMPRE usas las herramientas para consultar datos reales
- NUNCA inventes precios, disponibilidad ni políticas — usa siempre las herramientas disponibles
- Cuando el huésped confirme que desea reservar, llama a create_prereservation UNA SOLA VEZ

El hotel:
- Hotel Frontiere es un hotel 3 estrellas con ubicación privilegiada en Zona Río, Tijuana
- Mejor tarifa garantizada — sin intermediarios
- Servicios: WiFi gratuito, restaurante, estacionamiento, caja de seguridad, A/C y calefacción, room service, habitaciones reformadas
- Distancias clave desde el hotel (en vehículo):
  * Hospital del Prado: 3 min | Estadio Caliente (Xolos): 4 min
  * Plazas 5 y 10: 7 min | Plaza Río: 10 min
  * Aeropuerto Internacional de Tijuana: 14 min
  * Garita San Isidro: 15 min | Garita Otay: 13 min

Políticas:
- Check-in: 15:00 hrs | Check-out: 12:00 hrs
- Cancelación gratuita en cualquier momento, sin penalidades
- No se aceptan mascotas

Fecha actual: ${new Date().toLocaleDateString('es-MX', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  timeZone: 'America/Tijuana'  // ← zona horaria del hotel
})}
`;
```

---

## 3. Streaming con function calling — streamWithSofia

**¿Para qué sirve?**
Versión streaming del agente. El desafío técnico principal: en un stream, los tool calls llegan fragmentados en múltiples chunks — hay que acumularlos por índice antes de ejecutarlos.

```typescript
export async function streamWithSofia(
  userMessage: string,
  history: Message[],
  onToken: (token: string) => void
): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: getSystemPrompt() },
    ...history,
    { role: 'user', content: userMessage },
  ];

  let fullReply = '';

  while (true) {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto',
      stream: true,
    });

    let currentToolCalls: any[] = [];
    let assistantContent = '';
    let finishReason = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      finishReason = chunk.choices[0]?.finish_reason ?? '';

      if (delta?.content) {
        assistantContent += delta.content;
        fullReply += delta.content;
        onToken(delta.content); // ← llega al cliente en milisegundos
      }

      // Tool calls llegan fragmentados — acumular índice por índice
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!currentToolCalls[tc.index]) {
            currentToolCalls[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
          }
          if (tc.id) currentToolCalls[tc.index].id += tc.id;
          if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
          if (tc.function?.arguments) currentToolCalls[tc.index].function.arguments += tc.function.arguments;
        }
      }
    }

    if (finishReason === 'stop') break;

    if (finishReason === 'tool_calls' && currentToolCalls.length > 0) {
      messages.push({ role: 'assistant', content: assistantContent || null, tool_calls: currentToolCalls });
      const toolResults = await Promise.all(
        currentToolCalls.map(async (tc) => {
          const args = JSON.parse(tc.function.arguments);
          const result = await executeTool(tc.function.name, args);
          return { role: 'tool' as const, tool_call_id: tc.id, content: result };
        })
      );
      messages.push(...toolResults);
      // Continuar el loop — Sofía genera respuesta final con los resultados
    } else {
      break;
    }
  }

  return fullReply;
}
```

---

## 4. Schemas de tools — functions.ts

**¿Para qué sirve?**
Define qué herramientas puede usar Sofía. La descripción de cada tool es crítica — es lo que el modelo lee para decidir cuándo usarla.

```typescript
export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Consulta habitaciones disponibles en Wubook para un rango de fechas y número de personas.',
      parameters: {
        type: 'object',
        properties: {
          fecha_entrada: { type: 'string', description: 'Fecha de entrada en formato YYYY-MM-DD' },
          fecha_salida:  { type: 'string', description: 'Fecha de salida en formato YYYY-MM-DD' },
          personas:      { type: 'number', description: 'Número de personas (adultos). Default 1.' },
        },
        required: ['fecha_entrada', 'fecha_salida'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_prereservation',
      description: 'Registra una pre-reservación cuando el huésped confirma que desea reservar.',
      parameters: {
        type: 'object',
        properties: {
          nombre:          { type: 'string', description: 'Nombre completo del huésped.' },
          email:           { type: 'string', description: 'Correo electrónico del huésped.' },
          telefono:        { type: 'string', description: 'Teléfono del huésped.' },
          tipo_habitacion: { type: 'string', description: 'Clave del tipo de habitación.' },
          fecha_entrada:   { type: 'string', description: 'Fecha de entrada en formato YYYY-MM-DD.' },
          fecha_salida:    { type: 'string', description: 'Fecha de salida en formato YYYY-MM-DD.' },
          personas:        { type: 'number', description: 'Número de personas.' },
          notas:           { type: 'string', description: 'Notas adicionales. Opcional.' },
        },
        required: ['nombre', 'email', 'telefono', 'tipo_habitacion', 'fecha_entrada', 'fecha_salida', 'personas'],
      },
    },
  },
  // get_hotel_info y get_policies no tienen parámetros — Sofía los llama sin argumentos
];
```

---

## 5. Ejecutor de herramientas — functionExecutor.ts

**¿Para qué sirve?**
Traduce los nombres de funciones que OpenAI solicita en llamadas reales. Contiene los datos del hotel configurados y la lógica de notificación email. El try/catch en `check_availability` garantiza que un fallo de Wubook nunca llegue al huésped como error técnico.

**check_availability con fallback:**
```typescript
case 'check_availability': {
  const { fecha_entrada, fecha_salida, personas = 1 } = args;
  const validation = validateDates(fecha_entrada, fecha_salida);
  if (!validation.valid) return validation.error!;

  try {
    const { fetchAvailability } = await import('./wubook');
    const habitaciones = await fetchAvailability(fecha_entrada, fecha_salida, personas);

    if (habitaciones.length === 0) {
      return `No hay habitaciones disponibles para ${personas} persona(s) del ${fecha_entrada} al ${fecha_salida}. 
Te recomendamos consultar otras fechas o contactarnos directamente al (+52) 664 380 2830.`;
    }

    const noches = Math.ceil(
      (new Date(fecha_salida).getTime() - new Date(fecha_entrada).getTime()) / 86400000
    );
    const lista = habitaciones.map(h =>
      `- **${h.name}** (${h.occupancy} pax máx): $${h.price.toLocaleString('es-MX')} MXN/noche — ${h.availableRooms} disponible(s)`
    ).join('\n');
    return `Disponibilidad del ${fecha_entrada} al ${fecha_salida} (${noches} noche${noches > 1 ? 's' : ''}) para ${personas} persona(s):\n\n${lista}`;

  } catch (err: any) {
    console.error(`[WUBOOK] Error al consultar disponibilidad:`, err.message);
    return `En este momento tenemos un problema técnico. Por favor contáctanos directamente:\n\n📞 (+52) 664 380 2830\n✉️ hotelfrontieretijuana@gmail.com`;
  }
}
```

**create_prereservation con email:**
```typescript
case 'create_prereservation': {
  const folio = `PRE-${Date.now()}`;
  try {
    const registro = await insertPrereservacion({ folio, ...args });
    console.log(`[PRE-RESERVACIÓN] Guardada en BD — ${folio}`);

    // Calcular noches para el email
    const noches = Math.ceil(
      (new Date(args.fecha_salida).getTime() - new Date(args.fecha_entrada).getTime()) / 86400000
    );

    // Notificar al recepcionista — fallo silencioso para no afectar la respuesta al huésped
    try {
      await sendPrereservacionEmail({
        folio: registro.folio,
        nombre: args.nombre, email: args.email, telefono: args.telefono,
        tipo_habitacion: args.tipo_habitacion,
        fecha_entrada: args.fecha_entrada, fecha_salida: args.fecha_salida,
        noches, personas: args.personas, notas: args.notas,
      });
    } catch (emailErr: any) {
      console.error(`[EMAIL] Error al enviar notificación — ${folio}:`, emailErr.message);
    }

    return JSON.stringify({
      folio: registro.folio,
      status: 'confirmada',
      instrucciones: 'El equipo de reservaciones se pondrá en contacto en menos de 2 horas.',
    });
  } catch (err: any) {
    return JSON.stringify({ error: 'No se pudo registrar la pre-reservación', detalle: err.message });
  }
}
```

**Datos del hotel — get_hotel_info:**
```typescript
case 'get_hotel_info': {
  return JSON.stringify({
    nombre: 'Hotel Frontiere',
    direccion: 'Blvd. Gustavo Díaz Ordaz 13228, El Prado, 22105 Tijuana, B.C.',
    telefono: '(+52) 664 380 2830',
    email: 'hotelfrontieretijuana@gmail.com',
    sitio_web: 'hotelfrontiere.com',
    descripcion: 'Hotel 3 estrellas en Zona Río, Tijuana. Mejor tarifa garantizada — reserva directamente sin intermediarios.',
    servicios: ['WiFi gratuito', 'Restaurante', 'Estacionamiento', 'Caja de seguridad', 'Habitaciones reformadas', 'A/C y calefacción', 'Room service'],
    distancias: {
      'Hospital del Prado': '3 min', 'Estadio Caliente (Xolos)': '4 min',
      'Plazas 5 y 10': '7 min', 'Plaza Río': '10 min',
      'Aeropuerto Internacional de Tijuana': '14 min',
      'Garita San Isidro': '15 min', 'Garita Otay': '13 min',
    },
  });
}
```

---

## 6. Conector Wubook — wubook.ts

**¿Para qué sirve?**
Conecta con el channel manager via XML-RPC. La novedad de la Sesión 7: agrupación de variantes de ocupación para evitar mostrar "Doble 3 pax" y "Doble 4 pax" cuando el huésped pide 3 personas.

**Consulta y agrupación de variantes:**
```typescript
export async function fetchAvailability(
  fechaEntrada: string,
  fechaSalida: string,
  personas: number = 1
): Promise<RoomAvailability[]> {
  if (!catalogLoaded) await loadRoomCatalog();

  const key = cacheKey(`wubook:avail:${LCODE}:${fechaEntrada}:${fechaSalida}`);
  const cached = await cacheGet<Record<string, WubookDayValue[]>>(key);
  let roomValues = cached ?? await fetchFromWubook(fechaEntrada, fechaSalida);
  if (!cached) await cacheSet(key, roomValues, 900);

  const noches = calcularNoches(fechaEntrada, fechaSalida);
  const resultado: RoomAvailability[] = [];

  for (const room of roomCatalog) {
    if (room.occupancy < personas) continue;

    const days = roomValues[room.id.toString()];
    if (!days || days.length === 0) continue;

    const estanciaDays = days.slice(0, noches);
    if (estanciaDays.some(d => d.closed === 1)) continue;

    const precios = estanciaDays.map(d => d.price).filter(p => p < 9000);
    if (precios.length === 0) continue;

    const availValues = estanciaDays.map(d => d.avail).filter((a): a is number => a !== undefined);
    const disponibles = availValues.length > 0 ? Math.min(...availValues) : 1;

    resultado.push({
      id: room.id, name: room.name, shortname: room.shortname,
      occupancy: room.occupancy, price: Math.min(...precios), availableRooms: disponibles,
    });
  }

  // Agrupar variantes del mismo tipo — mostrar solo la de menor ocupación que satisfaga la búsqueda
  // Wubook crea variantes con nombres como "Doble Twin Superior 3 pax" y "Doble Twin Superior 4 pax"
  const mejorPorNombreBase = new Map<string, RoomAvailability>();
  for (const room of resultado) {
    const nombreBase = room.name.replace(/\s+\d+\s*pax$/i, '').trim(); // ← regex clave
    const existente = mejorPorNombreBase.get(nombreBase);
    if (!existente || room.occupancy < existente.occupancy) {
      mejorPorNombreBase.set(nombreBase, room);
    }
  }

  return Array.from(mejorPorNombreBase.values()).sort((a, b) => a.price - b.price);
}
```

---

## 7. Notificaciones email — email.ts

**¿Para qué sirve?**
Envía un email HTML al recepcionista del hotel al capturar cada pre-reservación. Archivo nuevo de la Sesión 7.

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface PrereservacionEmailData {
  folio: string;
  nombre: string; email: string; telefono: string;
  tipo_habitacion: string;
  fecha_entrada: string; fecha_salida: string;
  noches: number; personas: number; notas?: string;
}

export async function sendPrereservacionEmail(data: PrereservacionEmailData): Promise<void> {
  const destinatario = process.env.HOTEL_NOTIFY_EMAIL;
  if (!destinatario) {
    console.warn('[EMAIL] HOTEL_NOTIFY_EMAIL no configurado — se omite notificación');
    return;
  }

  const { error } = await resend.emails.send({
    from: 'Sofía — Integra Hotel AI <onboarding@resend.dev>', // sandbox — cambiar al verificar dominio
    to: destinatario,
    subject: `🏨 Nueva pre-reservación ${data.folio} — ${data.nombre}`,
    html: buildEmailHtml(data),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  console.log(`[EMAIL] Notificación enviada — ${data.folio} → ${destinatario}`);
}
```

**Template HTML simplificado:**
```typescript
function buildEmailHtml(data: PrereservacionEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;">
      <div style="background:linear-gradient(135deg,#b8312f,#3e3e3e);padding:24px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;">Nueva Pre-Reservación</h1>
      </div>
      <div style="background:white;padding:24px;border:1px solid #eee;border-radius:0 0 12px 12px;">
        <p><strong>Folio:</strong> ${data.folio}</p>
        <p><strong>Nombre:</strong> ${data.nombre}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Teléfono:</strong> ${data.telefono}</p>
        <p><strong>Habitación:</strong> ${data.tipo_habitacion}</p>
        <p><strong>Check-in:</strong> ${data.fecha_entrada} | <strong>Check-out:</strong> ${data.fecha_salida}</p>
        <p><strong>Noches / Personas:</strong> ${data.noches} noches · ${data.personas} personas</p>
        ${data.notas ? `<p><strong>Notas:</strong> ${data.notas}</p>` : ''}
        <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
        <p style="color:#999;font-size:12px;">Generado por Sofía · Integra Hotel AI — Pre-reservación pendiente de confirmación.</p>
      </div>
    </div>
  `;
}
```

---

## 8. Caché Redis — cache.ts

**¿Para qué sirve?**
Abstracción sobre Upstash Redis REST API. El patrón cache-aside se implementa en los servicios — `cache.ts` solo provee los primitivos.

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function cacheGet<T>(key: string): Promise<T | null> {
  return await redis.get<T>(key) ?? null;
}

export async function cacheSet(key: string, value: any, ttl = 300): Promise<void> {
  await redis.set(key, value, { ex: ttl });
}

export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}
```

---

## 9. Sesiones Redis — session.ts

**¿Para qué sirve?**
Mantiene el historial de conversación entre requests. El límite de 20 mensajes evita exceder el context window de OpenAI.

```typescript
const SESSION_TTL  = 1800; // 30 minutos
const MAX_MESSAGES = 20;

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export async function getSession(sessionId: string): Promise<Message[]> {
  const data = await cacheGet<Message[]>(`session:${sessionId}`);
  return data ?? [];
}

export async function appendToSession(
  sessionId: string,
  userMessage: string,
  assistantReply: string
): Promise<void> {
  const history = await getSession(sessionId);
  history.push(
    { role: 'user',      content: userMessage    },
    { role: 'assistant', content: assistantReply },
  );
  const trimmed = history.length > MAX_MESSAGES
    ? history.slice(history.length - MAX_MESSAGES)
    : history;
  await cacheSet(`session:${sessionId}`, trimmed, SESSION_TTL);
}
```

---

## 10. Base de datos propia — ownDb.ts

**¿Para qué sirve?**
Gestiona la tabla `prereservaciones` en PostgreSQL Neon. Decisiones clave: `split('T')[0]` al insertar para evitar desplazamiento UTC, y `TO_CHAR` al leer para formato limpio.

```typescript
export async function initDb(): Promise<void> {
  await queryOwn(`
    CREATE TABLE IF NOT EXISTS prereservaciones (
      id               SERIAL PRIMARY KEY,
      folio            VARCHAR(50)  UNIQUE NOT NULL,
      nombre           VARCHAR(255) NOT NULL,
      email            VARCHAR(255) NOT NULL,
      telefono         VARCHAR(50)  NOT NULL,
      tipo_habitacion  VARCHAR(50)  NOT NULL,
      fecha_entrada    DATE         NOT NULL,
      fecha_salida     DATE         NOT NULL,
      personas         INTEGER      NOT NULL,
      notas            TEXT,
      status           VARCHAR(50)  NOT NULL DEFAULT 'pendiente',
      fecha_prereservacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  console.log('  ✓ Tabla prereservaciones lista');
}

export async function insertPrereservacion(data: PrereservacionData): Promise<any> {
  const rows = await queryOwn(
    `INSERT INTO prereservaciones 
     (folio, nombre, email, telefono, tipo_habitacion, fecha_entrada, fecha_salida, personas, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      data.folio, data.nombre, data.email, data.telefono, data.tipo_habitacion,
      data.fecha_entrada.split('T')[0],  // ← fix UTC — solo fecha sin hora
      data.fecha_salida.split('T')[0],   // ← fix UTC — solo fecha sin hora
      data.personas, data.notas || null,
    ]
  );
  return rows[0];
}

export async function getPrereservaciones(): Promise<any[]> {
  return queryOwn(`
    SELECT
      id, folio, nombre, email, telefono, tipo_habitacion, personas,
      TO_CHAR(fecha_entrada, 'YYYY-MM-DD') AS fecha_entrada,
      TO_CHAR(fecha_salida,  'YYYY-MM-DD') AS fecha_salida,
      notas, status,
      TO_CHAR(fecha_prereservacion AT TIME ZONE 'America/Mexico_City',
              'YYYY-MM-DD HH24:MI:SS') AS fecha_prereservacion
    FROM prereservaciones
    ORDER BY fecha_prereservacion DESC
    LIMIT 50
  `);
}
```

---

## 11. Validación de fechas — dates.ts

**¿Para qué sirve?**
Valida las fechas antes de enviarlas a Wubook. La versión 2 agrega soporte para reservaciones el mismo día antes de las 20:00 hora Tijuana, usando `Intl.DateTimeFormat` para evitar el bug de zona horaria UTC.

```typescript
export interface DateValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDates(
  fechaEntrada: string,
  fechaSalida: string,
  _testHora?: number  // solo para pruebas — no usar en producción
): DateValidationResult {

  // Hora actual en zona del hotel — Intl evita el bug de UTC
  const ahoraEnMexico = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Tijuana' })
  );

  const fechaHoyMex = ahoraEnMexico.toISOString().split('T')[0];
  const horaMex = _testHora !== undefined ? _testHora : ahoraEnMexico.getHours();

  const entrada = new Date(fechaEntrada + 'T00:00:00');
  const salida  = new Date(fechaSalida  + 'T00:00:00');
  const hoy     = new Date(fechaHoyMex  + 'T00:00:00');

  if (isNaN(entrada.getTime()))
    return { valid: false, error: `La fecha de entrada "${fechaEntrada}" no es válida.` };
  if (isNaN(salida.getTime()))
    return { valid: false, error: `La fecha de salida "${fechaSalida}" no es válida.` };

  // Fecha anterior a hoy → siempre rechazar
  if (entrada < hoy)
    return { valid: false, error: `La fecha de entrada ${fechaEntrada} ya pasó. Por favor elige una fecha futura.` };

  // Mismo día → permitir solo antes de las 20:00 hora Tijuana
  if (fechaEntrada === fechaHoyMex && horaMex >= 20)
    return { valid: false, error: `Lo sentimos, ya no es posible registrar una pre-reservación para hoy — la hora límite es a las 8:00 pm. Llámanos al (+52) 664 380 2830.` };

  if (salida <= entrada)
    return { valid: false, error: `La fecha de salida debe ser posterior a la de entrada.` };

  const noches = Math.ceil((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24));
  if (noches > 30)
    return { valid: false, error: `La estancia máxima es de 30 noches. Tu consulta indica ${noches} noches.` };

  return { valid: true };
}
```

---

## 12. Widget — renderAvatar y sugerencias rápidas

**¿Para qué sirve?**
Dos mejoras de la Sesión 8: `renderAvatar` hace el avatar configurable (URL o emoji) sin tocar código, y las sugerencias rápidas reducen la fricción del primer mensaje.

**renderAvatar — detecta URL vs emoji:**
```javascript
function renderAvatar(el) {
  if (CONFIG.avatar.startsWith('http')) {
    // Avatar con imagen del hotel — favicon u otro logo
    const img = document.createElement('img');
    img.src = CONFIG.avatar;
    img.style.cssText = 'width:24px;height:24px;border-radius:50%;object-fit:cover;';
    el.appendChild(img);
  } else {
    // Fallback a emoji
    el.textContent = CONFIG.avatar;
  }
}

// Se llama después de inyectar el HTML del widget:
renderAvatar(document.getElementById('sofia-header-avatar'));

// Y en cada mensaje de Sofía:
const avatar = document.createElement('div');
avatar.className = 'sofia-msg-avatar';
renderAvatar(avatar); // ← un solo punto de renderizado
```

**CSS del avatar de mensajes — fondo blanco:**
```css
/* Fondo blanco en lugar de gradiente — da protagonismo al favicon del hotel */
.sofia-msg-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: #ffffff;
  border: 1.5px solid #e8e8e8;  /* borde sutil para que no se pierda en el fondo claro */
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
}
```

**Sugerencias rápidas:**
```javascript
function initSuggestions() {
  const container = document.getElementById('sofia-suggestions');
  if (!container) return;

  container.querySelectorAll('.sofia-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('sofia-input');
      // Limpiar emoji del inicio del texto del botón
      input.value = btn.textContent.replace(/^[^\w¿]+/, '').trim();
      hideSuggestions();
      sendMessage();
    });
  });
}

function hideSuggestions() {
  const container = document.getElementById('sofia-suggestions');
  if (container) container.classList.add('hidden');
}

// En toggleWidget — mostrar sugerencias la primera vez:
if (isOpen && !initialized) {
  initialized = true;
  appendMessage('sofia', CONFIG.welcomeMsg);
  document.getElementById('sofia-input').focus();
  initSuggestions(); // ← inicializar listeners
}

// En sendMessage — ocultar al enviar cualquier mensaje:
hideSuggestions();
input.value = '';
```

**CSS de sugerencias:**
```css
#sofia-suggestions { padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 8px; background: #fff; border-top: 1px solid #E8F0F8; }
#sofia-suggestions.hidden { display: none; }
.sofia-suggestion-btn { background: #F0F6FC; border: 1.5px solid #D0E4F0; border-radius: 20px; padding: 7px 14px; font-size: 13px; color: #b8312f; cursor: pointer; white-space: nowrap; }
.sofia-suggestion-btn:hover { background: #daeeff; border-color: #b8312f; }
```

---

## 13. Widget — embed.js configuración

**¿Para qué sirve?**
La interfaz pública del widget. El hotel configura `window.SofiaConfig` con sus datos y `embed.js` inyecta CSS, HTML y JS en el documento. El parámetro `avatar` ahora acepta URL o emoji.

**Instalación Hotel Frontiere:**
```html
<script>
  window.SofiaConfig = {
    backendUrl:   'https://integra-hotel-ai-production.up.railway.app',
    hotelName:    'Hotel Frontiere',
    primaryColor: '#b8312f',
    darkColor:    '#3e3e3e',
    avatar:       'https://content.app-sources.com/s/33999217963244997/uploads/svg/FAVICON-9287264.ico',
  };
</script>
<script src="https://integra-hotel-ai-production.up.railway.app/widget/embed.js"></script>
```

**Configuración por defecto en embed.js:**
```javascript
const CONFIG = Object.assign({
  backendUrl:   'https://integra-hotel-ai-production.up.railway.app',
  hotelName:    'Hotel Frontiere',
  primaryColor: '#b8312f',
  darkColor:    '#3e3e3e',
  avatar:       'https://content.app-sources.com/s/33999217963244997/uploads/svg/FAVICON-9287264.ico',
  welcomeMsg:   null,
}, window.SofiaConfig || {});

CONFIG.welcomeMsg = CONFIG.welcomeMsg ||
  `¡Hola! Soy Sofía 👋 Estoy aquí para ayudarte con disponibilidad, precios y reservaciones del ${CONFIG.hotelName}. ¿En qué puedo ayudarte?`;
```

**Header del widget con avatar dinámico:**
```javascript
// En el HTML inyectado, el avatar del header es un div vacío:
// <div class="sofia-avatar" id="sofia-header-avatar"></div>

// Después de inyectar el HTML, se renderiza el avatar:
renderAvatar(document.getElementById('sofia-header-avatar'));
```

---

## 14. Middlewares

**asyncWrapper.ts — elimina try/catch en cada ruta:**
```typescript
import { Request, Response, NextFunction } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export function wrap(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

**errorHandler.ts — respuesta JSON consistente para todos los errores:**
```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[ERROR]', err.message);
  res.status(500).json({
    error: err.message || 'Error interno del servidor',
    timestamp: new Date().toISOString(),
  });
}
```

---

## 15. Variables de entorno — .env.example

```env
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Wubook
WUBOOK_TOKEN=wr_...
WUBOOK_LCODE=1234567890

# Redis — Upstash (pegar SIN comillas — las comillas se tratan como parte del valor)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# PostgreSQL — Neon
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Email — Resend
RESEND_API_KEY=re_...
HOTEL_NOTIFY_EMAIL=recepcion@hotel.com

# Admin — protege el endpoint /prereservaciones
ADMIN_TOKEN=tu-token-seguro-aqui

# Servidor (no agregar en Railway — se inyecta automáticamente como PORT=8080)
PORT=3000
```

> **Nota Railway:** Las variables se copian sin comillas. `UPSTASH_REDIS_REST_URL="https://..."` rompe la conexión — el cliente Redis recibe `""https://...""`  como URL inválida.

---

*Última actualización: Sesión 8 — 14 de marzo 2026*
