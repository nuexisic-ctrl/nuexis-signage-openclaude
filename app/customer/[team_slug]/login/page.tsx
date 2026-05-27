import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LoginForm from './LoginForm'
import WorkspaceNotFound from './WorkspaceNotFound'
import { createAdminClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ team_slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team_slug } = await params
  return {
    title: `Sign In — ${team_slug}`,
    description: `Sign in to the ${team_slug} workspace on NuExis.`,
  }
}

export default async function TeamLoginPage({ params }: Props) {
  const { team_slug } = await params

  // Basic slug validation — prevent XSS / weird URLs
  if (!/^[a-z0-9-]+$/.test(team_slug)) {
    notFound()
  }

  const supabase = createAdminClient()
  const { data: team } = await supabase
    .from('teams')
    .select('slug')
    .eq('slug', team_slug)
    .maybeSingle()

  if (!team) {
    return <WorkspaceNotFound teamSlug={team_slug} />
  }

  return <LoginForm teamSlug={team_slug} />
}
