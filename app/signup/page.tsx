'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './signup.module.css'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    fullName: '',
    teamName: '',
    email: '',
    teamSlug: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'teamName' && {
        teamSlug: value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, ''),
      }),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (!form.teamSlug) {
      setError('Team slug is required.')
      return
    }

    setStatus('loading')

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          team_name: form.teamName,
          team_slug: form.teamSlug,
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setStatus('idle')
      return
    }

    setStatus('success')
    router.push(`/customer/${form.teamSlug}/login?signup=success`)
  }

  return (
    <div className="auth-shell">
      <div className={styles.wrapper}>
        {/* Logo */}
        <Link href="/" className="navbar-logo" style={{ display: 'block', textAlign: 'center', marginBottom: '16px' }}>
          <Image src="/Nuexis-logo.png" alt="NuExis Logo" width={160} height={46} priority style={{ margin: '0 auto' }} />
        </Link>

        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Create your workspace</h1>
          <p className={styles.subtitle}>
            Already have a team?{' '}
            <Link href="/login">Sign in here →</Link>
          </p>
        </div>

        {/* Card */}
        <div className={styles.card}>
          {error && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {status === 'success' && (
            <div className="alert alert-success" role="status" style={{ marginBottom: '20px' }}>
              Workspace created! Redirecting to your login page…
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Row 1: Full Name + Team Name */}
            <div className={styles.row}>
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  className="form-input"
                  placeholder="Alex Johnson"
                  required
                  value={form.fullName}
                  onChange={handleChange}
                  disabled={status === 'loading'}
                />
              </div>

              <div className="form-group">
                <label htmlFor="teamName">Team / Company Name</label>
                <input
                  id="teamName"
                  name="teamName"
                  type="text"
                  className="form-input"
                  placeholder="Acme Corp"
                  required
                  value={form.teamName}
                  onChange={handleChange}
                  disabled={status === 'loading'}
                />
              </div>
            </div>

            {/* Work Email */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label htmlFor="email">Work Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="form-input"
                placeholder="alex@acme.com"
                required
                value={form.email}
                onChange={handleChange}
                disabled={status === 'loading'}
              />
            </div>

            {/* Team Slug */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label htmlFor="teamSlug">Workspace URL</label>
              <div className={styles.slugRow}>
                <span className={styles.slugPrefix}>nuexis.com/</span>
                <input
                  id="teamSlug"
                  name="teamSlug"
                  type="text"
                  className={`form-input ${styles.slugInput}`}
                  placeholder="acme-corp"
                  required
                  value={form.teamSlug}
                  onChange={handleChange}
                  disabled={status === 'loading'}
                />
              </div>
            </div>

            {/* Row 2: Passwords */}
            <div className={styles.row} style={{ marginBottom: '28px' }}>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  className="form-input"
                  placeholder="••••••••"
                  required
                  value={form.password}
                  onChange={handleChange}
                  disabled={status === 'loading'}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className="form-input"
                  placeholder="••••••••"
                  required
                  value={form.confirmPassword}
                  onChange={handleChange}
                  disabled={status === 'loading'}
                />
              </div>
            </div>

            <button
              id="signup-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '16px' }}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <>
                  <span className="spinner" />
                  Creating workspace…
                </>
              ) : (
                'Create Workspace'
              )}
            </button>
          </form>

          <p className={styles.terms}>
            By creating an account you agree to our{' '}
            <Link href="#">Terms of Service</Link> and{' '}
            <Link href="#">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
