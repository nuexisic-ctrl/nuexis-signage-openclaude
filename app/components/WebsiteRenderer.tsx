'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import styles from './website-renderer.module.css'
import { checkUrlFrameability } from '@/app/customer/[team_slug]/asset/actions'

interface WebsiteRendererProps {
  url: string
  preview?: boolean
}

export default function WebsiteRenderer({ url, preview = false }: WebsiteRendererProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{
    type: 'x-frame-options' | 'csp-frame-ancestors' | 'network-error' | 'invalid-url' | 'ssrf-attempt' | null
    message: string
  } | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    async function checkFrameability() {
      try {
        const result = await checkUrlFrameability(url)
        if (!active) return

        if (!result.frameable) {
          let message = 'This website cannot be embedded on the screen.'
          if (result.reason === 'x-frame-options') {
            message = 'This website restricts embedding via X-Frame-Options (DENY or SAMEORIGIN).'
          } else if (result.reason === 'csp-frame-ancestors') {
            message = 'This website restricts embedding via Content Security Policy (frame-ancestors).'
          } else if (result.reason === 'ssrf-attempt') {
            message = 'Access to private, loopback, or invalid IP ranges is blocked for security.'
          } else if (result.reason === 'invalid-url') {
            message = 'The website URL format is invalid.'
          } else if (result.reason === 'network-error') {
            message = 'Failed to reach the website. Please check the URL or network connectivity.'
          }
          setError({ type: result.reason, message })
        }
      } catch (err) {
        if (!active) return
        setError({
          type: 'network-error',
          message: 'An error occurred while checking website frameability.'
        })
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    checkFrameability()

    return () => {
      active = false
    }
  }, [url])

  if (loading) {
    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.spinner} />
        <div className={styles.loadingText}>Connecting to website...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <div className={styles.errorIconContainer}>
            <AlertTriangle size={28} />
          </div>
          <h3 className={styles.errorTitle}>Cannot Embed Website</h3>
          <p className={styles.errorDescription}>{error.message}</p>
          <div className={styles.urlBadge} title={url}>{url}</div>
          {!preview && (
            <button
              onClick={() => window.open(url, '_blank')}
              className={styles.actionButton}
            >
              <ExternalLink size={16} />
              Open Website in New Tab
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <iframe
        src={url}
        className={styles.iframe}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        title="Embedded Website Widget"
        referrerPolicy="no-referrer"
      />
    </div>
  )
}
