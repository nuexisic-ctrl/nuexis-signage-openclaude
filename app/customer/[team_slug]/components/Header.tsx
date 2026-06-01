'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Sun, Moon, Bell, LogOut, ChevronDown, ChevronLeft } from 'lucide-react'
import styles from './header.module.css'

interface HeaderProps {
  fullName?: string
  email?: string
}

export default function Header({ fullName, email }: HeaderProps) {
  const [isDark, setIsDark] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initial = fullName ? fullName.charAt(0).toUpperCase() : email?.charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const setTheme = (theme: 'light' | 'dark') => {
    setIsDark(theme === 'dark')
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    setIsDropdownOpen(false)
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
        <button className={styles.notificationBtn} title="Notifications">
          <Bell size={20} />
        </button>

        <div className={styles.profileContainer} ref={dropdownRef}>
          <button 
            className={`${styles.profileBtn} ${isDropdownOpen ? styles.activeProfile : ''}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title="Profile menu"
          >
            <div className={styles.avatar}>{initial}</div>
            <span className={styles.profileName}>{fullName || email || 'User'}</span>
            {fullName && email && <span style={{ display: 'none' }}>{email}</span>}
            <ChevronDown size={14} className={styles.dropdownArrow} />
          </button>

          {isDropdownOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownSection}>
                <div className={`${styles.dropdownItem} ${styles.themeItem}`}>
                  <div className={styles.themeItemLabel}>
                    <ChevronLeft size={14} className={styles.submenuArrow} style={{ marginRight: '8px' }} />
                    <div className={styles.dropdownItemContent}>
                      {isDark ? <Moon size={16} /> : <Sun size={16} />}
                      <span style={{ marginLeft: '8px' }}>Theme</span>
                    </div>
                  </div>
                  
                  <div className={styles.submenu}>
                    <button 
                      className={`${styles.submenuItem} ${!isDark ? styles.activeSubmenu : ''}`}
                      onClick={() => setTheme('light')}
                    >
                      <Sun size={14} />
                      <span>Light</span>
                    </button>
                    <button 
                      className={`${styles.submenuItem} ${isDark ? styles.activeSubmenu : ''}`}
                      onClick={() => setTheme('dark')}
                    >
                      <Moon size={14} />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.dropdownDivider} />

              <form action="/auth/signout" method="post">
                <button type="submit" className={`${styles.dropdownItem} ${styles.logoutBtn}`}>
                  <div style={{ width: '22px' }} />
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
