import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ThemeSelect from './ThemeSelect'

// Mock modalStack
vi.mock('@/lib/utils/modalStack', () => ({
  modalStack: {
    push: vi.fn(),
    pop: vi.fn()
  }
}))

describe('ThemeSelect component', () => {
  const options = [
    { value: 'dark', label: 'Deep Dark' },
    { value: 'light', label: 'Clean Light' },
    { value: 'sunset', label: 'Sunset Gradient' }
  ] as const

  it('renders selected theme label and handles open/close click', () => {
    const handleChange = vi.fn()
    render(
      <ThemeSelect
        id="test-theme-select"
        value="dark"
        options={options}
        onChange={handleChange}
      />
    )

    // Verify it shows selected theme label
    expect(screen.getByText('Deep Dark')).toBeInTheDocument()

    // Clicking trigger opens dropdown
    const trigger = screen.getByRole('button', { name: /Deep Dark/i })
    fireEvent.click(trigger)

    // Option list items should be displayed
    expect(screen.getByText('Clean Light')).toBeInTheDocument()
    expect(screen.getByText('Sunset Gradient')).toBeInTheDocument()

    // Clicking trigger again closes dropdown
    fireEvent.click(trigger)
    expect(screen.queryByText('Clean Light')).not.toBeInTheDocument()
  })

  it('calls onChange when a theme card is clicked', () => {
    const handleChange = vi.fn()
    render(
      <ThemeSelect
        id="test-theme-select"
        value="dark"
        options={options}
        onChange={handleChange}
      />
    )

    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('option', { name: 'Clean Light' }))

    expect(handleChange).toHaveBeenCalledWith('light')
  })

  it('handles preview hover states cleanly', () => {
    vi.useFakeTimers()
    const handlePreviewChange = vi.fn()

    render(
      <ThemeSelect
        id="test-theme-select"
        value="dark"
        options={options}
        onChange={vi.fn()}
        onPreviewChange={handlePreviewChange}
        previewDelay={100}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByRole('button'))

    // Hover over 'Sunset Gradient'
    const option = screen.getByRole('option', { name: 'Sunset Gradient' })
    fireEvent.mouseEnter(option)

    // Fast-forward timers
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(handlePreviewChange).toHaveBeenCalledWith('sunset')

    // Mouse leave calls preview change with null
    fireEvent.mouseLeave(option)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(handlePreviewChange).toHaveBeenLastCalledWith(null)

    vi.useRealTimers()
  })
})
