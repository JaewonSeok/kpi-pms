import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { UnderConstruction } from '@/components/common/UnderConstruction'

export default async function EvaluationCeoAdjustPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) redirect('/dashboard')

  return <UnderConstruction requestedPath="/evaluation/ceo-adjust" />
}
