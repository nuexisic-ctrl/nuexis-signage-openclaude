'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redis } from '@/lib/redis'

export async function updateTeamAllowedDomains(
  teamSlug: string,
  allowedDomains: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be logged in.' }
  }

  const teamId = user.app_metadata?.team_id as string | undefined
  if (!teamId) {
    return { success: false, error: 'Could not determine your team.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'Owner' && profile.role !== 'Admin')) {
    return { success: false, error: 'Only administrators can change workspace settings.' }
  }

  const sanitized = allowedDomains
    .map(d => d.trim().toLowerCase())
    .filter(d => {
      if (!d) return false
      // Enforce strict domain formatting
      const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/
      return domainRegex.test(d)
    })

  const { error } = await supabase
    .from('teams')
    .update({ allowed_domains: sanitized })
    .eq('id', teamId)

  if (error) {
    console.error('[updateTeamAllowedDomains] error:', error)
    return { success: false, error: 'Failed to update allowed domains.' }
  }

  // Update Redis cache of all allowed domains
  try {
    const { data: teamsData } = await supabase
      .from('teams')
      .select('allowed_domains')

    const allDomains = Array.from(new Set(teamsData?.flatMap(t => t.allowed_domains || []) || []))
    if (redis) {
      await redis.set('allowed_domains:all', JSON.stringify(allDomains))
    }
  } catch (redisErr) {
    console.error('[updateTeamAllowedDomains] Failed to update Redis allowed domains cache:', redisErr)
  }

  revalidatePath(`/customer/${teamSlug}/settings`)
  return { success: true }
}
