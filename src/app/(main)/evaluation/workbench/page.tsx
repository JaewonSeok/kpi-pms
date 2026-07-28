import { PerformanceExecutiveAdjustmentWorkspace } from '@/components/evaluation/performance/PerformanceExecutiveAdjustmentWorkspace'
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

type WorkbenchView = 'member' | 'leader' | 'executive'

const LEADER_REVIEW_PREVIEW_ROLES = new Set<string>([
  'ROLE_TEAM_LEADER',
  'ROLE_SECTION_CHIEF',
  'ROLE_DIV_HEAD',
  'ROLE_ADMIN',
  'ROLE_CEO',
  'ROLE_MASTER',
])

const EXECUTIVE_ADJUSTMENT_PREVIEW_ROLES = new Set<string>([
  'ROLE_DIV_HEAD',
  'ROLE_CEO',
  'ROLE_ADMIN',
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
  const canPreviewExecutiveAdjustment = EXECUTIVE_ADJUSTMENT_PREVIEW_ROLES.has(session.user.role)
  const hasEvaluatorTasks = (data.evaluations ?? []).some((ev) => ev.isEvaluator && ev.evalStage !== 'SELF')
  const requestedView = resolveWorkbenchView(resolvedSearchParams.view)
  const defaultView: WorkbenchView = canPreviewExecutiveAdjustment ? 'executive' : canPreviewLeaderReview ? 'leader' : 'member'
  const activeView =
    requestedView === 'executive' && !canPreviewExecutiveAdjustment
      ? defaultView
      : requestedView === 'leader' && !canPreviewLeaderReview
        ? 'member'
        : (requestedView ?? defaultView)

  return (
    <div className="space-y-4">
      <PerformanceWorkbenchRoleSwitch
        activeView={activeView}
        canPreviewLeaderReview={canPreviewLeaderReview}
        canPreviewExecutiveAdjustment={canPreviewExecutiveAdjustment}
        cycleId={resolvedSearchParams.cycleId}
        evaluationId={resolvedSearchParams.evaluationId}
      />
      {hasEvaluatorTasks && (
        <EvaluatorTaskPanel evaluations={data.evaluations ?? []} />
      )}
      {activeView === 'executive' ? (
        <PerformanceExecutiveAdjustmentWorkspace data={data} />
      ) : activeView === 'leader' ? (
        <PerformanceLeaderReviewWorkspace data={data} />
      ) : (
        <PerformanceMemberInputWorkspace data={data} />
      )}
    </div>
  )
}

function resolveWorkbenchView(value?: string): WorkbenchView | null {
  if (value === 'member' || value === 'leader' || value === 'executive') return value
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
  canPreviewExecutiveAdjustment,
  cycleId,
  evaluationId,
}: {
  activeView: WorkbenchView
  canPreviewLeaderReview: boolean
  canPreviewExecutiveAdjustment: boolean
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
      {canPreviewExecutiveAdjustment ? (
        <a
          href={buildWorkbenchViewHref({ view: 'executive', cycleId, evaluationId })}
          className={`${itemClass} ${activeView === 'executive' ? activeClass : inactiveClass}`}
        >
          본부장 평가 현황
        </a>
      ) : (
        <span className={`${itemClass} ${disabledClass}`} aria-disabled="true">
          본부장 평가 현황 · 권한 필요
        </span>
      )}
      <span className="ml-auto text-xs font-medium text-slate-500">
        preview only · 공식 저장 없음
      </span>
    </nav>
  )
}

type EvaluatorTask = {
  id: string
  stageLabel: string
  targetName: string
  targetDepartment: string
  statusLabel: string
  isActionRequired: boolean
  isEvaluator: boolean
  evalStage: string
}

function EvaluatorTaskPanel({ evaluations }: { evaluations: EvaluatorTask[] }) {
  const tasks = evaluations.filter((ev) => ev.isEvaluator && ev.evalStage !== 'SELF')

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">내 담당 평가</p>
      <p className="mt-1 text-sm text-slate-500">
        공식 평가는 아래 링크에서 진행합니다. 이 화면은 preview 전용이며 저장되지 않습니다.
      </p>
      <ul className="mt-4 space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
          >
            <div className="min-w-0">
              <span className="text-sm font-semibold text-slate-900">{task.targetName}</span>
              <span className="ml-2 text-xs text-slate-500">
                {task.targetDepartment} · {task.stageLabel}
              </span>
              <span className="ml-2 text-xs text-slate-400">{task.statusLabel}</span>
              {task.isActionRequired && (
                <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">
                  작성 필요
                </span>
              )}
            </div>
            <a
              href={`/evaluation/performance/${encodeURIComponent(task.id)}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              평가 화면 열기
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
