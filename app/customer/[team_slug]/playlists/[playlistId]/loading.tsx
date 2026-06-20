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

      {/* Single-column body */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', width: '100%' }}>
        {/* Content table area */}
        <div style={{
          flex: 1,
          background: 'var(--surface-lowest)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '16px',
          overflow: 'hidden',
          width: '100%',
        }}>
          {/* Table header */}
          <div style={{
            display: 'flex',
            gap: '16px',
            padding: '14px 16px',
            borderBottom: '1px solid var(--outline-variant)',
            alignItems: 'center',
          }}>
            {/* Checkbox (36px), # (30px), Name (flex: 1), TYPE (120px), Duration (100px), Actions (80px) */}
            <div className="skeleton" style={{ width: '36px', height: '14px' }} />
            <div className="skeleton" style={{ width: '30px', height: '14px' }} />
            <div className="skeleton" style={{ flex: 1, height: '14px' }} />
            <div className="skeleton" style={{ width: '120px', height: '14px' }} />
            <div className="skeleton" style={{ width: '100px', height: '14px' }} />
            <div className="skeleton" style={{ width: '80px', height: '14px' }} />
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
              <div className="skeleton" style={{ width: '36px', height: '16px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ width: '30px', height: '14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '6px', flexShrink: 0 }} />
                <div className="skeleton" style={{ width: '140px', height: '14px' }} />
              </div>
              <div className="skeleton" style={{ width: '120px', height: '14px' }} />
              <div className="skeleton" style={{ width: '100px', height: '14px' }} />
              <div className="skeleton" style={{ width: '80px', height: '14px' }} />
            </div>
          ))}
          {/* Add media button */}
          <div style={{ padding: '16px' }}>
            <div className="skeleton" style={{ width: '100%', height: '38px', borderRadius: '8px' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
