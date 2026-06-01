import { Redis } from '@upstash/redis'

// Fail fast if Redis credentials are missing — never silently fall back
// to a dummy URL, which would cause all heartbeats to fail silently
// and show every device as offline.
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn(
    '[Redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set. ' +
    'Device heartbeats and active rate limiting will be bypassed.'
  )
}

export const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

export async function rateLimitAction(userId: string, actionName: string, maxRequests: number = 30, windowSeconds: number = 60): Promise<boolean> {
  // If Redis credentials are not configured, gracefully bypass rate check to let the app function
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN || !redis) {
    console.warn(`[rateLimitAction] Redis credentials missing. Gracefully bypassing rate limit for: ${actionName}`)
    return true
  }

  try {
    const key = `rate_limit:${actionName}:${userId}`
    const script = `
      local current = redis.call('get', KEYS[1])
      if not current then
        redis.call('set', KEYS[1], 1, 'EX', tonumber(ARGV[2]))
        return 1
      else
        return redis.call('incr', KEYS[1])
      end
    `
    const count = (await redis.eval(script, [key], [maxRequests, windowSeconds])) as number
    return count <= maxRequests
  } catch (err) {
    console.error('[rateLimitAction] Error:', err)
    // Fail closed for sensitive operations (login, signup, etc.) to prevent brute force
    const isSensitive = ['login', 'signup', 'registerDevice', 'claimDevice', 'createPlaylist'].includes(actionName)
    return !isSensitive
  }
}