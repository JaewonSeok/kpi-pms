// 2026 정책 가감점 UI 헬퍼 — Workbench 컴포넌트가 사용하는 순수 함수.
//
// 서버측 정책(`src/lib/evaluation-policy-2026.ts` + `src/server/evaluation-scoring-2026.ts`)을
// 미러링하되, 클라이언트 입력 검증과 UI 게이트 결정만 담당한다. 정책 상수
// (`EVALUATION_POLICY_2026.adjustmentRule.active`)는 절대 import하지 않는다 —
// 활성화 게이트는 서버가 계산해 pageData.permissions.canAdjustScore로 내려준다.
//
// DRY 원칙: 'score≠0이면 reason 필수' 규칙은 schema superRefine과 단일 출처
// (`checkAdjustmentReasonRequirement` in validations.ts)를 공유한다.

import type { EvaluationPolicyItemCategoryCode } from './evaluation-policy-2026'
import {
  checkAdjustmentReasonRequirement,
  ADJUSTMENT_REASON_REQUIRED_MESSAGE,
} from './validations'

export const ALLOWED_ADJUSTMENT_CATEGORIES_2026: ReadonlySet<EvaluationPolicyItemCategoryCode> =
  new Set(['ORG_GOAL', 'PROJECT_T', 'PROJECT_K'])

export type AdjustmentVisibilityInput = {
  canAdjustScore: boolean
  policyCategory: EvaluationPolicyItemCategoryCode | null
  groupKey: string | null
}

export function resolveAdjustmentFieldVisibility(
  input: AdjustmentVisibilityInput
): { visible: boolean } {
  if (!input.canAdjustScore) return { visible: false }
  if (!input.policyCategory) return { visible: false }
  if (!ALLOWED_ADJUSTMENT_CATEGORIES_2026.has(input.policyCategory)) return { visible: false }
  if (!input.groupKey) return { visible: false }
  return { visible: true }
}

// 카테고리별 groupKey 도출.
// - ORG_GOAL → linkedOrgKpiId (같은 조직목표 = 같은 그룹, cross-person zero-sum 단위)
// - PROJECT_T / PROJECT_K → null
//   ⚠️ TODO(adjustment-project-groupkey): 현재 스키마에 cross-person 공유 프로젝트
//   식별자가 없다. linkedOrgKpiId는 PROJECT엔 너무 거칠다(한 조직목표 아래 여러
//   프로젝트가 묶일 수 있음). 별도 HR 집계 PR에서 Project 모델 + PersonalKpi.projectId
//   추가 후 여기 로직을 PROJECT 분기로 확장.
// - DAILY_WORK → null (정책상 가감점 비적용)
export function deriveAdjustmentGroupKey(input: {
  category: EvaluationPolicyItemCategoryCode | null
  linkedOrgKpiId: string | null
}): string | null {
  if (input.category === 'ORG_GOAL') return input.linkedOrgKpiId ?? null
  return null
}

export type AdjustmentDraftState = {
  adjustmentScore?: number | null
  adjustmentReason?: string | null
}

export type AdjustmentItemContext = {
  policyCategory: EvaluationPolicyItemCategoryCode | null
  linkedOrgKpiId: string | null
}

export type AdjustmentPayload = {
  adjustmentScore: number | null
  adjustmentGroupKey: string | null
  adjustmentReason: string | null
}

// draft가 들고 있는 값을 라우트가 받는 3필드 payload로 변환. visibility=false면 모두 null.
export function buildAdjustmentPayloadFromDraft(input: {
  draft: AdjustmentDraftState
  item: AdjustmentItemContext
  canAdjustScore: boolean
}): AdjustmentPayload {
  const groupKey = deriveAdjustmentGroupKey({
    category: input.item.policyCategory,
    linkedOrgKpiId: input.item.linkedOrgKpiId,
  })
  const visibility = resolveAdjustmentFieldVisibility({
    canAdjustScore: input.canAdjustScore,
    policyCategory: input.item.policyCategory,
    groupKey,
  })
  if (!visibility.visible) {
    return { adjustmentScore: null, adjustmentGroupKey: null, adjustmentReason: null }
  }
  const rawScore = input.draft.adjustmentScore
  const score = typeof rawScore === 'number' && rawScore !== 0 ? rawScore : null
  const reason = (input.draft.adjustmentReason ?? '').trim() || null
  return {
    adjustmentScore: score,
    adjustmentGroupKey: score === null ? null : groupKey,
    adjustmentReason: score === null ? null : reason,
  }
}

export type AdjustmentClientUxResult = { ok: true } | { ok: false; message: string }

// 클라이언트 사전 차단용. 서버 superRefine과 동일 규칙(checkAdjustmentReasonRequirement) 사용.
// 범위(±5)와 정수 enforcement는 input min/max/step과 schema가 backstop.
export function validateAdjustmentClientUx(input: {
  adjustmentScore?: number | null
  adjustmentReason?: string | null
}): AdjustmentClientUxResult {
  return checkAdjustmentReasonRequirement(input)
}

export { ADJUSTMENT_REASON_REQUIRED_MESSAGE }
