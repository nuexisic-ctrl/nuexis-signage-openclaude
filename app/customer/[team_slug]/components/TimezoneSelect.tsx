'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, Check } from 'lucide-react'
import { modalStack } from '@/lib/utils/modalStack'
import styles from './TimezoneSelect.module.css'

const ITEM_HEIGHT = 36 // Exact height of each option/header in pixels

export const SUPPORTED_TIMEZONES = [
  {
    group: 'Global',
    zones: ['UTC']
  },
  {
    group: 'Asia',
    zones: [
      'Asia/Kolkata',
      'Asia/Dubai',
      'Asia/Karachi',
      'Asia/Dhaka',
      'Asia/Bangkok',
      'Asia/Singapore',
      'Asia/Hong_Kong',
      'Asia/Tokyo',
      'Asia/Seoul',
      'Asia/Shanghai',
      'Asia/Manila',
      'Asia/Jakarta',
      'Asia/Makassar',
      'Asia/Magadan'
    ]
  },
  {
    group: 'Europe',
    zones: [
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Madrid',
      'Europe/Rome',
      'Europe/Amsterdam',
      'Europe/Brussels',
      'Europe/Prague',
      'Europe/Vienna',
      'Europe/Warsaw',
      'Europe/Stockholm',
      'Europe/Oslo',
      'Europe/Helsinki',
      'Europe/Athens',
      'Europe/Moscow'
    ]
  },
  {
    group: 'North & South America',
    zones: [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Phoenix',
      'America/Los_Angeles',
      'America/Anchorage',
      'America/Honolulu',
      'America/Toronto',
      'America/Vancouver',
      'America/Mexico_City',
      'America/Bogota',
      'America/Lima',
      'America/Santiago',
      'America/Sao_Paulo',
      'America/Buenos_Aires'
    ]
  },
  {
    group: 'Africa',
    zones: [
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Africa/Lagos',
      'Africa/Nairobi',
      'Africa/Casablanca'
    ]
  },
  {
    group: 'Australia',
    zones: [
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Brisbane',
      'Australia/Perth',
      'Australia/Adelaide',
      'Australia/Darwin'
    ]
  },
  {
    group: 'Pacific',
    zones: [
      'Pacific/Auckland',
      'Pacific/Fiji',
      'Pacific/Apia',
      'Pacific/Guam',
      'Pacific/Tahiti'
    ]
  }
]

interface TimezoneSelectProps {
  value: string
  onChange: (value: string) => void
  id: string
  onPreviewChange?: (value: string | null) => void
  previewDelay?: number
}

type FlattenedItem = 
  | { type: 'header'; label: string }
  | { type: 'option'; value: string; label: string }

export default function TimezoneSelect({
  value,
  onChange,
  id,
  onPreviewChange,
  previewDelay = 200
}: TimezoneSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [activeIndex, setActiveIndex] = useState(-1) // active index in the flattened list (options only)

  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const hoverTimeoutRef = useRef<number | null>(null)
  const onPreviewChangeRef = useRef(onPreviewChange)

  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

  const updateCoords = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      updateCoords()
      window.addEventListener('resize', updateCoords)
      window.addEventListener('scroll', updateCoords, true)
    }
    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords, true)
    }
  }, [isOpen, updateCoords])

  useEffect(() => {
    onPreviewChangeRef.current = onPreviewChange
  }, [onPreviewChange])

  const clearPreviewTimer = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  const closeDropdown = useCallback(() => {
    clearPreviewTimer()
    onPreviewChangeRef.current?.(null)
    setIsOpen(false)
    setSearchQuery('')
    setActiveIndex(-1)
  }, [clearPreviewTimer])

  // Register with modalStack when open
  useEffect(() => {
    const stackId = `timezone-select-${id}`
    if (isOpen) {
      modalStack.push(stackId)
      // Focus search input
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      modalStack.pop(stackId)
    }
    return () => {
      modalStack.pop(stackId)
    }
  }, [isOpen, id])

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        (!popoverRef.current || !popoverRef.current.contains(e.target as Node))
      ) {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen, closeDropdown])

  const handleSelect = (val: string) => {
    clearPreviewTimer()
    onPreviewChangeRef.current?.(null)
    onChange(val)
    closeDropdown()
  }

  const previewOption = (val: string | null) => {
    clearPreviewTimer()
    if (!onPreviewChangeRef.current) return
    hoverTimeoutRef.current = window.setTimeout(() => {
      onPreviewChangeRef.current?.(val)
    }, previewDelay)
  }

  // Filter timezones and flatten
  const query = searchQuery.trim().toLowerCase()
  const listItems: FlattenedItem[] = []
  
  SUPPORTED_TIMEZONES.forEach(group => {
    const matching = group.zones.filter(z => z.toLowerCase().includes(query))
    if (matching.length > 0) {
      listItems.push({ type: 'header', label: group.group })
      matching.forEach(z => {
        listItems.push({ type: 'option', value: z, label: z })
      })
    }
  })

  // List of indices in `listItems` that are actual options (not headers)
  const optionIndices = listItems
    .map((item, idx) => (item.type === 'option' ? idx : -1))
    .filter(idx => idx !== -1)

  // Virtualization constants
  const containerHeight = 240 // max-height in css
  const totalHeight = listItems.length * ITEM_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 3)
  const endIndex = Math.min(listItems.length - 1, Math.floor((scrollTop + containerHeight) / ITEM_HEIGHT) + 3)
  const visibleItems = listItems.slice(startIndex, endIndex + 1)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  const moveKeyboardFocus = (direction: 1 | -1) => {
    if (optionIndices.length === 0) return
    const currentActiveOptIndex = optionIndices.indexOf(activeIndex)
    let nextActiveOptIndex = currentActiveOptIndex + direction
    if (nextActiveOptIndex < 0) nextActiveOptIndex = optionIndices.length - 1
    if (nextActiveOptIndex >= optionIndices.length) nextActiveOptIndex = 0

    const targetListIndex = optionIndices[nextActiveOptIndex]
    setActiveIndex(targetListIndex)

    // Scroll target item into view if not visible
    if (scrollContainerRef.current) {
      const scrollMin = targetListIndex * ITEM_HEIGHT - containerHeight + ITEM_HEIGHT
      const scrollMax = targetListIndex * ITEM_HEIGHT
      const currentScroll = scrollContainerRef.current.scrollTop
      if (currentScroll < scrollMin) {
        scrollContainerRef.current.scrollTop = scrollMin
      } else if (currentScroll > scrollMax) {
        scrollContainerRef.current.scrollTop = scrollMax
      }
    }

    // Trigger preview change
    const targetItem = listItems[targetListIndex]
    if (targetItem && targetItem.type === 'option') {
      previewOption(targetItem.value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveKeyboardFocus(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveKeyboardFocus(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < listItems.length) {
        const item = listItems[activeIndex]
        if (item.type === 'option') {
          handleSelect(item.value)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeDropdown()
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ''}`}
        onClick={() => {
          if (isOpen) {
            closeDropdown()
          } else {
            setIsOpen(true)
          }
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.valueText}>
          {value || 'Select Timezone...'}
        </span>
        <ChevronDown size={14} className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className={styles.popoverMenu}
          role="listbox"
          data-dropdown={`timezone-select-${id}`}
          style={{
            position: 'absolute',
            top: `${coords.top + 4}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999,
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Search bar */}
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              ref={searchInputRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search timezones..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setScrollTop(0)
                setActiveIndex(-1)
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = 0
                }
              }}
              aria-label="Search timezones"
            />
          </div>

          {/* Virtualized options list */}
          <div
            ref={scrollContainerRef}
            className={styles.optionsList}
            onScroll={handleScroll}
            style={{ height: `${Math.min(containerHeight, totalHeight || 36)}px` }}
          >
            {listItems.length === 0 ? (
              <div className={styles.noResults}>No timezones found</div>
            ) : (
              <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
                <div style={{ transform: `translateY(${startIndex * ITEM_HEIGHT}px)`, position: 'absolute', left: 0, right: 0, display: 'flex', flexDirection: 'column' }}>
                  {visibleItems.map((item, visibleIdx) => {
                    const actualIdx = startIndex + visibleIdx
                    const isSelected = item.type === 'option' && item.value === value
                    const isFocused = actualIdx === activeIndex

                    if (item.type === 'header') {
                      return (
                        <div
                          key={`hdr-${item.label}`}
                          className={styles.headerItem}
                          style={{ height: `${ITEM_HEIGHT}px` }}
                        >
                          {item.label}
                        </div>
                      )
                    }

                    return (
                      <button
                        key={`opt-${item.value}`}
                        type="button"
                        className={`${styles.optionBtn} ${isSelected ? styles.optionActive : ''} ${isFocused ? styles.optionFocused : ''}`}
                        style={{ height: `${ITEM_HEIGHT}px` }}
                        onClick={() => handleSelect(item.value)}
                        onMouseEnter={() => {
                          setActiveIndex(actualIdx)
                          previewOption(item.value)
                        }}
                        onMouseLeave={() => previewOption(null)}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className={styles.optionLabel}>{item.label}</span>
                        {isSelected && (
                          <Check size={14} className={styles.checkIcon} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
