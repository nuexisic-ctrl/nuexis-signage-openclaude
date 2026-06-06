import React from 'react'

export default function SettingsLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', padding: '0 0 24px', maxWidth: '768px' }}>
      {/* Title block */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton" style={{ width: '140px', height: '36px' }} />
        <div className="skeleton" style={{ width: '380px', height: '18px' }} />
      </div>

      {/* Profile Card Skeleton */}
      <div style={{
        background: 'var(--surface-lowest)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '16px',
        overflow: 'hidden',
        marginTop: '8px'
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="skeleton" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ width: '150px', height: '18px' }} />
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="skeleton" style={{ width: '80px', height: '12px' }} />
            <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '10px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="skeleton" style={{ width: '100px', height: '12px' }} />
            <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '10px' }} />
          </div>
        </div>
      </div>

      {/* Workspace Card Skeleton */}
      <div style={{
        background: 'var(--surface-lowest)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="skeleton" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ width: '130px', height: '18px' }} />
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton" style={{ width: '100px', height: '12px' }} />
              <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '10px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton" style={{ width: '80px', height: '12px' }} />
              <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '10px' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
