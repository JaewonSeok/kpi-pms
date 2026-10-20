import type { PerformanceAssignmentSyncPlan } from '@/server/evaluation-performance-assignments'
import { EVAL_STAGE_LABELS } from '@/lib/utils'

// 배정 관리 화면의 자동 동기화 흐름(미리보기 → 확인 → 적용)에서 쓰는 순수 로직.
// 화면 컴포넌트는 이 함수들만 부르고, 요청 · 판정 규칙은 여기에 둔다.

export type SyncPlan = PerformanceAssignmentSyncPlan

export type SyncPlanSummary = {
  createCount: number
  updateCount: number
  deleteCount: number
  deleteWithInProgressCount: number
  transferCount: number
  unchangedCount: number
  preservedManualCount: number
  lockedSkippedCount: number
  manualInactiveCount: number
}

export function summarizeSyncPlan(plan: SyncPlan): SyncPlanSummary {
  return {
    createCount: plan.create.length,
    updateCount: plan.update.length,
    deleteCount: plan.delete.length,
    deleteWithInProgressCount: plan.delete.filter((item) => item.hasInProgressEvaluation).length,
    transferCount: plan.transfer.length,
    unchangedCount: plan.unchangedCount,
    preservedManualCount: plan.preservedManualCount,
    lockedSkippedCount: plan.lockedSkipped.length,
    manualInactiveCount: plan.manualInactive.length,
  }
}

// 쓸 것(create · update · delete · transfer)이 하나라도 있어야 적용할 수 있다.
export function canApplySyncPlan(plan: SyncPlan | null) {
  if (!plan) return false
  return plan.create.length + plan.update.length + plan.delete.length + plan.transfer.length > 0
}

export function buildSyncPreviewRequest(evalCycleId: string) {
  return { action: 'syncPreview', evalCycleId }
}

// 적용은 미리보기에서 받은 지문을 그대로 보낸다. 서버가 계획을 다시 계산해 지문이 다르면 409 로 거절한다.
export function buildSyncApplyRequest(plan: SyncPlan, evalCycleId: string) {
  return {
    action: 'sync',
    evalCycleId,
    fingerprint: plan.fingerprint,
  }
}

export type SyncPreviewContext = {
  departmentByTargetId: Record<string, string>
  stageLabelByStage: Record<string, string>
}

// 화면이 쓰는 맥락은 계획만으로 만든다. 배정 행 표에는 계획에만 있는 대상(행 없음)이 없다.
// 단계 라벨은 배정 행 표와 같은 EVAL_STAGE_LABELS 다.
export function buildSyncPreviewContext(plan: SyncPlan): SyncPreviewContext {
  return {
    departmentByTargetId: { ...plan.employeeDepartments },
    stageLabelByStage: { ...EVAL_STAGE_LABELS },
  }
}

export type SyncPreviewRow = {
  key: string
  kind: 'create' | 'update' | 'delete' | 'transfer' | 'locked' | 'manualInactive'
  kindLabel: string
  targetName: string
  department: string
  stageLabel: string
  beforeName: string
  afterName: string
  note: string | null
}

// 이름 맵에 없으면 id 를 그대로 보여 준다.
export function employeeNameOf(plan: SyncPlan, employeeId: string | null) {
  if (!employeeId) return '-'
  return plan.employeeNames[employeeId] ?? employeeId
}

export function buildSyncPreviewRows(plan: SyncPlan, context: SyncPreviewContext) {
  const row = (
    kind: SyncPreviewRow['kind'],
    kindLabel: string,
    key: string,
    item: { targetId: string; evalStage: string },
    beforeId: string | null,
    afterId: string | null,
    note: string | null = null
  ): SyncPreviewRow => ({
    key: `${kind}:${key}`,
    kind,
    kindLabel,
    targetName: employeeNameOf(plan, item.targetId),
    department: context.departmentByTargetId[item.targetId] ?? '-',
    stageLabel: context.stageLabelByStage[item.evalStage] ?? EVAL_STAGE_LABELS[item.evalStage] ?? item.evalStage,
    beforeName: employeeNameOf(plan, beforeId),
    afterName: employeeNameOf(plan, afterId),
    note,
  })

  return {
    writes: [
      ...plan.create.map((item) => row('create', '생성', item.id, item, null, item.evaluatorId)),
      ...plan.update.map((item) => row('update', '평가자 바뀜', item.id, item, item.beforeEvaluatorId, item.afterEvaluatorId)),
      ...plan.delete.map((item) =>
        row('delete', '삭제', item.id, item, item.beforeEvaluatorId, null, item.hasInProgressEvaluation ? '진행 중 평가 있음' : null)
      ),
      ...plan.transfer.map((item) =>
        row('transfer', '진행 중 평가 이관', item.id, item, item.beforeEvaluatorId, item.afterEvaluatorId)
      ),
    ],
    locked: plan.lockedSkipped.map((item) =>
      row('locked', '잠겨서 못 바꿈', `${item.targetId}:${item.evalStage}`, item, item.storedEvaluatorId, item.defaultEvaluatorId)
    ),
    manualInactive: plan.manualInactive.map((item) =>
      row('manualInactive', '퇴사자 수동 배정', `${item.targetId}:${item.evalStage}`, item, item.evaluatorId, null)
    ),
  }
}

export type SyncPostResult = {
  ok: boolean
  status: number
  data?: unknown
  error?: { code?: string; message?: string }
}

export type SyncPost = (body: Record<string, unknown>) => Promise<SyncPostResult>

export type SyncApplyResult = {
  syncedCount: number
  transferCount: number
  lockedSkipped: unknown[]
}

export type SyncApplyOutcome<TPage> =
  | { kind: 'applied'; result: SyncApplyResult; page: TPage }
  | { kind: 'plan-changed'; plan: SyncPlan | null; message: string }
  | { kind: 'error'; message: string }

export const SYNC_PLAN_CHANGED_MESSAGE =
  '미리보기 이후 배정이 바뀌었습니다. 새 미리보기를 확인한 뒤 다시 적용해 주세요.'

export async function loadSyncPreview(params: { evalCycleId: string; post: SyncPost }) {
  const response = await params.post(buildSyncPreviewRequest(params.evalCycleId))
  if (!response.ok) {
    throw new Error(response.error?.message || '자동 동기화 미리보기를 불러오지 못했습니다.')
  }
  return (response.data as { plan: SyncPlan }).plan
}

// 409(ASSIGNMENT_SYNC_PLAN_CHANGED)면 미리보기만 다시 불러온다. 이전 계획으로 다시 적용하지 않는다.
export async function applySyncPlan<TPage = unknown>(params: {
  plan: SyncPlan
  evalCycleId: string
  post: SyncPost
}): Promise<SyncApplyOutcome<TPage>> {
  const response = await params.post(buildSyncApplyRequest(params.plan, params.evalCycleId))

  if (response.ok) {
    const data = response.data as { result: SyncApplyResult; page: TPage }
    return { kind: 'applied', result: data.result, page: data.page }
  }

  if (response.status === 409 && response.error?.code === 'ASSIGNMENT_SYNC_PLAN_CHANGED') {
    const preview = await params.post(buildSyncPreviewRequest(params.evalCycleId))
    return {
      kind: 'plan-changed',
      plan: preview.ok ? (preview.data as { plan: SyncPlan }).plan : null,
      message: SYNC_PLAN_CHANGED_MESSAGE,
    }
  }

  return { kind: 'error', message: response.error?.message || '자동 동기화를 적용하지 못했습니다.' }
}

export function formatSyncApplyMessage(result: SyncApplyResult) {
  return `자동 동기화를 적용했습니다. 배정 ${result.syncedCount}건 변경 · 진행 중 평가 ${result.transferCount}건 이관 · 잠겨서 못 바꿈 ${result.lockedSkipped.length}건`
}
