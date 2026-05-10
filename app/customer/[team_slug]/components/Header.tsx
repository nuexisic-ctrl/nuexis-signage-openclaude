'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Sun, Moon, Bell, LogOut } from 'lucide-react'
import styles from './header.module.css'

interface HeaderProps {
  fullName?: string
  email?: string
}

export default function Header({ fullName, email }: HeaderProps) {
  const [isDark, setIsDark] = useState(true)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initial = fullName ? fullName.charAt(0).toUpperCase() : email?.charAt(0).toUpperCase() || 'U'

  useEffect(() => {
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
        <button 
          className={styles.iconBtn} 
          onClick={() => setIsDark(!isDark)}
          title="Toggle theme"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className={styles.iconBtn} title="Notifications">
          <Bell size={20} />
        </button>

        <div className={styles.profileContainer} ref={dropdownRef}>
          <button 
            className={styles.profileBtn}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title="Profile menu"
          >
            <div className={styles.avatar}>{initial}</div>
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
