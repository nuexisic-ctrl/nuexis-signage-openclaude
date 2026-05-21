'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { rateLimitAction } from '@/lib/redis'
import { headers } from 'next/headers'
import type { Database } from '@/types/supabase'

const RESERVED_SLUGS = new Set([
  'api', 'auth', 'admin', 'player', 'customer', 'login', 'signup',
  'dashboard', 'public', 'static', 'images', 'favicon.ico', 'assets',
  'playlists', 'screens', 'settings', 'support', 'help', 'status',
])

export async function signupWithRateLimit(formData: {
  fullName: string
  teamName: string
  email: string
  teamSlug: string
  password: string
}) {
  const { fullName, teamName, email, teamSlug, password } = formData

  // 1. IP rate limiting (H-07)
  const headersList = await headers()
  const forwardedFor = headersList.get('x-forwarded-for')
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1'

  const allowed = await rateLimitAction(clientIp, 'signup', 3, 900) // max 3 signups per 15 mins per IP
  if (!allowed) {
    return { success: false, error: 'Too many signup attempts from this IP. Please try again in 15 minutes.' }
  }

  // 2. Validate parameters
  if (!fullName.trim() || !teamName.trim() || !email.trim() || !teamSlug.trim() || !password.trim()) {
    return { success: false, error: 'All fields are required.' }
  }

  // Email format validation (M-06)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' }
  }

  // Team slug format and length
  const slugRegex = /^[a-z0-9-]+$/
  if (!slugRegex.test(teamSlug) || teamSlug.length < 3 || teamSlug.length > 40) {
    return { success: false, error: 'Team slug must be 3-40 characters and contain only lowercase letters, numbers, and hyphens.' }
  }

  // Reserved slugs validation (M-04)
  if (RESERVED_SLUGS.has(teamSlug.toLowerCase())) {
    return { success: false, error: 'This team slug is reserved. Please choose a different slug.' }
  }

  // Password strength validation (M-05)
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' }
  }
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return { success: false, error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.' }
  }

  // 3. Team slug uniqueness check (M-34)
  const serviceClient = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: existingTeam, error: queryError } = await serviceClient
    .from('teams')
    .select('id')
    .eq('slug', teamSlug.toLowerCase())
    .maybeSingle()

  if (queryError) {
    console.error('[signup] Error checking slug uniqueness:', queryError)
    return { success: false, error: 'An error occurred during verification. Please try again.' }
  }

  if (existingTeam) {
    return { success: false, error: 'This workspace URL is already taken. Please choose another one.' }
  }

  // 4. Perform auth sign up using the server client
  const supabase = await createClient()
  const { error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        team_name: teamName,
        team_slug: teamSlug.toLowerCase(),
      },
    },
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  return { success: true }
}
