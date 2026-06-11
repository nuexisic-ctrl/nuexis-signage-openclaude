import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Header from '../[team_slug]/components/Header'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/test-team/dashboard',
  useParams: () => ({ team_slug: 'test-team' })
}))

// Mock supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn()
    }
  })
}))

import { ThemeProvider } from '@/app/components/ThemeProvider'

describe('Header component', () => {
  it('renders user information correctly', () => {
    render(
      <ThemeProvider>
        <Header fullName="Test User" email="test@example.com" />
      </ThemeProvider>
    )
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('renders fallback when name is not provided', () => {
    render(
      <ThemeProvider>
        <Header email="test@example.com" />
      </ThemeProvider>
    )
    
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })
})
