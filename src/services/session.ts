import { v4 as uuidv4 } from 'uuid';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SESSION_TTL = 1800; // 30 minutos

export interface SessionMessage {
    role: 'user' | 'assistant';
    content: string;
}

export function generateSessionId(): string {
    return uuidv4();
}

export async function getSession(sessionId: string): Promise<SessionMessage[]> {
    try {
        const data = await redis.get<SessionMessage[]>(`session:${sessionId}`);
        return data ?? [];
    } catch {
        return [];
    }
}

export async function saveSession(sessionId: string, messages: SessionMessage[]): Promise<void> {
    try {
        // Mantener máximo 20 mensajes para no crecer indefinidamente
        const trimmed = messages.slice(-20);
        await redis.set(`session:${sessionId}`, trimmed, { ex: SESSION_TTL });
    } catch (err) {
        console.warn('[SESSION] Error al guardar:', err);
    }
}

export async function appendToSession(
    sessionId: string,
    userMessage: string,
    assistantReply: string
): Promise<void> {
    const history = await getSession(sessionId);
    history.push({ role: 'user', content: userMessage });
    history.push({ role: 'assistant', content: assistantReply });
    await saveSession(sessionId, history);
}