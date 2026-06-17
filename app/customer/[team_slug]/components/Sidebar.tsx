'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Monitor, 
  Image as ImageIcon, 
  CalendarClock, 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  ListVideo 
} from 'lucide-react'
import styles from './sidebar.module.css'
import { useTranslation } from '@/lib/i18n'

interface SidebarProps {
  teamSlug: string;
  fullName?: string;
  email?: string;
  role?: string;
  initialCollapsed?: boolean;
}

export default function Sidebar({ teamSlug, fullName, email, role = 'Owner', initialCollapsed = false }: SidebarProps) {
  const { t } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
  const pathname = usePathname()
  
  // Mobile horizontal scroll tracking
  const bottomNavRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  // Toggle class on body for the main content to adjust its margin and save state
  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed')
      localStorage.setItem('nuexis_sidebar_collapsed', 'true')
      document.cookie = "nuexis_sidebar_collapsed=true; path=/; max-age=31536000; SameSite=Lax"
    } else {
      document.body.classList.remove('sidebar-collapsed')
      localStorage.setItem('nuexis_sidebar_collapsed', 'false')
      document.cookie = "nuexis_sidebar_collapsed=false; path=/; max-age=31536000; SameSite=Lax"
    }
  }, [isCollapsed])

  const checkScroll = () => {
    const el = bottomNavRef.current
    if (el) {
      const scrollLeft = el.scrollLeft
      const scrollWidth = el.scrollWidth
      const clientWidth = el.clientWidth
      
      setShowLeftArrow(scrollLeft > 5)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5)
    }
  }

  useEffect(() => {
    const el = bottomNavRef.current
    if (el) {
      el.addEventListener('scroll', checkScroll)
      checkScroll()
      window.addEventListener('resize', checkScroll)
      
      const timer = setTimeout(checkScroll, 300)
      
      return () => {
        el.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
        clearTimeout(timer)
      }
    }
  }, [])

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: `/customer/${teamSlug}/dashboard` },
    { icon: Monitor,         label: 'Screens',   href: `/customer/${teamSlug}/screens` },
    { icon: ImageIcon,       label: 'Assets',    href: `/customer/${teamSlug}/assets` },
    { icon: ListVideo,       label: 'Playlists', href: `/customer/${teamSlug}/playlists` },
    { icon: CalendarClock,   label: 'Schedules', href: '#' },
  ]

  const mobileNavItems = [
    ...navItems,
    { icon: Settings,        label: 'Settings',  href: `/customer/${teamSlug}/settings` },
  ]

  return (
    <>
      <aside data-sidebar-nav className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoContainer}>
            <Link href="/" prefetch={false} className={styles.logoLink} title="NuExis">
              <div className={styles.logoWrapper}>
                <Image 
                  src={isCollapsed ? "/Nuexis-logo-small.png" : "/Nuexis-logo.png"} 
                  alt="NuExis Logo" 
                  fill 
                  className={styles.logoImage} 
                  priority
                />
              </div>
            </Link>
          </div>
          <button 
            className={styles.toggleBtn} 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? t("Expand sidebar") : t("Collapse sidebar")}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href) && item.href !== '#'
            return (
              <Link
                key={item.label}
                href={item.href}
                prefetch={false}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                title={isCollapsed ? t(item.label) : undefined}
              >
                <item.icon size={20} className={styles.navIcon} />
                {!isCollapsed && <span className={styles.navLabel}>{t(item.label)}</span>}
              </Link>
            )
          })}
        </nav>

        <div className={styles.sidebarFooter}>
           <Link
            href={`/customer/${teamSlug}/settings`}
            prefetch={false}
            className={`${styles.navItem} ${pathname.includes('/settings') ? styles.active : ''}`}
            title={isCollapsed ? t("Settings") : undefined}
            style={{ 
              width: isCollapsed ? '44px' : 'auto', 
              margin: isCollapsed ? '0 auto' : '0',
              display: 'flex',
              justifyContent: isCollapsed ? 'center' : 'flex-start'
            }}
          >
            <Settings size={20} className={styles.navIcon} />
            {!isCollapsed && <span className={styles.navLabel}>{t("Settings")}</span>}
          </Link>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.bottomNav}>
        {showLeftArrow && (
          <button 
            type="button"
            className={styles.scrollIndicatorLeft} 
            onClick={() => bottomNavRef.current?.scrollBy({ left: -80, behavior: 'smooth' })}
            aria-label={t("Scroll left")}
          >
            <ChevronLeft size={16} />
          </button>
        )}
        
        <div ref={bottomNavRef} className={styles.bottomNavScrollContainer}>
          <ul className={styles.bottomNavList}>
            {mobileNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href) && item.href !== '#'
              return (
                <li key={item.label} className={styles.bottomNavListItem}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className={`${styles.bottomNavItem} ${isActive ? styles.active : ''}`}
                  >
                    <item.icon size={20} />
                    <span className={styles.bottomNavLabel}>{t(item.label)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {showRightArrow && (
          <button 
            type="button"
            className={styles.scrollIndicatorRight} 
            onClick={() => bottomNavRef.current?.scrollBy({ left: 80, behavior: 'smooth' })}
            aria-label={t("Scroll right")}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </nav>
    </>
  )
}
