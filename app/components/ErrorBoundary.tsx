'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** Optional label used in error logs to identify which boundary caught */
  boundaryId?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Generic React Error Boundary.
 *
 * Catches runtime render errors in the subtree and displays a graceful
 * fallback UI instead of crashing the entire page.
 *
 * Usage:
 *   <ErrorBoundary boundaryId="player-root">
 *     <PlayerPage />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    const id = this.props.boundaryId ?? 'unknown'
    console.error(`[ErrorBoundary:${id}] Caught render error:`, error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#07111f',
            color: '#e0e4ef',
            fontFamily: 'Inter, sans-serif',
            gap: '16px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e57373"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
            Something went wrong
          </h2>
          <p style={{ margin: 0, maxWidth: '360px', fontSize: '0.9rem', color: '#8fa3c0', lineHeight: 1.6 }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {this.state.error && (
            <code
              style={{
                fontSize: '0.75rem',
                color: '#e57373',
                background: 'rgba(229,115,115,0.08)',
                borderRadius: '6px',
                padding: '8px 14px',
                maxWidth: '480px',
                wordBreak: 'break-all',
              }}
            >
              {this.state.error.message}
            </code>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              background: '#094cb2',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
