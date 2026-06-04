import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CustomSelect from './CustomSelect'

// Mock modalStack
vi.mock('@/lib/utils/modalStack', () => ({
  modalStack: {
    push: vi.fn(),
    pop: vi.fn()
  }
}))

describe('CustomSelect component', () => {
  const options = [
    { value: 'card', label: 'Card Layout' },
    { value: 'digital', label: 'Digital' },
    { value: 'minimal', label: 'Minimal', disabled: true }
  ]

  it('renders selected option label and handles open/close click', () => {
    const handleChange = vi.fn()
    render(
      <CustomSelect
        id="test-select"
        value="card"
        options={options}
        onChange={handleChange}
        placeholder="Select style"
      />
    )

    // Verify it shows selected option label
    expect(screen.getByText('Card Layout')).toBeInTheDocument()

    // Clicking trigger opens dropdown
    const trigger = screen.getByRole('button', { name: /Card Layout/i })
    fireEvent.click(trigger)

    // Option lists should be displayed
    expect(screen.getByText('Digital')).toBeInTheDocument()
    expect(screen.getByText('Minimal')).toBeInTheDocument()

    // Clicking it again closes dropdown
    fireEvent.click(trigger)
    expect(screen.queryByText('Digital')).not.toBeInTheDocument()
  })

  it('calls onChange when an enabled option is clicked', () => {
    const handleChange = vi.fn()
    render(
      <CustomSelect
        id="test-select"
        value="card"
        options={options}
        onChange={handleChange}
      />
    )

    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('option', { name: 'Digital' }))

    expect(handleChange).toHaveBeenCalledWith('digital')
  })

  it('does not call onChange when a disabled option is clicked', () => {
    const handleChange = vi.fn()
    render(
      <CustomSelect
        id="test-select"
        value="card"
        options={options}
        onChange={handleChange}
      />
    )

    fireEvent.click(screen.getByRole('button'))
    const disabledOption = screen.getByRole('option', { name: 'Minimal' })
    expect(disabledOption).toBeDisabled()
    fireEvent.click(disabledOption)

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('cleans up previews and calls onPreviewChange(null) cleanly on unmount', () => {
    vi.useFakeTimers()
    const handlePreviewChange = vi.fn()

    const { unmount } = render(
      <CustomSelect
        id="test-select"
        value="card"
        options={options}
        onChange={vi.fn()}
        onPreviewChange={handlePreviewChange}
        previewDelay={100}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByRole('button'))

    // Hover over 'Digital'
    const option = screen.getByRole('option', { name: 'Digital' })
    fireEvent.mouseEnter(option)

    // Fast-forward timers
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(handlePreviewChange).toHaveBeenCalledWith('digital')

    // Unmount select component
    unmount()

    // Check that cleanup calls preview change with null
    expect(handlePreviewChange).toHaveBeenLastCalledWith(null)

    vi.useRealTimers()
  })
})
