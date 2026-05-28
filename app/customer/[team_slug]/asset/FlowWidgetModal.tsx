'use client'

import { useState, useEffect } from 'react'
import { X, Monitor, Smartphone, Maximize, Clock } from 'lucide-react'
import styles from './Modal.module.css'
import FlowClockRenderer from '@/app/components/FlowClockRenderer'

interface FlowWidgetModalProps {
  onClose: () => void
  onSubmit: (name: string, config: {
    style: 'classic-digital' | 'modern-digital' | 'classic-analog' | 'modern-analog' | 'minimalist'
    showSeconds: boolean
    dateFormat: string
  }) => void
  isSubmitting: boolean
}

const STYLES_WHITELIST = [
  { id: 'classic-digital', name: 'Classic Digital' },
  { id: 'modern-digital', name: 'Modern Digital' },
  { id: 'classic-analog', name: 'Classic Analog' },
  { id: 'modern-analog', name: 'Modern Analog' },
  { id: 'minimalist', name: 'Minimalist' }
] as const

const DATE_FORMATS_WHITELIST = [
  'January 01, 2024',
  'Monday, January 01, 2024',
  'Mon, Jan 01, 2024',
  '31/01/2024',
  'Monday, 31/01/2024',
  '01/31/2024 (US)',
  '2024-01-31'
] as const

export default function FlowWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: FlowWidgetModalProps) {
  const [name, setName] = useState('')
  const [style, setStyle] = useState<typeof STYLES_WHITELIST[number]['id']>('classic-digital')
  const [showSeconds, setShowSeconds] = useState(true)
  const [dateFormat, setDateFormat] = useState<typeof DATE_FORMATS_WHITELIST[number]>('January 01, 2024')

  // Preview Mode: 'landscape' | 'portrait'
  const [previewMode, setPreviewMode] = useState<'landscape' | 'portrait'>('landscape')
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false)

  // Listen for Escape key to exit fullscreen preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFullscreenPreview) {
          setShowFullscreenPreview(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFullscreenPreview, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !name.trim()) return

    const validatedStyle = STYLES_WHITELIST.some(s => s.id === style) ? style : 'classic-digital'
    const validatedDateFormat = DATE_FORMATS_WHITELIST.includes(dateFormat) ? dateFormat : 'January 01, 2024'

    onSubmit(name.trim(), {
      style: validatedStyle,
      showSeconds: !!showSeconds,
      dateFormat: validatedDateFormat
    })
  }

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={styles.modalContainer}
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '1000px',
            width: '95vw',
            height: 'auto',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            borderBottom: '1px solid var(--outline-variant)',
            background: 'rgba(7, 17, 31, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={22} color="var(--primary)" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)', fontWeight: 600 }}>Create Cloak</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>Deploy elegant, sandboxed, high-performance clocks on your displays.</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close modal"><X size={20} /></button>
          </div>

          {/* Body content with split view */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            flex: 1,
            overflowY: 'auto',
            background: 'var(--surface-lowest)'
          }}>
            {/* Left: Configuration Inputs */}
            <form onSubmit={handleSubmit} style={{
              flex: '1 1 400px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              borderRight: '1px solid var(--outline-variant)'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Widget Name</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Lobby Central Cloak"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Clock Style</label>
                <select
                  value={style}
                  onChange={e => setStyle(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {STYLES_WHITELIST.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.86rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Date Format</label>
                <select
                  value={dateFormat}
                  onChange={e => setDateFormat(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {DATE_FORMATS_WHITELIST.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0' }}>
                <input
                  type="checkbox"
                  id="showSecondsCheckbox"
                  checked={showSeconds}
                  onChange={e => setShowSeconds(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="showSecondsCheckbox" style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                  Show Seconds (sweeping animations at 60 fps)
                </label>
              </div>
            </form>

            {/* Right: Live Interactive Simulator Area */}
            <div style={{
              flex: '1 1 450px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'rgba(0, 0, 0, 0.02)',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Preview mode selectors */}
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(0, 0, 0, 0.05)', padding: '4px', borderRadius: '8px', zIndex: 10 }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode('landscape')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none',
                    background: previewMode === 'landscape' ? '#ffffff' : 'transparent',
                    color: previewMode === 'landscape' ? 'var(--primary)' : 'var(--on-surface-subtle)',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-label)'
                  }}
                >
                  <Monitor size={14} />
                  Landscape (16:9)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('portrait')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none',
                    background: previewMode === 'portrait' ? '#ffffff' : 'transparent',
                    color: previewMode === 'portrait' ? 'var(--primary)' : 'var(--on-surface-subtle)',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-label)'
                  }}
                >
                  <Smartphone size={14} />
                  Portrait (9:16)
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullscreenPreview(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none',
                    background: 'transparent', color: 'var(--on-surface-subtle)',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-label)'
                  }}
                >
                  <Maximize size={14} />
                  Full Screen
                </button>
              </div>

              {/* Viewport Frame */}
              <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minHeight: '420px',
                position: 'relative'
              }}>
                {previewMode === 'landscape' ? (
                  /* 16:9 Smart TV Frame Simulator */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '480px',
                      height: '270px',
                      background: '#000000',
                      borderRadius: '8px',
                      border: '8px solid #222222',
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                      overflow: 'hidden',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FlowClockRenderer
                        style={style}
                        showSeconds={showSeconds}
                        dateFormat={dateFormat}
                      />
                    </div>
                    {/* Stand base */}
                    <div style={{ width: '80px', height: '15px', background: '#333333', borderTop: '2px solid #555555' }} />
                    <div style={{ width: '160px', height: '8px', background: '#222222', borderRadius: '4px' }} />
                  </div>
                ) : (
                  /* 9:16 Standing Kiosk Terminal Simulator */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '225px',
                      height: '400px',
                      background: '#000000',
                      borderRadius: '16px',
                      border: '6px solid #2d2d2d',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                      overflow: 'hidden',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FlowClockRenderer
                        style={style}
                        showSeconds={showSeconds}
                        dateFormat={dateFormat}
                      />
                    </div>
                    {/* Standing support footer base */}
                    <div style={{ width: '10px', height: '8px', background: '#333333' }} />
                    <div style={{ width: '120px', height: '8px', background: '#1c1c1c', borderRadius: '4px 4px 0 0' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--outline-variant)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            background: 'rgba(7, 17, 31, 0.4)',
            gap: '12px'
          }}>
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
                cursor: 'pointer',
                fontFamily: 'var(--font-label)',
                fontSize: '0.88rem'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
              style={{
                padding: '10px 24px',
                background: !name.trim() ? 'var(--surface-low)' : 'var(--primary)',
                color: !name.trim() ? 'var(--on-surface-subtle)' : 'var(--on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: (isSubmitting || !name.trim()) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || !name.trim()) ? 0.7 : 1,
                boxShadow: !name.trim() ? 'none' : '0 4px 12px rgba(9, 76, 178, 0.2)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.88rem'
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save Widget'}
            </button>
          </div>
        </div>
      </div>

      {/* FULLSCREEN REAL-TIME LIVE PREVIEW POPUP WITH STRICT RATIO COMPARISON */}
      {showFullscreenPreview && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#05070a',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 200ms ease-out'
        }}>
          {/* Locked Aspect Ratio frame aligned precisely with active display mode */}
          <div style={{
            position: 'relative',
            width: previewMode === 'landscape' ? 'min(90vw, calc((90vh * 16) / 9))' : 'min(90vw, calc((90vh * 9) / 16))',
            height: previewMode === 'landscape' ? 'min(90vh, calc((90vw * 9) / 16))' : 'min(90vh, calc((90vw * 16) / 9))',
            background: '#000000',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
            border: '2px solid rgba(255,255,255,0.05)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FlowClockRenderer
              style={style}
              showSeconds={showSeconds}
              dateFormat={dateFormat}
            />
          </div>

          {/* Floating close action banner */}
          <div style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '30px',
            padding: '6px 16px',
            color: '#ffffff',
            fontSize: '0.86rem',
            fontFamily: 'var(--font-label)',
            fontWeight: 500,
            pointerEvents: 'none'
          }}>
            <span>Fullscreen ({previewMode === 'landscape' ? 'Widescreen 16:9' : 'Kiosk 9:16'})</span>
            <button
              onClick={() => setShowFullscreenPreview(false)}
              style={{
                background: '#ffffff',
                border: 'none',
                color: '#000000',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto',
                transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1.0)'}
              aria-label="Exit fullscreen preview"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
