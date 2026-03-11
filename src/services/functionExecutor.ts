import { validateDates } from '../utils/dates';
import { insertPrereservacion } from './ownDb';


export async function executeTool(name: string, args: any): Promise<string> {
  console.log(`[TOOL] Ejecutando: ${name}`, args);

  switch (name) {

    case 'check_availability': {
      const { fecha_entrada, fecha_salida, personas = 1 } = args;

      const validation = validateDates(fecha_entrada, fecha_salida);
      if (!validation.valid) return validation.error!;

      try {
        const { fetchAvailability } = await import('./wubook');
        const habitaciones = await fetchAvailability(fecha_entrada, fecha_salida, personas);

        if (habitaciones.length === 0) {
          return `No hay habitaciones disponibles para ${personas} persona(s) del ${fecha_entrada} al ${fecha_salida}. Te recomendamos consultar otras fechas o contactarnos directamente al 55 55 18 14 40.`;
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
        return `En este momento tenemos un problema técnico para consultar disponibilidad en línea. Por favor contáctanos directamente:\n\n📞 55 55 18 14 40\n✉️ reservaciones@hotelgillow.com\n\nCon gusto te atendemos.`;
      }
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