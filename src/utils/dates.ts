export interface DateValidationResult {
    valid: boolean;
    error?: string;
}

export function validateDates(fechaEntrada: string, fechaSalida: string): DateValidationResult {
    // Comparar solo fechas, sin zonas horarias
    const hoyStr = new Date().toISOString().split('T')[0];
    const hoy = new Date(hoyStr + 'T00:00:00');
    const entrada = new Date(fechaEntrada + 'T00:00:00');
    const salida = new Date(fechaSalida + 'T00:00:00');

    if (isNaN(entrada.getTime())) {
        return { valid: false, error: `La fecha de entrada "${fechaEntrada}" no es válida.` };
    }
    if (isNaN(salida.getTime())) {
        return { valid: false, error: `La fecha de salida "${fechaSalida}" no es válida.` };
    }
    if (entrada < hoy) {
        return { valid: false, error: `La fecha de entrada ${fechaEntrada} ya pasó. Por favor elige una fecha futura.` };
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