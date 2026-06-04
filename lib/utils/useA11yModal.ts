'use client'

import { useEffect, useRef } from 'react'
import { modalStack } from './modalStack'

type UseA11yModalOptions = {
  /**
   * Unique id for modalStack priority + scroll locking.
   * Keep stable across mounts.
   */
  id: string
  /**
   * Called when user requests close via ESC (top-most only).
   */
  onClose: () => void
  /**
   * If you already have a close button/input you want focused first, pass it here.
   */
  initialFocusSelector?: string
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getModalStackSize(): number {
  if (typeof window === 'undefined') return 0
  return window.__nuexisModalStack?.length ?? 0
}

/**
 * Minimal, dependency-free a11y modal behavior:
 * - body scroll lock (stack-aware)
 * - ESC closes only the top-most modal
 * - focus is moved into the modal on mount and restored on unmount
 * - TAB key is trapped inside the modal
 */
export function useA11yModal({ id, onClose, initialFocusSelector }: UseA11yModalOptions) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreFocusRef.current = (document.activeElement as HTMLElement | null) ?? null

    modalStack.push(id)
    document.body.style.overflow = 'hidden'

    // Focus the first meaningful control inside the modal.
    const focusTimer = window.setTimeout(() => {
      if (!dialogRef.current) return

      const preferred = initialFocusSelector
        ? (dialogRef.current.querySelector(initialFocusSelector) as HTMLElement | null)
        : null

      const firstFocusable = (dialogRef.current.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null) ?? dialogRef.current
      ;(preferred ?? firstFocusable)?.focus?.()
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)

      modalStack.pop(id)

      // Restore body scroll only when the last modal is gone.
      if (getModalStackSize() === 0) {
        document.body.style.overflow = ''
      }

      // Restore focus if possible (avoid throwing if element is gone).
      try {
        restoreFocusRef.current?.focus?.()
      } catch {
        // ignore
      }
    }
  }, [id, initialFocusSelector])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!dialogRef.current) return

      if (event.key === 'Escape' && modalStack.isTop(id)) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return
      if (!modalStack.isTop(id)) return

      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1)

      if (focusables.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (!active || active === first || !dialogRef.current.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else {
        if (!active || active === last || !dialogRef.current.contains(active)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [id, onClose])

  return dialogRef
}

