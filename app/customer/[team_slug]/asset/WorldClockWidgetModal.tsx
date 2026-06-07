'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Monitor, Smartphone, Maximize, Clock, ArrowLeft } from 'lucide-react'
import styles from './Modal.module.css'
import FlowWorldClockRenderer from '@/app/components/FlowWorldClockRenderer'
import { modalStack } from '@/lib/utils/modalStack'
import CustomSelect from '../components/CustomSelect'
import TimezoneSelect from '../components/TimezoneSelect'

interface WorldClockWidgetModalProps {
  onClose: () => void
  onBack?: () => void
  onSubmit: (name: string, config: {
    clockType: 'analog' | 'digital'
    timezone: string
    theme: 'light' | 'dark' | 'custom'
    themeSettings?: {
      backgroundColor?: string
      textColor?: string
    }
    use24Hour?: boolean
    showSeconds?: boolean
  }) => void
  isSubmitting: boolean
  initialData?: {
    name: string
    clockType?: 'analog' | 'digital'
    timezone?: string
    theme?: 'light' | 'dark' | 'custom'
    themeSettings?: {
      backgroundColor?: string
      textColor?: string
    }
    use24Hour?: boolean
    showSeconds?: boolean
  }
}

const NAME_MAX_LENGTH = 100

const CLOCK_TYPE_OPTIONS = [
  { value: 'analog', label: 'Analog Clock' },
  { value: 'digital', label: 'Digital Clock' }
] as const

const THEME_OPTIONS = [
  { value: 'light', label: 'Predefined Light' },
  { value: 'dark', label: 'Predefined Dark' },
  { value: 'custom', label: 'Custom Colors' }
] as const

export default function WorldClockWidgetModal({
  onClose,
  onBack,
  onSubmit,
  isSubmitting,
  initialData
}: WorldClockWidgetModalProps) {
  const isEditMode = !!initialData
  const [name, setName] = useState(initialData?.name ?? '')
  const [nameError, setNameError] = useState('')

  // Widget specific configuration states
  const [clockType, setClockType] = useState<'analog' | 'digital'>(initialData?.clockType ?? 'analog')
  const [timezone, setTimezone] = useState<string>(initialData?.timezone ?? 'UTC')
  const [theme, setTheme] = useState<'light' | 'dark' | 'custom'>(initialData?.theme ?? 'dark')
  
  // Custom theme settings
  const [backgroundColor, setBackgroundColor] = useState(initialData?.themeSettings?.backgroundColor ?? '#090d16')
  const [textColor, setTextColor] = useState(initialData?.themeSettings?.textColor ?? '#ffffff')

  // Clock options
  const [use24Hour, setUse24Hour] = useState(initialData?.use24Hour ?? false)
  const [showSeconds, setShowSeconds] = useState(initialData?.showSeconds ?? true)

  // Hover preview overrides — applied to live preview while hovering, cleared on revert
  const [previewOverride, setPreviewOverride] = useState<{
    clockType?: 'analog' | 'digital'
    timezone?: string
    theme?: 'light' | 'dark' | 'custom'
  }>({})



  // Drag select and backdrop click detection
  const dragStartRef = useRef(false)
  const wasDropdownOpenRef = useRef(false)

  // Live simulator orientation & fullscreen
  const [previewMode, setPreviewMode] = useState<'landscape' | 'portrait'>('landscape')
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false)

  // Lock body scroll and register with modalStack
  useEffect(() => {
    modalStack.push('world-clock-widget-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('world-clock-widget-modal')
      document.body.style.overflow = ''
    }
  }, [])

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFullscreenPreview) {
          setShowFullscreenPreview(false)
        } else if (modalStack.isTop('world-clock-widget-modal')) {
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

    onSubmit(name.trim(), {
      clockType,
      timezone,
      theme,
      themeSettings: theme === 'custom' ? {
        backgroundColor,
        textColor
      } : undefined,
      use24Hour,
      showSeconds
    })
  }

  // Active configurations including hover overrides
  const activeClockType = previewOverride.clockType ?? clockType
  const activeTimezone = previewOverride.timezone ?? timezone
  const activeTheme = previewOverride.theme ?? theme

  return (
    <>
      <div
        className={`${styles.modalOverlay} ${styles.countdownWidgetOverlay}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            dragStartRef.current = true
            wasDropdownOpenRef.current = !!document.querySelector('[data-dropdown]')
          } else {
            dragStartRef.current = false
          }
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          if (!dragStartRef.current) return
          if (wasDropdownOpenRef.current) {
            wasDropdownOpenRef.current = false
            return
          }
          if (modalStack.hasActiveChildOf('world-clock-widget-modal')) {
            return
          }
          onClose()
        }}
      >
        <div
          className={`${styles.modalContainer} ${styles.countdownWidgetModal}`}
          onClick={e => e.stopPropagation()}
          style={{
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
            padding: '16px 24px',
            borderBottom: '1px solid var(--outline-variant)',
            background: 'var(--surface-low)',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className={styles.modalCloseBtn}
                  aria-label="Back to widget selection"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <Clock size={22} color="var(--primary)" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)', fontWeight: 600 }}>
                  {isEditMode ? 'Edit World Clock Widget' : 'Create World Clock Widget'}
                </h2>
                {isEditMode && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '999px', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', fontFamily: 'var(--font-label)', display: 'inline-block', marginTop: '4px' }}>EDITING</span>
                )}
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>Display beautiful real-time analog or digital clocks for any global timezone.</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn} type="button" aria-label="Close modal"><X size={20} /></button>
          </div>

          {/* Body Content with Split View */}
          <div className={styles.splitViewBody}>
            {/* Left Form Panel */}
            <form onSubmit={handleSubmit} className={styles.splitViewForm}>
              {/* Widget Name */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Widget Name*</label>
                <input
                  required
                  type="text"
                  value={name}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={e => {
                    const val = e.target.value
                    if (val.length > NAME_MAX_LENGTH) {
                      setName(val.slice(0, NAME_MAX_LENGTH))
                      setNameError(`Name cannot exceed ${NAME_MAX_LENGTH} characters.`)
                    } else {
                      setName(val)
                      setNameError(val.length === NAME_MAX_LENGTH ? `Limit reached (${NAME_MAX_LENGTH}/${NAME_MAX_LENGTH}).` : '')
                    }
                  }}
                  placeholder="e.g. London Office Clock"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${nameError ? '#ef4444' : 'var(--outline-variant)'}`,
                    background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
                {nameError && <span style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{nameError}</span>}
              </div>

              {/* Clock Type */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Clock Type</label>
                <CustomSelect
                  id="worldclock-type"
                  value={clockType}
                  options={CLOCK_TYPE_OPTIONS}
                  onChange={val => { setClockType(val as 'analog' | 'digital'); setPreviewOverride(p => ({ ...p, clockType: undefined })) }}
                  onPreviewChange={val => setPreviewOverride(p => ({ ...p, clockType: val ? val as 'analog' | 'digital' : undefined }))}
                />
              </div>

              {/* Timezone Selection */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Timezone</label>
                <TimezoneSelect
                  id="worldclock-timezone"
                  value={timezone}
                  onChange={val => { setTimezone(val); setPreviewOverride(p => ({ ...p, timezone: undefined })) }}
                  onPreviewChange={val => setPreviewOverride(p => ({ ...p, timezone: val ? val : undefined }))}
                />
              </div>

              {/* Format Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="worldclock-showseconds"
                    checked={showSeconds}
                    onChange={e => setShowSeconds(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="worldclock-showseconds" style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                    Show Seconds
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="worldclock-24hour"
                    checked={use24Hour}
                    onChange={e => setUse24Hour(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="worldclock-24hour" style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                    24-hour Format
                  </label>
                </div>
              </div>

              {/* Theme Preset */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Theme Preset*</label>
                <CustomSelect
                  id="worldclock-theme"
                  value={theme}
                  options={THEME_OPTIONS}
                  onChange={val => { setTheme(val as 'light' | 'dark' | 'custom'); setPreviewOverride(p => ({ ...p, theme: undefined })) }}
                  onPreviewChange={val => setPreviewOverride(p => ({ ...p, theme: val ? val as 'light' | 'dark' | 'custom' : undefined }))}
                />
              </div>

              {theme === 'custom' && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', background: 'var(--surface-low)',
                  border: '1.5px solid var(--outline-variant)', borderRadius: '10px', marginTop: '4px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Background Color</label>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={backgroundColor.startsWith('#') ? backgroundColor : '#090d16'}
                          onChange={e => setBackgroundColor(e.target.value)}
                          style={{ width: '36px', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px', boxSizing: 'border-box' }}
                        />
                        <input
                          type="text"
                          value={backgroundColor}
                          onChange={e => setBackgroundColor(e.target.value)}
                          placeholder="#090d16"
                          style={{ flex: 1, padding: '6px 8px', fontSize: '0.82rem', border: '1px solid var(--outline-variant)', borderRadius: '6px', background: 'var(--surface-container-lowest)', color: 'var(--on-surface)' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Text / Clock Color</label>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={textColor.startsWith('#') ? textColor : '#ffffff'}
                          onChange={e => setTextColor(e.target.value)}
                          style={{ width: '36px', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px', boxSizing: 'border-box' }}
                        />
                        <input
                          type="text"
                          value={textColor}
                          onChange={e => setTextColor(e.target.value)}
                          placeholder="#ffffff"
                          style={{ flex: 1, padding: '6px 8px', fontSize: '0.82rem', border: '1px solid var(--outline-variant)', borderRadius: '6px', background: 'var(--surface-container-lowest)', color: 'var(--on-surface)' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Right Live Simulator Panel */}
            <div className={styles.splitViewPreview}>
              {/* Preview Mode selector buttons */}
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

              {/* Simulated Screen Frame */}
              <div style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '360px', position: 'relative'
              }}>
                <div style={{
                  width: previewMode === 'landscape' ? 'min(100%, 480px)' : 'min(100%, 225px)',
                  aspectRatio: previewMode === 'landscape' ? '16 / 9' : '9 / 16',
                  background: '#000000',
                  borderRadius: '8px',
                  border: '1px solid var(--outline-variant)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FlowWorldClockRenderer
                    timezone={activeTimezone}
                    clockType={activeClockType}
                    theme={activeTheme}
                    backgroundColor={backgroundColor}
                    textColor={textColor}
                    use24Hour={use24Hour}
                    showSeconds={showSeconds}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--outline-variant)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            background: 'var(--surface-low)',
            gap: '12px',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px'
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
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Widget'}
            </button>
          </div>
        </div>
      </div>

      {/* FULLSCREEN REAL-TIME LIVE PREVIEW POPUP */}
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
          <div style={{
            width: previewMode === 'landscape' ? 'min(90vw, calc((90vh * 16) / 9))' : 'min(90vw, calc((90vh * 9) / 16))',
            height: previewMode === 'landscape' ? 'min(90vh, calc((90vw * 9) / 16))' : 'min(90vh, calc((90vw * 16) / 9))',
            background: '#000000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FlowWorldClockRenderer
              timezone={activeTimezone}
              clockType={activeClockType}
              theme={activeTheme}
              backgroundColor={backgroundColor}
              textColor={textColor}
              use24Hour={use24Hour}
              showSeconds={showSeconds}
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
