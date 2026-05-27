'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import styles from './generic-login.module.css'

export default function GenericLoginForm() {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [shouldShake, setShouldShake] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setShouldShake(false)

    const trimmed = slug.trim().toLowerCase()

    if (!trimmed) {
      setError('Please enter your workspace name.')
      triggerShake()
      return
    }

    if (!/^[a-z0-9-]+$/.test(trimmed)) {
      setError('Workspace names can only contain lowercase letters, numbers, and dashes.')
      triggerShake()
      return
    }

    // Redirect to the customer workspace login page
    router.push(`/customer/${trimmed}/login`)
  }

  const triggerShake = () => {
    setShouldShake(true)
    setTimeout(() => setShouldShake(false), 450)
  }

  const currentHost = mounted ? window.location.host : 'app.nuexis.com'
  const currentProtocol = mounted ? window.location.protocol : 'https:'

  return (
    <div className={`${styles.lightThemeWrapper} ${styles.authShellContainer} auth-shell`}>
      <div className={`${styles.loginWrapper} ${shouldShake ? styles.shake : ''}`}>
        
        {/* Header */}
        <div className={styles.loginHeader}>
          <Link href="/" className="navbar-logo" style={{ display: 'block', marginBottom: '4px', textAlign: 'center' }}>
            <Image 
              src="/Nuexis-logo.png" 
              alt="NuExis Logo" 
              width={140} 
              height={40} 
              priority 
              style={{ margin: '0 auto' }} 
              sizes="(max-width: 768px) 100vw, 140px" 
            />
          </Link>
          <h1 className={styles.loginTitle} style={{ marginTop: '8px' }}>Find your workspace</h1>
          <p className={styles.loginSubtitle}>
            NuExis workspaces have their own unique, secure URLs.
          </p>
        </div>

        {/* Card */}
        <div className={styles.formCard}>
          {error && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="workspace-slug">Workspace Name</label>
              
              <div className={styles.inputContainer}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </span>
                <input
                  ref={inputRef}
                  id="workspace-slug"
                  type="text"
                  placeholder="acme"
                  className={`form-input ${styles.formInputWithIcon}`}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  aria-invalid={!!error}
                  required
                />
              </div>

              {/* Dynamic URL Preview Indicator */}
              <div className={styles.urlPreviewBlock}>
                <span className={styles.previewLabel}>Your login URL will be:</span>
                <div className={styles.previewUrlField}>
                  {currentProtocol}//{currentHost}/customer/<strong style={{ color: 'var(--primary)', fontWeight: 700 }}>{slug.trim().toLowerCase() || 'workspace-name'}</strong>/login
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              Continue to Workspace
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>

          {/* Form Divider */}
          <div className="divider" style={{ margin: '18px 0' }}>New to NuExis?</div>

          {/* Secondary Button */}
          <Link
            href="/signup"
            className="btn btn-secondary"
            style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="16" y1="11" x2="22" y2="11" />
            </svg>
            Create a new workspace
          </Link>


        </div>

        {/* Footer */}
        <footer className={styles.minimalFooter}>
          <div className={styles.footerLinks}>
            <Link href="#">Privacy Policy</Link>
            <Link href="#">Terms of Service</Link>
            <Link href="#">Contact Us</Link>
          </div>
          <span className={styles.footerCopyright}>© 2024 NuExis. All rights reserved.</span>
        </footer>
      </div>
    </div>
  )
}
