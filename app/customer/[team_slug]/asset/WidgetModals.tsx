'use client'

import { useState } from 'react'
import { AlertTriangle, Link, MonitorPlay, X } from 'lucide-react'
import styles from './Modal.module.css'

export function WidgetSelectionModal({
  onClose,
  onSelectYouTube,
  onSelectRemoteUrl
}: {
  onClose: () => void
  onSelectYouTube: () => void
  onSelectRemoteUrl: () => void
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Select Widget</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          <button 
            onClick={() => { onClose(); onSelectYouTube(); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
              background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
              borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
              color: 'var(--on-surface)', fontSize: '1rem', fontWeight: 600,
              fontFamily: 'var(--font-label)'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--outline-variant)'}
          >
            <MonitorPlay color="#ff0000" size={28} />
            YouTube Player
          </button>
          <button 
            onClick={() => { onClose(); onSelectRemoteUrl(); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
              background: 'var(--surface-low)', border: '1px solid var(--outline-variant)',
              borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
              color: 'var(--on-surface)', fontSize: '1rem', fontWeight: 600,
              fontFamily: 'var(--font-label)'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--outline-variant)'}
          >
            <Link color="#4dabf7" size={28} />
            Remote URL
          </button>
        </div>
      </div>
    </div>
  )
}

export function YouTubeWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: {
  onClose: () => void
  onSubmit: (name: string, url: string) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Configure YouTube Widget</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(name, url); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>Widget Name</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Lobby YouTube Video"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>YouTube URL</label>
            <input 
              required
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting || !name || !url}
            style={{ 
              marginTop: '8px', padding: '12px', background: 'var(--primary)', color: 'var(--on-primary)', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save Widget'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function RemoteUrlWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: {
  onClose: () => void
  onSubmit: (name: string, url: string) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  function validateAndSubmit() {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        setError('URL must use HTTP or HTTPS protocol')
        return
      }
      setError(null)
      onSubmit(name, url)
    } catch {
      setError('Invalid URL')
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Configure Remote URL</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); validateAndSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className={styles.errorBanner} role="alert" style={{ marginBottom: '0' }}>
              <AlertTriangle className={styles.errorIcon} size={17} />
              {error}
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>Widget Name</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Remote Weather Display"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>Media URL (HTTP/HTTPS)</label>
            <input 
              required
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(null); }}
              placeholder="https://example.com/dashboard"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting || !name || !url}
            style={{ 
              marginTop: '8px', padding: '12px', background: 'var(--primary)', color: 'var(--on-primary)', 
              border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save Widget'}
          </button>
        </form>
      </div>
    </div>
  )
}
