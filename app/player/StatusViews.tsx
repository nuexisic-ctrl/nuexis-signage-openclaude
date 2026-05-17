'use client'

import styles from './player.module.css'

export function ExpiredView() {
  return (
    <div className={styles.shell} style={{ width: '100%', height: '100%' }}>
      <div className={styles.expiredView}>
        <svg className={styles.expiredIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h1 className={styles.expiredTitle}>Pairing code expired</h1>
        <p className={styles.expiredText}>
          The 15-minute window has closed. Reload this page to generate a new code.
        </p>
        <button className={styles.reloadBtn} onClick={() => window.location.assign(window.location.pathname)}>
          Generate New Code
        </button>
      </div>
    </div>
  )
}

export function LoadingView() {
  return (
    <div className={styles.shell} style={{ width: '100%', height: '100%' }}>
      <div className={styles.loadingView}>
        <div className={styles.spinner} />
      </div>
    </div>
  )
}
