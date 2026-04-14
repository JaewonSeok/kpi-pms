import { redirect } from 'next/navigation'
import { canAccessMenu } from '@/lib/auth/permissions'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { GoogleAccountRegistrationClient } from '@/components/admin/GoogleAccountRegistrationClient'

export default async function AdminGoogleAccessPage() {
  const session = await requireProtectedPageSession({
    route: '/admin/google-access',
    pathname: '/admin/google-access',
  })

  if (!canAccessMenu(session.user.role, 'SYSTEM_SETTING')) {
    redirect('/403')
  }

  return <GoogleAccountRegistrationClient />
}
