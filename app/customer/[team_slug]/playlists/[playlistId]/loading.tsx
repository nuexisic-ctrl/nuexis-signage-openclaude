import React from 'react'

export default function PlaylistWorkspaceLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', padding: '0 0 24px' }}>
      {/* Breadcrumb + Title Row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="skeleton" style={{ width: '180px', height: '16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div className="skeleton" style={{ width: '260px', height: '36px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '10px' }} />
            <div className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '10px' }} />
            <div className="skeleton" style={{ width: '120px', height: '38px', borderRadius: '10px' }} />
            <div className="skeleton" style={{ width: '120px', height: '38px', borderRadius: '10px' }} />
          </div>
        </div>
        <div className="skeleton" style={{ width: '140px', height: '14px' }} />
      </div>

      {/* Two-column body */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Content table area */}
        <div style={{
          flex: 1,
          background: 'var(--surface-lowest)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'flex',
            gap: '16px',
            padding: '14px 16px',
            borderBottom: '1px solid var(--outline-variant)',
          }}>
            {['40px', '36px', '160px', '80px', '90px', '80px', '100px'].map((w, i) => (
              <div key={i} className="skeleton" style={{ width: w, height: '14px' }} />
            ))}
          </div>
          {/* Table rows */}
          {[1, 2, 3, 4].map((row) => (
            <div key={row} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 16px',
              borderBottom: '1px solid var(--outline-variant)',
              gap: '16px',
            }}>
              <div className="skeleton" style={{ width: '24px', height: '14px' }} />
              <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '6px' }} />
              <div className="skeleton" style={{ width: '140px', height: '14px', flex: 1 }} />
              <div className="skeleton" style={{ width: '60px', height: '14px' }} />
              <div className="skeleton" style={{ width: '70px', height: '14px' }} />
              <div className="skeleton" style={{ width: '50px', height: '14px' }} />
              <div className="skeleton" style={{ width: '80px', height: '14px' }} />
              <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
            </div>
          ))}
          {/* Add media button */}
          <div style={{ padding: '16px' }}>
            <div className="skeleton" style={{ width: '100%', height: '38px', borderRadius: '8px' }} />
          </div>
        </div>

        {/* Info panel */}
        <div style={{
          width: '300px',
          flexShrink: 0,
          background: 'var(--surface-lowest)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          <div className="skeleton" style={{ width: '100px', height: '16px' }} />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="skeleton" style={{ width: '80px', height: '14px' }} />
              <div className="skeleton" style={{ width: '60px', height: '14px' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
