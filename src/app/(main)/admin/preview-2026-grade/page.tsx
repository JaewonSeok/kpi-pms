import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getPreview2026GradePageData } from '@/server/preview-2026-grade-page'
import { PREVIEW_2026_PERSONAS } from '@/lib/preview-2026-personas'
import { Preview2026GradeAdminClient } from '@/components/admin/Preview2026GradeAdminClient'

// A1 시연 미리보기 — /admin/preview-2026-grade
// ROLE_ADMIN 전용. dynamic 강제 — build 시 prerender·prod DB 접근 0.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Preview2026GradeAdminPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (session.user.role !== 'ROLE_ADMIN') redirect('/dashboard')

  const viewModel = await getPreview2026GradePageData()

  return (
    <Preview2026GradeAdminClient viewModel={viewModel} personas={PREVIEW_2026_PERSONAS} />
  )
}
