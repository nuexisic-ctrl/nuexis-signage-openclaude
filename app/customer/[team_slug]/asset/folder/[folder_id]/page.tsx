import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import FolderClient from './FolderClient'
import styles from '../../asset.module.css'
import Header from '../../../components/Header'
import Sidebar from '../../../components/Sidebar'
import { Asset } from '../../types'

interface Props {
  params: Promise<{ team_slug: string; folder_id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug, folder_id } = await params
  return {
    title: `Folder ${folder_id} — ${team_slug} | NuExis`,
    description: 'Manage media assets inside this folder.',
  }
}

export default async function FolderPage({ params }: Props) {
  const { team_slug, folder_id } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()
  if (!/^[a-f0-9]{6}$/i.test(folder_id)) notFound()

  const supabase = await createClient()
  const user = await getCachedUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id, role, teams(slug)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? profile.teams.slug : undefined
  if (userTeamSlug && userTeamSlug !== team_slug) {
    redirect(`/customer/${userTeamSlug}/asset/folder/${folder_id}`)
  }

  const fullName = user.user_metadata?.full_name as string | undefined
  const userRole = profile?.role || 'Owner'

  // Fetch the folder using the 6-character short ID prefix
  const { data: folder, error: folderError } = await supabase
    .from('assets')
    .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color')
    .eq('team_id', profile?.team_id as string)
    .eq('mime_type', 'application/x-folder')
    .ilike('id', `${folder_id}%`)
    .single()

  if (folderError || !folder) {
    notFound()
  }

  // Fetch assets inside this folder
  const { data: assets } = await supabase
    .from('assets')
    .select('id, file_name, file_path, mime_type, size_bytes, created_at, folder_id, color')
    .eq('team_id', profile?.team_id as string)
    .eq('folder_id', folder.id)
    .order('created_at', { ascending: false })

  const folderAssets = assets ?? []

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get('nuexis_sidebar_collapsed')?.value === 'true';

  return (
    <div className={styles.shell}>
      <Sidebar teamSlug={team_slug} fullName={fullName} email={user.email} role={userRole} initialCollapsed={initialCollapsed} />

      {/* Main */}
      <main className={styles.main}>
        <Header fullName={fullName} email={user.email} />

        <FolderClient
          folder={folder as Asset}
          initialAssets={folderAssets as Asset[]}
          teamId={profile?.team_id ?? ''}
          teamSlug={team_slug}
        />
      </main>
    </div>
  )
}
