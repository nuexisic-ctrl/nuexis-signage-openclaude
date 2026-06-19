'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Sun, Moon, Bell, LogOut, ChevronDown, ChevronLeft, Monitor, Globe, ZoomIn } from 'lucide-react'
import styles from './header.module.css'
import { useTheme } from '@/app/components/ThemeProvider'
import { useTranslation, SUPPORTED_LOCALES } from '@/lib/i18n'

interface HeaderProps {
  fullName?: string
  email?: string
}

export default function Header({ fullName, email }: HeaderProps) {
  const { theme: activeTheme, setTheme: handleSetThemeAndClose } = useTheme()
  const { t, locale, setLocale } = useTranslation()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [activeZoom, setActiveZoom] = useState<string>('default')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initial = fullName ? fullName.charAt(0).toUpperCase() : email?.charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    const savedZoom = localStorage.getItem('nuexis_interface_zoom') || 'default'
    setActiveZoom(savedZoom)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(prev => {
          if (prev) return false
          return prev
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSetTheme = (theme: 'light' | 'dark' | 'system') => {
    handleSetThemeAndClose(theme)
    setIsDropdownOpen(false)
  }

  const handleSetLocale = (code: typeof SUPPORTED_LOCALES[number]['code']) => {
    setLocale(code)
    setIsDropdownOpen(false)
  }

  const handleSetZoom = (zoom: string) => {
    setActiveZoom(zoom)
    localStorage.setItem('nuexis_interface_zoom', zoom)
    document.documentElement.setAttribute('data-zoom', zoom)
    document.cookie = `nuexis_interface_zoom=${zoom}; path=/; max-age=31536000; SameSite=Lax`
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
            placeholder={t('Search...')} 
            className={styles.searchInput}
          />
          <div className={styles.kbd}>
            <span className={styles.kbdKey}>Ctrl</span>
            <span className={styles.kbdKey}>K</span>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <button className={styles.notificationBtn} title={t('Notifications')}>
          <Bell size={20} />
        </button>

        <div className={styles.profileContainer} ref={dropdownRef}>
          <button 
            className={`${styles.profileBtn} ${isDropdownOpen ? styles.activeProfile : ''}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title={t('Profile menu')}
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
                      {activeTheme === 'system' ? (
                        <Monitor size={16} />
                      ) : activeTheme === 'dark' ? (
                        <Moon size={16} />
                      ) : (
                        <Sun size={16} />
                      )}
                      <span style={{ marginLeft: '8px' }}>{t('Theme')}</span>
                    </div>
                  </div>
                  
                  <div className={styles.submenu}>
                    <button 
                      className={`${styles.submenuItem} ${activeTheme === 'light' ? styles.activeSubmenu : ''}`}
                      onClick={() => handleSetTheme('light')}
                    >
                      <Sun size={14} />
                      <span>{t('Light')}</span>
                    </button>
                    <button 
                      className={`${styles.submenuItem} ${activeTheme === 'dark' ? styles.activeSubmenu : ''}`}
                      onClick={() => handleSetTheme('dark')}
                    >
                      <Moon size={14} />
                      <span>{t('Dark')}</span>
                    </button>
                    <button 
                      className={`${styles.submenuItem} ${activeTheme === 'system' ? styles.activeSubmenu : ''}`}
                      onClick={() => handleSetTheme('system')}
                    >
                      <Monitor size={14} />
                      <span>{t('System')}</span>
                    </button>
                  </div>
                </div>

                <div className={`${styles.dropdownItem} ${styles.languageItem}`}>
                  <div className={styles.themeItemLabel}>
                    <ChevronLeft size={14} className={styles.submenuArrow} style={{ marginRight: '8px' }} />
                    <div className={styles.dropdownItemContent}>
                      <Globe size={16} />
                      <span style={{ marginLeft: '8px' }}>{t('Language')}</span>
                    </div>
                  </div>
                  
                  <div className={styles.submenu}>
                    {SUPPORTED_LOCALES.map(loc => (
                      <button 
                        key={loc.code}
                        className={`${styles.submenuItem} ${locale === loc.code ? styles.activeSubmenu : ''}`}
                        onClick={() => handleSetLocale(loc.code)}
                      >
                        <span>{loc.nativeLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`${styles.dropdownItem} ${styles.zoomItem}`}>
                  <div className={styles.themeItemLabel}>
                    <ChevronLeft size={14} className={styles.submenuArrow} style={{ marginRight: '8px' }} />
                    <div className={styles.dropdownItemContent}>
                      <ZoomIn size={16} />
                      <span style={{ marginLeft: '8px' }}>{t('Interface Zoom')}</span>
                    </div>
                  </div>
                  
                  <div className={styles.submenu}>
                    <button 
                      className={`${styles.submenuItem} ${activeZoom === 'smaller' ? styles.activeSubmenu : ''}`}
                      onClick={() => handleSetZoom('smaller')}
                    >
                      <span>{t('Smaller')}</span>
                    </button>
                    <button 
                      className={`${styles.submenuItem} ${activeZoom === 'default' ? styles.activeSubmenu : ''}`}
                      onClick={() => handleSetZoom('default')}
                    >
                      <span>{t('Default')}</span>
                    </button>
                    <button 
                      className={`${styles.submenuItem} ${activeZoom === 'larger' ? styles.activeSubmenu : ''}`}
                      onClick={() => handleSetZoom('larger')}
                    >
                      <span>{t('Larger')}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.dropdownDivider} />

              <form action="/auth/signout" method="post">
                <button type="submit" className={`${styles.dropdownItem} ${styles.logoutBtn}`}>
                  <div style={{ width: '22px' }} />
                  <LogOut size={16} style={{ marginRight: '8px' }} />
                  {t('Logout')}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
