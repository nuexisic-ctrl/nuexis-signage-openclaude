import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AssetClient from './AssetClient'
import styles from './asset.module.css'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

interface Props {
  params: Promise<{ team_slug: string }>
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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  const userTeamSlug = user.user_metadata?.team_slug as string | undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/asset`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined

  // Get user's team_id and role
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'Owner'

  // Fetch all assets for this team
  const assets = profile?.team_id
    ? (await supabase
        .from('assets')
        .select('id, file_name, file_path, mime_type, size_bytes, created_at')
        .eq('team_id', profile.team_id)
        .order('created_at', { ascending: false })
      ).data ?? []
    : []

  const navItems = [
    { icon: '⬡', label: 'Dashboard', href: `/customer/${team_slug}/dashboard`, active: false },
    { icon: '◫', label: 'Screens',   href: `/customer/${team_slug}/screens`,   active: false },
    { icon: '◈', label: 'Assets',   href: `/customer/${team_slug}/asset`,   active: true  },
    { icon: '◉', label: 'Schedules', href: '#', active: false },
    { icon: '◎', label: 'Analytics', href: '#', active: false },
    { icon: '◌', label: 'Settings',  href: '#', active: false },
  ]

  return (
    <div className={styles.shell}>
      <Sidebar teamSlug={team_slug} fullName={fullName} email={user.email} role={userRole} />

      {/* Main */}
      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.pageTitle}>Asset Library</h1>
            <p className={styles.pageSubtitle}>
              {assets.length > 0
                ? `${assets.length} asset${assets.length === 1 ? '' : 's'} in your library.`
                : 'Upload images and videos to get started.'}
            </p>
          </div>
        </div>

        <AssetClient
          initialAssets={assets as Parameters<typeof AssetClient>[0]['initialAssets']}
          teamId={profile?.team_id ?? ''}
          teamSlug={team_slug}
        />
      </main>
    </div>
  )
}
