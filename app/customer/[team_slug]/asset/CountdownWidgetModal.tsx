'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Monitor, Smartphone, Maximize, Hourglass, ChevronDown, Calendar, Clock as ClockIcon, ArrowLeft } from 'lucide-react'
import styles from './Modal.module.css'
import FlowCountdownRenderer from '@/app/components/FlowCountdownRenderer'
import { modalStack } from '@/lib/utils/modalStack'
import CustomSelect from '../components/CustomSelect'
import ThemeSelect from '../components/ThemeSelect'

interface CountdownWidgetModalProps {
  onClose: () => void
  onBack?: () => void
  onSubmit: (name: string, config: {
    text: string
    endTime: string
    endMessage: string
    timerStyle: 'flip' | 'digital' | 'modern' | 'minimal' | 'card'
    daysOnly: boolean
    theme: 'light' | 'dark' | 'sunset' | 'neon' | 'ocean' | 'custom'
    themeSettings: {
      primaryColor?: string
      secondaryColor?: string
      backgroundColor?: string
      textColor?: string
      backgroundImage?: string
    }
  }) => void
  isSubmitting: boolean
  initialData?: {
    name: string
    text?: string
    endTime?: string
    endMessage?: string
    timerStyle?: string
    daysOnly?: boolean
    theme?: string
    themeSettings?: {
      primaryColor?: string
      secondaryColor?: string
      backgroundColor?: string
      textColor?: string
      backgroundImage?: string
    }
  }
}

const NAME_MAX_LENGTH = 100
const TEXT_MAX_LENGTH = 150
const MESSAGE_MAX_LENGTH = 200

const STYLE_OPTIONS = [
  { value: 'card', label: 'Card Layout' },
  { value: 'flip', label: 'Flip Clock' },
  { value: 'digital', label: 'Digital Grid' },
  { value: 'modern', label: 'Modern Accent' },
  { value: 'minimal', label: 'Minimalist' },
] as const

const THEME_OPTIONS = [
  { value: 'dark', label: 'Deep Dark' },
  { value: 'light', label: 'Clean Light' },
  { value: 'sunset', label: 'Sunset Gradient' },
  { value: 'neon', label: 'Neon Glow' },
  { value: 'ocean', label: 'Ocean Breeze' },
  { value: 'custom', label: 'Custom Styles' },
] as const

type TimerStyle = typeof STYLE_OPTIONS[number]['value']
type ThemeOption = typeof THEME_OPTIONS[number]['value']

function getDefaultEndTimeParts() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(12, 0, 0, 0)

  return {
    year: tomorrow.getFullYear(),
    month: tomorrow.getMonth() + 1,
    day: tomorrow.getDate(),
    hour: 12,
    minute: 0,
    second: 0,
    iso: tomorrow.toISOString()
  }
}

export default function CountdownWidgetModal({
  onClose,
  onBack,
  onSubmit,
  isSubmitting,
  initialData,
}: CountdownWidgetModalProps) {
  const isEditMode = !!initialData
  const [name, setName] = useState(initialData?.name ?? '')
  const [nameError, setNameError] = useState('')
  
  // Widget specific configuration states
  const [text, setText] = useState(initialData?.text ?? 'Event Starts In')
  const [endMessage, setEndMessage] = useState(initialData?.endMessage ?? 'Event Has Begun!')
  const [timerStyle, setTimerStyle] = useState<TimerStyle>((initialData?.timerStyle as TimerStyle) ?? 'card')
  const [daysOnly, setDaysOnly] = useState(initialData?.daysOnly ?? false)
  const [theme, setTheme] = useState<ThemeOption>((initialData?.theme as ThemeOption) ?? 'dark')
  
  // Theme Settings
  const [primaryColor, setPrimaryColor] = useState(initialData?.themeSettings?.primaryColor ?? '#38bdf8')
  const [secondaryColor, setSecondaryColor] = useState(initialData?.themeSettings?.secondaryColor ?? '#818cf8')
  const [backgroundColor, setBackgroundColor] = useState(initialData?.themeSettings?.backgroundColor ?? '#090d16')
  const [textColor, setTextColor] = useState(initialData?.themeSettings?.textColor ?? '#f8fafc')
  const [backgroundImage, setBackgroundImage] = useState(initialData?.themeSettings?.backgroundImage ?? '')

  // Collapsible section visibility states
  const [showStyle, setShowStyle] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Hover preview overrides — applied to live preview while hovering, cleared on revert
  const [previewOverride, setPreviewOverride] = useState<{
    timerStyle?: TimerStyle
    theme?: ThemeOption
  }>({})
  
  // Date & Time Picker states — initialise from existing endTime if editing
  const [initialEndTime] = useState(() => {
    if (initialData?.endTime) {
      try {
        const d = new Date(initialData.endTime)
        return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(), iso: initialData.endTime }
      } catch { /* fall through */ }
    }
    return getDefaultEndTimeParts()
  })
  const [showPicker, setShowPicker] = useState(false)
  const [pickYear, setPickYear] = useState(initialEndTime.year)
  const [pickMonth, setPickMonth] = useState(initialEndTime.month)
  const [pickDay, setPickDay] = useState(initialEndTime.day)
  const [pickHour, setPickHour] = useState(initialEndTime.hour)
  const [pickMinute, setPickMinute] = useState(initialEndTime.minute)
  const [pickSecond, setPickSecond] = useState(initialEndTime.second)
  const [endTimeStr, setEndTimeStr] = useState(initialEndTime.iso)

  const dragStartRef = useRef(false)
  const wasDropdownOpenRef = useRef(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Live simulator orientation & fullscreen
  const [previewMode, setPreviewMode] = useState<'landscape' | 'portrait'>('landscape')
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false)

  // Sync date selection to final ISO string
  const updateEndTime = (y: number, m: number, d: number, hr: number, min: number, sec: number) => {
    try {
      const cleanM = Math.max(1, Math.min(12, m))
      const maxDays = new Date(y, cleanM, 0).getDate()
      const cleanD = Math.max(1, Math.min(maxDays, d))
      const cleanHr = Math.max(0, Math.min(23, hr))
      const cleanMin = Math.max(0, Math.min(59, min))
      const cleanSec = Math.max(0, Math.min(59, sec))

      const target = new Date(y, cleanM - 1, cleanD, cleanHr, cleanMin, cleanSec)
      setEndTimeStr(target.toISOString())
    } catch (err) {
      console.error('Error updating end date:', err)
    }
  }

  // Handle outside click to close picker
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showPicker])

  // Register Datepicker with modalStack
  useEffect(() => {
    if (showPicker) {
      modalStack.push('countdown-widget-picker')
    } else {
      modalStack.pop('countdown-widget-picker')
    }
    return () => {
      modalStack.pop('countdown-widget-picker')
    }
  }, [showPicker])

  // Lock body scroll and register with modalStack
  useEffect(() => {
    modalStack.push('countdown-widget-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('countdown-widget-modal')
      document.body.style.overflow = ''
    }
  }, [])

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFullscreenPreview) {
          setShowFullscreenPreview(false)
        } else if (modalStack.isTop('countdown-widget-modal')) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFullscreenPreview, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !name.trim() || !endTimeStr) return

    onSubmit(name.trim(), {
      text: text.trim().slice(0, TEXT_MAX_LENGTH),
      endTime: endTimeStr,
      endMessage: endMessage.trim().slice(0, MESSAGE_MAX_LENGTH),
      timerStyle,
      daysOnly,
      theme,
      themeSettings: {
        primaryColor: theme === 'custom' ? primaryColor : undefined,
        secondaryColor: theme === 'custom' ? secondaryColor : undefined,
        backgroundColor: theme === 'custom' ? backgroundColor : undefined,
        textColor: theme === 'custom' ? textColor : undefined,
        backgroundImage: theme === 'custom' && backgroundImage.trim() ? backgroundImage.trim() : undefined,
      }
    })
  }

  const getReadableEndTime = () => {
    if (!endTimeStr) return 'Select date and time...'
    const d = new Date(endTimeStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  const handleThemeChange = (selectedTheme: typeof theme) => {
    setTheme(selectedTheme)
    if (selectedTheme === 'light') {
      setPrimaryColor('#4f46e5')
      setSecondaryColor('#0ea5e9')
      setBackgroundColor('#f8fafc')
      setTextColor('#0f172a')
    } else if (selectedTheme === 'dark') {
      setPrimaryColor('#38bdf8')
      setSecondaryColor('#818cf8')
      setBackgroundColor('#090d16')
      setTextColor('#f8fafc')
    } else if (selectedTheme === 'sunset') {
      setPrimaryColor('#fca5a5')
      setSecondaryColor('#f472b6')
      setBackgroundColor('linear-gradient(135deg, #e11d48, #4f46e5)')
      setTextColor('#ffffff')
    } else if (selectedTheme === 'neon') {
      setPrimaryColor('#00f0ff')
      setSecondaryColor('#ff00cc')
      setBackgroundColor('#000000')
      setTextColor('#ffffff')
    } else if (selectedTheme === 'ocean') {
      setPrimaryColor('#22d3ee')
      setSecondaryColor('#0d9488')
      setBackgroundColor('linear-gradient(135deg, #0f172a, #115e59)')
      setTextColor('#ffffff')
    }
  }

  // Active Style and Theme incorporating hover preview overrides
  const activeStyle = previewOverride.timerStyle ?? timerStyle
  const activeTheme = previewOverride.theme ?? theme

  const getThemeColors = (themeName: string) => {
    if (themeName === 'light') {
      return { primaryColor: '#4f46e5', secondaryColor: '#0ea5e9', backgroundColor: '#f8fafc', textColor: '#0f172a' }
    } else if (themeName === 'dark') {
      return { primaryColor: '#38bdf8', secondaryColor: '#818cf8', backgroundColor: '#090d16', textColor: '#f8fafc' }
    } else if (themeName === 'sunset') {
      return { primaryColor: '#fca5a5', secondaryColor: '#f472b6', backgroundColor: 'linear-gradient(135deg, #e11d48, #4f46e5)', textColor: '#ffffff' }
    } else if (themeName === 'neon') {
      return { primaryColor: '#00f0ff', secondaryColor: '#ff00cc', backgroundColor: '#000000', textColor: '#ffffff' }
    } else if (themeName === 'ocean') {
      return { primaryColor: '#22d3ee', secondaryColor: '#0d9488', backgroundColor: 'linear-gradient(135deg, #0f172a, #115e59)', textColor: '#ffffff' }
    }
    return { primaryColor, secondaryColor, backgroundColor, textColor, backgroundImage }
  }

  const activeColors = getThemeColors(activeTheme)

  const simulatedConfig = {
    text,
    endTime: endTimeStr,
    endMessage,
    timerStyle: activeStyle,
    daysOnly,
    theme: activeTheme,
    themeSettings: {
      primaryColor: activeColors.primaryColor,
      secondaryColor: activeColors.secondaryColor,
      backgroundColor: activeColors.backgroundColor,
      textColor: activeColors.textColor,
      backgroundImage: activeColors.backgroundImage?.trim() || undefined,
    }
  }

  const currentYear = new Date().getFullYear()
  const maxPickerDay = new Date(pickYear, pickMonth, 0).getDate()
  const yearOptions = Array.from({ length: 15 }, (_, i) => {
    const year = currentYear + i
    return { value: year, label: String(year) }
  })
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    return { value: month, label: String(month).padStart(2, '0') }
  })
  const dayOptions = Array.from({ length: maxPickerDay }, (_, i) => {
    const day = i + 1
    return { value: day, label: String(day).padStart(2, '0') }
  })
  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: String(hour).padStart(2, '0')
  }))
  const minuteSecondOptions = Array.from({ length: 60 }, (_, value) => ({
    value,
    label: String(value).padStart(2, '0')
  }))
  const previewAspectRatio = previewMode === 'landscape' ? '16 / 9' : '9 / 16'
  const previewMaxWidth = previewMode === 'landscape' ? 'min(100%, 760px)' : 'min(100%, 360px)'

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
          if (modalStack.hasActiveChildOf('countdown-widget-modal')) {
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
            background: 'rgba(7, 17, 31, 0.4)',
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
              <Hourglass size={22} color="var(--primary)" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)', fontWeight: 600 }}>
                  {isEditMode ? 'Edit Countdown Widget' : 'Create Countdown Widget'}
                </h2>
                {isEditMode && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '999px', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', fontFamily: 'var(--font-label)', display: 'inline-block', marginTop: '4px' }}>EDITING</span>
                )}
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>Display beautiful real-time timers for sales, announcements, or events.</p>
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
                  placeholder="e.g. Black Friday Launch Timer"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${nameError ? '#ef4444' : 'var(--outline-variant)'}`,
                    background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none'
                  }}
                />
                {nameError && <span style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{nameError}</span>}
              </div>

              {/* Text / Label */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Heading Text*</label>
                <input
                  required
                  type="text"
                  value={text}
                  maxLength={TEXT_MAX_LENGTH}
                  onChange={e => setText(e.target.value.slice(0, TEXT_MAX_LENGTH))}
                  placeholder="e.g. Sale Ends In"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none'
                  }}
                />
              </div>

              {/* End Time Date-Time picker */}
              <div style={{ position: 'relative' }} ref={pickerRef}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>End Time*</label>
                <button
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none',
                    textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} style={{ color: 'var(--primary)' }} />
                    {getReadableEndTime()}
                  </span>
                  <ChevronDown size={14} style={{ opacity: 0.6 }} />
                </button>

                {/* Custom Date Time Picker Dropdown */}
                {showPicker && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface-lowest)',
                    border: '1px solid var(--outline-variant)', borderRadius: '10px', boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
                    zIndex: 100, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
                  }} data-dropdown="countdown-date-picker">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Year</label>
                        <CustomSelect
                          id="countdown-picker-year"
                          value={pickYear}
                          options={yearOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            const nextDay = Math.min(pickDay, new Date(val, pickMonth, 0).getDate())
                            setPickYear(val)
                            setPickDay(nextDay)
                            updateEndTime(val, pickMonth, nextDay, pickHour, pickMinute, pickSecond)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Month</label>
                        <CustomSelect
                          id="countdown-picker-month"
                          value={pickMonth}
                          options={monthOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            const nextDay = Math.min(pickDay, new Date(pickYear, val, 0).getDate())
                            setPickMonth(val)
                            setPickDay(nextDay)
                            updateEndTime(pickYear, val, nextDay, pickHour, pickMinute, pickSecond)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Day</label>
                        <CustomSelect
                          id="countdown-picker-day"
                          value={Math.min(pickDay, maxPickerDay)}
                          options={dayOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            setPickDay(val)
                            updateEndTime(pickYear, pickMonth, val, pickHour, pickMinute, pickSecond)
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', borderTop: '1px solid var(--outline-variant)', paddingTop: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><ClockIcon size={12}/> Hour</label>
                        <CustomSelect
                          id="countdown-picker-hour"
                          value={pickHour}
                          options={hourOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            setPickHour(val)
                            updateEndTime(pickYear, pickMonth, pickDay, val, pickMinute, pickSecond)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Minute</label>
                        <CustomSelect
                          id="countdown-picker-minute"
                          value={pickMinute}
                          options={minuteSecondOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            setPickMinute(val)
                            updateEndTime(pickYear, pickMonth, pickDay, pickHour, val, pickSecond)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Second</label>
                        <CustomSelect
                          id="countdown-picker-second"
                          value={pickSecond}
                          options={minuteSecondOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            setPickSecond(val)
                            updateEndTime(pickYear, pickMonth, pickDay, pickHour, pickMinute, val)
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button 
                        type="button" 
                        onClick={() => {
                          const now = new Date()
                          setPickYear(now.getFullYear())
                          setPickMonth(now.getMonth() + 1)
                          setPickDay(now.getDate())
                          setPickHour(now.getHours())
                          setPickMinute(now.getMinutes())
                          setPickSecond(now.getSeconds())
                          setEndTimeStr(now.toISOString())
                        }}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--outline-variant)', background: 'var(--surface-container)', fontSize: '0.78rem', color: 'var(--on-surface)', cursor: 'pointer' }}
                      >
                        Reset to Now
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowPicker(false)}
                        style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--primary)', fontSize: '0.78rem', color: 'var(--on-primary)', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Timer Style */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>Timer Style</label>
                <CustomSelect
                  id="countdown-timer-style"
                  value={timerStyle}
                  options={STYLE_OPTIONS}
                  onChange={val => { setTimerStyle(val as TimerStyle); setPreviewOverride(p => ({ ...p, timerStyle: undefined })) }}
                  onPreviewChange={val => setPreviewOverride(p => ({ ...p, timerStyle: val ? val as TimerStyle : undefined }))}
                />
              </div>

              {/* Theme Settings Container */}
              <div className={`${styles.collapsibleContainer} ${showStyle ? styles.collapsibleContainerActive : ''}`}>
                <div 
                  className={styles.collapsibleHeader}
                  onClick={() => setShowStyle(!showStyle)}
                >
                  <span>Theme Settings</span>
                  <span>{showStyle ? '▲' : '▼'}</span>
                </div>
                {showStyle && (
                  <div className={styles.collapsibleContent}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                        Theme Preset*
                      </label>
                      <ThemeSelect
                        id="countdown-theme"
                        value={theme}
                        options={THEME_OPTIONS}
                        onChange={val => { handleThemeChange(val as ThemeOption); setPreviewOverride(p => ({ ...p, theme: undefined })) }}
                        onPreviewChange={val => setPreviewOverride(p => ({ ...p, theme: val ? val as ThemeOption : undefined }))}
                        previewDelay={500}
                        primaryColor={primaryColor}
                        secondaryColor={secondaryColor}
                        backgroundColor={backgroundColor}
                      />
                    </div>

                    {theme === 'custom' && (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', background: 'rgba(0, 0, 0, 0.03)',
                        border: '1px dashed var(--outline-variant)', borderRadius: '10px', marginTop: '12px'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Primary Color</label>
                            <input
                              type="color"
                              value={primaryColor}
                              onChange={e => setPrimaryColor(e.target.value)}
                              style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Secondary Color</label>
                            <input
                              type="color"
                              value={secondaryColor}
                              onChange={e => setSecondaryColor(e.target.value)}
                              style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Background Color</label>
                            <input
                              type="color"
                              value={backgroundColor}
                              onChange={e => setBackgroundColor(e.target.value)}
                              style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Text Color</label>
                            <input
                              type="color"
                              value={textColor}
                              onChange={e => setTextColor(e.target.value)}
                              style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Background Image URL (Optional)</label>
                          <input
                            type="text"
                            value={backgroundImage}
                            onChange={e => setBackgroundImage(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            style={{
                              width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--outline-variant)',
                              background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontSize: '0.84rem'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Advanced Settings Container */}
              <div className={`${styles.collapsibleContainer} ${showAdvanced ? styles.collapsibleContainerActive : ''}`}>
                <div 
                  className={styles.collapsibleHeader}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span>Advanced Settings</span>
                  <span>{showAdvanced ? '▲' : '▼'}</span>
                </div>
                {showAdvanced && (
                  <div className={styles.collapsibleContent}>
                    {/* End Message */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>End Message*</label>
                      <input
                        required
                        type="text"
                        value={endMessage}
                        maxLength={MESSAGE_MAX_LENGTH}
                        onChange={e => setEndMessage(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                        placeholder="e.g. Sale is now closed!"
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--outline-variant)',
                          background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none'
                        }}
                      />
                    </div>

                    {/* Display Format (Days Only) */}
                    <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: '12px', marginTop: '12px' }}>
                      <span style={{ display: 'block', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600, marginBottom: '8px' }}>Display Format*</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="daysOnlyCheckbox"
                          checked={daysOnly}
                          onChange={e => setDaysOnly(e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                        <label htmlFor="daysOnlyCheckbox" style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                          Days Only
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

              {/* Simulated Screen Frame with Scaled Down Target Proportions */}
              <div style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '360px', position: 'relative'
              }}>
                <div style={{
                  width: previewMaxWidth,
                  aspectRatio: previewAspectRatio,
                  background: '#000000',
                  borderRadius: '8px',
                  border: '1px solid var(--outline-variant)',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.24)'
                }}>
                  <FlowCountdownRenderer
                    text={simulatedConfig.text}
                    endTime={simulatedConfig.endTime}
                    endMessage={simulatedConfig.endMessage}
                    timerStyle={simulatedConfig.timerStyle}
                    daysOnly={simulatedConfig.daysOnly}
                    theme={simulatedConfig.theme}
                    themeSettings={simulatedConfig.themeSettings}
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
            background: 'rgba(7, 17, 31, 0.4)',
            gap: '12px',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px', background: 'transparent', color: 'var(--on-surface-muted)', border: 'none', borderRadius: '8px',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: '0.88rem'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !endTimeStr}
              style={{
                padding: '10px 24px',
                background: (!name.trim() || !endTimeStr) ? 'var(--surface-low)' : 'var(--primary)',
                color: (!name.trim() || !endTimeStr) ? 'var(--on-surface-subtle)' : 'var(--on-primary)',
                border: 'none', borderRadius: '8px', fontWeight: 600,
                cursor: (isSubmitting || !name.trim() || !endTimeStr) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || !name.trim() || !endTimeStr) ? 0.7 : 1,
                boxShadow: (!name.trim() || !endTimeStr) ? 'none' : '0 4px 12px rgba(9, 76, 178, 0.2)',
                fontFamily: 'var(--font-label)', fontSize: '0.88rem'
              }}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Widget'}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Live Preview */}
      {showFullscreenPreview && (
        <div style={{
          position: 'fixed', inset: 0, background: '#05070a', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 200ms ease-out'
        }}>
          <div style={{
            width: previewMode === 'landscape' ? 'min(90vw, calc((90vh * 16) / 9))' : 'min(90vw, calc((90vh * 9) / 16))',
            height: previewMode === 'landscape' ? 'min(90vh, calc((90vw * 9) / 16))' : 'min(90vh, calc((90vw * 16) / 9))',
            background: '#000000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FlowCountdownRenderer
              text={simulatedConfig.text}
              endTime={simulatedConfig.endTime}
              endMessage={simulatedConfig.endMessage}
              timerStyle={simulatedConfig.timerStyle}
              daysOnly={simulatedConfig.daysOnly}
              theme={simulatedConfig.theme}
              themeSettings={simulatedConfig.themeSettings}
            />
          </div>

          <div style={{
            position: 'absolute', top: '24px', right: '24px', display: 'flex', alignItems: 'center', gap: '12px',
            background: 'rgba(0, 0, 0, 0.6)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
            borderRadius: '30px', padding: '6px 16px', color: '#ffffff', fontSize: '0.86rem', fontFamily: 'var(--font-label)', fontWeight: 500, pointerEvents: 'none'
          }}>
            <span>Fullscreen Preview ({previewMode === 'landscape' ? '16:9' : '9:16'})</span>
            <button
              onClick={() => setShowFullscreenPreview(false)}
              style={{
                background: '#ffffff', border: 'none', color: '#000000', borderRadius: '50%', width: '26px', height: '26px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto', transition: 'transform 0.2s'
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
