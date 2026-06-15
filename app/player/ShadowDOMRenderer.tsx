'use client'

import React, { useEffect, useRef, useState } from 'react'

interface ShadowDOMHtmlRendererProps {
  html: string
  css: string
  onLoadComplete?: () => void
  style?: React.CSSProperties
}

export function ShadowDOMHtmlRenderer({ html, css, onLoadComplete, style }: ShadowDOMHtmlRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Clear container
    containerRef.current.innerHTML = ''

    // Create shadow root
    const shadowRoot = containerRef.current.shadowRoot || containerRef.current.attachShadow({ mode: 'open' })

    const styleContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      * {
        box-sizing: border-box;
      }
      ${css}
    `

    // Clear shadow root and inject custom stylesheet + HTML content
    shadowRoot.innerHTML = `
      <style>${styleContent}</style>
      <div style="width: 100%; height: 100%; overflow: hidden;">${html}</div>
    `

    if (onLoadComplete) {
      onLoadComplete()
    }
  }, [html, css, onLoadComplete])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />
}

interface ShadowDOMRemoteURLRendererProps {
  url: string
  onLoadComplete?: () => void
  style?: React.CSSProperties
}

export function ShadowDOMRemoteURLRenderer({ url, onLoadComplete, style }: ShadowDOMRemoteURLRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)

    // Fetch proxied website HTML
    fetch(`/api/player/proxy?url=${encodeURIComponent(url)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load URL via proxy: ${res.statusText}`)
        }
        return res.text()
      })
      .then((text) => {
        if (active) {
          setHtmlContent(text)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('[ShadowDOMRemoteURL] Error fetching proxied URL:', err)
        if (active) {
          setError(err.message || 'Failed to load page content')
          setIsLoading(false)
          if (onLoadComplete) onLoadComplete() // Trigger so loop doesn't hang
        }
      })

    return () => {
      active = false
    }
  }, [url, onLoadComplete])

  useEffect(() => {
    if (!containerRef.current || !htmlContent) return

    const shadowRoot = containerRef.current.shadowRoot || containerRef.current.attachShadow({ mode: 'open' })

    // Inject proxied HTML (which already includes base tag pointing to original URL)
    shadowRoot.innerHTML = htmlContent

    if (onLoadComplete) {
      onLoadComplete()
    }
  }, [htmlContent, onLoadComplete])

  if (isLoading) {
    return (
      <div style={{ color: '#ffffff', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', backgroundColor: '#07111f' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeftColor: '#3b82f6', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <div>Loading Website...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ color: '#ef4444', padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#07111f', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <svg style={{ width: '48px', height: '48px', marginBottom: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>Failed to load website</h3>
        <p style={{ color: '#94a3b8', maxWidth: '400px', fontSize: '0.875rem' }}>{error}</p>
        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '12px', wordBreak: 'break-all' }}>URL: {url}</p>
      </div>
    )
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />
}
