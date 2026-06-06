import React from 'react'

export default function ScreensLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', padding: '0 0 24px' }}>
      {/* Title block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="skeleton" style={{ width: '150px', height: '36px' }} />
          <div className="skeleton" style={{ width: '300px', height: '18px' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="skeleton" style={{ width: '110px', height: '42px', borderRadius: '10px' }} />
          <div className="skeleton" style={{ width: '120px', height: '42px', borderRadius: '10px' }} />
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            background: 'var(--surface-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div className="skeleton" style={{ width: '80px', height: '12px' }} />
            <div className="skeleton" style={{ width: '60px', height: '28px' }} />
          </div>
        ))}
      </div>

      {/* Groups Section Skeleton */}
      <div style={{
        background: 'var(--surface-lowest)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="skeleton" style={{ width: '120px', height: '20px' }} />
        {[1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '12px' }}>
            <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: '140px', height: '16px' }} />
            <div className="skeleton" style={{ width: '80px', height: '16px', marginLeft: 'auto' }} />
          </div>
        ))}
      </div>

      {/* Main Table Block Container */}
      <div style={{
        background: 'var(--surface-lowest)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Controls Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          borderBottom: '1px solid var(--outline-variant)',
          gap: '14px',
          flexWrap: 'wrap'
        }}>
          <div className="skeleton" style={{ width: '320px', height: '42px', borderRadius: '10px' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="skeleton" style={{ width: '90px', height: '42px', borderRadius: '10px' }} />
            <div className="skeleton" style={{ width: '84px', height: '42px', borderRadius: '10px' }} />
          </div>
        </div>

        {/* Table Skeleton Rows */}
        <div style={{ padding: '0 16px' }}>
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '18px 0',
              borderBottom: '1px solid var(--outline-variant)',
              gap: '16px'
            }}>
              <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
                <div className="skeleton" style={{ width: '160px', height: '16px' }} />
                <div className="skeleton" style={{ width: '80px', height: '10px' }} />
              </div>
              <div className="skeleton" style={{ width: '80px', height: '16px', flex: 1 }} />
              <div className="skeleton" style={{ width: '100px', height: '16px', flex: 1 }} />
              <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '8px', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
