import { query } from './database';

// ─────────────────────────────────────────────────────────
// 1. TIPOS DE HABITACIÓN disponibles en el hotel
// ─────────────────────────────────────────────────────────
export async function getTiposHabitacion(idHotel: number) {
  return query(`
    SELECT 
      th.intIdTipoHabitacion,
      th.strNombreTipo,
      th.strClaveTipo,
      COUNT(h.intIdHabitacion) AS totalHabitaciones
    FROM tbTiposHabitacion th
    INNER JOIN tbHabitaciones h 
      ON h.intIdTipoHabitacion = th.intIdTipoHabitacion
      AND h.intIdHotel = th.intIdHotel
    WHERE th.intIdHotel = @idHotel
      AND th.strStatus = 'A'
      AND h.strStatus = 'A'
    GROUP BY 
      th.intIdTipoHabitacion,
      th.strNombreTipo,
      th.strClaveTipo
    ORDER BY th.strNombreTipo
  `, { idHotel });
}

// ─────────────────────────────────────────────────────────
// 2. DISPONIBILIDAD por tipo y rango de fechas
// ─────────────────────────────────────────────────────────
export async function getDisponibilidad(
  idHotel: number,
  fechaEntrada: string,   // 'YYYY-MM-DD'
  fechaSalida: string     // 'YYYY-MM-DD'
) {
  return query(`
    SELECT 
      th.intIdTipoHabitacion,
      th.strNombreTipo,
      th.strClaveTipo,
      COUNT(DISTINCT h.intIdHabitacion) AS totalHabitaciones,
      COUNT(DISTINCT rh.intIdHabitacion) AS habitacionesOcupadas,
      COUNT(DISTINCT h.intIdHabitacion) 
        - COUNT(DISTINCT rh.intIdHabitacion) AS disponibles
    FROM tbTiposHabitacion th
    INNER JOIN tbHabitaciones h 
      ON h.intIdTipoHabitacion = th.intIdTipoHabitacion
      AND h.intIdHotel = th.intIdHotel
      AND h.strStatus = 'A'
    LEFT JOIN tbReservacionesHabitaciones rh 
      ON rh.intIdHabitacion = h.intIdHabitacion
      AND rh.strStatus = 'A'
    LEFT JOIN tbReservaciones r 
      ON r.intIdReservacion = rh.intIdReservacionTipo
      AND r.intIdHotel = @idHotel
      AND r.strStatus = 'A'
      AND r.intFolioCancelacion IS NULL
      AND r.dtmFechaEntrada < @fechaSalida
      AND r.dtmFechaSalida > @fechaEntrada
    WHERE th.intIdHotel = @idHotel
      AND th.strStatus = 'A'
    GROUP BY 
      th.intIdTipoHabitacion,
      th.strNombreTipo,
      th.strClaveTipo
    ORDER BY th.strNombreTipo
  `, { idHotel, fechaEntrada, fechaSalida });
}

// ─────────────────────────────────────────────────────────
// 3. TARIFARIO vigente para un rango de fechas
// ─────────────────────────────────────────────────────────
export async function getTarifasVigentes(
  idHotel: number,
  fechaEntrada: string,
  fechaSalida: string
) {
  return query(`
    SELECT 
      intIdTarifario,
      strNombreTarifa,
      dtmFechaInicio,
      dtmFechaFin,
      strTipoMoneda,
      bolDolarFijo,
      dcmPrecioFijoDolarEnPesos
    FROM tbTarifario
    WHERE intIdHotel = @idHotel
      AND strStatus = 'A'
      AND dtmFechaInicio <= @fechaSalida
      AND dtmFechaFin >= @fechaEntrada
    ORDER BY dtmFechaInicio
  `, { idHotel, fechaEntrada, fechaSalida });
}

// ─────────────────────────────────────────────────────────
// 4. RESUMEN COMPLETO para el agente de voz
//    (disponibilidad + tarifas en una sola llamada)
// ─────────────────────────────────────────────────────────
export async function consultarDisponibilidadCompleta(
  idHotel: number,
  fechaEntrada: string,
  fechaSalida: string
) {
  const [disponibilidad, tarifas, precios] = await Promise.all([
    getDisponibilidad(idHotel, fechaEntrada, fechaSalida),
    getTarifasVigentes(idHotel, fechaEntrada, fechaSalida),
    getPreciosPorTipo(idHotel, fechaEntrada, fechaSalida),
  ]);

  const noches = Math.ceil(
    (new Date(fechaSalida).getTime() - new Date(fechaEntrada).getTime())
    / (1000 * 60 * 60 * 24)
  );

  return {
    hotel: { id: idHotel },
    fechaEntrada,
    fechaSalida,
    noches,
    disponibilidad,
    tarifas,
    precios,
    consultadoEn: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// 5. PRECIOS REALES por tipo de habitación
//    tbTarifario → tbPrecioAdultos → por ocupación
// ─────────────────────────────────────────────────────────
export async function getPreciosPorTipo(
  idHotel: number,
  fechaEntrada: string,
  fechaSalida: string
) {
  return query(`
    SELECT 
      th.strNombreTipo,
      th.strClaveTipo,
      t.strNombreTarifa,
      t.strTipoMoneda,
      pa.intAdulto,
      pa.dcmPrecioAdulto
    FROM tbTarifario t
    INNER JOIN tbPrecioAdultos pa 
      ON pa.intIdTarifario = t.intIdTarifario
    INNER JOIN tbTiposHabitacion th 
      ON th.intIdTipoHabitacion = pa.intIdTipoHabitacion
      AND th.intIdHotel = @idHotel
    WHERE t.intIdHotel = @idHotel
      AND t.strStatus = 'A'
      AND t.dtmFechaInicio <= @fechaSalida
      AND t.dtmFechaFin    >= @fechaEntrada
      AND pa.intAdulto <= 2
      AND t.strNombreTarifa LIKE '%RACK%'
    ORDER BY 
      th.strNombreTipo,
      pa.intAdulto
  `, { idHotel, fechaEntrada, fechaSalida });
}