import React from 'react'

export default function DashboardLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', padding: '0 0 24px' }}>
      {/* Title block */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton" style={{ width: '220px', height: '36px' }} />
        <div className="skeleton" style={{ width: '420px', height: '18px' }} />
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            background: 'var(--surface-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div className="skeleton" style={{ width: '80px', height: '14px' }} />
            <div className="skeleton" style={{ width: '140px', height: '32px' }} />
            <div className="skeleton" style={{ width: '110px', height: '12px' }} />
          </div>
        ))}
      </div>

      {/* Main Blocks (2 Columns) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Chart Block */}
          <div style={{
            background: 'var(--surface-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '16px',
            padding: '24px',
            height: '320px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div className="skeleton" style={{ width: '180px', height: '20px' }} />
            <div className="skeleton" style={{ width: '100%', flex: 1 }} />
          </div>

          {/* Activity Table Block */}
          <div style={{
            background: 'var(--surface-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div className="skeleton" style={{ width: '150px', height: '20px' }} />
            {[1, 2, 3].map((row) => (
              <div key={row} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="skeleton" style={{ width: '60%', height: '14px' }} />
                  <div className="skeleton" style={{ width: '30%', height: '10px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Alerts / Issues Block */}
          <div style={{
            background: 'var(--surface-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '16px',
            padding: '24px',
            height: '220px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div className="skeleton" style={{ width: '120px', height: '20px' }} />
            {[1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', gap: '12px' }}>
                <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="skeleton" style={{ width: '80%', height: '14px' }} />
                  <div className="skeleton" style={{ width: '90%', height: '10px' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Timeline Block */}
          <div style={{
            background: 'var(--surface-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div className="skeleton" style={{ width: '160px', height: '20px' }} />
            <div className="skeleton" style={{ width: '100%', height: '150px' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
