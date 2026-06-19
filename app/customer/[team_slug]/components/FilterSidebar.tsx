'use client'

import React, { useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import styles from './FilterSidebar.module.css'

interface FilterSidebarProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  onReset: () => void
  resetLabel?: string
  isModal?: boolean
  triggerId?: string
  subtitle?: React.ReactNode
}

export default function FilterSidebar({
  isOpen,
  onClose,
  title,
  children,
  onReset,
  resetLabel,
  isModal = false,
  triggerId,
  subtitle,
}: FilterSidebarProps) {
  const { t } = useTranslation()
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isOpen || isModal) return

    let startedInside = false
    let hadDropdownOpen = false

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      startedInside = !!(
        target.closest('[data-filter-sidebar]') ||
        (triggerId && target.closest(`#${triggerId}`)) ||
        target.closest('[data-filter-toggle]') ||
        target.closest('[data-sidebar-nav]') ||
        target.closest('[class*="modal"]') ||
        target.closest('[class*="dropdown"]') ||
        target.closest('[class*="select"]')
      )

      const openDropdown = document.querySelector(
        '[data-filter-sidebar] [class*="dropdown"], [data-filter-sidebar] [class*="optionsList"]'
      )
      hadDropdownOpen = !!openDropdown
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (startedInside) return
      if (hadDropdownOpen) {
        hadDropdownOpen = false
        return
      }

      const target = e.target as HTMLElement
      const endedInside = !!(
        target.closest('[data-filter-sidebar]') ||
        (triggerId && target.closest(`#${triggerId}`)) ||
        target.closest('[data-filter-toggle]') ||
        target.closest('[data-sidebar-nav]') ||
        target.closest('[class*="modal"]') ||
        target.closest('[class*="dropdown"]') ||
        target.closest('[class*="select"]')
      )

      if (!endedInside) {
        onClose()
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mouseup', handleMouseUp)
    }, 50)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isOpen, onClose, isModal, triggerId])

  // Focus trap
  useEffect(() => {
    if (!isOpen) return

    const sidebar = sidebarRef.current
    if (!sidebar) return

    const getFocusables = () => {
      return Array.from(
        sidebar.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"], [contenteditable]'
        )
      ) as HTMLElement[]
    }

    const focusables = getFocusables()
    if (focusables.length > 0) {
      focusables[0].focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const currentFocusables = getFocusables()
        if (currentFocusables.length === 0) return

        const firstElement = currentFocusables[0]
        const lastElement = currentFocusables[currentFocusables.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <>
      {!isModal && (
        <div
          className={`${styles.sidebarOverlay} ${isOpen ? styles.overlayOpen : ''}`}
          onClick={onClose}
        />
      )}
      <aside
        ref={sidebarRef}
        data-filter-sidebar
        className={`${styles.filterSidebar} ${isOpen ? styles.isOpen : ''} ${isModal ? styles.isModal : ''}`}
        aria-hidden={!isOpen}
        aria-labelledby="filter-sidebar-title"
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.headerTitleContainer}>
            <h3 id="filter-sidebar-title" className={styles.sidebarTitle}>{t(title)}</h3>
            {subtitle && <div className={styles.headerSubtitle}>{subtitle}</div>}
          </div>
          <button
            className={styles.closeSidebarBtn}
            onClick={onClose}
            type="button"
            aria-label={t('Close filters')}
          >
            <X size={20} />
          </button>
        </div>
        <div className={styles.sidebarBody}>{children}</div>
        <div className={styles.sidebarFooter}>
          <button
            className={styles.resetFiltersBtn}
            onClick={onReset}
            type="button"
          >
            {resetLabel ? t(resetLabel) : t('Reset All Filters')}
          </button>
        </div>
      </aside>
    </>
  )
}
