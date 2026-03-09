import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const TTL_SEGUNDOS = 300; // 5 minutos

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(key);
    return data ?? null;
  } catch (err) {
    console.warn('[CACHE] Error al leer:', err);
    return null;
  }
}

export async function cacheSet(key: string, value: any): Promise<void> {
  try {
    await redis.set(key, value, { ex: TTL_SEGUNDOS });
  } catch (err) {
    console.warn('[CACHE] Error al escribir:', err);
  }
}

export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}