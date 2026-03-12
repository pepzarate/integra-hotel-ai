export interface DateValidationResult {
    valid: boolean;
    error?: string;
}

export function validateDates(fechaEntrada: string, fechaSalida: string): DateValidationResult {

    // Hora actual en zona de México (UTC-6 estándar / UTC-5 verano)
    // Intl.DateTimeFormat garantiza la zona correcta sin librerías externas
    const ahoraEnMexico = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' })
    );

    const hoyMexStr = ahoraEnMexico.toISOString().split('T')[0];
    // toISOString usa UTC — como ya convertimos a hora México arriba, la fecha es correcta
    const fechaHoyMex = hoyMexStr;
    const horaMex = ahoraEnMexico.getHours();// 0-23 en hora México

    const entrada = new Date(fechaEntrada + 'T00:00:00');
    const salida = new Date(fechaSalida + 'T00:00:00');
    const hoy = new Date(fechaHoyMex + 'T00:00:00');

    if (isNaN(entrada.getTime())) {
        return { valid: false, error: `La fecha de entrada "${fechaEntrada}" no es válida.` };
    }
    if (isNaN(salida.getTime())) {
        return { valid: false, error: `La fecha de salida "${fechaSalida}" no es válida.` };
    }

    // Fecha anterior a hoy → rechazar siempre
    if (entrada < hoy) {
        return { valid: false, error: `La fecha de entrada ${fechaEntrada} ya pasó. Por favor elige una fecha futura.` };
    }

    // Fecha de hoy → permitir solo antes de las 20:00 CDMX
    if (fechaEntrada === fechaHoyMex && horaMex >= 20) {
        return {
            valid: false,
            error: `Lo sentimos, ya no es posible registrar una pre-reservación para hoy — la hora límite de check-in es a las 8:00 pm. Te invitamos a reservar para mañana o a llamarnos directamente al 55 55 18 14 40.`,
        };
    }

    if (salida <= entrada) {
        return { valid: false, error: `La fecha de salida debe ser posterior a la de entrada.` };
    }

    const noches = Math.ceil((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24));
    if (noches > 30) {
        return { valid: false, error: `La estancia máxima es de 30 noches. Tu consulta indica ${noches} noches.` };
    }

    return { valid: true };
}

export function formatDateMX(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function calcularNoches(fechaEntrada: string, fechaSalida: string): number {
    const entrada = new Date(fechaEntrada);
    const salida = new Date(fechaSalida);
    return Math.ceil((salida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24));
}