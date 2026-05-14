import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import styles from './generic-login.module.css'

export const metadata: Metadata = {
  title: 'Sign In — NuExis',
  description: 'Access your NuExis team workspace. Navigate to your team-specific URL to sign in.',
}

export default function GenericLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <div className="auth-shell">
      <div className={styles.wrapper}>
        {/* Logo */}
        <Link href="/" className="navbar-logo" style={{ display: 'block', marginBottom: '32px', textAlign: 'center' }}>
          <Image src="/Nuexis-logo.png" alt="NuExis Logo" width={160} height={46} priority style={{ margin: '0 auto' }} />
        </Link>

        {/* Main Card */}
        <div className={styles.card}>
          {/* Icon */}
          <div className={styles.iconWrap} aria-hidden="true">
            <div className={styles.icon}>⬡</div>
          </div>

          <h1 className={styles.title}>Team workspaces have<br />their own login URL</h1>

          <p className={styles.body}>
            NuExis uses team-specific login URLs to keep each workspace isolated and secure.
            Every team gets a dedicated address in the format below:
          </p>

          {/* URL Format Display */}
          <div className={styles.urlDisplay}>
            <span className={styles.urlBase}>localhost:3000/customer/</span>
            <span className={styles.urlSlug}>your&#8209;team</span>
            <span className={styles.urlBase}>/login</span>
          </div>

          {/* Example */}
          <div className={styles.exampleBlock}>
            <p className={styles.exampleLabel}>Example</p>
            <code className={styles.exampleCode}>
              localhost:3000/customer/acme&#8209;corp/login
            </code>
          </div>

          <p className={styles.hint}>
            Your team URL was provided when your workspace was created.
            Check your welcome email for the link, or ask your workspace owner.
          </p>

          <div className={styles.divider} />

          <div className={styles.actions}>
            <Link href="/signup" className="btn btn-primary" style={{ flex: 1 }}>
              Create a new workspace
            </Link>
            <Link href="/" className="btn btn-secondary" style={{ flex: 1 }}>
              Back to home
            </Link>
          </div>
        </div>

        {/* Help Text */}
        <p className={styles.helpText}>
          Need help finding your team URL?{' '}
          <Link href="#">Contact support →</Link>
        </p>
      </div>
    </div>
  )
}
