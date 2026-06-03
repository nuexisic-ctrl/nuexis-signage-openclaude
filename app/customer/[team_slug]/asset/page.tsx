import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AssetClient from './AssetClient'
import styles from './asset.module.css'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

interface Props {
  params: Promise<{ team_slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Assets — ${team_slug} | NuExis`,
    description: 'Upload and manage media assets for your digital displays.',
  }
}

export default async function AssetPage({ params }: Props) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  // Use getCachedUser() — deduplicates the auth/v1/user call shared with middleware
  const user = await getCachedUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  // Get user's team_id, role, and team slug securely from their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role, teams(slug)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? profile.teams.slug : undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/asset`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined

  const userRole = profile?.role || 'Owner'

  const query = supabase
    .from('assets')
    .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color', { count: 'exact' })
    .eq('team_id', profile?.team_id as string)
    .order('created_at', { ascending: false })
    .limit(1000)

  const response = profile?.team_id
    ? await query
    : { data: [], count: 0 }

  const assets = response.data ?? []
  const totalAssets = response.count ?? 0

  const { data: screens } = profile?.team_id
    ? await supabase
        .from('devices')
        .select('id, name, status, content_type, asset_id, playlist_id, content')
        .eq('team_id', profile.team_id as string)
        .order('created_at', { ascending: false })
    : { data: [] }

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get('nuexis_sidebar_collapsed')?.value === 'true';

  return (
    <div className={styles.shell}>
      <Sidebar teamSlug={team_slug} fullName={fullName} email={user.email} role={userRole} initialCollapsed={initialCollapsed} />

      {/* Main */}
      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />

        <AssetClient
          initialAssets={assets as Parameters<typeof AssetClient>[0]['initialAssets']}
          teamId={profile?.team_id ?? ''}
          teamSlug={team_slug}
          totalAssets={totalAssets}
          screens={(screens ?? []) as Parameters<typeof AssetClient>[0]['screens']}
        />
      </main>
    </div>
  )
}
