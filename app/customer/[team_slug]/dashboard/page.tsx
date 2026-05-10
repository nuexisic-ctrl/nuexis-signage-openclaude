import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import styles from './dashboard.module.css'

interface Props {
  params: Promise<{ team_slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Dashboard — ${team_slug}`,
  }
}

async function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
        Sign Out
      </button>
    </form>
  )
}

export default async function DashboardPage({ params }: Props) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Middleware handles the redirect, but double-check here for safety
  if (!user) {
    redirect(`/customer/${team_slug}/login`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined
  const userTeamSlug = user.user_metadata?.team_slug as string | undefined

  // If this user belongs to a different team, redirect them to their correct dashboard
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/dashboard`)
  }

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
          {[
            { icon: '⬡', label: 'Dashboard', href: `/customer/${team_slug}/dashboard`, active: true  },
            { icon: '◫', label: 'Screens',   href: `/customer/${team_slug}/screens`,   active: false },
            { icon: '◈', label: 'Content',   href: `/customer/${team_slug}/content`, active: false },
            { icon: '◉', label: 'Schedules', href: '#', active: false },
            { icon: '◎', label: 'Analytics', href: '#', active: false },
            { icon: '◌', label: 'Settings',  href: '#', active: false },
          ].map((item) => (
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
            <button type="submit" className={styles.signOutBtn} title="Sign out">
              ↩
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {/* Topbar */}
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <p className={styles.pageSubtitle}>
              Welcome back{fullName ? `, ${fullName.split(' ')[0]}` : ''}. Your workspace is ready.
            </p>
          </div>
          <div className={styles.topbarActions}>
            <span className={styles.teamPill}>{team_slug}</span>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <div className={styles.comingSoonCard}>
          <div className={styles.comingSoonGlow} aria-hidden="true" />
          <div className={styles.comingSoonContent}>
            <div className={styles.comingSoonIcon}>🚧</div>
            <div>
              <h2 className={styles.comingSoonTitle}>
                Your dashboard is being built
              </h2>
              <p className={styles.comingSoonText}>
                The full NuExis dashboard experience is on its way. Your workspace is set up,
                your team is ready, and great things are coming soon.
                Check back shortly — this will be your command center for managing
                screens, content, schedules, and analytics all in one place.
              </p>
            </div>
          </div>

          <div className={styles.featurePreviewGrid}>
            {[
              { icon: '◫', title: 'Screen Management', desc: 'Connect and manage your digital displays' },
              { icon: '◈', title: 'Content Library', desc: 'Upload and organise all your media assets' },
              { icon: '◉', title: 'Smart Scheduling', desc: 'Automate content delivery with timezone-aware rules' },
              { icon: '◎', title: 'Live Analytics', desc: 'Proof-of-play reports and uptime metrics' },
            ].map((f) => (
              <div key={f.title} className={styles.featurePreviewItem}>
                <span className={styles.featurePreviewIcon}>{f.icon}</span>
                <div>
                  <p className={styles.featurePreviewTitle}>{f.title}</p>
                  <p className={styles.featurePreviewDesc}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workspace Info Card */}
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <p className={styles.infoLabel}>Workspace</p>
            <p className={styles.infoValue}>{team_slug}</p>
          </div>
          <div className={styles.infoCard}>
            <p className={styles.infoLabel}>Role</p>
            <p className={styles.infoValue}>Owner</p>
          </div>
          <div className={styles.infoCard}>
            <p className={styles.infoLabel}>Status</p>
            <p className={styles.infoValue} style={{ color: '#16a34a' }}>● Active</p>
          </div>
          <div className={styles.infoCard}>
            <p className={styles.infoLabel}>Your URL</p>
            <p className={styles.infoValue} style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-label)' }}>
              /customer/{team_slug}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
