'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Sun, Moon, Bell, LogOut, ChevronDown } from 'lucide-react'
import styles from './header.module.css'

interface HeaderProps {
  fullName?: string
  email?: string
}

export default function Header({ fullName, email }: HeaderProps) {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initial = fullName ? fullName.charAt(0).toUpperCase() : email?.charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
     
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light')
    localStorage.setItem('theme', newTheme ? 'dark' : 'light')
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search..." 
            className={styles.searchInput}
          />
          <div className={styles.kbd}>
            <span className={styles.kbdKey}>Ctrl</span>
            <span className={styles.kbdKey}>K</span>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <div 
          className={styles.themeSwitcher}
          onClick={toggleTheme}
          title="Toggle theme"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleTheme() }}
        >
          <div className={`${styles.switcherOption} ${mounted && !isDark ? styles.active : ''}`}>
            <Sun size={16} />
          </div>
          <div className={`${styles.switcherOption} ${mounted && isDark ? styles.active : ''}`}>
            <Moon size={16} />
          </div>
        </div>

        <button className={styles.notificationBtn} title="Notifications">
          <Bell size={20} />
        </button>

        <div className={styles.profileContainer} ref={dropdownRef}>
          <button 
            className={styles.profileBtn}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title="Profile menu"
          >
            <div className={styles.avatar}>{initial}</div>
            <span className={styles.profileName}>{fullName || 'John Doe'}</span>
            <ChevronDown size={14} className={styles.dropdownArrow} />
          </button>

          {isDropdownOpen && (
            <div className={styles.dropdown}>
              <form action="/auth/signout" method="post">
                <button type="submit" className={`${styles.dropdownItem} ${styles.logoutBtn}`}>
                  <LogOut size={16} style={{ marginRight: '8px' }} />
                  Logout
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
