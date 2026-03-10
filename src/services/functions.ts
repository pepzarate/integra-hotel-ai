import type { ChatCompletionTool } from 'openai/resources';

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Consulta habitaciones disponibles en Wubook para un rango de fechas y número de personas.',
      parameters: {
        type: 'object',
        properties: {
          fecha_entrada: {
            type: 'string',
            description: 'Fecha de entrada en formato YYYY-MM-DD',
          },
          fecha_salida: {
            type: 'string',
            description: 'Fecha de salida en formato YYYY-MM-DD',
          },
          personas: {
            type: 'number',
            description: 'Número de personas (adultos). Default 1.',
          },
        },
        required: ['fecha_entrada', 'fecha_salida'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_room_rates',
      description: 'Obtiene los precios por tipo de habitación para un rango de fechas.',
      parameters: {
        type: 'object',
        properties: {
          fecha_entrada: {
            type: 'string',
            description: 'Fecha de entrada en formato YYYY-MM-DD.',
          },
          fecha_salida: {
            type: 'string',
            description: 'Fecha de salida en formato YYYY-MM-DD.',
          },
          tipo_habitacion: {
            type: 'string',
            description: 'Clave del tipo: IND, DBL, JRS, SU, KS, MS, SNUP. Opcional.',
          },
        },
        required: ['fecha_entrada', 'fecha_salida'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_hotel_info',
      description: 'Devuelve información general del hotel: nombre, dirección, teléfono, sitio web, servicios.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_policies',
      description: 'Devuelve las políticas del hotel: horario de check-in/check-out, cancelaciones, mascotas, etc.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
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
          nombre: {
            type: 'string',
            description: 'Nombre completo del huésped.',
          },
          email: {
            type: 'string',
            description: 'Correo electrónico del huésped.',
          },
          telefono: {
            type: 'string',
            description: 'Teléfono del huésped.',
          },
          tipo_habitacion: {
            type: 'string',
            description: 'Clave del tipo de habitación: IND, DBL, JRS, SU, KS, MS, SNUP.',
          },
          fecha_entrada: {
            type: 'string',
            description: 'Fecha de entrada en formato YYYY-MM-DD.',
          },
          fecha_salida: {
            type: 'string',
            description: 'Fecha de salida en formato YYYY-MM-DD.',
          },
          personas: {
            type: 'number',
            description: 'Número de personas.',
          },
          notas: {
            type: 'string',
            description: 'Notas adicionales del huésped. Opcional.',
          },
        },
        required: ['nombre', 'email', 'telefono', 'tipo_habitacion', 'fecha_entrada', 'fecha_salida', 'personas'],
      },
    },
  },
];