import { validateDates } from '../utils/dates';
import { insertPrereservacion } from './ownDb';
import { sendPrereservacionEmail } from './email';

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
          return `No hay habitaciones disponibles para ${personas} persona(s) del ${fecha_entrada} al ${fecha_salida}. Te recomendamos consultar otras fechas o contactarnos directamente al 📞 (+52) 664 380 2830.`;
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
        return `En este momento tenemos un problema técnico para consultar disponibilidad en línea. Por favor contáctanos directamente:\n\n📞 (+52) 664 380 2830\n✉️ hotelfrontieretijuana@gmail.com\n\nCon gusto te atendemos.`;
      }
    }

    case 'get_hotel_info': {
      return JSON.stringify({
        nombre: 'Hotel Frontiere',
        direccion: 'Blvd. Gustavo Díaz Ordaz 13228, El Prado, 22105 Tijuana, B.C.',
        telefono: '(+52) 664 380 2830',
        email: 'hotelfrontieretijuana@gmail.com',
        sitio_web: 'hotelfrontiere.com',
        descripcion: 'Hotel 3 estrellas con ubicación privilegiada en Zona Río, Tijuana. Mejor tarifa garantizada — reserva directamente sin intermediarios.',
        servicios: [
          'WiFi gratuito',
          'Restaurante',
          'Estacionamiento',
          'Caja de seguridad',
          'Habitaciones reformadas',
          'A/C y calefacción',
          'Room service',
        ],
        distancias: {
          'Hospital del Prado': '3 min',
          'Estadio Caliente (Xolos)': '4 min',
          'Plazas 5 y 10': '7 min',
          'Plaza Río': '10 min',
          'Hospital General': '10 min',
          'Hospital Los Ángeles': '10 min',
          'Centro / Revolución': '15 min',
          'Aeropuerto Internacional de Tijuana': '14 min',
          'Garita San Isidro': '15 min',
          'Garita Otay': '13 min',
        },
      });
    }

    case 'get_policies': {
      return JSON.stringify({
        check_in: '15:00 hrs',
        check_out: '12:00 hrs',
        early_check_in: 'Sujeto a disponibilidad, sin costo adicional',
        late_check_out: 'Sujeto a disponibilidad, puede tener cargo adicional',
        cancelacion: 'Cancelación gratuita en cualquier momento, sin penalidades',
        mascotas: 'No se permiten mascotas',
        fumadores: 'Consultar en recepción',
        formas_pago: ['Efectivo', 'Tarjeta de crédito', 'Tarjeta de débito', 'Transferencia'],
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
        const noches = Math.ceil(
          (new Date(args.fecha_salida).getTime() - new Date(args.fecha_entrada).getTime()) / 86400000
        );
        // Notificar al recepcionista — fallo silencioso para no afectar la respuesta al huésped
        try {
          await sendPrereservacionEmail({
            folio: registro.folio,
            nombre: args.nombre,
            email: args.email,
            telefono: args.telefono,
            tipo_habitacion: args.tipo_habitacion,
            fecha_entrada: args.fecha_entrada,
            fecha_salida: args.fecha_salida,
            noches,
            personas: args.personas,
            notas: args.notas,
          });
        } catch (emailErr: any) {
          // El email falló pero la pre-reservación ya está guardada — solo logueamos
          console.error(`[EMAIL] Error al enviar notificación — ${folio}:`, emailErr.message);
        }
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