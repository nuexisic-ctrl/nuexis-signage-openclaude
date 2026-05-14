'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Monitor, 
  Image as ImageIcon, 
  CalendarClock, 
  LineChart, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react'
import styles from './sidebar.module.css'

interface SidebarProps {
  teamSlug: string;
  fullName?: string;
  email?: string;
  role?: string;
  initialCollapsed?: boolean;
}

export default function Sidebar({ teamSlug, fullName, email, role = 'Owner', initialCollapsed = false }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
  const pathname = usePathname()

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

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: `/customer/${teamSlug}/dashboard` },
    { icon: Monitor,         label: 'Screens',   href: `/customer/${teamSlug}/screens` },
    { icon: ImageIcon,       label: 'Assets',    href: `/customer/${teamSlug}/asset` },
    { icon: CalendarClock,   label: 'Schedules', href: '#' },
    { icon: LineChart,       label: 'Analytics', href: '#' },
    { icon: Settings,        label: 'Settings',  href: '#' },
  ]

  const userInitial = fullName ? fullName.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : <User size={18} />)

  return (
    <>
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoContainer}>
            <Link href="/" className={styles.logoLink} title="NuExis">
              <div className={styles.logoWrapper}>
                <Image 
                  src="/Nuexis-logo.png" 
                  alt="NuExis Logo" 
                  fill 
                  className={styles.logoImage} 
                  priority
                />
              </div>
            </Link>
            {!isCollapsed && <span className={styles.teamSlug}>{teamSlug}</span>}
          </div>
          <button 
            className={styles.toggleBtn} 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon size={20} className={styles.navIcon} />
                {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo} title={isCollapsed ? (fullName || email) : undefined}>
            <div className={styles.userAvatar}>
              {userInitial}
            </div>
            {!isCollapsed && (
              <div className={styles.userDetails}>
                <span className={styles.userName}>{fullName || 'User'}</span>
                <span className={styles.userEmail}>{email}</span>
                <span className={styles.userRoleBadge}>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.bottomNav}>
        <ul className={styles.bottomNavList}>
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname.startsWith(item.href) && item.href !== '#'
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`${styles.bottomNavItem} ${isActive ? styles.active : ''}`}
              >
                <item.icon size={20} />
                <span className={styles.bottomNavLabel}>{item.label}</span>
              </Link>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
