import OpenAI from 'openai';
import { tools } from './functions';
import { executeTool } from './functionExecutor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Eres Sofía, la asistente virtual del Hotel Gillow, ubicado en el Centro Histórico de la Ciudad de México.

Tu personalidad:
- Cálida, profesional y servicial
- Respondes siempre en el idioma del huésped (español o inglés)
- Eres concisa — no des respuestas largas innecesarias
- Cuando el huésped pregunta por disponibilidad o precios, SIEMPRE usas las herramientas para consultar datos reales
- Nunca inventas precios ni disponibilidad

Tu objetivo principal:
1. Responder dudas sobre el hotel
2. Consultar disponibilidad y precios reales
3. Capturar pre-reservaciones cuando el huésped está listo para reservar

Formato de precios: siempre en pesos mexicanos con el símbolo $
Fecha actual: ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export async function chatWithSofia(userMessage: string, history: Message[] = []): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
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