import { Redis } from '@upstash/redis'

// Fail fast if Redis credentials are missing — never silently fall back
// to a dummy URL, which would cause all heartbeats to fail silently
// and show every device as offline.
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error(
    '[Redis] FATAL: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set. ' +
    'Device heartbeats will not work without Redis.'
  )
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function rateLimitAction(userId: string, actionName: string, maxRequests: number = 30, windowSeconds: number = 60): Promise<boolean> {
  try {
    const key = `rate_limit:${actionName}:${userId}`
    const requests = await redis.incr(key)
    if (requests === 1) {
      await redis.expire(key, windowSeconds)
    }
    return requests <= maxRequests
  } catch (err) {
    console.error('[rateLimitAction] Error:', err)
    return true // Fail open so users aren't locked out if Redis drops
  }
}