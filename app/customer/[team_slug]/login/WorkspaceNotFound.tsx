'use client'

import Link from 'next/link'
import Image from 'next/image'
import styles from './login.module.css'

interface WorkspaceNotFoundProps {
  teamSlug: string
}

export default function WorkspaceNotFound({ teamSlug }: WorkspaceNotFoundProps) {
  return (
    <div className={`${styles.lightThemeWrapper} auth-shell`}>
      <div className={styles.loginWrapper}>
        {/* Logo */}
        <Link href="/" className="navbar-logo" style={{ display: 'block', textAlign: 'center', marginBottom: '8px' }}>
          <Image 
            src="/NuExis-logo.png" 
            alt="NuExis Logo" 
            width={140} 
            height={40} 
            priority 
            style={{ margin: '0 auto', width: 'auto', height: 'auto' }} 
            sizes="(max-width: 768px) 100vw, 140px" 
          />
        </Link>

        {/* Content Card */}
        <div className={styles.formCard} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          {/* Animated Glowing Broken Link Icon */}
          <div className={styles.errorIconContainer} aria-hidden="true">
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className={styles.errorIcon}
            >
              <path d="M10.9 7.3c-.3-.2-.6-.3-.9-.3-1.7 0-3 1.3-3 3s1.3 3 3 3c.3 0 .6-.1.9-.3" />
              <path d="M13.1 16.7c.3.2.6.3.9.3 1.7 0 3-1.3 3-3s-1.3-3-3-3c-.3 0-.6.1-.9.3" />
              <line x1="8" y1="16" x2="16" y2="8" />
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h1 className={styles.loginTitle} style={{ fontSize: '1.75rem', fontWeight: 700 }}>Workspace not found</h1>
            <p className={styles.loginSubtitle}>
              We couldn't find a workspace with the slug <span className={styles.highlightSlug}>"{teamSlug}"</span>.
            </p>
          </div>

          <p className={styles.errorDescription}>
            Please check the spelling of your workspace URL or contact your administrator. If you want to build a new screen display, you can create a new workspace.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '8px' }}>
            <Link 
              href="/signup" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '16px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="16" y1="11" x2="22" y2="11" />
              </svg>
              Create your workspace
            </Link>

            <Link 
              href="/" 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '14px' }}
            >
              Go to NuExis Home
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className={styles.minimalFooter} style={{ marginTop: '12px' }}>
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
