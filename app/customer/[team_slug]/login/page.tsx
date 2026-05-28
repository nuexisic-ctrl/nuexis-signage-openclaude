import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LoginForm from './LoginForm'
import WorkspaceNotFound from './WorkspaceNotFound'
import { createClient } from '@/lib/supabase/server'

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

  const supabase = await createClient()
  const { data: exists } = await supabase.rpc('check_team_exists', {
    p_slug: team_slug,
  })

  if (!exists) {
    return <WorkspaceNotFound teamSlug={team_slug} />
  }

  return <LoginForm teamSlug={team_slug} />
}
