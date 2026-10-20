import type { SelfEvaluationPopulationPlan } from '@/server/evaluation-self-population'
import type { SyncPost } from '@/lib/performance-assignment-sync-preview'

// 배정 관리 화면의 자기평가 일괄 생성 흐름(미리보기 → 확인 → 실행)에서 쓰는 순수 로직.
// 자동 배정 미리보기(performance-assignment-sync-preview)와 같은 방식이다.

export type PopulationPlan = SelfEvaluationPopulationPlan

export type PopulationPlanSummary = {
  createCount: number
  createItemCount: number
  skippedExistingCount: number
  noConfirmedKpiCount: number
}

export function summarizePopulationPlan(plan: PopulationPlan): PopulationPlanSummary {
  return {
    createCount: plan.create.length,
    createItemCount: plan.create.reduce((sum, item) => sum + item.personalKpiIds.length, 0),
    skippedExistingCount: plan.skippedExisting.length,
    noConfirmedKpiCount: plan.noConfirmedKpi.length,
  }
}

const POPULATION_RUNNABLE_CYCLE_STATUS = 'SELF_EVAL'

// 실행은 자기평가 단계에서만 한다. 서버도 같은 조건으로 막는다(400 INVALID_CYCLE_STATUS).
export function isPopulationRunnableCycle(cycleStatus: string | null) {
  return cycleStatus === POPULATION_RUNNABLE_CYCLE_STATUS
}

export const POPULATION_CYCLE_NOT_SELF_EVAL_MESSAGE = '자기평가 단계에서만 실행할 수 있습니다.'

export function populationRunBlockedReason(params: { plan: PopulationPlan | null; cycleStatus: string | null }) {
  if (!isPopulationRunnableCycle(params.cycleStatus)) return POPULATION_CYCLE_NOT_SELF_EVAL_MESSAGE
  if (!params.plan?.create.length) return '생성할 자기평가가 없습니다.'
  return null
}

export function canRunPopulation(params: { plan: PopulationPlan | null; cycleStatus: string | null }) {
  return populationRunBlockedReason(params) === null
}

export function buildPopulationPreviewRequest(evalCycleId: string) {
  return { action: 'populationPreview', evalCycleId }
}

// 실행은 미리보기에서 받은 지문을 그대로 보낸다. 서버가 계획을 다시 계산해 지문이 다르면 409 로 거절한다.
export function buildPopulationRunRequest(plan: PopulationPlan, evalCycleId: string) {
  return {
    action: 'population',
    evalCycleId,
    fingerprint: plan.fingerprint,
  }
}

export function buildPopulationPreviewRows(plan: PopulationPlan) {
  return {
    create: plan.create.map((item) => ({
      key: `create:${item.employeeId}`,
      name: item.employeeName,
      department: item.departmentName,
      kpiCount: item.personalKpiIds.length,
    })),
    noConfirmedKpi: plan.noConfirmedKpi.map((item) => ({
      key: `no-kpi:${item.employeeId}`,
      name: item.employeeName,
      department: item.departmentName,
    })),
  }
}

export type PopulationRunResult = {
  createdCount: number
  skippedExistingCount: number
  noConfirmedKpiCount: number
}

export type PopulationRunOutcome<TPage> =
  | { kind: 'applied'; result: PopulationRunResult; page: TPage }
  | { kind: 'plan-changed'; plan: PopulationPlan | null; message: string }
  | { kind: 'error'; message: string }

export const POPULATION_PLAN_CHANGED_MESSAGE =
  '미리보기 이후 자기평가 생성 대상이 바뀌었습니다. 새 미리보기를 확인한 뒤 다시 실행해 주세요.'

export async function loadPopulationPreview(params: { evalCycleId: string; post: SyncPost }) {
  const response = await params.post(buildPopulationPreviewRequest(params.evalCycleId))
  if (!response.ok) {
    throw new Error(response.error?.message || '자기평가 생성 미리보기를 불러오지 못했습니다.')
  }
  return (response.data as { plan: PopulationPlan }).plan
}

// 409(SELF_EVALUATION_POPULATION_PLAN_CHANGED)면 미리보기만 다시 불러온다. 이전 계획으로 다시 실행하지 않는다.
export async function runPopulationPlan<TPage = unknown>(params: {
  plan: PopulationPlan
  evalCycleId: string
  post: SyncPost
}): Promise<PopulationRunOutcome<TPage>> {
  const response = await params.post(buildPopulationRunRequest(params.plan, params.evalCycleId))

  if (response.ok) {
    const data = response.data as { result: PopulationRunResult; page: TPage }
    return { kind: 'applied', result: data.result, page: data.page }
  }

  if (response.status === 409 && response.error?.code === 'SELF_EVALUATION_POPULATION_PLAN_CHANGED') {
    const preview = await params.post(buildPopulationPreviewRequest(params.evalCycleId))
    return {
      kind: 'plan-changed',
      plan: preview.ok ? (preview.data as { plan: PopulationPlan }).plan : null,
      message: POPULATION_PLAN_CHANGED_MESSAGE,
    }
  }

  return { kind: 'error', message: response.error?.message || '자기평가를 생성하지 못했습니다.' }
}

export function formatPopulationRunMessage(result: PopulationRunResult) {
  return `자기평가를 생성했습니다. 생성 ${result.createdCount}명 · 건너뜀 ${result.skippedExistingCount}명 · 확정 KPI 없음 ${result.noConfirmedKpiCount}명`
}
