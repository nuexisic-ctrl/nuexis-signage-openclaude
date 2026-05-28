'use client'

import { useEffect, useState } from 'react'

interface FlowClockRendererProps {
  style?: 'classic-digital' | 'modern-digital' | 'classic-analog' | 'modern-analog' | 'minimalist'
  showSeconds?: boolean
  dateFormat?: string
}

function formatDate(date: Date, format: string): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const monthName = months[date.getMonth()]
  const monthNameUpper = months[date.getMonth()].toUpperCase()
  const monthNameShort = monthsShort[date.getMonth()]
  const dayName = days[date.getDay()]
  const dayNameShort = daysShort[date.getDay()]

  switch (format) {
    case 'January 01, 2024': return `${monthName} ${dd}, ${yyyy}`
    case 'Monday, January 01, 2024': return `${dayName}, ${monthName} ${dd}, ${yyyy}`
    case 'Mon, Jan 01, 2024': return `${dayNameShort}, ${monthNameShort} ${dd}, ${yyyy}`
    case '31/01/2024': return `${dd}/${mm}/${yyyy}`
    case 'Monday, 31/01/2024': return `${dayName}, ${dd}/${mm}/${yyyy}`
    case '01/31/2024 (US)': return `${mm}/${dd}/${yyyy}`
    case '2024-01-31': return `${yyyy}-${mm}-${dd}`
    case 'CLASSIC_CAPS': return `${monthNameUpper} ${dd}, ${yyyy}`
    default: return `${monthName} ${dd}, ${yyyy}`
  }
}

export default function FlowClockRenderer({
  style = 'classic-digital',
  showSeconds = true,
  dateFormat = 'January 01, 2024'
}: FlowClockRendererProps) {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    let frameId: number
    const tick = () => {
      setTime(new Date())
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [])

  if (!time) {
    return (
      <div style={{ color: 'var(--on-surface-subtle)', fontFamily: 'sans-serif', fontSize: '1rem' }}>
        Loading Clock...
      </div>
    )
  }

  // Smooth 60fps sweeping hand calculations
  const ms = time.getMilliseconds()
  const sec = time.getSeconds() + ms / 1000
  const min = time.getMinutes() + sec / 60
  const hr = (time.getHours() % 12) + min / 60

  const secAngle = sec * 6
  const minAngle = min * 6
  const hrAngle = hr * 30

  const hoursRaw = time.getHours()
  const ampm = hoursRaw >= 12 ? 'PM' : 'AM'
  const hours12 = hoursRaw % 12 || 12
  const minsStr = String(time.getMinutes()).padStart(2, '0')
  const secsStr = String(time.getSeconds()).padStart(2, '0')

  return (
    <div style={{
      width: '100%',
      height: '100%',
      containerType: 'inline-size',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:wght@300;400;600&family=Public+Sans:wght@300;400;500;600;700&display=swap');
        
        .classic-digital-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: #000000;
          width: 100%;
          height: 100%;
          padding: 24px;
          box-sizing: border-box;
          font-family: 'Noto Serif', Georgia, serif;
          text-align: center;
        }

        .classic-digital-time {
          font-size: min(15cqw, 5rem);
          font-weight: 400;
          margin: 0;
          line-height: 1.1;
          letter-spacing: -0.02em;
          color: #000000;
        }

        .classic-digital-seconds {
          font-size: 0.5em;
          margin-left: 0.15em;
          font-weight: 300;
          color: #000000;
        }

        .classic-digital-ampm {
          font-size: min(4cqw, 1.3rem);
          font-weight: 300;
          margin-left: 12px;
          font-family: 'Public Sans', sans-serif;
          text-transform: uppercase;
          color: #000000;
        }

        .classic-digital-date {
          font-size: min(3.5cqw, 1.1rem);
          font-weight: 400;
          margin-top: 16px;
          margin-bottom: 0;
          letter-spacing: 0.12em;
          font-family: 'Public Sans', sans-serif;
          color: #000000;
          text-transform: uppercase;
        }

        .modern-digital-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #eef6fc;
          color: #094cb2;
          width: 100%;
          height: 100%;
          padding: 24px;
          box-sizing: border-box;
          font-family: 'Courier New', Courier, monospace;
          text-align: center;
        }

        .modern-digital-time {
          font-size: min(13cqw, 4.2rem);
          font-weight: bold;
          margin: 0;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .modern-digital-date {
          font-size: min(4cqw, 1.2rem);
          font-weight: 600;
          margin-top: 20px;
          margin-bottom: 0;
          letter-spacing: 0.05em;
        }

        .minimalist-root {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          gap: 32px;
          width: 100%;
          max-width: 850px;
          align-items: center;
          justify-content: center;
          font-family: 'Public Sans', sans-serif;
          transition: all 0.3s ease;
        }

        .minimalist-left {
          background: #ffffff;
          border-radius: 40px;
          width: min(280px, 42cqw);
          height: min(280px, 42cqw);
          min-width: 220px;
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: 0 10px 25px rgba(0,0,0,0.03);
          transition: all 0.3s ease;
        }

        .minimalist-right {
          background: #ffffff;
          border-radius: 40px;
          padding: 28px;
          width: min(330px, 48cqw);
          min-width: 260px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.03);
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: all 0.3s ease;
        }

        @container (max-width: 520px) {
          .minimalist-root {
            flex-direction: column !important;
            gap: 16px !important;
          }
          .minimalist-left {
            width: min(150px, 60cqw) !important;
            height: min(150px, 60cqw) !important;
            min-width: unset !important;
            min-height: unset !important;
            border-radius: 24px !important;
          }
          .minimalist-right {
            width: min(210px, 80cqw) !important;
            min-width: unset !important;
            border-radius: 24px !important;
            padding: 16px !important;
            gap: 8px !important;
          }
          .minimalist-left h1 {
            font-size: min(12cqw, 2rem) !important;
          }
          .minimalist-left div {
            font-size: 0.75rem !important;
            margin-top: 2px !important;
          }
          .minimalist-right h2 {
            font-size: 0.95rem !important;
          }
          .minimalist-right span {
            font-size: 0.75rem !important;
          }
          .minimalist-right .calendar-grid {
            gap: 4px 2px !important;
          }
          .minimalist-right .calendar-grid span {
            font-size: 0.62rem !important;
          }
        }
      `}} />

      {style === 'classic-digital' && (
        <div className="classic-digital-root">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
            <h1 className="classic-digital-time">
              {hours12}:{minsStr}{showSeconds && <span className="classic-digital-seconds">:{secsStr}</span>}
            </h1>
            <span className="classic-digital-ampm">{ampm}</span>
          </div>
          <p className="classic-digital-date">
            {formatDate(time, dateFormat === 'January 01, 2024' ? 'CLASSIC_CAPS' : dateFormat)}
          </p>
        </div>
      )}

      {style === 'modern-digital' && (
        <div className="modern-digital-root">
          <h1 className="modern-digital-time">
            {hours12}:{minsStr}{showSeconds && <span style={{ fontSize: '0.6em' }}>:{secsStr}</span>} <span style={{ fontSize: '0.7em' }}>{ampm}</span>
          </h1>
          <p className="modern-digital-date">{formatDate(time, dateFormat)}</p>
        </div>
      )}

      {style === 'classic-analog' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#ffffff', width: '100%', height: '100%', padding: '20px', boxSizing: 'border-box',
          fontFamily: "'Public Sans', sans-serif"
        }}>
          <div style={{ position: 'relative', width: 'min(75cqw, 75vh)', height: 'min(75cqw, 75vh)' }}>
            <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
              {/* Draw 60 small ticks */}
              {Array.from({ length: 60 }).map((_, i) => {
                if (i % 5 === 0) return null
                const angle = (i * 6 * Math.PI) / 180
                return (
                  <line
                    key={i}
                    x1={100 + 82 * Math.sin(angle)} y1={100 - 82 * Math.cos(angle)}
                    x2={100 + 86 * Math.sin(angle)} y2={100 - 86 * Math.cos(angle)}
                    stroke="#aaaaaa" strokeWidth="1"
                  />
                )
              })}

              {/* Draw 12 hour ticks */}
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30 * Math.PI) / 180
                return (
                  <line
                    key={i}
                    x1={100 + 78 * Math.sin(angle)} y1={100 - 78 * Math.cos(angle)}
                    x2={100 + 86 * Math.sin(angle)} y2={100 - 86 * Math.cos(angle)}
                    stroke="#000000" strokeWidth="3" strokeLinecap="round"
                  />
                )
              })}

              {/* Numbers 1-12 */}
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30 * Math.PI) / 180
                return (
                  <text
                    key={i}
                    x={100 + 64 * Math.sin(angle)}
                    y={100 - 64 * Math.cos(angle) + 4}
                    textAnchor="middle"
                    style={{ fontSize: '12px', fontWeight: 500, fill: '#333333' }}
                  >
                    {i || 12}
                  </text>
                )
              })}

              {/* Hour Hand */}
              <line
                x1="100" y1="100"
                x2={100 + 42 * Math.sin((hrAngle * Math.PI) / 180)}
                y2={100 - 42 * Math.cos((hrAngle * Math.PI) / 180)}
                stroke="#111111" strokeWidth="5" strokeLinecap="round"
              />

              {/* Minute Hand */}
              <line
                x1="100" y1="100"
                x2={100 + 68 * Math.sin((minAngle * Math.PI) / 180)}
                y2={100 - 68 * Math.cos((minAngle * Math.PI) / 180)}
                stroke="#222222" strokeWidth="3.5" strokeLinecap="round"
              />

              {/* Second Hand */}
              {showSeconds && (
                <>
                  <line
                    x1={100 - 15 * Math.sin((secAngle * Math.PI) / 180)}
                    y1={100 + 15 * Math.cos((secAngle * Math.PI) / 180)}
                    x2={100 + 78 * Math.sin((secAngle * Math.PI) / 180)}
                    y2={100 - 78 * Math.cos((secAngle * Math.PI) / 180)}
                    stroke="#ff9800" strokeWidth="1.2"
                  />
                  <circle cx="100" cy="100" r="5" fill="#ff9900" />
                </>
              )}
              <circle cx="100" cy="100" r="2.5" fill="#111111" />
            </svg>
          </div>
          <p style={{
            fontSize: 'min(4.5cqw, 1rem)', fontWeight: 500, color: '#666666',
            marginTop: '16px', marginBottom: 0, letterSpacing: '0.04em'
          }}>
            {formatDate(time, dateFormat)}
          </p>
        </div>
      )}

      {style === 'modern-analog' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#07111f', width: '100%', height: '100%', padding: '24px', boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '36px', padding: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 'min(75cqw, 75vh)', height: 'min(75cqw, 75vh)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.08" />
                  </filter>
                </defs>

                {/* Ticks */}
                {Array.from({ length: 60 }).map((_, i) => {
                  const angle = (i * 6 * Math.PI) / 180
                  const isHour = i % 5 === 0
                  return (
                    <line
                      key={i}
                      x1={100 + (isHour ? 78 : 82) * Math.sin(angle)} y1={100 - (isHour ? 78 : 82) * Math.cos(angle)}
                      x2={100 + 86 * Math.sin(angle)} y2={100 - 86 * Math.cos(angle)}
                      stroke={isHour ? '#111111' : '#bbbbbb'} strokeWidth={isHour ? 2.5 : 1} strokeLinecap="round"
                    />
                  )
                })}

                {/* Hour Hand */}
                <line
                  x1="100" y1="100"
                  x2={100 + 44 * Math.sin((hrAngle * Math.PI) / 180)}
                  y2={100 - 44 * Math.cos((hrAngle * Math.PI) / 180)}
                  stroke="#1c1c1e" strokeWidth="5" strokeLinecap="round" filter="url(#soft-shadow)"
                />

                {/* Minute Hand */}
                <line
                  x1="100" y1="100"
                  x2={100 + 72 * Math.sin((minAngle * Math.PI) / 180)}
                  y2={100 - 72 * Math.cos((minAngle * Math.PI) / 180)}
                  stroke="#2c2c2e" strokeWidth="3.2" strokeLinecap="round" filter="url(#soft-shadow)"
                />

                {/* Second Hand */}
                {showSeconds && (
                  <>
                    <line
                      x1={100 - 20 * Math.sin((secAngle * Math.PI) / 180)}
                      y1={100 + 20 * Math.cos((secAngle * Math.PI) / 180)}
                      x2={100 + 82 * Math.sin((secAngle * Math.PI) / 180)}
                      y2={100 - 82 * Math.cos((secAngle * Math.PI) / 180)}
                      stroke="#ff3b30" strokeWidth="1.2"
                    />
                    <circle cx="100" cy="100" r="5" fill="#ff3b30" />
                  </>
                )}
                <circle cx="100" cy="100" r="2" fill="#ffffff" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {style === 'minimalist' && (() => {
        const currentYear = time.getFullYear()
        const currentMonth = time.getMonth()
        const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate()
        const currentDay = time.getDate()

        const calendarCells: (number | null)[] = []
        for (let i = 0; i < firstDayIndex; i++) calendarCells.push(null)
        for (let day = 1; day <= totalDays; day++) calendarCells.push(day)

        return (
          <div style={{
            display: 'flex', background: '#f4f5f7', width: '100%', height: '100%',
            padding: 'min(4vw, 36px)', boxSizing: 'border-box', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Public Sans', sans-serif"
          }}>
            <div className="minimalist-root">
              {/* Clock Left */}
              <div className="minimalist-left minimalist-left-box">
                <svg viewBox="0 0 200 200" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  {Array.from({ length: 60 }).map((_, i) => {
                    const angle = (i * 6 * Math.PI) / 180
                    const isHour = i % 5 === 0
                    const isTickActive = showSeconds ? (i <= time.getSeconds()) : true
                    return (
                      <line
                        key={i}
                        x1={100 + (isHour ? 78 : 82) * Math.sin(angle)} y1={100 - (isHour ? 78 : 82) * Math.cos(angle)}
                        x2={100 + 88 * Math.sin(angle)} y2={100 - 88 * Math.cos(angle)}
                        stroke={isTickActive ? '#111111' : 'rgba(0,0,0,0.1)'}
                        strokeWidth={isHour ? 3 : 1.5} strokeLinecap="round"
                        style={{ transition: 'stroke 0.15s ease' }}
                      />
                    )
                  })}
                </svg>

                <div style={{ textAlign: 'center', zIndex: 5 }}>
                  <h1 style={{
                    fontSize: 'max(2.8rem, 6cqw)', fontWeight: 750, margin: 0, color: '#111111',
                    lineHeight: 1, fontFamily: "'Public Sans', sans-serif", letterSpacing: '-0.04em'
                  }}>
                    {String(hours12).padStart(2, '0')}:{minsStr}
                  </h1>
                  {showSeconds && (
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#666666', marginTop: '6px', letterSpacing: '0.05em' }}>
                      {secsStr}s
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar Right */}
              <div className="minimalist-right minimalist-right-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#094cb2', fontFamily: "'Public Sans', sans-serif" }}>
                    {monthNames[currentMonth]}
                  </h2>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#999999' }}>{currentYear}</span>
                </div>

                <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px 4px', textAlign: 'center' }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                    <span key={index} style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888888', paddingBottom: '4px' }}>
                      {label}
                    </span>
                  ))}

                  {calendarCells.map((day, idx) => {
                    if (day === null) return <div key={`empty-${idx}`} />
                    const isToday = day === currentDay
                    return (
                      <div
                        key={`day-${day}`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px',
                          fontSize: '0.82rem', fontWeight: isToday ? 700 : 500, color: isToday ? '#ffffff' : '#333333',
                          position: 'relative'
                        }}
                      >
                        {isToday && (
                          <div style={{
                            position: 'absolute', width: '26px', height: '26px', borderRadius: '50%',
                            background: '#094cb2', zIndex: 1
                          }} />
                        )}
                        <span style={{ zIndex: 2 }}>{day}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
