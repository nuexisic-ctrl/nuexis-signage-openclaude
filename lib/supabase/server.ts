import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SupabaseClient, createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'
import type { Database } from '@/types/supabase'
import { resilientFetch } from './resilientFetch'

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: resilientFetch
      }
    }
  )
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: resilientFetch
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // Server Component — cookies can only be set in middleware or route handlers.
            // Log for diagnostics; this is expected in Server Components but not elsewhere.
            console.warn('[Supabase Server] Could not set cookies (expected in Server Components):', error)
          }
        },
      },
    }
  )
}

/**
 * Returns the authenticated user for the current request, deduplicating the
 * auth/v1/user HTTP call via React's request-scoped cache().
 *
 * Without this, Next.js middleware + layout + page each call supabase.auth.getUser()
 * independently, resulting in 2-3 identical round-trips to Supabase auth per navigation.
 * With cache(), all callers within the same server render share a single result.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export async function requireOwner(supabase: SupabaseClient<Database>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  
  if (profile?.role !== 'owner') {
    throw new Error('Only workspace owners can perform this action.')
  }
  return true
}
