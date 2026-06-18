import { PerformanceMemberInputWorkspace } from '@/components/evaluation/performance/PerformanceMemberInputWorkspace'
import { PerformanceLeaderReviewWorkspace } from '@/components/evaluation/performance/PerformanceLeaderReviewWorkspace'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getEvaluationWorkbenchPageData } from '@/server/evaluation-workbench'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    evaluationId?: string
    view?: string
  }>
}

type WorkbenchView = 'member' | 'leader'

const LEADER_REVIEW_PREVIEW_ROLES = new Set<string>([
  'ROLE_TEAM_LEADER',
  'ROLE_SECTION_CHIEF',
  'ROLE_DIV_HEAD',
  'ROLE_ADMIN',
  'ROLE_CEO',
  'ROLE_MASTER',
])

export default async function EvaluationWorkbenchPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/workbench',
    pathname: '/evaluation/workbench',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getEvaluationWorkbenchPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    evaluationId: resolvedSearchParams.evaluationId,
  })

  const canPreviewLeaderReview = LEADER_REVIEW_PREVIEW_ROLES.has(session.user.role)
  const requestedView = resolveWorkbenchView(resolvedSearchParams.view)
  const defaultView: WorkbenchView = canPreviewLeaderReview ? 'leader' : 'member'
  const activeView = requestedView === 'leader' && !canPreviewLeaderReview ? 'member' : (requestedView ?? defaultView)

  return (
    <div className="space-y-4">
      <PerformanceWorkbenchRoleSwitch
        activeView={activeView}
        canPreviewLeaderReview={canPreviewLeaderReview}
        cycleId={resolvedSearchParams.cycleId}
        evaluationId={resolvedSearchParams.evaluationId}
      />
      {activeView === 'leader' ? (
        <PerformanceLeaderReviewWorkspace data={data} />
      ) : (
        <PerformanceMemberInputWorkspace data={data} />
      )}
    </div>
  )
}

function resolveWorkbenchView(value?: string): WorkbenchView | null {
  if (value === 'member' || value === 'leader') return value
  return null
}

function buildWorkbenchViewHref(params: {
  view: WorkbenchView
  cycleId?: string
  evaluationId?: string
}) {
  const query = new URLSearchParams()
  query.set('view', params.view)
  if (params.cycleId) query.set('cycleId', params.cycleId)
  if (params.evaluationId) query.set('evaluationId', params.evaluationId)
  return `/evaluation/workbench?${query.toString()}`
}

function PerformanceWorkbenchRoleSwitch({
  activeView,
  canPreviewLeaderReview,
  cycleId,
  evaluationId,
}: {
  activeView: WorkbenchView
  canPreviewLeaderReview: boolean
  cycleId?: string
  evaluationId?: string
}) {
  const itemClass =
    'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition'
  const activeClass = 'border-blue-300 bg-blue-50 text-blue-700'
  const inactiveClass = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
  const disabledClass = 'border-slate-200 bg-slate-50 text-slate-400'

  return (
    <nav
      aria-label="업적평가 역할 화면 전환"
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <span className="mr-1 text-xs font-bold text-slate-500">역할 화면</span>
      <a
        href={buildWorkbenchViewHref({ view: 'member', cycleId, evaluationId })}
        className={`${itemClass} ${activeView === 'member' ? activeClass : inactiveClass}`}
      >
        팀원 업적평가 입력
      </a>
      {canPreviewLeaderReview ? (
        <a
          href={buildWorkbenchViewHref({ view: 'leader', cycleId, evaluationId })}
          className={`${itemClass} ${activeView === 'leader' ? activeClass : inactiveClass}`}
        >
          팀장 평가 화면
        </a>
      ) : (
        <span className={`${itemClass} ${disabledClass}`} aria-disabled="true">
          팀장 평가 화면 · 권한 필요
        </span>
      )}
      <span className={`${itemClass} ${disabledClass}`} aria-disabled="true">
        본부장 평가 현황 · 아직 구현 전
      </span>
      <span className="ml-auto text-xs font-medium text-slate-500">
        preview only · 공식 저장 없음
      </span>
    </nav>
  )
}
