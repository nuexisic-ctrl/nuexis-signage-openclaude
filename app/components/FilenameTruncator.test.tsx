import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilenameTruncator } from './FilenameTruncator'

describe('FilenameTruncator component', () => {
  beforeEach(() => {
    // Mock getBoundingClientRect
    window.HTMLElement.prototype.getBoundingClientRect = function() {
      return {
        width: 100,
        height: 20,
        top: 100,
        left: 100,
        bottom: 120,
        right: 200,
        x: 100,
        y: 100,
        toJSON: () => {},
      }
    }
  })

  it('correctly splits base name and extension', () => {
    render(<FilenameTruncator filename="Marketing_Presentation_Final_Version_2026.pptx" />)

    // Should render the first part and the second part separately based on suffixLength = 6
    expect(screen.getByText('Marketing_Presentation_Final_Versio')).toBeInTheDocument()
    expect(screen.getByText('n_2026.pptx')).toBeInTheDocument()
  })

  it('exposes full filename for screen readers via aria-label', () => {
    const filename = 'Customer_Contract_Signed_Updated_Version.pdf'
    render(<FilenameTruncator filename={filename} />)

    const element = screen.getByLabelText(filename)
    expect(element).toBeInTheDocument()
  })

  it('handles filenames without extensions cleanly', () => {
    render(<FilenameTruncator filename="Lobby Morning Loop" />)

    expect(screen.getByLabelText('Lobby Morning Loop')).toBeInTheDocument()
    expect(screen.getByText('Lobby Mornin')).toBeInTheDocument()
    expect(screen.getByText('g Loop')).toBeInTheDocument()
  })

  it('renders and displays a body-level tooltip on hover', async () => {
    const filename = 'Screenshot_2026_06_06_14_32_48.png'
    render(<FilenameTruncator filename={filename} />)

    // Initially tooltip shouldn't be in document body
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    // Hover trigger
    const container = screen.getByLabelText(filename)
    fireEvent.mouseEnter(container)

    // Tooltip should appear
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent(filename)

    // Unhover trigger
    fireEvent.mouseLeave(container)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
