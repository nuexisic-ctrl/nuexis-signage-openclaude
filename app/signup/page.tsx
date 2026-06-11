'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { signupWithRateLimit } from './actions'
import styles from './signup.module.css'
import { toast } from '@/app/components/Toast'

export default function SignupPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    fullName: '',
    teamName: '',
    email: '',
    teamSlug: '',
    password: '',
    confirmPassword: '',
  })
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

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }

    if (!form.teamSlug) {
      toast.error('Team slug is required.')
      return
    }

    setStatus('loading')

    const result = await signupWithRateLimit({
      fullName: form.fullName,
      teamName: form.teamName,
      email: form.email,
      teamSlug: form.teamSlug,
      password: form.password,
    })

    if (!result.success) {
      toast.error(result.error || 'Failed to sign up.')
      setStatus('idle')
      return
    }

    setStatus('success')
    toast.success('Account created! Please check your email.')
  }

  if (status === 'success') {
    return (
      <div className={`auth-shell ${styles.lightThemeWrapper}`}>
        <div className={styles.wrapper}>
          <Link href="/" className="navbar-logo" style={{ display: 'block', textAlign: 'center', marginBottom: '16px' }}>
            <Image src="/NuExis-logo.png" alt="NuExis Logo" width={160} height={46} priority style={{ margin: '0 auto', width: 'auto', height: 'auto' }} />
          </Link>
          <div className={styles.card} style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📧</div>
            <h1 className={styles.title}>Check your email</h1>
            <p className={styles.subtitle} style={{ marginBottom: '24px' }}>
              We've sent a verification link to <strong>{form.email}</strong>. 
              Please click the link to verify your account and continue.
            </p>
            <Link href={`/customer/${form.teamSlug}/login`} className="btn btn-primary" style={{ display: 'inline-block', width: 'auto', padding: '12px 24px' }}>
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`auth-shell ${styles.lightThemeWrapper}`}>
      <div className={styles.wrapper}>
        {/* Logo */}
        <Link href="/" className="navbar-logo" style={{ display: 'block', textAlign: 'center', marginBottom: '16px' }}>
          <Image src="/NuExis-logo.png" alt="NuExis Logo" width={160} height={46} priority style={{ margin: '0 auto', width: 'auto', height: 'auto' }} />
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
