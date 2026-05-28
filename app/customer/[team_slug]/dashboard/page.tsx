import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import styles from './dashboard.module.css'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import DashboardShell from './DashboardShell'

import {
  getDashboardStats,
  getOfflineTrend,
  getAlerts,
  getRecentActivity,
  getAnalytics,
  getDeviceHealth,
  getScheduledTimeline,
  getUptimeHistory,
  getScreenUptimeHistory,
} from './actions'

interface Props {
  params: Promise<{ team_slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Dashboard — ${team_slug}`,
  }
}

export default async function DashboardPage({ params }: Props) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  const user = await getCachedUser()

  if (!user) {
    redirect(`/customer/${team_slug}/login`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, team_id, teams(slug)')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'Owner'
  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? (profile.teams as { slug: string }).slug : undefined

  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/dashboard`)
  }

  const teamId = profile?.team_id || ''

  const cookieStore = await cookies()
  const initialCollapsed = cookieStore.get('nuexis_sidebar_collapsed')?.value === 'true'

  const [stats, offlineTrend, alerts, activities, analytics, deviceHealth, scheduleEvents, uptimeHistory, screenUptimeData] = await Promise.all([
    getDashboardStats(team_slug),
    getOfflineTrend(team_slug),
    getAlerts(team_slug),
    getRecentActivity(team_slug),
    getAnalytics(team_slug),
    getDeviceHealth(team_slug),
    getScheduledTimeline(team_slug),
    getUptimeHistory(team_slug),
    getScreenUptimeHistory(team_slug),
  ])

  return (
    <div className={styles.shell}>
      <Sidebar teamSlug={team_slug} fullName={fullName} email={user.email} role={userRole} initialCollapsed={initialCollapsed} />

      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />

        <div className={styles.topbar}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <p className={styles.pageSubtitle}>
              Welcome back{fullName ? `, ${fullName.split(' ')[0]}` : ''}. Here&apos;s your workspace at a glance.
            </p>
          </div>
        </div>

        <DashboardShell
          teamSlug={team_slug}
          teamId={teamId}
          stats={stats}
          offlineTrend={offlineTrend}
          alerts={alerts}
          activities={activities}
          analytics={analytics}
          deviceHealth={deviceHealth}
          scheduleEvents={scheduleEvents}
          uptimeHistory={uptimeHistory}
          screenUptimeData={screenUptimeData}
        />
      </main>
    </div>
  )
}
