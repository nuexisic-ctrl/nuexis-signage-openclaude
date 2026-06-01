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

describe('Header component', () => {
  it('renders user information correctly', () => {
    render(<Header fullName="Test User" email="test@example.com" />)
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('renders fallback when name is not provided', () => {
    render(<Header email="test@example.com" />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })
})
