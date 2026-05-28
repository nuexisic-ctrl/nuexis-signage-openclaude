'use client'

import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Global CSS injected ONCE into <head> – never touched again on re-renders
// ─────────────────────────────────────────────────────────────────────────────
const STYLE_ID = 'flow-clock-styles-v2'

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,300;0,400;0,600&family=Public+Sans:wght@300;400;500;600;700&display=swap');

.fck-classic-root {
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:#ffffff;width:100%;height:100%;padding:4cqmin;box-sizing:border-box;
  font-family:'Noto Serif',Georgia,serif;text-align:center;
}
.fck-classic-time {
  font-size:min(24cqmin,7rem);font-weight:400;margin:0;
  line-height:1.1;letter-spacing:-0.02em;color:#000;
}
.fck-classic-secs {
  font-size:0.5em;margin-left:0.15em;font-weight:300;color:#000;
}
.fck-classic-ampm {
  font-size:min(6cqmin,1.8rem);font-weight:300;margin-left:12px;
  font-family:'Public Sans',sans-serif;text-transform:uppercase;color:#000;
}
.fck-classic-date {
  font-size:min(5.5cqmin,1.6rem);font-weight:400;margin-top:2cqmin;margin-bottom:0;
  letter-spacing:0.12em;font-family:'Public Sans',sans-serif;color:#000;text-transform:uppercase;
}

.fck-modern-root {
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:#090d16;color:#ffffff;width:100%;height:100%;padding:4cqmin;
  box-sizing:border-box;font-family:'Public Sans',sans-serif;text-align:center;
}
.fck-modern-time {
  font-size:min(22cqmin,6.5rem);font-weight:700;margin:0;line-height:1;letter-spacing:-0.03em;
}
.fck-modern-date {
  font-size:min(6cqmin,1.8rem);font-weight:600;margin-top:2cqmin;margin-bottom:0;letter-spacing:0.05em;
  color:#94a3b8;text-transform:uppercase;
}

.fck-mini-root {
  display:flex;flex-direction:row;align-items:center;justify-content:center;
  gap:4cqw;width:100%;height:100%;box-sizing:border-box;
}
.fck-mini-left {
  background:#fff;border-radius:min(24px, 5cqmin);
  width:min(500px, 70cqh);height:min(500px, 70cqh);
  display:flex;align-items:center;justify-content:center;
  position:relative;box-shadow:0 10px 25px rgba(0,0,0,0.03);
}
.fck-mini-right {
  background:#fff;border-radius:min(24px, 5cqmin);padding:min(28px, 5cqmin);
  width:min(550px, 80cqh);height:min(500px, 70cqh);
  box-shadow:0 10px 25px rgba(0,0,0,0.03);
  display:flex;flex-direction:column;justify-content:center;gap:min(16px, 3cqh);
}

@container (orientation: portrait) {
  .fck-mini-root {
    flex-direction:column!important;gap:4cqh!important;
  }
  .fck-mini-left {
    width:min(450px, 75cqw)!important;height:min(450px, 75cqw)!important;
    border-radius:16px!important;
  }
  .fck-mini-right {
    width:min(500px, 80cqw)!important;height:auto!important;
    padding:20px!important;border-radius:16px!important;
    gap:16px!important;
  }
}
`

function ensureGlobalStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = GLOBAL_CSS
  document.head.appendChild(el)
}

// ─────────────────────────────────────────────────────────────────────────────
// Date formatting
// ─────────────────────────────────────────────────────────────────────────────
function formatDate(date: Date, format: string): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const daysShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const yyyy = date.getFullYear()
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const dd   = String(date.getDate()).padStart(2, '0')
  const monthName      = months[date.getMonth()]
  const monthNameUpper = months[date.getMonth()].toUpperCase()
  const monthNameShort = monthsShort[date.getMonth()]
  const dayName        = days[date.getDay()]
  const dayNameShort   = daysShort[date.getDay()]

  switch (format) {
    case 'January 01, 2024':            return `${monthName} ${dd}, ${yyyy}`
    case 'Monday, January 01, 2024':    return `${dayName}, ${monthName} ${dd}, ${yyyy}`
    case 'Mon, Jan 01, 2024':           return `${dayNameShort}, ${monthNameShort} ${dd}, ${yyyy}`
    case '31/01/2024':                  return `${dd}/${mm}/${yyyy}`
    case 'Monday, 31/01/2024':          return `${dayName}, ${dd}/${mm}/${yyyy}`
    case '01/31/2024 (US)':             return `${mm}/${dd}/${yyyy}`
    case '2024-01-31':                  return `${yyyy}-${mm}-${dd}`
    case 'CLASSIC_CAPS':                return `${monthNameUpper} ${dd}, ${yyyy}`
    default:                            return `${monthName} ${dd}, ${yyyy}`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface FlowClockRendererProps {
  style?: 'classic-digital' | 'modern-digital' | 'classic-analog' | 'modern-analog' | 'minimalist'
  showSeconds?: boolean
  showDate?: boolean
  use24Hour?: boolean
  dateFormat?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function FlowClockRenderer({
  style = 'classic-digital',
  showSeconds = true,
  showDate = true,
  use24Hour = false,
  dateFormat  = 'January 01, 2024',
}: FlowClockRendererProps) {

  const isAnalog = style === 'classic-analog' || style === 'modern-analog'

  // Single time state – the Date object we render from
  const [time, setTime] = useState<Date | null>(null)

  // For analog: we store the sub-second ms in a ref so we can interpolate hand angles
  // without triggering extra renders – the rAF loop writes here and React state is set
  // via the throttle mechanism below.
  const msRef = useRef(0)

  // Tracks the last rendered second (digital) or last rendered 50ms-bucket (analog)
  // so we only call setTime when the visible output would actually change.
  const lastBucketRef = useRef(-1)

  useEffect(() => {
    ensureGlobalStyles()
  }, [])

  useEffect(() => {
    let rafId: number

    const loop = () => {
      const now  = new Date()
      const ms   = now.getMilliseconds()
      msRef.current = ms

      if (isAnalog) {
        // Analog: update React state at ~20 fps (every 50 ms) for smooth hand sweep
        const bucket = Math.floor(now.getTime() / 50)
        if (bucket !== lastBucketRef.current) {
          lastBucketRef.current = bucket
          setTime(new Date(now))      // snapshot so render sees consistent values
        }
      } else {
        // Digital / minimalist: update only when the displayed second changes
        const sec = now.getSeconds()
        if (sec !== lastBucketRef.current) {
          lastBucketRef.current = sec
          setTime(new Date(now))
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    // Kick off immediately so the first paint shows the current time
    lastBucketRef.current = -1
    rafId = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalog])   // only re-run if clock type switches (which never happens in practice)

  // ── Loading state ───────────────────────────────────────────────────────────
  if (!time) {
    return (
      <div style={{ color: '#888', fontFamily: 'sans-serif', fontSize: '1rem',
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading…
      </div>
    )
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  // For digital clocks msRef is irrelevant (we update once/second), so ms = 0 is fine.
  const ms  = isAnalog ? msRef.current : 0
  const sec = time.getSeconds() + ms / 1000
  const min = time.getMinutes() + sec / 60
  const hr  = (time.getHours() % 12) + min / 60

  const secAngle = sec * 6
  const minAngle = min * 6
  const hrAngle  = hr  * 30

  const hoursRaw  = time.getHours()
  const ampm      = hoursRaw >= 12 ? 'PM' : 'AM'
  const hours12   = hoursRaw % 12 || 12
  const hours24   = hoursRaw
  const hoursStr  = use24Hour ? String(hours24).padStart(2, '0') : String(hours12)
  const minsStr   = String(time.getMinutes()).padStart(2, '0')
  const secsStr   = String(time.getSeconds()).padStart(2, '0')

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%', height: '100%',
      containerType: 'size',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>

      {/* ── Classic Digital ── */}
      {style === 'classic-digital' && (
        <div className="fck-classic-root">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
            <h1 className="fck-classic-time">
              {hoursStr}:{minsStr}
              {showSeconds && <span className="fck-classic-secs">:{secsStr}</span>}
            </h1>
            {!use24Hour && <span className="fck-classic-ampm">{ampm}</span>}
          </div>
          {showDate && (
            <p className="fck-classic-date">
              {formatDate(time, dateFormat === 'January 01, 2024' ? 'CLASSIC_CAPS' : dateFormat)}
            </p>
          )}
        </div>
      )}

      {/* ── Modern Digital ── */}
      {style === 'modern-digital' && (
        <div className="fck-modern-root">
          <h1 className="fck-modern-time">
            {hoursStr}:{minsStr}
            {showSeconds && <span style={{ fontSize: '0.6em', color: '#38bdf8' }}>:{secsStr}</span>}
            {!use24Hour && <> <span style={{ fontSize: '0.7em', color: '#38bdf8' }}>{ampm}</span></>}
          </h1>
          {showDate && <p className="fck-modern-date">{formatDate(time, dateFormat)}</p>}
        </div>
      )}

      {/* ── Classic Analog ── */}
      {style === 'classic-analog' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#ffffff', width: '100%', height: '100%', padding: '4cqmin', boxSizing: 'border-box',
          fontFamily: "'Public Sans', sans-serif",
        }}>
          <div style={{ position: 'relative', width: 'min(70cqw, 70cqh)', height: 'min(70cqw, 70cqh)' }}>
            <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
              {Array.from({ length: 60 }).map((_, i) => {
                if (i % 5 === 0) return null
                const a = (i * 6 * Math.PI) / 180
                return <line key={i} x1={100+82*Math.sin(a)} y1={100-82*Math.cos(a)} x2={100+86*Math.sin(a)} y2={100-86*Math.cos(a)} stroke="#aaa" strokeWidth="1" />
              })}
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i * 30 * Math.PI) / 180
                return <line key={i} x1={100+78*Math.sin(a)} y1={100-78*Math.cos(a)} x2={100+86*Math.sin(a)} y2={100-86*Math.cos(a)} stroke="#000" strokeWidth="3" strokeLinecap="round" />
              })}
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i * 30 * Math.PI) / 180
                return <text key={i} x={100+64*Math.sin(a)} y={100-64*Math.cos(a)+4} textAnchor="middle" style={{ fontSize: '12px', fontWeight: 500, fill: '#333' }}>{i || 12}</text>
              })}
              <line x1="100" y1="100" x2={100+42*Math.sin(hrAngle*Math.PI/180)} y2={100-42*Math.cos(hrAngle*Math.PI/180)} stroke="#111" strokeWidth="5" strokeLinecap="round" />
              <line x1="100" y1="100" x2={100+68*Math.sin(minAngle*Math.PI/180)} y2={100-68*Math.cos(minAngle*Math.PI/180)} stroke="#222" strokeWidth="3.5" strokeLinecap="round" />
              {showSeconds && (
                <>
                  <line x1={100-15*Math.sin(secAngle*Math.PI/180)} y1={100+15*Math.cos(secAngle*Math.PI/180)} x2={100+78*Math.sin(secAngle*Math.PI/180)} y2={100-78*Math.cos(secAngle*Math.PI/180)} stroke="#ff9800" strokeWidth="1.2" />
                  <circle cx="100" cy="100" r="5" fill="#ff9900" />
                </>
              )}
              <circle cx="100" cy="100" r="2.5" fill="#111" />
            </svg>
          </div>
          {showDate && (
            <p style={{ fontSize: 'min(32px, 4.5cqmin)', fontWeight: 500, color: '#666', marginTop: '2.5cqmin', marginBottom: 0, letterSpacing: '0.04em' }}>
              {formatDate(time, dateFormat)}
            </p>
          )}
        </div>
      )}

      {/* ── Modern Analog ── */}
      {style === 'modern-analog' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#07111f', width: '100%', height: '100%', padding: '4cqmin', boxSizing: 'border-box',
        }}>
          <div style={{
            background: '#fff', borderRadius: 'min(36px, 5cqmin)', padding: 'min(24px, 4cqmin)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 'min(70cqw, 70cqh)', height: 'min(70cqw, 70cqh)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <filter id="fck-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.08" />
                  </filter>
                </defs>
                {Array.from({ length: 60 }).map((_, i) => {
                  const a = (i * 6 * Math.PI) / 180
                  const isHr = i % 5 === 0
                  return <line key={i} x1={100+(isHr?78:82)*Math.sin(a)} y1={100-(isHr?78:82)*Math.cos(a)} x2={100+86*Math.sin(a)} y2={100-86*Math.cos(a)} stroke={isHr?'#111':'#bbb'} strokeWidth={isHr?2.5:1} strokeLinecap="round" />
                })}
                <line x1="100" y1="100" x2={100+44*Math.sin(hrAngle*Math.PI/180)} y2={100-44*Math.cos(hrAngle*Math.PI/180)} stroke="#1c1c1e" strokeWidth="5" strokeLinecap="round" filter="url(#fck-shadow)" />
                <line x1="100" y1="100" x2={100+72*Math.sin(minAngle*Math.PI/180)} y2={100-72*Math.cos(minAngle*Math.PI/180)} stroke="#2c2c2e" strokeWidth="3.2" strokeLinecap="round" filter="url(#fck-shadow)" />
                {showSeconds && (
                  <>
                    <line x1={100-20*Math.sin(secAngle*Math.PI/180)} y1={100+20*Math.cos(secAngle*Math.PI/180)} x2={100+82*Math.sin(secAngle*Math.PI/180)} y2={100-82*Math.cos(secAngle*Math.PI/180)} stroke="#ff3b30" strokeWidth="1.2" />
                    <circle cx="100" cy="100" r="5" fill="#ff3b30" />
                  </>
                )}
                <circle cx="100" cy="100" r="2" fill="#fff" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ── Minimalist ── */}
      {style === 'minimalist' && (() => {
        const currentYear     = time.getFullYear()
        const currentMonth    = time.getMonth()
        const monthNames      = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']
        const firstDayIndex   = new Date(currentYear, currentMonth, 1).getDay()
        const totalDays       = new Date(currentYear, currentMonth + 1, 0).getDate()
        const currentDay      = time.getDate()

        const cells: (number | null)[] = []
        for (let i = 0; i < firstDayIndex; i++) cells.push(null)
        for (let d = 1; d <= totalDays; d++) cells.push(d)

        return (
          <div style={{
            display: 'flex', background: '#f4f5f7', width: '100%', height: '100%',
            padding: '4cqmin', boxSizing: 'border-box',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Public Sans', sans-serif",
          }}>
            <div className={showDate ? 'fck-mini-root' : ''} style={!showDate ? { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' } : {}}>

              {/* Clock card */}
              <div className={showDate ? 'fck-mini-left' : ''} style={!showDate ? {
                background: '#fff', borderRadius: 'min(24px, 5cqmin)',
                width: 'min(400px, 70cqw)', height: 'min(400px, 70cqw)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
              } : {}}>
                <svg viewBox="0 0 200 200" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  {Array.from({ length: 60 }).map((_, i) => {
                    const a          = (i * 6 * Math.PI) / 180
                    const isHr       = i % 5 === 0
                    const isActive   = showSeconds ? i <= time.getSeconds() : true
                    return (
                      <line
                        key={i}
                        x1={100+(isHr?78:82)*Math.sin(a)} y1={100-(isHr?78:82)*Math.cos(a)}
                        x2={100+88*Math.sin(a)}            y2={100-88*Math.cos(a)}
                        stroke={isActive ? '#111' : 'rgba(0,0,0,0.1)'}
                        strokeWidth={isHr ? 3 : 1.5} strokeLinecap="round"
                        style={{ transition: 'stroke 0.12s ease' }}
                      />
                    )
                  })}
                </svg>
                <div style={{ textAlign: 'center', zIndex: 5 }}>
                  <h1 style={{ fontSize: 'min(96px, 12cqmin)', fontWeight: 750, margin: 0, color: '#111', lineHeight: 1, fontFamily: "'Public Sans',sans-serif", letterSpacing: '-0.04em' }}>
                    {hoursStr}:{minsStr}
                  </h1>
                  {showSeconds && (
                    <div style={{ fontSize: 'min(32px, 3.5cqmin)', fontWeight: 600, color: '#666', marginTop: '1.5cqmin', letterSpacing: '0.05em' }}>
                      {secsStr}s
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar card */}
              {showDate && (
                <div className="fck-mini-right">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: 'min(48px, 4.5cqmin)', fontWeight: 700, color: '#094cb2', fontFamily: "'Public Sans',sans-serif" }}>
                      {monthNames[currentMonth]}
                    </h2>
                    <span style={{ fontSize: 'min(32px, 3cqmin)', fontWeight: 600, color: '#999' }}>{currentYear}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 'min(16px, 1.5cqmin) min(8px, 1cqmin)', textAlign: 'center' }}>
                    {['S','M','T','W','T','F','S'].map((l, i) => (
                      <span key={i} style={{ fontSize: 'min(28px, 2.5cqmin)', fontWeight: 600, color: '#888', paddingBottom: '4px' }}>{l}</span>
                    ))}
                    {cells.map((day, idx) => {
                      if (day === null) return <div key={`e-${idx}`} />
                      const isToday = day === currentDay
                      return (
                        <div key={`d-${day}`} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 'min(48px, 5.5cqmin)', fontSize: 'min(32px, 3cqmin)',
                          fontWeight: isToday ? 700 : 500, color: isToday ? '#fff' : '#333',
                          position: 'relative'
                        }}>
                          {isToday && (
                            <div style={{
                              position: 'absolute',
                              width: 'min(44px, 5.2cqmin)',
                              height: 'min(44px, 5.2cqmin)',
                              borderRadius: '50%',
                              background: '#094cb2',
                              zIndex: 1
                            }} />
                          )}
                          <span style={{ zIndex: 2 }}>{day}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        )
      })()}

    </div>
  )
}
