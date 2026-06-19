'use client'

import { useEffect } from 'react'

export function ModalDragFix() {
  useEffect(() => {
    let mousedownOnBackdrop = false

    const isBackdrop = (el: Element | null): boolean => {
      if (!el) return false
      
      if (el.getAttribute('role') === 'presentation') {
        return true
      }

      const className = el.className as any
      const classNameStr = typeof className === 'string'
        ? className
        : (className && typeof className === 'object' && 'baseVal' in className ? className.baseVal : '')
      
      const lowerClass = classNameStr.toLowerCase()
      return (
        lowerClass.includes('overlay') || 
        lowerClass.includes('backdrop')
      )
    }

    const handleMouseDown = (e: MouseEvent) => {
      mousedownOnBackdrop = isBackdrop(e.target as Element)
    }

    const handleClick = (e: MouseEvent) => {
      if (!mousedownOnBackdrop && isBackdrop(e.target as Element)) {
        e.stopPropagation()
        e.stopImmediatePropagation()
        e.preventDefault()
      }
      mousedownOnBackdrop = false
    }

    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('click', handleClick, true)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('click', handleClick, true)
    }
  }, [])

  return null
}

export default ModalDragFix
