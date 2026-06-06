import type { EvaluationPolicyItemCategory } from '@prisma/client'

// 2026 정책 분류(policyCategory) source 태그.
// `personal_kpis.policyCategorySource` / `evaluation_items.policyCategorySource` 컬럼은
// free string이지만, 코드 일관성을 위해 정의된 상수만 사용. 새 source 추가 시 여기에 모아둔다.
//
// 컨벤션: '2026_POLICY_<주체>_<방식>' — 분류가 누구에 의해 어떤 경로로 들어왔는지 추적용.
// - HR_MANUAL: HR이 PolicyMapping2026Panel에서 카테고리 드롭다운으로 확정
// - HR_KEEP_UNCLASSIFIED: HR이 명시적으로 "미분류 유지" 선택(테스트/예외 항목)
// - BACKFILL_AUTO_V1: 백필 스크립트(scripts/backfill-2026-policy-metadata.ts) --apply 자동 분류
// - OWNER_AT_CREATE: KPI 작성자(소유 직원)가 등록 폼에서 직접 선택
//
// ※ 기존 mapping.ts / backfill.ts의 inline string literal은 본 PR 범위 밖. 향후 별도
// PR에서 본 상수로 통합 가능.
export const POLICY_CATEGORY_SOURCE_2026 = {
  HR_MANUAL: '2026_POLICY_HR_MANUAL',
  HR_KEEP_UNCLASSIFIED: '2026_POLICY_HR_KEEP_UNCLASSIFIED',
  BACKFILL_AUTO_V1: '2026_POLICY_BACKFILL_AUTO_V1',
  OWNER_AT_CREATE: '2026_POLICY_OWNER_AT_CREATE',
} as const

export type PolicyCategorySource2026 =
  (typeof POLICY_CATEGORY_SOURCE_2026)[keyof typeof POLICY_CATEGORY_SOURCE_2026]

// 등록 시점에 작성자가 직접 선택한 분류와 메타 5컬럼을 채우는 helper.
// buildPersonalKpiTargetValuePersistence 패턴과 동일 — prisma.create의 data에 spread해
// 사용. 테스트 가능하도록 now를 주입받는다(default new Date()).
//
// - category non-null: 5컬럼 모두 채움. source=OWNER_AT_CREATE, confidence=1
//   (작성자 본인 확정이라 최대). reviewedAt=now, reviewNote=영문 default 텍스트
//   (PolicyMapping2026Panel의 'HR manual policyCategory mapping from ...' 패턴과 일관).
// - category null("미분류"/미선택): 5컬럼 모두 null로 둠. HR이 사후에 PolicyMapping2026Panel
//   에서 분류하는 기존 흐름을 그대로 유지(metadata도 비워둬야 사후 source/reviewedAt이
//   정상 set됨).
export function buildPolicyCategoryPersistenceAtCreate2026(
  category: EvaluationPolicyItemCategory | null,
  now: Date = new Date()
): {
  policyCategory: EvaluationPolicyItemCategory | null
  policyCategorySource: string | null
  policyCategoryConfidence: number | null
  policyCategoryReviewedAt: Date | null
  policyCategoryReviewNote: string | null
} {
  if (category === null) {
    return {
      policyCategory: null,
      policyCategorySource: null,
      policyCategoryConfidence: null,
      policyCategoryReviewedAt: null,
      policyCategoryReviewNote: null,
    }
  }

  return {
    policyCategory: category,
    policyCategorySource: POLICY_CATEGORY_SOURCE_2026.OWNER_AT_CREATE,
    policyCategoryConfidence: 1,
    policyCategoryReviewedAt: now,
    policyCategoryReviewNote: 'Owner self-selected at personal KPI registration',
  }
}
