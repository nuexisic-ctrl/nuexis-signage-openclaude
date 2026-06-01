'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Link, MonitorPlay, X, Code, Clock } from 'lucide-react'
import styles from './Modal.module.css'
import { validateHtml, validateCss } from './validators'
import { t } from '@/lib/i18n'
import CustomCodeEditor from './CustomCodeEditor'

// ── STANDARD POPUP CONFIGURATION MODALS ───────────────────────────────────

interface WidgetSelectionModalProps {
  onClose: () => void
  onSelectYouTube: () => void
  onSelectRemoteUrl: () => void
  onSelectHtml: () => void
  onSelectFlow: () => void
}

export function WidgetSelectionModal({
  onClose,
  onSelectYouTube,
  onSelectRemoteUrl,
  onSelectHtml,
  onSelectFlow
}: WidgetSelectionModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>{t('Select Widget')}</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          <button 
            onClick={() => { onClose(); onSelectFlow(); }}
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
            <Clock color="#8b5cf6" size={28} />
            {t('Clock')}
          </button>
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
            {t('YouTube Player')}
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
            {t('Remote URL')}
          </button>
          <button 
            onClick={() => { onClose(); onSelectHtml(); }}
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
            <Code color="var(--primary)" size={28} />
            {t('Text / HTML')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface YouTubeWidgetModalProps {
  onClose: () => void
  onSubmit: (name: string, url: string) => void
  isSubmitting: boolean
}

export function YouTubeWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: YouTubeWidgetModalProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>{t('Configure YouTube Widget')}</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(name, url); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('Widget Name')}</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('e.g. Lobby YouTube Video')}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('YouTube URL')}</label>
            <input 
              required
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={t('https://www.youtube.com/watch?v=...')}
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
            {isSubmitting ? t('Saving...') : t('Save Widget')}
          </button>
        </form>
      </div>
    </div>
  )
}

interface RemoteUrlWidgetModalProps {
  onClose: () => void
  onSubmit: (name: string, url: string) => void
  isSubmitting: boolean
}

export function RemoteUrlWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: RemoteUrlWidgetModalProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>{t('Configure Remote URL')}</h2>
          <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); validateAndSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className={styles.errorBanner} role="alert" style={{ margin: '0' }}>
              <AlertTriangle className={styles.errorIcon} size={17} />
              {error}
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('Widget Name')}</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('e.g. Remote Weather Display')}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)' }}>{t('Media URL (HTTP/HTTPS)')}</label>
            <input 
              required
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(null); }}
              placeholder={t('https://example.com/dashboard')}
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
            {isSubmitting ? t('Saving...') : t('Save Widget')}
          </button>
        </form>
      </div>
    </div>
  )
}

interface HtmlWidgetPreviewModalProps {
  name: string
  html: string
  css: string
  onClose: () => void
}

export function HtmlWidgetPreviewModal({
  name,
  html,
  css,
  onClose
}: HtmlWidgetPreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const iframeSrcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 0; box-sizing: border-box; overflow: hidden; background: transparent; }
          ${css}
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true">
      <div className={styles.modalContainer} style={{ maxWidth: '900px', width: '90vw' }}>
        <div className={styles.modalHeader}>
          <div className={styles.modalMeta}>
            <span className={styles.modalTitle} title={name}>{name || t('Widget Preview')}</span>
            <span className={styles.modalMime}>{t('Text/HTML Widget')}</span>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close preview">
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.modalContent} style={{ display: 'block', background: '#000', overflow: 'hidden', padding: 0 }}>
          <iframe
            title="widget-html-preview"
            srcDoc={iframeSrcDoc}
            style={{ width: '100%', height: '450px', border: 'none', display: 'block', background: 'transparent' }}
            sandbox=""
          />
        </div>
      </div>
    </div>
  )
}

interface HtmlWidgetModalProps {
  onClose: () => void
  onSubmit: (name: string, html: string, css: string) => void
  isSubmitting: boolean
  teamSlug: string
}

export function HtmlWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: HtmlWidgetModalProps) {
  const [name, setName] = useState('')
  const [html, setHtml] = useState('<!-- Custom HTML widget contents -->\n<div class="lobby-card">\n  <h1>Hello, World</h1>\n</div>')
  const [css, setCss] = useState('/* Custom styles and animations */\nbody {\n  background: #0f172a;\n  color: #f8fafc;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n  margin: 0;\n  font-family: sans-serif;\n}')
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [htmlErrors, setHtmlErrors] = useState<string[]>([])
  const [cssErrors, setCssErrors] = useState<string[]>([])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    setHtmlErrors(validateHtml(html))
  }, [html])

  useEffect(() => {
    setCssErrors(validateCss(css))
  }, [css])

  const hasErrors = [...htmlErrors, ...cssErrors].some(err => err.toLowerCase().includes('error'))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (hasErrors) return
    onSubmit(name, html, css)
  }

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div 
          className={styles.modalContainer} 
          style={{ 
            width: '95vw', 
            maxWidth: '650px', 
            height: 'auto',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0
          }} 
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 24px', 
            borderBottom: '1px solid var(--outline-variant)',
            background: 'rgba(7, 17, 31, 0.4)'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>{t('Create Text / HTML Widget')}</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>{t('Design customized rich-text, layouts, and cards using custom HTML + CSS styling.')}</p>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('Widget Name')}</label>
                <input 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('e.g. Lobby Announcement Widget')}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                />
              </div>

              {/* HTML Editor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('HTML Code (Body Contents)')}</label>
                </div>
                <CustomCodeEditor
                  value={html}
                  onChange={setHtml}
                  language="html"
                />
              </div>

              {/* CSS Editor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>{t('CSS Code (Styles & Animations)')}</label>
                </div>
                <CustomCodeEditor
                  value={css}
                  onChange={setCss}
                  language="css"
                />
              </div>

              {/* Real-time Diagnostics */}
              {(htmlErrors.length > 0 || cssErrors.length > 0) && (
                <div style={{ 
                  padding: '12px 16px', 
                  background: 'rgba(239, 68, 68, 0.04)', 
                  border: '1.5px solid rgba(239, 68, 68, 0.12)', 
                  borderRadius: '10px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 600, fontSize: '0.82rem' }}>
                    <AlertTriangle size={16} />
                    <span>{t('Real-time Code Diagnostics & Safety Warnings')}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', paddingLeft: '24px' }}>
                    {[...htmlErrors, ...cssErrors].map((err, idx) => (
                      <div key={idx} style={{ fontSize: '0.76rem', color: '#fca5a5', lineHeight: '1.4' }}>• {err}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid var(--outline-variant)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(7, 17, 31, 0.4)'
            }}>
              <button 
                type="button" 
                onClick={() => setShowPreviewModal(true)}
                style={{ 
                  padding: '10px 18px', 
                  background: 'var(--surface-low)', 
                  color: 'var(--primary)', 
                  border: '1px solid var(--outline-variant)', 
                  borderRadius: '8px', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  fontFamily: 'var(--font-label)',
                  fontSize: '0.9rem'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-high)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--surface-low)'}
              >
                {t('Preview')}
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={onClose} 
                  style={{ 
                    padding: '10px 18px', 
                    background: 'transparent', 
                    color: 'var(--on-surface-muted)', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600, 
                    cursor: 'pointer' 
                  }}
                >
                  {t('Cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !name || hasErrors}
                  style={{ 
                    padding: '10px 24px', 
                    background: hasErrors ? 'var(--surface-low)' : 'var(--primary)', 
                    color: hasErrors ? 'var(--on-surface-subtle)' : 'var(--on-primary)', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600, 
                    cursor: (isSubmitting || !name || hasErrors) ? 'not-allowed' : 'pointer',
                    opacity: (isSubmitting || !name) ? 0.7 : 1,
                    boxShadow: hasErrors ? 'none' : '0 4px 12px rgba(9, 76, 178, 0.2)'
                  }}
                >
                  {isSubmitting ? t('Saving...') : t('Save Widget')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showPreviewModal && (
        <HtmlWidgetPreviewModal 
          name={name}
          html={html}
          css={css}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </>
  )
}
