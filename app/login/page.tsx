import type { Metadata } from 'next'
import GenericLoginForm from './GenericLoginForm'

export const metadata: Metadata = {
  title: 'Sign In — NuExis',
  description: 'Access your NuExis team workspace. Navigate to your team-specific URL to sign in.',
}

export default function GenericLoginPage() {
  return <GenericLoginForm />
}
