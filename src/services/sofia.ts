import OpenAI from 'openai';
import { tools } from './functions';
import { executeTool } from './functionExecutor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  * Hospital del Prado: 3 min
  * Estadio Caliente (Xolos): 4 min
  * Plazas 5 y 10: 7 min
  * Plaza Río: 10 min
  * Hospitales General y Los Ángeles: 10 min
  * Centro / Revolución: 15 min
  * Aeropuerto Internacional de Tijuana: 14 min
  * Garita San Isidro (cruce fronterizo): 15 min
  * Garita Otay (cruce fronterizo): 13 min

Políticas:
- Check-in: 15:00 hrs | Check-out: 12:00 hrs
- Cancelación gratuita en cualquier momento, sin penalidades
- No se aceptan mascotas

Fecha actual: ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Tijuana' })}
`;

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export async function chatWithSofia(userMessage: string, history: Message[] = []): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: getSystemPrompt() },
    ...history,
    { role: 'user', content: userMessage },
  ];

  let response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    tools,
    tool_choice: 'auto',
  });

  // Loop de ejecución — Sofía puede llamar múltiples funciones
  while (response.choices[0].finish_reason === 'tool_calls') {
    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);

    // Ejecutar cada función que Sofía pidió
    const toolResults = await Promise.all(
      assistantMessage.tool_calls!
        .filter((toolCall: any) => toolCall.type === 'function')
        .map(async (toolCall: any) => {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeTool(toolCall.function.name, args);
          return {
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: result,
          };
        })
    );

    messages.push(...toolResults);

    // Sofía procesa los resultados y genera respuesta final
    response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto',
    });
  }

  return response.choices[0].message.content ?? 'No pude generar una respuesta.';
}

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

  // Loop — puede haber function calls antes del texto final
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
      finishReason = chunk.choices[0]?.finish_reason || finishReason;
      // Token de texto — enviar al cliente inmediatamente
      if (delta?.content) {
        assistantContent += delta.content;
        fullReply += delta.content;
        onToken(delta.content);
      }

      // Acumular tool calls (llegan fragmentados en el stream)
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!currentToolCalls[tc.index]) {
            currentToolCalls[tc.index] = {
              id: '',
              type: 'function',
              function: { name: '', arguments: '' },
            };
          }
          if (tc.id) currentToolCalls[tc.index].id += tc.id;
          if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
          if (tc.function?.arguments) currentToolCalls[tc.index].function.arguments += tc.function.arguments;
        }
      }
    }

    // Si terminó con texto — salir del loop
    if (finishReason === 'stop') break;

    // Si terminó con tool_calls — ejecutar y continuar
    if (finishReason === 'tool_calls' && currentToolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: currentToolCalls,
      });

      // Ejecutar cada tool
      const toolResults = await Promise.all(
        currentToolCalls.map(async (tc) => {
          const args = JSON.parse(tc.function.arguments);
          const result = await executeTool(tc.function.name, args);
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content: result,
          };
        })
      );

      messages.push(...toolResults);
      // Continuar el loop para que Sofía genere la respuesta final
    } else {
      break;
    }
  }

  return fullReply;
}