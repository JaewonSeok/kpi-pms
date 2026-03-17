import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { GoogleAccountRegistrationClient } from '@/components/admin/GoogleAccountRegistrationClient'

export default async function AdminGoogleAccessPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ROLE_ADMIN') {
    redirect('/dashboard')
  }

  return <GoogleAccountRegistrationClient />
}
