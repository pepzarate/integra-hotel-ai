import { consultarDisponibilidadCompleta } from './pms';
import { validateDates } from '../utils/dates';
import { insertPrereservacion } from './ownDb';


const ID_HOTEL = 1; // Hotel Gillow

export async function executeTool(name: string, args: any): Promise<string> {
  console.log(`[TOOL] Ejecutando: ${name}`, args);

  switch (name) {

    case 'check_availability': {
      const validation = validateDates(args.fecha_entrada, args.fecha_salida);
      if (!validation.valid) {
        return JSON.stringify({ error: validation.error });
      }
      const data = await consultarDisponibilidadCompleta(
        ID_HOTEL,
        args.fecha_entrada,
        args.fecha_salida
      );
      const disponibles = (data.disponibilidad as any[]).filter(h => h.disponibles > 0);
      return JSON.stringify({
        fechas: { entrada: args.fecha_entrada, salida: args.fecha_salida, noches: data.noches },
        disponibles,
        mensaje: disponibles.length > 0
          ? `Hay ${disponibles.length} tipos de habitación disponibles`
          : 'No hay habitaciones disponibles para esas fechas',
      });
    }

    case 'get_room_rates': {
      const validation = validateDates(args.fecha_entrada, args.fecha_salida);
      if (!validation.valid) {
        return JSON.stringify({ error: validation.error });
      }
      const data = await consultarDisponibilidadCompleta(
        ID_HOTEL,
        args.fecha_entrada,
        args.fecha_salida
      );
      const precios = args.tipo_habitacion
        ? (data.precios as any[]).filter(p =>
          p.strClaveTipo === args.tipo_habitacion && p.intAdulto === 1
        )
        : (data.precios as any[]).filter(p => p.intAdulto === 1);
      return JSON.stringify({ precios, noches: data.noches });
    }

    case 'get_hotel_info': {
      return JSON.stringify({
        nombre: 'Hotel Gillow',
        direccion: 'Isabel la Católica #17, Centro Histórico, CDMX',
        telefono: '55 55 18 14 40',
        email: 'reservaciones@hotelgillow.com',
        sitio_web: 'www.hotelgillow.com',
        descripcion: 'Hotel boutique en el corazón del Centro Histórico de la Ciudad de México, a pasos del Zócalo.',
        servicios: ['WiFi gratuito', 'Restaurante', 'Bar', 'Servicio a cuartos', 'Estacionamiento', 'Aire acondicionado'],
      });
    }

    case 'get_policies': {
      return JSON.stringify({
        check_in: '15:00 hrs',
        check_out: '12:00 hrs',
        early_check_in: 'Sujeto a disponibilidad, sin costo adicional',
        late_check_out: 'Sujeto a disponibilidad, puede tener cargo',
        cancelacion: 'Cancelación gratuita hasta 24 horas antes de la llegada',
        mascotas: 'No se permiten mascotas',
        fumadores: 'Hotel 100% libre de humo',
        menores: 'Niños bienvenidos, menores de 5 años sin cargo',
        formas_pago: ['Efectivo', 'Tarjeta de crédito', 'Tarjeta de débito'],
      });
    }

    case 'create_prereservation': {
      const folio = `PRE-${Date.now()}`;
      try {
        const registro = await insertPrereservacion({
          folio,
          nombre: args.nombre,
          email: args.email,
          telefono: args.telefono,
          tipo_habitacion: args.tipo_habitacion,
          fecha_entrada: args.fecha_entrada,
          fecha_salida: args.fecha_salida,
          personas: args.personas,
          notas: args.notas,
        });
        console.log(`[PRE-RESERVACIÓN] Guardada en BD — ${folio}`);
        return JSON.stringify({
          folio: registro.folio,
          status: 'confirmada',
          mensaje: 'Pre-reservación registrada exitosamente',
          instrucciones: 'El equipo de reservaciones se pondrá en contacto en menos de 2 horas para confirmar.',
        });
      } catch (err: any) {
        console.error(`[PRE-RESERVACIÓN] Error al guardar:`, err.message);
        return JSON.stringify({
          error: 'No se pudo registrar la pre-reservación',
          detalle: err.message,
        });
      }
    }

    default:
      return JSON.stringify({ error: `Función desconocida: ${name}` });
  }
}