'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Link, MonitorPlay, X, Code, Clock } from 'lucide-react'
import styles from './Modal.module.css'
import { validateHtml, validateCss } from './validators'

// ── CUSTOM LIGHTWEIGHT IDE SYNTAX HIGHLIGHTING (NORD PALETTE) ──────────────

function highlightHtml(code: string): string {
  if (!code) return ''
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Nord comments (muted slate grey-green)
  html = html.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color: #4c566a; font-style: italic;">$1</span>')
  
  // Quoted attribute values (Nord soft emerald green)
  html = html.replace(/("[^"]*")/g, '<span style="color: #a3be8c;">$1</span>')
  html = html.replace(/('[^']*')/g, '<span style="color: #a3be8c;">$1</span>')

  // HTML brackets & tags (Nord bright developer blue)
  html = html.replace(/(&lt;\/?[a-zA-Z0-9-]+)/g, '<span style="color: #81a1c1; font-weight: 600;">$1</span>')
  html = html.replace(/(&gt;)/g, '<span style="color: #81a1c1; font-weight: 600;">$1</span>')

  // Attribute keys (Nord frost teal)
  html = html.replace(/(\s)([a-zA-Z0-9-]+)(?=\s*=)/g, '$1<span style="color: #8fbcbb;">$2</span>')

  return html
}

function highlightCss(code: string): string {
  if (!code) return ''
  let css = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // CSS Comments (Nord slate grey)
  css = css.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color: #4c566a; font-style: italic;">$1</span>')

  // CSS Selectors (Nord bright cyan/blue)
  css = css.replace(/([^\r\n{}]+)(?=\s*\{)/g, '<span style="color: #88c0d0; font-weight: 600;">$1</span>')

  // CSS Properties (Nord soft frost blue)
  css = css.replace(/([a-zA-Z0-9-]+)(?=\s*:)/g, '<span style="color: #81a1c1;">$1</span>')

  // CSS Values (Nord pastel purple/pink)
  css = css.replace(/(:\s*)([^;}\r\n]+)/g, '$1<span style="color: #b48ead;">$2</span>')

  // Punctuation braces
  css = css.replace(/([{}])/g, '<span style="color: #d8dee9;">$1</span>')

  return css
}

// ── HIGH-FIDELITY PURE REACT CODE EDITOR COMPONENT ─────────────────────────

function CustomCodeEditor({
  value,
  onChange,
  language
}: {
  value: string
  onChange: (v: string) => void
  language: 'html' | 'css'
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const syncScroll = () => {
    if (textareaRef.current) {
      if (backdropRef.current) {
        backdropRef.current.scrollTop = textareaRef.current.scrollTop
        backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
      }
      if (gutterRef.current) {
        gutterRef.current.scrollTop = textareaRef.current.scrollTop
      }
    }
  }

  // Ensure scroll sync triggers when code loads or is reset
  useEffect(() => {
    syncScroll()
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget
    const val = textarea.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    // 1. Tab Indent: Insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const newValue = val.substring(0, start) + '  ' + val.substring(end)
      onChange(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
      return
    }

    // 2. Bracket & Quote Autopairing
    const braces: Record<string, string> = {
      '{': '}',
      '[': ']',
      '(': ')',
      '"': '"',
      "'": "'",
      '<': '>'
    }

    if (braces[e.key] !== undefined) {
      e.preventDefault()
      const closingChar = braces[e.key]
      const newValue = val.substring(0, start) + e.key + closingChar + val.substring(end)
      onChange(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
      return
    }

    // 3. HTML Tag Auto-closing on typing '>'
    if (e.key === '>') {
      const textBefore = val.substring(0, start)
      const tagMatch = textBefore.match(/<([a-zA-Z0-9-]+)(?:\s+[^>]*?)?$/)
      if (tagMatch) {
        const tagName = tagMatch[1]
        const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
        if (!voidElements.has(tagName.toLowerCase())) {
          e.preventDefault()
          const newValue = val.substring(0, start) + '></' + tagName + '>' + val.substring(end)
          onChange(newValue)
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 1
          }, 0)
        }
      }
    }
  }

  const lines = value.split('\n')
  const highlighted = language === 'html' ? highlightHtml(value) : highlightCss(value)

  return (
    <div style={{
      display: 'flex',
      height: '220px',
      background: '#2e3440',
      borderRadius: '10px',
      border: '1.5px solid var(--outline-variant)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Line Numbers gutter */}
      <div 
        ref={gutterRef}
        className={styles.editorBackdrop}
        style={{
          width: '42px',
          background: '#242933',
          color: '#5e6a80',
          padding: '12px 0',
          textAlign: 'right',
          userSelect: 'none',
          borderRight: '1.5px solid #3b4252',
          overflow: 'hidden',
          height: '100%',
          lineHeight: '20px',
          boxSizing: 'border-box'
        }}
      >
        {lines.map((_, i) => (
          <div key={i} style={{ paddingRight: '8px', fontSize: '11px', fontWeight: 600 }}>{i + 1}</div>
        ))}
      </div>

      {/* Editor viewport container */}
      <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden' }}>
        {/* Background Syntax Display */}
        <div 
          ref={backdropRef}
          className={styles.editorBackdrop}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            padding: '12px',
            boxSizing: 'border-box',
            whiteSpace: 'pre',
            overflow: 'hidden',
            pointerEvents: 'none',
            color: '#d8dee9',
            lineHeight: '20px',
            zIndex: 1
          }}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />

        {/* User Interactive Textarea Overlay */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          className={styles.editorTextarea}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'transparent',
            color: 'transparent',
            caretColor: '#88c0d0',
            border: 'none',
            outline: 'none',
            padding: '12px',
            boxSizing: 'border-box',
            resize: 'none',
            lineHeight: '20px',
            whiteSpace: 'pre',
            overflow: 'auto',
            zIndex: 2
          }}
        />
      </div>
    </div>
  )
}

// ── STANDARD POPUP CONFIGURATION MODALS ───────────────────────────────────

export function WidgetSelectionModal({
  onClose,
  onSelectYouTube,
  onSelectRemoteUrl,
  onSelectHtml,
  onSelectFlow
}: {
  onClose: () => void
  onSelectYouTube: () => void
  onSelectRemoteUrl: () => void
  onSelectHtml: () => void
  onSelectFlow: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} style={{ padding: '24px', maxWidth: '400px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Select Widget</h2>
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
            Clock
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
            Text / HTML
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

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Configure Remote URL</h2>
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

export function HtmlWidgetPreviewModal({
  name,
  html,
  css,
  onClose
}: {
  name: string
  html: string
  css: string
  onClose: () => void
}) {
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
            <span className={styles.modalTitle} title={name}>{name || 'Widget Preview'}</span>
            <span className={styles.modalMime}>Text/HTML Widget</span>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close preview">
            <X size={24} />
          </button>
        </div>
        
        {/* locked parent height to 450px so that it never collapses */}
        <div className={styles.modalContent} style={{ display: 'block', background: '#000', overflow: 'hidden', padding: 0 }}>
          <iframe
            title="widget-html-preview"
            srcDoc={iframeSrcDoc}
            style={{ width: '100%', height: '450px', border: 'none', display: 'block', background: 'transparent' }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  )
}

export function HtmlWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: {
  onClose: () => void
  onSubmit: (name: string, html: string, css: string) => void
  isSubmitting: boolean
  teamSlug: string
}) {
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
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)' }}>Create Text / HTML Widget</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>Design customized rich-text, layouts, and cards using custom HTML + CSS styling.</p>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn}><X size={20} /></button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Widget Name</label>
                <input 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Lobby Announcement Widget"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', color: 'var(--on-surface)' }}
                />
              </div>

              {/* HTML Editor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>HTML Code (Body Contents)</label>
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
                  <label style={{ fontSize: '0.86rem', color: 'var(--on-surface-subtle)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>CSS Code (Styles & Animations)</label>
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
                    <span>Real-time Code Diagnostics & Safety Warnings</span>
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
                Preview
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
                  Cancel
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
                  {isSubmitting ? 'Saving...' : 'Save Widget'}
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
