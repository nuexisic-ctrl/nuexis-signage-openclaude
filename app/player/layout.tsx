import type { ReactNode } from 'react'
import ErrorBoundary from '@/app/components/ErrorBoundary'

/**
 * Player layout — wraps the entire player client in an Error Boundary.
 *
 * Digital signage players run 24/7 without user interaction. Without an
 * Error Boundary, a single render exception would produce a blank screen
 * until someone manually refreshes the device. The boundary catches that
 * error and shows a "Reload Page" UI instead.
 */
export default function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary boundaryId="player-root">
      {children}
    </ErrorBoundary>
  )
}
