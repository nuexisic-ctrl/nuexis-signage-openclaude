'use server'

import { createClient } from '@/lib/supabase/server'
import { redis } from '@/lib/redis'

export async function loginWithRateLimit(
  teamSlug: string,
  email: string,
  password: string,
  ip: string
) {
  // Rate limit by IP
  const rateLimitKey = `login_attempts:${ip}`
  const attempts = await redis.incr(rateLimitKey)
  if (attempts === 1) {
    await redis.expire(rateLimitKey, 60 * 15) // 15 minutes window
  }

  if (attempts > 5) {
    return { success: false, error: 'Too many login attempts. Please try again later.' }
  }

  const supabase = await createClient()
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  // Verify the signed-in user actually belongs to this team securely via the database
  const { data: profile } = await supabase
    .from('profiles')
    .select('teams(slug)')
    .eq('id', data.user.id)
    .single()
  
  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) 
    ? profile.teams.slug 
    : undefined

  if (userTeamSlug && userTeamSlug !== teamSlug) {
    await supabase.auth.signOut()
    return { success: false, error: `This account does not belong to the "${teamSlug}" workspace. Please use your correct team URL.` }
  }

  // Reset rate limit on success
  await redis.del(rateLimitKey)

  return { success: true }
}