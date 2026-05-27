'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { loginWithRateLimit } from './actions'
import styles from './login.module.css'

interface LoginFormProps {
  teamSlug: string
}

export default function LoginForm({ teamSlug }: LoginFormProps) {
  const router = useRouter()

  // State Management
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockActive, setCapsLockActive] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [shouldShake, setShouldShake] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Input References for Smart Autofocus, Popover position and Keyboard control
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const helpPopoverRef = useRef<HTMLDivElement>(null)
  const badgeWrapperRef = useRef<HTMLDivElement>(null)

  // 1. Hydration Mount check
  useEffect(() => {
    setMounted(true)
    
    // 2. Smart Autofocus Behavior
    const savedEmail = localStorage.getItem('nuexis_remembered_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
      // Focus password field if email is remembered
      setTimeout(() => {
        passwordInputRef.current?.focus()
      }, 100)
    } else {
      // Focus email field by default
      setTimeout(() => {
        emailInputRef.current?.focus()
      }, 100)
    }
  }, [])

  // Close help popover on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHelpOpen(false)
      }
    }
    if (isHelpOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isHelpOpen])

  // Close help popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (badgeWrapperRef.current && !badgeWrapperRef.current.contains(event.target as Node)) {
        // Only close if click is not inside the popover itself to avoid accidental closing
        if (helpPopoverRef.current && !helpPopoverRef.current.contains(event.target as Node)) {
          setIsHelpOpen(false)
        }
      }
    }
    if (isHelpOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isHelpOpen])

  // Caps Lock Detection Event Listeners
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState('CapsLock')) {
      setCapsLockActive(true)
    } else {
      setCapsLockActive(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading' || status === 'success') return
    
    setError('')
    setShouldShake(false)

    // Field check
    if (!email || !password) {
      setError('Please enter your email and password.')
      triggerShake()
      return
    }

    setStatus('loading')

    // Generate client fingerprint for basic rate limiting
    const clientIpFallback = 'client-' + navigator.userAgent.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '')
    
    try {
      const result = await loginWithRateLimit(teamSlug, email, password, clientIpFallback)

      if (!result.success) {
        setError(result.error!)
        setStatus('idle')
        triggerShake()
        return
      }

      // If "Remember me" option is checked, store the email
      if (rememberMe) {
        localStorage.setItem('nuexis_remembered_email', email)
      } else {
        localStorage.removeItem('nuexis_remembered_email')
      }

      setStatus('success')

      // Short delay for a premium transition experience before redirecting
      setTimeout(() => {
        router.push(`/customer/${teamSlug}/dashboard`)
        router.refresh()
      }, 600)

    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.')
      setStatus('idle')
      triggerShake()
    }
  }

  const triggerShake = () => {
    setShouldShake(true)
    setTimeout(() => setShouldShake(false), 450)
  }

  // Render Host URL dynamically to prevent hydration mismatch (e.g. app.nuexis.com vs localhost:3000)
  const currentHost = mounted ? window.location.host : 'app.nuexis.com'
  const currentProtocol = mounted ? window.location.protocol : 'https:'

  return (
    <div className={`${styles.lightThemeWrapper} ${styles.authShellContainer} auth-shell`}>
      <div className={`${styles.loginWrapper} ${shouldShake ? styles.shake : ''}`}>
        
        {/* Workspace Badge & Logo Header */}
        <div className={styles.loginHeader}>
          {/* Custom Info Badge - Absolute anchor is loginHeader for position stability */}
          <div className={styles.badgeWrapper} ref={badgeWrapperRef}>
            <button
              type="button"
              className={styles.teamBadgeInteractive}
              onClick={() => setIsHelpOpen(!isHelpOpen)}
              aria-label="Workspace information. Click to see how to switch workspaces"
              aria-expanded={isHelpOpen}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <span className={styles.teamBadgeLabel}>Workspace:</span>
              <span className={styles.teamBadgeSlug}>{teamSlug}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.badgeInfoIcon}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          </div>

          {/* Guide Menu Popover - Anchored strictly to loginHeader, permanently rendered to eliminate layout reflow / coordinate jumps */}
          <div 
            ref={helpPopoverRef}
            className={`${styles.guidePopover} ${isHelpOpen ? styles.popoverVisible : ''}`} 
            role="dialog"
            aria-hidden={!isHelpOpen}
            aria-labelledby="help-title"
          >
            <button 
              type="button" 
              className={styles.popoverCloseBtn}
              onClick={() => setIsHelpOpen(false)}
              aria-label="Close information guide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className={styles.popoverBody}>
              {/* Left Column: Mock Browser Illustration */}
              <div className={styles.browserMockContainer} aria-hidden="true">
                <div className={styles.browserHeaderBar}>
                  <span className={`${styles.browserDot} ${styles.dotRed}`} />
                  <span className={`${styles.browserDot} ${styles.dotYellow}`} />
                  <span className={`${styles.browserDot} ${styles.dotGreen}`} />
                </div>
                <div className={styles.browserAddressBar}>
                  <span className={styles.addressIcon}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <span className={styles.addressText}>
                    {currentProtocol}//{currentHost}/customer/<strong style={{ color: 'var(--primary)', fontWeight: 700 }}>{teamSlug}</strong>/login
                  </span>
                </div>
                <div className={styles.browserMockContent} />
              </div>

              {/* Right Column: Help Explanatory Text */}
              <div className={styles.helpTextContent}>
                <h2 id="help-title" className={styles.helpTitle}>How to switch workspace?</h2>
                <p className={styles.helpParagraph}>
                  Workspaces are not switchable from here. To access another workspace, use its unique login URL.
                </p>
                <div className={styles.exampleUrlBlock}>
                  <span className={styles.exampleLabel}>Example:</span>
                  <div className={styles.exampleUrlField}>
                    {currentProtocol}//{currentHost}/customer/<strong style={{ color: 'var(--primary)', fontWeight: 700 }}>acme</strong>/login
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h1 className={styles.loginTitle} style={{ marginTop: '8px' }}>Welcome back!</h1>
          <p className={styles.loginSubtitle}>
            Sign in to access your workspace dashboard.
          </p>
        </div>

        {/* Compact Form Card */}
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
            {/* Email Field */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label htmlFor="login-email">Work Email</label>
              <div className={styles.inputContainer}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  ref={emailInputRef}
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  className={`form-input ${styles.formInputWithIcon}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'loading' || status === 'success'}
                  aria-invalid={!!error && !email}
                  required
                />
                {email && email.includes('@') && email.includes('.') && (
                  <span className={styles.validIndicator} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label htmlFor="login-password">Password</label>
                <Link
                  href="#"
                  className={styles.forgotPasswordLink}
                  tabIndex={0}
                >
                  Forgot password?
                </Link>
              </div>
              <div className={styles.inputContainer}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  ref={passwordInputRef}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className={`form-input ${styles.formInputWithIcon} ${styles.formInputWithAction}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyDown}
                  disabled={status === 'loading' || status === 'success'}
                  aria-invalid={!!error && !password}
                  required
                />
                
                {/* Visibility Toggle Button */}
                <button
                  type="button"
                  className={styles.passwordActionBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={status === 'loading' || status === 'success'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Caps Lock Banner */}
              {capsLockActive && (
                <div className={styles.capsLockWarning} role="status">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                    <path d="M18 15h-6v4H6v-4H0V9h6V5h6v4h6v6z" />
                  </svg>
                  <span>Caps Lock is active</span>
                </div>
              )}
            </div>

            {/* Remember Me Toggle */}
            <div className={styles.checkboxGroup} style={{ marginBottom: '18px' }}>
              <label className={styles.checkboxLabel} htmlFor="remember-me">
                <input
                  id="remember-me"
                  type="checkbox"
                  className={styles.customCheckbox}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={status === 'loading' || status === 'success'}
                />
                <span className={styles.checkboxText}>Remember me</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              className={`btn btn-primary ${styles.submitButton} ${status === 'success' ? styles.btnSuccess : ''}`}
              style={{ width: '100%', padding: '14px' }}
              disabled={status === 'loading' || status === 'success'}
            >
              {status === 'loading' && (
                <>
                  <span className="spinner" />
                  Signing in…
                </>
              )}
              {status === 'success' && (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'scaleUp 0.2s ease-out' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Success!
                </>
              )}
              {status === 'idle' && (
                <>
                  Continue to Dashboard
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
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
            Create your workspace
          </Link>


        </div>

        {/* Footer Links & Copyright */}
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
