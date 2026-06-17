'use client'

import { useEffect } from 'react'

export function ModalDragFix() {
  useEffect(() => {
    let mousedownInsideModal = false

    const isInsideModalContent = (el: Element | null): boolean => {
      let current = el
      while (current && current !== document.body) {
        const className = current.className as any
        const classNameStr = typeof className === 'string'
          ? className
          : (className && typeof className === 'object' && 'baseVal' in className ? className.baseVal : '')
        
        // If we hit any element that is known as a backdrop/overlay, we are NOT inside the modal content box.
        if (
          classNameStr.includes('overlay') || 
          classNameStr.includes('backdrop') || 
          classNameStr.includes('modalBackdrop') ||
          classNameStr.includes('sidebarBackdrop')
        ) {
          return false
        }
        
        // If we hit a modal box or element with dialog role:
        if (
          classNameStr.includes('modal') || 
          current.getAttribute('role') === 'dialog' ||
          classNameStr.includes('modalHeader') ||
          classNameStr.includes('modalBody') ||
          classNameStr.includes('modalFooter')
        ) {
          return true
        }
        
        current = current.parentElement
      }
      return false
    }

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element
      mousedownInsideModal = isInsideModalContent(target)
    }

    const handleClick = (e: MouseEvent) => {
      if (mousedownInsideModal) {
        const target = e.target as Element
        const className = target.className as any
        const classNameStr = typeof className === 'string'
          ? className
          : (className && typeof className === 'object' && 'baseVal' in className ? className.baseVal : '')
        
        // If the click event's target is the backdrop overlay but the click originally started inside the modal content box,
        // stop the event immediately before it reaches the backdrop's click event handlers.
        const isBackdropClick = 
          classNameStr.includes('overlay') || 
          classNameStr.includes('backdrop') || 
          classNameStr.includes('modalBackdrop') ||
          classNameStr.includes('sidebarBackdrop')
        
        if (isBackdropClick) {
          e.stopPropagation()
          e.stopImmediatePropagation()
          e.preventDefault()
        }
      }
      mousedownInsideModal = false
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
