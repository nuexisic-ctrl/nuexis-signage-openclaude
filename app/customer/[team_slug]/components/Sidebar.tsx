'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Monitor, 
  Image as ImageIcon, 
  CalendarClock, 
  LineChart, 
  Settings, 
  LogOut,
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
}

export default function Sidebar({ teamSlug, fullName, email, role = 'Owner' }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  // Initialize state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('nuexis_sidebar_collapsed')
    if (savedState === 'true') {
      setIsCollapsed(true)
    }
  }, [])

  // Toggle class on body for the main content to adjust its margin and save state
  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed')
      localStorage.setItem('nuexis_sidebar_collapsed', 'true')
    } else {
      document.body.classList.remove('sidebar-collapsed')
      localStorage.setItem('nuexis_sidebar_collapsed', 'false')
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
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.sidebarHeader}>
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logoLink} title="NuExis">
            <span className={styles.logoIcon}>Nu</span>
            {!isCollapsed && <span className={styles.logoText}>Exis</span>}
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
        <form action="/auth/signout" method="post" className={styles.signOutForm}>
          <button type="submit" className={styles.signOutBtn} title="Sign out">
            <LogOut size={18} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
