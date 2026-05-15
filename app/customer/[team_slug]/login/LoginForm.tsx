'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './login.module.css'

interface LoginFormProps {
  teamSlug: string
}

export default function LoginForm({ teamSlug }: LoginFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    setStatus('loading')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setStatus('idle')
      return
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
      setError(
        `This account does not belong to the "${teamSlug}" workspace. ` +
        `Please use your correct team URL.`
      )
      setStatus('idle')
      return
    }

    // Redirect to the team dashboard
    router.push(`/customer/${teamSlug}/dashboard`)
    router.refresh()
  }

  return (
    <div className="auth-shell">
      <div className={styles.loginWrapper}>
        {/* Header */}
        <div className={styles.loginHeader}>
          <Link href="/" className="navbar-logo" style={{ display: 'block', textAlign: 'center', marginBottom: '8px' }}>
            <Image src="/Nuexis-logo.png" alt="NuExis Logo" width={140} height={40} priority style={{ margin: '0 auto' }} />
          </Link>

          <div className={styles.teamBadge}>
            <span className={styles.teamBadgeSlug}>{teamSlug}</span>
            <span className={styles.teamBadgeLabel}>workspace</span>
          </div>

          <h1 className={styles.loginTitle}>Welcome back</h1>
          <p className={styles.loginSubtitle}>
            Sign in to continue to your team dashboard.
          </p>
        </div>

        {/* Form Card */}
        <div className={styles.formCard}>
          {error && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label htmlFor="login-email">Work Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="alex@acme.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'loading'}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="login-password">Password</label>
                <Link
                  href="#"
                  style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-label)' }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status === 'loading'}
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '16px' }}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <>
                  <span className="spinner" />
                  Signing in…
                </>
              ) : (
                'Sign In to Workspace'
              )}
            </button>
          </form>

          <div className="divider" style={{ margin: '24px 0' }}>new to NuExis?</div>

          <Link
            href="/signup"
            className="btn btn-secondary"
            style={{ width: '100%', padding: '14px' }}
          >
            Create a new workspace
          </Link>
        </div>

        {/* Team URL hint */}
        <div className={styles.teamUrlHint}>
          <span className={styles.urlDomain}>localhost:3000/customer/</span>
          <span className={styles.urlSlug}>{teamSlug}</span>
          <span className={styles.urlDomain}>/login</span>
        </div>
      </div>
    </div>
  )
}
