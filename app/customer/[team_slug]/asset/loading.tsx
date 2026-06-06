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
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="skeleton" style={{ width: '120px', height: '42px', borderRadius: '10px' }} />
          <div className="skeleton" style={{ width: '130px', height: '42px', borderRadius: '10px' }} />
          <div className="skeleton" style={{ width: '135px', height: '42px', borderRadius: '10px' }} />
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: '90px', height: '42px', borderRadius: '10px' }} />
            <div className="skeleton" style={{ width: '84px', height: '42px', borderRadius: '10px' }} />
          </div>
        </div>

        {/* Media Items (Grid Skeleton matching 280px auto-fill grid) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '14px',
          padding: '16px'
        }}>
          {/* 2 Folder Cards (Folders are styled as grid cards at the top) */}
          {[1, 2].map((i) => (
            <div key={`folder-skele-${i}`} style={{
              background: 'var(--surface-lowest)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '14px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Card Thumbnail Area */}
              <div style={{ width: '100%', aspectRatio: '16 / 10', background: 'var(--surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {/* Folder icon placeholder shape */}
                <div className="skeleton" style={{ width: '64px', height: '52px', borderRadius: '8px' }} />
                {/* Folder tag chip */}
                <div className="skeleton" style={{ position: 'absolute', bottom: '9px', left: '9px', width: '56px', height: '18px', borderRadius: '9999px' }} />
              </div>
              {/* Card Info Area */}
              <div style={{ padding: '13px 14px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div className="skeleton" style={{ width: '60%', height: '16px' }} />
                  <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                </div>
                <div className="skeleton" style={{ width: '40%', height: '12px', marginTop: '4px' }} />
              </div>
            </div>
          ))}

          {/* 6 Media Cards */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={`media-skele-${i}`} style={{
              background: 'var(--surface-lowest)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '14px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Card Thumbnail Area */}
              <div style={{ width: '100%', aspectRatio: '16 / 10', position: 'relative' }}>
                <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: '0' }} />
                {/* Mime chip shape */}
                <div className="skeleton" style={{ position: 'absolute', bottom: '9px', left: '9px', width: '44px', height: '18px', borderRadius: '9999px' }} />
              </div>
              {/* Card Info Area */}
              <div style={{ padding: '13px 14px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div className="skeleton" style={{ width: '80%', height: '16px' }} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                    <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                  </div>
                </div>
                {/* Meta details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <div className="skeleton" style={{ width: '45px', height: '12px' }} />
                  <div className="skeleton" style={{ width: '6px', height: '6px', borderRadius: '50%' }} />
                  <div className="skeleton" style={{ width: '55px', height: '12px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
