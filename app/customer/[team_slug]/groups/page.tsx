import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ team_slug: string }>
}

export default async function GroupsPage({ params }: Props) {
  const { team_slug } = await params
  redirect(`/customer/${team_slug}/screens`)
}
