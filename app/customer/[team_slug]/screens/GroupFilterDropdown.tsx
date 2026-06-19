'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check, X } from 'lucide-react'
import styles from './GroupFilterDropdown.module.css'

interface Group {
  id: string
  name: string
  color: string
}

interface GroupFilterDropdownProps {
  groups: Group[]
  selectedGroupIds: string[]
  onChange: (ids: string[]) => void
  className?: string
}

export function GroupFilterDropdown({
  groups,
  selectedGroupIds,
  onChange,
  className = '',
}: GroupFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!dropdownRef.current) return
      
      const focusables = Array.from(
        dropdownRef.current.querySelectorAll(
          'input:not([disabled]), button:not([disabled]), [role="option"]:not([disabled])'
        )
      ) as HTMLElement[]

      if (focusables.length === 0) return

      const activeEl = document.activeElement as HTMLElement
      let index = focusables.indexOf(activeEl)

      if (e.key === 'ArrowDown') {
        index = (index + 1) % focusables.length
      } else {
        index = (index - 1 + focusables.length) % focusables.length
      }

      focusables[index].focus()
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleToggleGroup = (id: string) => {
    const nextIds = selectedGroupIds.includes(id)
      ? selectedGroupIds.filter(x => x !== id)
      : [...selectedGroupIds, id]
    onChange(nextIds)
  }

  const handleSelectAll = () => {
    const allIds = groups.map(g => g.id)
    onChange(allIds)
  }

  const handleClearAll = () => {
    onChange([])
  }

  // Determine trigger text representation
  let triggerText = 'All Groups'
  if (selectedGroupIds.length === 1) {
    const selectedGroup = groups.find(g => g.id === selectedGroupIds[0])
    triggerText = selectedGroup ? selectedGroup.name : '1 Group Selected'
  } else if (selectedGroupIds.length > 1) {
    triggerText = `${selectedGroupIds.length} Groups Selected`
  }

  return (
    <div className={`${styles.wrapper} ${className}`} ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className={`${styles.trigger} ${selectedGroupIds.length > 0 ? styles.triggerActive : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className={styles.triggerContent}>
          {selectedGroupIds.length === 1 && (
            <span
              className={styles.colorDot}
              style={{
                backgroundColor: groups.find(g => g.id === selectedGroupIds[0])?.color || '#3b82f6',
              }}
            />
          )}
          <span className={styles.triggerText}>{triggerText}</span>
        </div>
        <ChevronDown size={16} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearSearch}
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className={styles.actionRow}>
            <button type="button" className={styles.actionBtn} onClick={handleSelectAll}>
              Select All
            </button>
            <button type="button" className={styles.actionBtn} onClick={handleClearAll}>
              Clear
            </button>
          </div>

          <div className={styles.list}>
            {filteredGroups.length === 0 ? (
              <div className={styles.noResults}>No groups found</div>
            ) : (
              filteredGroups.map(g => {
                const isSelected = selectedGroupIds.includes(g.id)
                return (
                  <div
                    key={g.id}
                    className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                    onClick={() => handleToggleGroup(g.id)}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleToggleGroup(g.id)
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent click
                      className={styles.checkbox}
                      onClick={(e) => e.stopPropagation()}
                      tabIndex={-1} // prevent double focus with outer item div
                    />
                    <span className={styles.itemContent}>
                      <span
                        className={styles.colorDot}
                        style={{ backgroundColor: g.color || '#3b82f6' }}
                      />
                      <span className={styles.itemName}>{g.name}</span>
                    </span>
                    {isSelected && <Check size={14} className={styles.checkIcon} />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
