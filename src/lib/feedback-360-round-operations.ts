import { resolveEvaluationRole, type EvaluationRole } from '@/lib/evaluation-leader-role'
import { isEvaluationTarget, type EvaluationTargetScope } from '@/lib/evaluation-targets'
import { isFeedback360ResultRuleRound, isFeedback360RoundEnded } from '@/lib/feedback-360-result-exposure'

// 360(FULL_360, 온보딩 제외) 라운드 운영 판정: 대상 제한 · 일괄 발행 대상 · 대상별 현황 · 운영 버튼 상태.

export const FEEDBACK_360_LEADER_TARGET_MESSAGE = '리더와 대표는 360 대상이 아닙니다(리더십 평가 대상)'

// 360 대상: 평가 대상(ACTIVE · 사이클 조직 · 대표 아님) 중 평가 역할이 팀원인 사람. 리더는 리더십 평가 대상이다.
export function isFeedback360RoundTarget(
  employee: { status: string; deptId: string; role: EvaluationRole; jobTitle?: string | null },
  scope: EvaluationTargetScope
) {
  return isEvaluationTarget(employee, scope) && resolveEvaluationRole(employee) === 'ROLE_MEMBER'
}

type NominationLike = { targetId: string; status: string }

export type Feedback360TargetProgressRow = {
  targetId: string
  name: string
  department: string
  draft: number
  submitted: number
  // 승인 + 발행(발행은 승인된 지명이다)
  approved: number
  meetsMinRaters: boolean
  published: boolean
}

export function buildFeedback360TargetProgress(params: {
  minRaters: number
  nominations: NominationLike[]
  // 규칙상 360 대상 전원(미지명 판정에 쓴다)
  targets: Array<{ id: string; name: string; department: string }>
}) {
  const targetById = new Map(params.targets.map((target) => [target.id, target]))
  const counts = new Map<string, { draft: number; submitted: number; approved: number; published: number }>()
  for (const nomination of params.nominations) {
    const current = counts.get(nomination.targetId) ?? { draft: 0, submitted: 0, approved: 0, published: 0 }
    if (nomination.status === 'DRAFT') current.draft += 1
    if (nomination.status === 'SUBMITTED') current.submitted += 1
    if (nomination.status === 'APPROVED' || nomination.status === 'PUBLISHED') current.approved += 1
    if (nomination.status === 'PUBLISHED') current.published += 1
    counts.set(nomination.targetId, current)
  }

  const rows: Feedback360TargetProgressRow[] = [...counts.entries()].map(([targetId, count]) => ({
    targetId,
    name: targetById.get(targetId)?.name ?? targetId,
    department: targetById.get(targetId)?.department ?? '-',
    draft: count.draft,
    submitted: count.submitted,
    approved: count.approved,
    meetsMinRaters: count.approved >= params.minRaters,
    published: count.published > 0,
  }))
  const unnominated = params.targets.filter((target) => !counts.has(target.id))

  return { rows, unnominated }
}

// 일괄 발행 대상: 승인된(아직 발행 전) 지명이 있고, 승인 수(승인 + 발행)가 minRaters 이상인 대상.
export function selectFeedback360BulkPublishTargets(params: { minRaters: number; nominations: NominationLike[] }) {
  const byTarget = new Map<string, NominationLike[]>()
  for (const nomination of params.nominations) {
    byTarget.set(nomination.targetId, [...(byTarget.get(nomination.targetId) ?? []), nomination])
  }

  const publish: string[] = []
  const skippedBelowMinRaters: Array<{ targetId: string; approvedCount: number }> = []
  const notApprovedTargets: Array<{ targetId: string; pendingCount: number }> = []
  for (const [targetId, nominations] of byTarget) {
    const approvedCount = nominations.filter((item) => item.status === 'APPROVED' || item.status === 'PUBLISHED').length
    const awaitingPublish = nominations.some((item) => item.status === 'APPROVED')
    const pendingCount = nominations.filter((item) => item.status === 'DRAFT' || item.status === 'SUBMITTED').length

    if (awaitingPublish && approvedCount >= params.minRaters) publish.push(targetId)
    else if (approvedCount > 0 && approvedCount < params.minRaters) skippedBelowMinRaters.push({ targetId, approvedCount })
    if (pendingCount > 0 && approvedCount === 0) notApprovedTargets.push({ targetId, pendingCount })
  }

  return { publish, skippedBelowMinRaters, notApprovedTargets }
}

export type Feedback360RoundActionState = { enabled: boolean; reason: string | null }
export type Feedback360RoundActions = Record<'bulkPublish' | 'close' | 'release' | 'unrelease', Feedback360RoundActionState>

const enabled = (): Feedback360RoundActionState => ({ enabled: true, reason: null })
const blocked = (reason: string): Feedback360RoundActionState => ({ enabled: false, reason })

// 운영 버튼 상태. 할 수 없는 상태면 막고 사유를 돌려준다.
export function resolveFeedback360RoundActions(params: {
  round: { roundType: string; status: string; isOnboarding: boolean; released: boolean }
  canManageAllRounds: boolean
  canManageRound: boolean
  publishableTargetCount: number
}): Feedback360RoundActions {
  const { round } = params
  if (!isFeedback360ResultRuleRound(round)) {
    const reason = '360 다면평가(분기) 라운드에서만 운영할 수 있습니다.'
    return { bulkPublish: blocked(reason), close: blocked(reason), release: blocked(reason), unrelease: blocked(reason) }
  }
  if (round.status === 'CANCELLED') {
    const reason = '취소된 라운드입니다.'
    return { bulkPublish: blocked(reason), close: blocked(reason), release: blocked(reason), unrelease: blocked(reason) }
  }
  const noPermission = '라운드 관리 권한이 없습니다.'
  const ended = isFeedback360RoundEnded(round.status)

  return {
    bulkPublish: !params.canManageAllRounds
      ? blocked('전체 리뷰 관리자만 일괄 발행할 수 있습니다.')
      : ended
        ? blocked('마감된 라운드는 발행할 수 없습니다.')
        : params.publishableTargetCount === 0
          ? blocked('기준 인원 이상 승인된 대상이 없습니다.')
          : enabled(),
    close: !params.canManageRound
      ? blocked(noPermission)
      : round.status !== 'IN_PROGRESS'
        ? blocked('응답 진행 중인 라운드만 마감할 수 있습니다.')
        : enabled(),
    release: !params.canManageRound
      ? blocked(noPermission)
      : !ended
        ? blocked('마감된 라운드만 결과를 공개할 수 있습니다.')
        : round.released
          ? blocked('이미 결과를 공개했습니다.')
          : enabled(),
    unrelease: !params.canManageRound
      ? blocked(noPermission)
      : !round.released
        ? blocked('공개된 결과가 없습니다.')
        : enabled(),
  }
}
