import React from 'react'
import Link from 'next/link'
import { ListVideo } from 'lucide-react'

export default function PlaylistNotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '80px 24px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        background: 'var(--surface-low)',
        border: '1px solid var(--outline-variant)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--on-surface-muted)',
      }}>
        <ListVideo size={28} />
      </div>

      <h2 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '1.35rem',
        fontWeight: 800,
        color: 'var(--on-surface)',
        margin: 0,
      }}>
        Playlist Not Found
      </h2>

      <p style={{
        fontSize: '0.92rem',
        color: 'var(--on-surface-muted)',
        maxWidth: '420px',
        lineHeight: 1.6,
        margin: 0,
      }}>
        This playlist doesn&apos;t exist or you don&apos;t have access to it.
        It may have been deleted or you may need to sign in to a different workspace.
      </p>

      <Link
        href="./"
        style={{
          marginTop: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          background: 'var(--primary)',
          color: 'var(--on-primary)',
          borderRadius: '10px',
          fontFamily: 'var(--font-label)',
          fontSize: '0.875rem',
          fontWeight: 800,
          textDecoration: 'none',
        }}
      >
        Back to Playlists
      </Link>
    </div>
  )
}
