'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Monitor, Smartphone, Maximize, Timer, Calendar, Clock as ClockIcon, ChevronDown } from 'lucide-react'
import styles from './Modal.module.css'
import FlowCountUpRenderer from '@/app/components/FlowCountUpRenderer'
import ScaledScreenPreview from '@/app/components/ScaledScreenPreview'
import { modalStack } from '@/lib/utils/modalStack'
import CustomSelect from '../components/CustomSelect'
import ThemeSelect from '../components/ThemeSelect'

interface CountUpWidgetModalProps {
  onClose: () => void
  onSubmit: (name: string, config: {
    text: string
    startTime: string
    endTime?: string
    endMessage?: string
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
    advancedSettings?: {
      showDate?: boolean
      dateFormat?: 'January 01, 2024' | 'Monday, January 01, 2024' | 'Mon, Jan 01, 2024' | '31/01/2024' | 'Monday, 31/01/2024' | '01/31/2024 (US)' | '2024-01-31'
    }
  }) => void
  isSubmitting: boolean
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

const DATE_FORMATS = [
  { value: 'January 01, 2024', label: 'January 01, 2024' },
  { value: 'Monday, January 01, 2024', label: 'Monday, January 01, 2024' },
  { value: 'Mon, Jan 01, 2024', label: 'Mon, Jan 01, 2024' },
  { value: '31/01/2024', label: '31/01/2024' },
  { value: 'Monday, 31/01/2024', label: 'Monday, 31/01/2024' },
  { value: '01/31/2024 (US)', label: '01/31/2024 (US)' },
  { value: '2024-01-31', label: '2024-01-31' },
] as const

type TimerStyle = typeof STYLE_OPTIONS[number]['value']
type ThemeOption = typeof THEME_OPTIONS[number]['value']
type DateFormat = typeof DATE_FORMATS[number]['value']

function getDefaultStartTimeParts() {
  const now = new Date()
  now.setSeconds(0, 0)
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: 0,
    iso: now.toISOString()
  }
}

function getDefaultEndTimeParts() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(d.getHours(), d.getMinutes(), 0, 0)
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: 0,
    iso: d.toISOString()
  }
}

export default function CountUpWidgetModal({
  onClose,
  onSubmit,
  isSubmitting
}: CountUpWidgetModalProps) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')

  // Core widget fields
  const [text, setText] = useState('Time Since Event')
  const [timerStyle, setTimerStyle] = useState<TimerStyle>('card')
  const [daysOnly, setDaysOnly] = useState(false)
  const [theme, setTheme] = useState<ThemeOption>('dark')

  // Collapsible section visibility states
  const [showStyle, setShowStyle] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Theme Settings
  const [primaryColor, setPrimaryColor] = useState('#38bdf8')
  const [secondaryColor, setSecondaryColor] = useState('#818cf8')
  const [backgroundColor, setBackgroundColor] = useState('#090d16')
  const [textColor, setTextColor] = useState('#f8fafc')
  const [backgroundImage, setBackgroundImage] = useState('')

  // Advanced (UI-only, no JSON editor)
  const [showDate, setShowDate] = useState(false)
  const [dateFormat, setDateFormat] = useState<DateFormat>('January 01, 2024')

  // Optional end message
  const [endEnabled, setEndEnabled] = useState(false)
  const [endMessage, setEndMessage] = useState('Milestone reached!')

  // Hover preview overrides
  const [previewOverride, setPreviewOverride] = useState<{
    timerStyle?: TimerStyle
    theme?: ThemeOption
  }>({})

  // Start time picker
  const [initialStartTime] = useState(getDefaultStartTimeParts)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [startYear, setStartYear] = useState(initialStartTime.year)
  const [startMonth, setStartMonth] = useState(initialStartTime.month)
  const [startDay, setStartDay] = useState(initialStartTime.day)
  const [startHour, setStartHour] = useState(initialStartTime.hour)
  const [startMinute, setStartMinute] = useState(initialStartTime.minute)
  const [startSecond, setStartSecond] = useState(initialStartTime.second)
  const [startTimeStr, setStartTimeStr] = useState(initialStartTime.iso)
  const startPickerRef = useRef<HTMLDivElement>(null)

  // End time picker
  const [initialEndTime] = useState(getDefaultEndTimeParts)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [endYear, setEndYear] = useState(initialEndTime.year)
  const [endMonth, setEndMonth] = useState(initialEndTime.month)
  const [endDay, setEndDay] = useState(initialEndTime.day)
  const [endHour, setEndHour] = useState(initialEndTime.hour)
  const [endMinute, setEndMinute] = useState(initialEndTime.minute)
  const [endSecond, setEndSecond] = useState(initialEndTime.second)
  const [endTimeStr, setEndTimeStr] = useState(initialEndTime.iso)
  const endPickerRef = useRef<HTMLDivElement>(null)

  const dragStartRef = useRef(false)
  const wasDropdownOpenRef = useRef(false)

  // Live preview orientation & fullscreen
  const [previewMode, setPreviewMode] = useState<'landscape' | 'portrait'>('landscape')
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false)

  const updateIsoTime = (
    setIso: (iso: string) => void,
    y: number, m: number, d: number, hr: number, min: number, sec: number
  ) => {
    try {
      const cleanM = Math.max(1, Math.min(12, m))
      const maxDays = new Date(y, cleanM, 0).getDate()
      const cleanD = Math.max(1, Math.min(maxDays, d))
      const cleanHr = Math.max(0, Math.min(23, hr))
      const cleanMin = Math.max(0, Math.min(59, min))
      const cleanSec = Math.max(0, Math.min(59, sec))
      const target = new Date(y, cleanM - 1, cleanD, cleanHr, cleanMin, cleanSec)
      setIso(target.toISOString())
    } catch (err) {
      console.error('Error updating date/time:', err)
    }
  }

  const getReadableTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    } catch {
      return 'Select date and time...'
    }
  }

  // Close pickers on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (showStartPicker && startPickerRef.current && !startPickerRef.current.contains(e.target as Node)) {
        setShowStartPicker(false)
      }
      if (showEndPicker && endPickerRef.current && !endPickerRef.current.contains(e.target as Node)) {
        setShowEndPicker(false)
      }
    }
    if (showStartPicker || showEndPicker) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showStartPicker, showEndPicker])

  // Register pickers with modalStack so outside-click closes dropdowns first
  useEffect(() => {
    if (showStartPicker) modalStack.push('countup-widget-start-picker')
    else modalStack.pop('countup-widget-start-picker')
    return () => modalStack.pop('countup-widget-start-picker')
  }, [showStartPicker])
  useEffect(() => {
    if (showEndPicker) modalStack.push('countup-widget-end-picker')
    else modalStack.pop('countup-widget-end-picker')
    return () => modalStack.pop('countup-widget-end-picker')
  }, [showEndPicker])

  // Lock body scroll and register modal
  useEffect(() => {
    modalStack.push('countup-widget-modal')
    document.body.style.overflow = 'hidden'
    return () => {
      modalStack.pop('countup-widget-modal')
      document.body.style.overflow = ''
    }
  }, [])

  // ESC closes fullscreen first; otherwise only closes modal if top-most
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showFullscreenPreview) {
        setShowFullscreenPreview(false)
      } else if (modalStack.isTop('countup-widget-modal')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFullscreenPreview, onClose])

  const handleThemeChange = (selectedTheme: ThemeOption) => {
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

  const activeStyle = previewOverride.timerStyle ?? timerStyle
  const activeTheme = previewOverride.theme ?? theme

  const simulatedConfig = {
    text,
    startTime: startTimeStr,
    endTime: endEnabled ? endTimeStr : undefined,
    endMessage: endEnabled ? endMessage : undefined,
    timerStyle: activeStyle,
    daysOnly,
    theme: activeTheme,
    themeSettings: {
      primaryColor: activeTheme === 'custom' ? primaryColor : undefined,
      secondaryColor: activeTheme === 'custom' ? secondaryColor : undefined,
      backgroundColor: activeTheme === 'custom' ? backgroundColor : undefined,
      textColor: activeTheme === 'custom' ? textColor : undefined,
      backgroundImage: activeTheme === 'custom' && backgroundImage.trim() ? backgroundImage.trim() : undefined,
    },
    advancedSettings: {
      showDate,
      dateFormat,
    }
  } as const

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 20 }, (_, i) => {
    const y = currentYear - 5 + i
    return { value: y, label: String(y) }
  })
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return { value: m, label: String(m).padStart(2, '0') }
  })
  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: String(hour).padStart(2, '0') }))
  const minuteSecondOptions = Array.from({ length: 60 }, (_, value) => ({ value, label: String(value).padStart(2, '0') }))

  const maxStartDay = new Date(startYear, startMonth, 0).getDate()
  const startDayOptions = Array.from({ length: maxStartDay }, (_, i) => {
    const d = i + 1
    return { value: d, label: String(d).padStart(2, '0') }
  })

  const maxEndDay = new Date(endYear, endMonth, 0).getDate()
  const endDayOptions = Array.from({ length: maxEndDay }, (_, i) => {
    const d = i + 1
    return { value: d, label: String(d).padStart(2, '0') }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !name.trim() || !startTimeStr) return

    onSubmit(name.trim(), {
      text: text.trim().slice(0, TEXT_MAX_LENGTH),
      startTime: startTimeStr,
      endTime: endEnabled ? endTimeStr : undefined,
      endMessage: endEnabled ? endMessage.trim().slice(0, MESSAGE_MAX_LENGTH) : undefined,
      timerStyle,
      daysOnly,
      theme,
      themeSettings: {
        primaryColor: theme === 'custom' ? primaryColor : undefined,
        secondaryColor: theme === 'custom' ? secondaryColor : undefined,
        backgroundColor: theme === 'custom' ? backgroundColor : undefined,
        textColor: theme === 'custom' ? textColor : undefined,
        backgroundImage: theme === 'custom' && backgroundImage.trim() ? backgroundImage.trim() : undefined,
      },
      advancedSettings: { showDate, dateFormat },
    })
  }

  return (
    <>
      <div
        className={`${styles.modalOverlay} ${styles.countupWidgetOverlay}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            dragStartRef.current = true
            wasDropdownOpenRef.current = !!document.querySelector('[class*="colorPickerPopover"], [data-dropdown]')
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
          if (modalStack.hasActiveChildOf('countup-widget-modal')) return
          onClose()
        }}
      >
        <div
          className={`${styles.modalContainer} ${styles.countupWidgetModal}`}
          onClick={e => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', padding: 0 }}
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
              <Timer size={22} color="var(--primary)" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--on-surface)', fontWeight: 600 }}>
                  Create CountUp Widget
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--on-surface-subtle)' }}>
                  Display time elapsed since a chosen start time.
                </p>
              </div>
            </div>
            <button onClick={onClose} className={styles.modalCloseBtn} aria-label="Close modal"><X size={20} /></button>
          </div>

          {/* Body */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            flex: 1,
            minHeight: 0,
            background: 'var(--surface-lowest)',
            overflowY: 'auto'
          }}>
            {/* Left Form Panel */}
            <form onSubmit={handleSubmit} style={{
              flex: '1 1 480px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              borderRight: '1px solid var(--outline-variant)'
            }}>
              {/* Widget Name */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                  Widget Name*
                </label>
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
                  placeholder="e.g. Days Since Launch"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${nameError ? '#ef4444' : 'var(--outline-variant)'}`,
                    background: 'var(--surface-container-lowest)',
                    color: 'var(--on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
                {nameError && <span style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{nameError}</span>}
              </div>

              {/* Heading Text */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                  Heading Text*
                </label>
                <input
                  required
                  type="text"
                  value={text}
                  maxLength={TEXT_MAX_LENGTH}
                  onChange={e => setText(e.target.value.slice(0, TEXT_MAX_LENGTH))}
                  placeholder="e.g. Time Since Incident"
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

              {/* Start Time picker */}
              <div style={{ position: 'relative' }} ref={startPickerRef}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                  Start Time*
                </label>
                <button
                  type="button"
                  onClick={() => setShowStartPicker(v => !v)}
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
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} style={{ color: 'var(--primary)' }} />
                    {getReadableTime(startTimeStr)}
                  </span>
                  <ChevronDown size={14} style={{ opacity: 0.6 }} />
                </button>

                {showStartPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface-lowest)',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '10px',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
                      zIndex: 100,
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                    data-dropdown="countup-start-picker"
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Year</label>
                        <CustomSelect
                          id="countup-start-year"
                          value={startYear}
                          options={yearOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            const nextDay = Math.min(startDay, new Date(val, startMonth, 0).getDate())
                            setStartYear(val)
                            setStartDay(nextDay)
                            updateIsoTime(setStartTimeStr, val, startMonth, nextDay, startHour, startMinute, startSecond)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Month</label>
                        <CustomSelect
                          id="countup-start-month"
                          value={startMonth}
                          options={monthOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            const nextDay = Math.min(startDay, new Date(startYear, val, 0).getDate())
                            setStartMonth(val)
                            setStartDay(nextDay)
                            updateIsoTime(setStartTimeStr, startYear, val, nextDay, startHour, startMinute, startSecond)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Day</label>
                        <CustomSelect
                          id="countup-start-day"
                          value={Math.min(startDay, maxStartDay)}
                          options={startDayOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            setStartDay(val)
                            updateIsoTime(setStartTimeStr, startYear, startMonth, val, startHour, startMinute, startSecond)
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', borderTop: '1px solid var(--outline-variant)', paddingTop: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><ClockIcon size={12}/> Hour</label>
                        <CustomSelect
                          id="countup-start-hour"
                          value={startHour}
                          options={hourOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            setStartHour(val)
                            updateIsoTime(setStartTimeStr, startYear, startMonth, startDay, val, startMinute, startSecond)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Minute</label>
                        <CustomSelect
                          id="countup-start-minute"
                          value={startMinute}
                          options={minuteSecondOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            setStartMinute(val)
                            updateIsoTime(setStartTimeStr, startYear, startMonth, startDay, startHour, val, startSecond)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Second</label>
                        <CustomSelect
                          id="countup-start-second"
                          value={startSecond}
                          options={minuteSecondOptions}
                          onChange={(value) => {
                            const val = Number(value)
                            setStartSecond(val)
                            updateIsoTime(setStartTimeStr, startYear, startMonth, startDay, startHour, startMinute, val)
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date()
                          setStartYear(now.getFullYear())
                          setStartMonth(now.getMonth() + 1)
                          setStartDay(now.getDate())
                          setStartHour(now.getHours())
                          setStartMinute(now.getMinutes())
                          setStartSecond(0)
                          now.setSeconds(0, 0)
                          setStartTimeStr(now.toISOString())
                        }}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--outline-variant)', background: 'var(--surface-container)', fontSize: '0.78rem', color: 'var(--on-surface)', cursor: 'pointer' }}
                      >
                        Reset to Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowStartPicker(false)}
                        style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--primary)', fontSize: '0.78rem', color: 'var(--on-primary)', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Timer style + Days only */}
              <div style={{ display: 'flex', gap: '16px', width: '100%', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                    Timer Style
                  </label>
                  <CustomSelect
                    id="countup-timer-style"
                    value={timerStyle}
                    options={STYLE_OPTIONS}
                    onChange={val => { setTimerStyle(val as TimerStyle); setPreviewOverride(p => ({ ...p, timerStyle: undefined })) }}
                    onPreviewChange={val => setPreviewOverride(p => ({ ...p, timerStyle: val ? val as TimerStyle : undefined }))}
                    previewDelay={1000}
                  />
                </div>

                <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600, marginBottom: '8px' }}>
                    Display format
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="countup-days-only"
                      checked={daysOnly}
                      onChange={e => setDaysOnly(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="countup-days-only" style={{ fontSize: '0.9rem', color: 'var(--on-surface)', fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                      Days Only
                    </label>
                  </div>
                </div>
              </div>

              {/* Theme Settings Container */}
              <div className={`${styles.collapsibleContainer} ${showStyle ? styles.collapsibleContainerActive : ''}`}>
                <div 
                  className={styles.collapsibleHeader}
                  onClick={() => setShowStyle(!showStyle)}
                >
                  <span>Theme Settings*</span>
                  <span>{showStyle ? '▲' : '▼'}</span>
                </div>
                {showStyle && (
                  <div className={styles.collapsibleContent}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                        Theme Preset*
                      </label>
                      <ThemeSelect
                        id="countup-theme"
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
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        padding: '14px',
                        background: 'rgba(0, 0, 0, 0.03)',
                        border: '1px dashed var(--outline-variant)',
                        borderRadius: '10px',
                        marginTop: '12px'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Primary Color</label>
                            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                              style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Secondary Color</label>
                            <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                              style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Background Color</label>
                            <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)}
                              style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Text Color</label>
                            <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
                              style={{ width: '100%', height: '36px', border: '1px solid var(--outline-variant)', borderRadius: '6px', cursor: 'pointer', padding: '2px' }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>
                            Background Image URL (Optional)
                          </label>
                          <input
                            type="text"
                            value={backgroundImage}
                            onChange={e => setBackgroundImage(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--outline-variant)',
                              background: 'var(--surface-container-lowest)',
                              color: 'var(--on-surface)',
                              fontSize: '0.84rem'
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
                  <span>Advanced Settings*</span>
                  <span>{showAdvanced ? '▲' : '▼'}</span>
                </div>
                {showAdvanced && (
                  <div className={styles.collapsibleContent}>
                    {/* Optional end time + message */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>End Message (Optional)*</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)' }}>Show a message after an optional end time is reached.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={endEnabled}
                          onChange={e => setEndEnabled(e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                          aria-label="Enable end message"
                        />
                      </div>

                      {endEnabled && (
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ position: 'relative' }} ref={endPickerRef}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                              End Time*
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowEndPicker(v => !v)}
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
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer'
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={16} style={{ color: 'var(--primary)' }} />
                                {getReadableTime(endTimeStr)}
                              </span>
                              <ChevronDown size={14} style={{ opacity: 0.6 }} />
                            </button>

                            {showEndPicker && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 'calc(100% + 4px)',
                                  left: 0,
                                  right: 0,
                                  background: 'var(--surface-lowest)',
                                  border: '1px solid var(--outline-variant)',
                                  borderRadius: '10px',
                                  boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
                                  zIndex: 100,
                                  padding: '16px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '12px'
                                }}
                                data-dropdown="countup-end-picker"
                              >
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                  <div>
                                    <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Year</label>
                                    <CustomSelect
                                      id="countup-end-year"
                                      value={endYear}
                                      options={yearOptions}
                                      onChange={(value) => {
                                        const val = Number(value)
                                        const nextDay = Math.min(endDay, new Date(val, endMonth, 0).getDate())
                                        setEndYear(val)
                                        setEndDay(nextDay)
                                        updateIsoTime(setEndTimeStr, val, endMonth, nextDay, endHour, endMinute, endSecond)
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Month</label>
                                    <CustomSelect
                                      id="countup-end-month"
                                      value={endMonth}
                                      options={monthOptions}
                                      onChange={(value) => {
                                        const val = Number(value)
                                        const nextDay = Math.min(endDay, new Date(endYear, val, 0).getDate())
                                        setEndMonth(val)
                                        setEndDay(nextDay)
                                        updateIsoTime(setEndTimeStr, endYear, val, nextDay, endHour, endMinute, endSecond)
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Day</label>
                                    <CustomSelect
                                      id="countup-end-day"
                                      value={Math.min(endDay, maxEndDay)}
                                      options={endDayOptions}
                                      onChange={(value) => {
                                        const val = Number(value)
                                        setEndDay(val)
                                        updateIsoTime(setEndTimeStr, endYear, endMonth, val, endHour, endMinute, endSecond)
                                      }}
                                    />
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', borderTop: '1px solid var(--outline-variant)', paddingTop: '10px' }}>
                                  <div>
                                    <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><ClockIcon size={12}/> Hour</label>
                                    <CustomSelect
                                      id="countup-end-hour"
                                      value={endHour}
                                      options={hourOptions}
                                      onChange={(value) => {
                                        const val = Number(value)
                                        setEndHour(val)
                                        updateIsoTime(setEndTimeStr, endYear, endMonth, endDay, val, endMinute, endSecond)
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Minute</label>
                                    <CustomSelect
                                      id="countup-end-minute"
                                      value={endMinute}
                                      options={minuteSecondOptions}
                                      onChange={(value) => {
                                        const val = Number(value)
                                        setEndMinute(val)
                                        updateIsoTime(setEndTimeStr, endYear, endMonth, endDay, endHour, val, endSecond)
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.74rem', color: 'var(--on-surface-subtle)', display: 'block', marginBottom: '4px' }}>Second</label>
                                    <CustomSelect
                                      id="countup-end-second"
                                      value={endSecond}
                                      options={minuteSecondOptions}
                                      onChange={(value) => {
                                        const val = Number(value)
                                        setEndSecond(val)
                                        updateIsoTime(setEndTimeStr, endYear, endMonth, endDay, endHour, endMinute, val)
                                      }}
                                    />
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => setShowEndPicker(false)}
                                    style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--primary)', fontSize: '0.78rem', color: 'var(--on-primary)', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                              End Message*
                            </label>
                            <input
                              type="text"
                              value={endMessage}
                              maxLength={MESSAGE_MAX_LENGTH}
                              onChange={e => setEndMessage(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                              placeholder="e.g. Incident Resolved"
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1px solid var(--outline-variant)',
                                background: 'var(--surface-container-lowest)',
                                color: 'var(--on-surface)',
                                fontFamily: 'var(--font-body)',
                                fontSize: '0.92rem',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Show Date / Date Format */}
                    <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: '12px', marginTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '0.86rem', color: 'var(--on-surface)', fontWeight: 600 }}>Show Date*</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--on-surface-subtle)' }}>Display the start date under the title.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={showDate}
                          onChange={e => setShowDate(e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                          aria-label="Show date"
                        />
                      </div>

                      {showDate && (
                        <div style={{ marginTop: '12px' }}>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', color: 'var(--on-surface)', fontFamily: 'var(--font-label)', fontWeight: 600 }}>
                            Date Format*
                          </label>
                          <CustomSelect
                            id="countup-date-format"
                            value={dateFormat}
                            options={DATE_FORMATS}
                            onChange={(val) => setDateFormat(val as DateFormat)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Right Preview Panel */}
            <div style={{
              flex: '1 1 580px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'rgba(0, 0, 0, 0.02)',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
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

              <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minHeight: '360px',
                position: 'relative'
              }}>
                <div style={{
                  width: previewMode === 'landscape' ? 'min(100%, 760px)' : 'min(100%, 360px)',
                  aspectRatio: previewMode === 'landscape' ? '16 / 9' : '9 / 16',
                  background: '#000000',
                  borderRadius: '8px',
                  border: '1px solid var(--outline-variant)',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.24)'
                }}>
                  <ScaledScreenPreview mode={previewMode}>
                    <FlowCountUpRenderer
                      text={simulatedConfig.text}
                      startTime={simulatedConfig.startTime}
                      endTime={simulatedConfig.endTime}
                      endMessage={simulatedConfig.endMessage}
                      timerStyle={simulatedConfig.timerStyle}
                      daysOnly={simulatedConfig.daysOnly}
                      theme={simulatedConfig.theme}
                      themeSettings={simulatedConfig.themeSettings}
                      advancedSettings={simulatedConfig.advancedSettings}
                    />
                  </ScaledScreenPreview>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
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
              disabled={isSubmitting || !name.trim() || !startTimeStr}
              style={{
                padding: '10px 24px',
                background: (!name.trim() || !startTimeStr) ? 'var(--surface-low)' : 'var(--primary)',
                color: (!name.trim() || !startTimeStr) ? 'var(--on-surface-subtle)' : 'var(--on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: (isSubmitting || !name.trim() || !startTimeStr) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || !name.trim() || !startTimeStr) ? 0.7 : 1,
                boxShadow: (!name.trim() || !startTimeStr) ? 'none' : '0 4px 12px rgba(9, 76, 178, 0.2)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.88rem'
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save Widget'}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Preview */}
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
            <FlowCountUpRenderer
              text={simulatedConfig.text}
              startTime={simulatedConfig.startTime}
              endTime={simulatedConfig.endTime}
              endMessage={simulatedConfig.endMessage}
              timerStyle={simulatedConfig.timerStyle}
              daysOnly={simulatedConfig.daysOnly}
              theme={simulatedConfig.theme}
              themeSettings={simulatedConfig.themeSettings}
              advancedSettings={simulatedConfig.advancedSettings}
            />
          </div>

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
            <span>Fullscreen Preview ({previewMode === 'landscape' ? '16:9' : '9:16'})</span>
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
              }}
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

