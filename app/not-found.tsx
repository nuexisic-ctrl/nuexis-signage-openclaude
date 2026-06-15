import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#07111f',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#f8fafc',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glowing effects */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0) 70%)',
        top: '20%',
        left: '10%',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, rgba(124, 58, 237, 0) 70%)',
        bottom: '10%',
        right: '5%',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '48px 32px',
        maxWidth: '460px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px'
      }}>
        {/* Glow-ring Broken Link Icon */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(239, 68, 68, 0.15)',
          color: '#ef4444'
        }} aria-hidden="true">
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ width: '36px', height: '36px' }}
          >
            <path d="M10.9 7.3c-.3-.2-.6-.3-.9-.3-1.7 0-3 1.3-3 3s1.3 3 3 3c.3 0 .6-.1.9-.3" />
            <path d="M13.1 16.7c.3.2.6.3.9.3 1.7 0 3-1.3 3-3s-1.3-3-3-3c-.3 0-.6.1-.9.3" />
            <line x1="8" y1="16" x2="16" y2="8" />
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            margin: 0,
            background: 'linear-gradient(to right, #ffffff, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Page Not Found</h1>
          <p style={{
            fontSize: '1rem',
            color: '#94a3b8',
            margin: 0,
            lineHeight: '1.5'
          }}>
            The page you are looking for does not exist, or you do not have permission to access it.
          </p>
        </div>

        <p style={{
          fontSize: '0.875rem',
          color: '#64748b',
          margin: 0,
          lineHeight: '1.6'
        }}>
          Please check the spelling of your workspace URL or contact your administrator.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '8px' }}>
          <Link 
            href="/" 
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.95rem',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'background-color 0.2s',
              display: 'inline-block',
              boxSizing: 'border-box'
            }}
          >
            Go to NuExis Home
          </Link>
        </div>
      </div>
    </div>
  )
}
