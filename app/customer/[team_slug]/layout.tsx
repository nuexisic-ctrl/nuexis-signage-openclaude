import type { ReactNode } from 'react'
import ErrorBoundary from '@/app/components/ErrorBoundary'

/**
 * Customer workspace layout — wraps all customer dashboard routes in an
 * Error Boundary so that a crash in any sub-page (assets, playlists,
 * screens, etc.) shows a graceful fallback instead of a blank white screen.
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary boundaryId="customer-dashboard">
      {children}
    </ErrorBoundary>
  )
}
