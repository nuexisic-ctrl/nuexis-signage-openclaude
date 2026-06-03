'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { modalStack } from '@/lib/utils/modalStack'
import styles from './CustomSelect.module.css'

interface Option {
  value: string | number
  label: string
  disabled?: boolean
}

interface CustomSelectProps {
  value: string | number
  onChange: (value: any) => void
  options: Option[]
  disabled?: boolean
  className?: string
  placeholder?: string
  id: string
}

export default function CustomSelect({
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  placeholder = '',
  id
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Register with modalStack when open
  useEffect(() => {
    const stackId = `custom-select-${id}`
    if (isOpen) {
      modalStack.push(stackId)
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  const selectedOption = options.find(opt => opt.value === value)

  const handleSelect = (val: any) => {
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div className={`${styles.container} ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className={styles.valueText}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.optionsList}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.optionBtn} ${opt.value === value ? styles.optionActive : ''} ${opt.disabled ? styles.optionDisabled : ''}`}
              onClick={() => !opt.disabled && handleSelect(opt.value)}
              disabled={opt.disabled}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
