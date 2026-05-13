import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import styles from './dashboard.module.css'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

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

  // Fetch the user's role from the profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'Owner'

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get('nuexis_sidebar_collapsed')?.value === 'true';

  return (
    <div className={styles.shell}>
      <Sidebar teamSlug={team_slug} fullName={fullName} email={user.email} role={userRole} initialCollapsed={initialCollapsed} />

      {/* Main */}
      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />
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
              { icon: '◈', title: 'Asset Library', desc: 'Upload and organise all your media assets' },
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
            <p className={styles.infoValue}>{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</p>
          </div>
          <div className={styles.infoCard}>
            <p className={styles.infoLabel}>Status</p>
            <p className={`${styles.infoValue} ${styles.statusActive}`}>● Active</p>
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
