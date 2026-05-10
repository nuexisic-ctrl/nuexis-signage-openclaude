import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ScreensClient from './ScreensClient'
import styles from './screens.module.css'
import Header from '../components/Header'

interface Props {
  params: Promise<{ team_slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Screens — ${team_slug} | NuExis`,
    description: 'Manage and pair digital displays for your workspace.',
  }
}

export default async function ScreensPage({ params }: Props) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  const userTeamSlug = user.user_metadata?.team_slug as string | undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/screens`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined

  // Get the user's team_id from their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  const query = supabase
    .from('devices')
    .select('id, name, status, created_at, content_type, asset_id, scale_mode, orientation, device_heartbeats(last_seen_at)')
    .eq('team_id', profile?.team_id as string)
    .order('created_at', { ascending: false })

  const devicesData = profile?.team_id
    ? ((await query).data ?? [])
    : []

  const devices = devicesData.map((d) => {
    const hb = Array.isArray(d.device_heartbeats) ? d.device_heartbeats[0] : d.device_heartbeats
    const { device_heartbeats, ...rest } = d
    return {
      ...rest,
      last_seen_at: hb?.last_seen_at || null,
      device_heartbeats: undefined
    }
  })

  // Fetch all assets for this team
  const assets = profile?.team_id
    ? (await supabase
        .from('assets')
        .select('id, file_name, file_path, mime_type, size_bytes')
        .eq('team_id', profile.team_id)
        .order('created_at', { ascending: false })
      ).data ?? []
    : []

  const navItems = [
    { icon: '⬡', label: 'Dashboard', href: `/customer/${team_slug}/dashboard`, active: false },
    { icon: '◫', label: 'Screens',   href: `/customer/${team_slug}/screens`,   active: true  },
    { icon: '◈', label: 'Content',   href: `/customer/${team_slug}/content`, active: false },
    { icon: '◉', label: 'Schedules', href: '#', active: false },
    { icon: '◎', label: 'Analytics', href: '#', active: false },
    { icon: '◌', label: 'Settings',  href: '#', active: false },
  ]

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <Link href="/" className="navbar-logo" style={{ fontSize: '1.25rem' }}>
            Nu<span>Exis</span>
          </Link>
          <span className={styles.sidebarTeam}>{team_slug}</span>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.navItem} ${item.active ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {fullName ? fullName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{fullName || 'Team Owner'}</span>
              <span className={styles.userEmail}>{user.email}</span>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signOutBtn} title="Sign out">↩</button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.pageTitle}>Screens</h1>
            <p className={styles.pageSubtitle}>
              {devices.length > 0
                ? `${devices.length} screen${devices.length === 1 ? '' : 's'} paired to this workspace.`
                : 'Pair your first screen to get started.'}
            </p>
          </div>
        </div>

        <ScreensClient
          devices={devices}
          assets={assets}
          teamSlug={team_slug}
          teamId={profile?.team_id as string}
        />
      </main>
    </div>
  )
}
