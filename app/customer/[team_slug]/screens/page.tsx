import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ScreensClient from './ScreensClient'
import styles from './screens.module.css'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

interface Props {
  params: Promise<{ team_slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Screens — ${team_slug} | NuExis`,
    description: 'Manage and pair digital displays for your workspace.',
  }
}

export default async function ScreensPage({ params, searchParams }: Props) {
  const { team_slug } = await params
  const resolvedSearchParams = await searchParams
  const pageStr = resolvedSearchParams.page
  const currentPage = typeof pageStr === 'string' ? parseInt(pageStr, 10) || 1 : 1
  const pageSize = 30
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  // Get the user's team_id, role, and team slug securely from their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role, teams(slug)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? profile.teams.slug : undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/screens`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined

  const userRole = profile?.role || 'Owner'

  const query = supabase
    .from('devices')
    .select('id, name, status, created_at, content_type, asset_id, scale_mode, orientation, last_seen_at, total_playtime_seconds', { count: 'exact' })
    .eq('team_id', profile?.team_id as string)
    .order('created_at', { ascending: false })
    .range(from, to)

  const response = profile?.team_id
    ? await query
    : { data: [], count: 0 }

  const devicesData = response.data ?? []
  const totalScreens = response.count ?? 0

  const devices = devicesData.map((d) => {
    return {
      id: d.id,
      name: d.name,
      created_at: d.created_at,
      content_type: d.content_type,
      asset_id: d.asset_id,
      scale_mode: d.scale_mode,
      orientation: d.orientation,
      status: d.status as 'online' | 'offline' | 'pairing',
      last_seen_at: d.last_seen_at || null,
      total_playtime_seconds: d.total_playtime_seconds || 0,
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

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get('nuexis_sidebar_collapsed')?.value === 'true';

  return (
    <div className={styles.shell}>
      <Sidebar teamSlug={team_slug} fullName={fullName} email={user.email} role={userRole} initialCollapsed={initialCollapsed} />

      {/* Main */}
      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />
        
        <ScreensClient
          devices={devices}
          assets={assets}
          teamSlug={team_slug}
          teamId={profile?.team_id as string}
          totalScreens={totalScreens}
          currentPage={currentPage}
          pageSize={pageSize}
        />
      </main>
    </div>
  )
}
