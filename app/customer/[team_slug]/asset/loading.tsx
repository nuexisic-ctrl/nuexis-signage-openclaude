import React from 'react'

export default function AssetsLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', padding: '0 0 24px' }}>
      {/* Title & Actions Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="skeleton" style={{ width: '180px', height: '36px' }} />
          <div className="skeleton" style={{ width: '240px', height: '18px' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div className="skeleton" style={{ width: '130px', height: '42px', borderRadius: '10px' }} />
          <div className="skeleton" style={{ width: '110px', height: '42px', borderRadius: '10px' }} />
          <div className="skeleton" style={{ width: '130px', height: '42px', borderRadius: '10px' }} />
        </div>
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="skeleton" style={{ width: '84px', height: '42px', borderRadius: '10px' }} />
            <div className="skeleton" style={{ width: '84px', height: '42px', borderRadius: '10px' }} />
          </div>
        </div>

        {/* Media Items (Grid Skeleton) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
          padding: '16px'
        }}>
          {/* 2 Folders */}
          {[1, 2].map((i) => (
            <div key={i} style={{
              background: 'var(--surface-low)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '12px',
              padding: '14px',
              height: '72px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skeleton" style={{ width: '70%', height: '14px' }} />
                <div className="skeleton" style={{ width: '30%', height: '10px' }} />
              </div>
            </div>
          ))}

          {/* 6 Media Cards */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{
              background: 'var(--surface-lowest)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: '190px'
            }}>
              {/* Card Thumbnail */}
              <div className="skeleton" style={{ width: '100%', height: '110px', borderRadius: '0' }} />
              {/* Card Info */}
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <div className="skeleton" style={{ width: '85%', height: '14px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div className="skeleton" style={{ width: '40px', height: '10px' }} />
                  <div className="skeleton" style={{ width: '30px', height: '10px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
