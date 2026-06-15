import type { Metadata } from 'next'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import SettingsClient from './SettingsClient'

interface Props {
  params: Promise<{ team_slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Settings — ${team_slug} | NuExis`,
    description: 'Configure your workspace and profile settings.',
  }
}

export default async function SettingsPage({ params }: Props) {
  const { team_slug } = await params

  if (!/^[a-z0-9-]+$/.test(team_slug)) notFound()

  const supabase = await createClient()
  const user = await getCachedUser()

  if (!user) redirect(`/customer/${team_slug}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, team_id, teams(slug, name)')
    .eq('id', user.id)
    .single()

  const userTeamSlug = profile?.teams && !Array.isArray(profile.teams) ? (profile.teams as any).slug : undefined

  if (userTeamSlug && userTeamSlug !== team_slug) {
    notFound()
  }

  const teamName = profile?.teams && !Array.isArray(profile.teams) ? (profile.teams as any).name : 'Workspace'
  const userRole = profile?.role || 'Owner'

  return (
    <SettingsClient
      teamSlug={team_slug}
      teamName={teamName}
      userRole={userRole}
      userEmail={user.email ?? ''}
      fullName={user.user_metadata?.full_name ?? ''}
    />
  )
}
