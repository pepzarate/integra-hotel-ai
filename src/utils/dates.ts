export interface DateValidationResult {
    valid: boolean;
    error?: string;
}

export function validateDates(fechaEntrada: string, fechaSalida: string): DateValidationResult {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const entrada = new Date(fechaEntrada);
    const salida = new Date(fechaSalida);

    // Validar formato
    if (isNaN(entrada.getTime())) {
        return { valid: false, error: `La fecha de entrada "${fechaEntrada}" no es válida.` };
    }
    if (isNaN(salida.getTime())) {
        return { valid: false, error: `La fecha de salida "${fechaSalida}" no es válida.` };
    }

    // Validar que entrada no sea en el pasado
    if (entrada < hoy) {
        return { valid: false, error: `La fecha de entrada ${fechaEntrada} ya pasó. Por favor elige una fecha futura.` };
    }

    // Validar que salida sea posterior a entrada
    if (salida <= entrada) {
        return { valid: false, error: `La fecha de salida debe ser posterior a la de entrada.` };
    }

    // Validar máximo 30 noches
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