'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimitAction } from '@/lib/redis'
import { headers } from 'next/headers'

export async function loginWithRateLimit(
  teamSlug: string,
  email: string,
  password: string,
  clientIpFallback?: string
) {
  // Retrieve secure client IP from headers to prevent client IP spoofing (C-08)
  const headersList = await headers()
  const forwardedFor = headersList.get('x-forwarded-for')
  const secureIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (clientIpFallback || '127.0.0.1')

  // Scope the rate limit to both the client's IP and email to limit brute force attacks
  const rateLimitKey = `${secureIp}:${email}`
  const allowed = await rateLimitAction(rateLimitKey, 'login', 5, 900)

  if (!allowed) {
    return { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' }
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

  return { success: true }
}