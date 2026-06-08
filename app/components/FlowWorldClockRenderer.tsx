'use client'

import { useEffect, useRef, useState } from 'react'

const STYLE_ID = 'flow-world-clock-styles'

const GLOBAL_CSS = `
.wck-wrapper {
  width: 100%;
  height: 100%;
  container-type: size;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  font-family: 'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

.wck-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 6cqmin;
  box-sizing: border-box;
  text-align: center;
  background: var(--wck-bg, #090d16);
  color: var(--wck-text, #ffffff);
  transition: background 0.3s ease, color 0.3s ease;
}

.wck-card[data-theme="light"] {
  --wck-bg: #f8fafc;
  --wck-text: #0f172a;
  --wck-accent: #4f46e5;
  --wck-accent-secondary: #0ea5e9;
  --wck-border: #e2e8f0;
}

.wck-card[data-theme="dark"] {
  --wck-bg: #090d16;
  --wck-text: #f8fafc;
  --wck-accent: #38bdf8;
  --wck-accent-secondary: #818cf8;
  --wck-border: #1e293b;
}

.wck-analog-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 3cqmin;
}

.wck-analog-clock {
  width: min(70cqw, 70cqh);
  height: min(70cqw, 70cqh);
  position: relative;
}

.wck-digital-time {
  font-size: min(20cqmin, 6.5rem);
  font-weight: 700;
  margin: 0;
  line-height: 1;
  letter-spacing: -0.03em;
}

.wck-digital-secs {
  font-size: 0.6em;
  color: var(--wck-accent, #38bdf8);
  margin-left: 0.05em;
  font-weight: 500;
}

.wck-digital-ampm {
  font-size: 0.6em;
  color: var(--wck-accent, #38bdf8);
  margin-left: 0.15em;
  font-weight: 600;
  text-transform: uppercase;
}

.wck-timezone-label {
  font-size: min(5cqmin, 1.5rem);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wck-text);
  opacity: 0.85;
  margin: 0;
}

.wck-timezone-sub {
  font-size: min(3.8cqmin, 1.1rem);
  font-weight: 500;
  color: var(--wck-accent, #38bdf8);
  margin-top: 1cqmin;
  margin-bottom: 0;
  letter-spacing: 0.05em;
}

.wck-date-label {
  font-size: min(4cqmin, 1.2rem);
  font-weight: 500;
  margin-top: 2cqmin;
  margin-bottom: 0;
  letter-spacing: 0.05em;
  opacity: 0.7;
  text-transform: uppercase;
}
`

function ensureGlobalStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = GLOBAL_CSS
  document.head.appendChild(el)
}

function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const yyyy = date.getFullYear()
  const monthName = months[date.getMonth()]
  const dd = String(date.getDate()).padStart(2, '0')
  const dayName = days[date.getDay()]
  return `${dayName}, ${monthName} ${dd}, ${yyyy}`
}

function getTzOffsetTime(timezone: string): { date: Date; ms: number } {
  const now = new Date()
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    const parts = formatter.formatToParts(now)
    let year = 1970, month = 1, day = 1, hour = 0, minute = 0, second = 0
    for (const part of parts) {
      if (part.type === 'year') year = parseInt(part.value, 10)
      else if (part.type === 'month') month = parseInt(part.value, 10)
      else if (part.type === 'day') day = parseInt(part.value, 10)
      else if (part.type === 'hour') {
        const val = parseInt(part.value, 10)
        hour = val % 24
      }
      else if (part.type === 'minute') minute = parseInt(part.value, 10)
      else if (part.type === 'second') second = parseInt(part.value, 10)
    }
    const ms = now.getMilliseconds()
    return {
      date: new Date(year, month - 1, day, hour, minute, second, ms),
      ms
    }
  } catch (err) {
    return { date: now, ms: now.getMilliseconds() }
  }
}

function getCleanTzLabel(timezone: string): { city: string; region: string } {
  if (!timezone || timezone === 'UTC') {
    return { city: 'UTC', region: 'Global' }
  }
  const parts = timezone.split('/')
  if (parts.length === 1) {
    return { city: parts[0], region: '' }
  }
  const city = parts[parts.length - 1].replace(/_/g, ' ')
  const region = parts.slice(0, -1).join(' / ').replace(/_/g, ' ')
  return { city, region }
}

interface FlowWorldClockRendererProps {
  timezone?: string
  clockType?: 'analog' | 'digital'
  theme?: 'light' | 'dark' | 'custom'
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  textColor?: string
  use24Hour?: boolean
  showSeconds?: boolean
}

export default function FlowWorldClockRenderer({
  timezone = 'UTC',
  clockType = 'analog',
  theme = 'light',
  primaryColor = '#38bdf8',
  secondaryColor = '#818cf8',
  backgroundColor = '#090d16',
  textColor = '#ffffff',
  use24Hour = false,
  showSeconds = true
}: FlowWorldClockRendererProps) {
  const [time, setTime] = useState<Date | null>(null)
  const msRef = useRef(0)
  const lastBucketRef = useRef(-1)

  useEffect(() => {
    ensureGlobalStyles()
  }, [])

  const isAnalog = clockType === 'analog'

  useEffect(() => {
    let rafId: number

    const loop = () => {
      const { date: tzDate, ms } = getTzOffsetTime(timezone)
      msRef.current = ms

      if (isAnalog) {
        // ~20 fps for analog hand sweep
        const bucket = Math.floor(Date.now() / 50)
        if (bucket !== lastBucketRef.current) {
          lastBucketRef.current = bucket
          setTime(tzDate)
        }
      } else {
        // 1 fps for digital
        const sec = tzDate.getSeconds()
        if (sec !== lastBucketRef.current) {
          lastBucketRef.current = sec
          setTime(tzDate)
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    lastBucketRef.current = -1
    rafId = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafId)
  }, [isAnalog, timezone])

  if (!time) {
    return (
      <div style={{
        color: '#888',
        fontFamily: 'sans-serif',
        fontSize: '1rem',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        Loading World Clock…
      </div>
    )
  }

  const ms = isAnalog ? msRef.current : 0
  const sec = time.getSeconds() + ms / 1000
  const min = time.getMinutes() + sec / 60
  const hr = (time.getHours() % 12) + min / 60

  const secAngle = sec * 6
  const minAngle = min * 6
  const hrAngle = hr * 30

  const hoursRaw = time.getHours()
  const ampm = hoursRaw >= 12 ? 'PM' : 'AM'
  const hours12 = hoursRaw % 12 || 12
  const hoursStr = use24Hour ? String(hoursRaw).padStart(2, '0') : String(hours12)
  const minsStr = String(time.getMinutes()).padStart(2, '0')
  const secsStr = String(time.getSeconds()).padStart(2, '0')

  const { city, region } = getCleanTzLabel(timezone)

  // Custom theme variables override
  const customStyles: React.CSSProperties = theme === 'custom' ? {
    '--wck-bg': backgroundColor,
    '--wck-text': textColor,
    '--wck-accent': primaryColor,
    '--wck-accent-secondary': secondaryColor,
    '--wck-border': 'rgba(255,255,255,0.08)'
  } as React.CSSProperties : {}

  return (
    <div className="wck-wrapper">
      <div className="wck-card" data-theme={theme} style={customStyles}>
        {isAnalog ? (
          <div className="wck-analog-container">
            <div className="wck-analog-clock">
              <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <filter id="wck-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity="0.1" />
                  </filter>
                </defs>
                {/* Outer Ring */}
                <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.15 }} />
                
                {/* Hour and Minute Ticks */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const a = (i * 30 * Math.PI) / 180
                  return (
                    <line
                      key={i}
                      x1={100 + 82 * Math.sin(a)}
                      y1={100 - 82 * Math.cos(a)}
                      x2={100 + 90 * Math.sin(a)}
                      y2={100 - 90 * Math.cos(a)}
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      style={{ opacity: 0.8 }}
                    />
                  )
                })}
                {Array.from({ length: 60 }).map((_, i) => {
                  if (i % 5 === 0) return null
                  const a = (i * 6 * Math.PI) / 180
                  return (
                    <line
                      key={i}
                      x1={100 + 86 * Math.sin(a)}
                      y1={100 - 86 * Math.cos(a)}
                      x2={100 + 90 * Math.sin(a)}
                      y2={100 - 90 * Math.cos(a)}
                      stroke="currentColor"
                      strokeWidth={1}
                      style={{ opacity: 0.3 }}
                    />
                  )
                })}

                {/* Clock Hands */}
                {/* Hour Hand */}
                <line
                  x1="100"
                  y1="100"
                  x2={100 + 46 * Math.sin((hrAngle * Math.PI) / 180)}
                  y2={100 - 46 * Math.cos((hrAngle * Math.PI) / 180)}
                  stroke="currentColor"
                  strokeWidth={5}
                  strokeLinecap="round"
                  filter="url(#wck-shadow)"
                />
                {/* Minute Hand */}
                <line
                  x1="100"
                  y1="100"
                  x2={100 + 72 * Math.sin((minAngle * Math.PI) / 180)}
                  y2={100 - 72 * Math.cos((minAngle * Math.PI) / 180)}
                  stroke="currentColor"
                  strokeWidth={3.2}
                  strokeLinecap="round"
                  filter="url(#wck-shadow)"
                />
                {/* Second Hand */}
                {showSeconds && (
                  <>
                    <line
                      x1={100 - 18 * Math.sin((secAngle * Math.PI) / 180)}
                      y1={100 + 18 * Math.cos((secAngle * Math.PI) / 180)}
                      x2={100 + 80 * Math.sin((secAngle * Math.PI) / 180)}
                      y2={100 - 80 * Math.cos((secAngle * Math.PI) / 180)}
                      stroke="var(--wck-accent, #38bdf8)"
                      strokeWidth={1.5}
                    />
                    <circle cx="100" cy="100" r="4.5" fill="var(--wck-accent, #38bdf8)" />
                  </>
                )}
                {/* Pivot Center Pin */}
                <circle cx="100" cy="100" r="2.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="wck-date-label">{formatDate(time)}</p>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="wck-digital-time">
              {hoursStr}:{minsStr}
              {showSeconds && <span className="wck-digital-secs">:{secsStr}</span>}
              {!use24Hour && <span className="wck-digital-ampm">{ampm}</span>}
            </h1>
            <p className="wck-date-label">{formatDate(time)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
