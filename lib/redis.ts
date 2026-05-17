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