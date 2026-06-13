import type { EvaluationGrade2026RoleGroup } from '../server/evaluation-grade-2026'
import type { OrganizationWeights2026 } from './validations'
import { DEFAULT_ORGANIZATION_WEIGHTS_2026 } from './policy-2026-organization-weights'
import { EVALUATION_POLICY_2026_VERSION } from './evaluation-policy-2026'

// A1 시연 미리보기 (/admin/preview-2026-grade) 전용 — 30:70 점수 산출 pure function.
// 결정 (1)에 따른 가중치 분기:
//   - DIVISION_HEAD: 본부 × 0.30 + 개인 × 0.70 (팀·실 없음 — 데모 특례)
//   - 팀원/팀장: 팀 × 0.20 + 직속상위(실 또는 본부) × 0.10 + 개인 × 0.70
//
// DB 조회 0. 부작용 0. 호출자가 슬라이더 입력값을 직접 제공.
// 등급 산정은 본 resolver의 책임 아님 — 호출자(client)가 결과 finalScore를
// calculateAbsoluteGrade2026 에 별도 전달.
//
// 옵션 (b): 향후 활성 사이클의 department_score_intakes 점수를 default 입력으로
//   자동 채울 수 있음. 단 본 resolver는 read-only · 호출자 입력 의존 원칙을 유지한다.
//   intake 연동은 별도 server loader에서 처리 — 본 resolver는 미터치.
//
// ★ DIVISION_HEAD 30% 데모 특례 — 정책 schema(policy2026OrganizationWeights)에
//   DIVISION_HEAD 전용 키 없음. A1 코드 상수 사용. 정책 담당자 정식 확정 후
//   schema 추가 또는 식 변경 검토 [확인 필요].
export const DIVISION_HEAD_DIVISION_WEIGHT = 0.3
export const DIVISION_HEAD_PERSONAL_WEIGHT = 0.7

export type PreviewIntakeInput2026 = {
  roleGroup: EvaluationGrade2026RoleGroup

  // 팀원/팀장만 사용. DIVISION_HEAD에선 무시.
  teamScore?: number

  // 팀원/팀장: 직속 상위 부서(실 or 본부)의 점수.
  // DIVISION_HEAD: 본인 본부의 점수 (자기 division).
  parentScore: number

  // 본인 개인 평가 점수.
  personalScore: number

  // 직속 상위 부서 level. withSection / withoutSection 가중치 분기 키.
  // - 'SECTION' 또는 null/undefined: withSection 사용 (직속상위가 실).
  // - 'DIVISION': withoutSection 사용 (직속상위가 본부, 실 없음).
  // DIVISION_HEAD에선 무시.
  parentLevel?: 'SECTION' | 'DIVISION' | null

  // 활성 사이클 OrganizationWeights2026. 미전달 시 DEFAULT 사용.
  // (DEFAULT는 withSection·withoutSection 양쪽 동일 team=0.20, parent=0.10, personal=0.70)
  weights?: OrganizationWeights2026
}

export type PreviewOrganizationScore2026Breakdown = {
  roleGroup: EvaluationGrade2026RoleGroup
  teamScoreWeighted?: number
  parentScoreWeighted?: number
  divisionScoreWeighted?: number
  personalScoreWeighted: number
  appliedWeights: {
    team?: number
    parent?: number
    division?: number
    personal: number
  }
}

export type PreviewOrganizationScore2026Result = {
  organizationScore: number
  personalScore: number
  finalScore: number
  breakdown: PreviewOrganizationScore2026Breakdown
  formulaVersion: typeof EVALUATION_POLICY_2026_VERSION
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function calculateOrganizationPerformanceFromIntake2026(
  input: PreviewIntakeInput2026
): PreviewOrganizationScore2026Result {
  // ── 분기 1: DIVISION_HEAD 데모 특례 ──
  // 팀·실 없음. weights/parentLevel/teamScore 입력은 본 분기에서 무시.
  if (input.roleGroup === 'DIVISION_HEAD') {
    const divisionWeighted = input.parentScore * DIVISION_HEAD_DIVISION_WEIGHT
    const personalWeighted = input.personalScore * DIVISION_HEAD_PERSONAL_WEIGHT
    return {
      organizationScore: round1(divisionWeighted),
      personalScore: round1(personalWeighted),
      finalScore: round1(divisionWeighted + personalWeighted),
      breakdown: {
        roleGroup: 'DIVISION_HEAD',
        divisionScoreWeighted: round1(divisionWeighted),
        personalScoreWeighted: round1(personalWeighted),
        appliedWeights: {
          division: DIVISION_HEAD_DIVISION_WEIGHT,
          personal: DIVISION_HEAD_PERSONAL_WEIGHT,
        },
      },
      formulaVersion: EVALUATION_POLICY_2026_VERSION,
    }
  }

  // ── 분기 2: 팀원/팀장 — 결정 (1)의 식 + 보정 (parentLevel별 가중치 출처 분기) ──
  const weights = input.weights ?? DEFAULT_ORGANIZATION_WEIGHTS_2026

  // parentLevel === 'DIVISION' → withoutSection (직속상위가 본부, 실 없음)
  // 그 외(SECTION/null/undefined) → withSection (직속상위가 실)
  // DEFAULT는 양쪽 동일(team=0.20, parent=0.10)이라 분기 영향 0.
  // 커스텀 가중치 저장 시 양쪽이 달라지면 본 분기가 정확한 가중치를 적용.
  const useWithoutSection = input.parentLevel === 'DIVISION'
  const teamWeight = useWithoutSection
    ? weights.withoutSection.team
    : weights.withSection.team
  const parentWeight = useWithoutSection
    ? weights.withoutSection.division
    : weights.withSection.section

  const teamWeighted = (input.teamScore ?? 0) * teamWeight
  const parentWeighted = input.parentScore * parentWeight
  const personalWeighted = input.personalScore * weights.personal

  return {
    organizationScore: round1(teamWeighted + parentWeighted),
    personalScore: round1(personalWeighted),
    finalScore: round1(teamWeighted + parentWeighted + personalWeighted),
    breakdown: {
      roleGroup: input.roleGroup,
      teamScoreWeighted: round1(teamWeighted),
      parentScoreWeighted: round1(parentWeighted),
      personalScoreWeighted: round1(personalWeighted),
      appliedWeights: {
        team: teamWeight,
        parent: parentWeight,
        personal: weights.personal,
      },
    },
    formulaVersion: EVALUATION_POLICY_2026_VERSION,
  }
}
