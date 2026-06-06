import React from 'react'

export default function PlaylistsLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', padding: '0 0 24px' }}>
      {/* Title & Actions Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="skeleton" style={{ width: '150px', height: '36px' }} />
          <div className="skeleton" style={{ width: '320px', height: '18px' }} />
        </div>
        <div className="skeleton" style={{ width: '140px', height: '42px', borderRadius: '10px' }} />
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
          <div className="skeleton" style={{ width: '280px', height: '42px', borderRadius: '10px' }} />
        </div>

        {/* Playlist Items (Table Skeleton) */}
        <div style={{ padding: '0 16px' }}>
          {[1, 2, 3, 4].map((row) => (
            <div key={row} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '18px 0',
              borderBottom: '1px solid var(--outline-variant)',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
                <div className="skeleton" style={{ width: '200px', height: '16px' }} />
                <div className="skeleton" style={{ width: '120px', height: '10px' }} />
              </div>
              <div className="skeleton" style={{ width: '80px', height: '16px', flex: 1 }} />
              <div className="skeleton" style={{ width: '120px', height: '16px', flex: 1 }} />
              <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '8px', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
