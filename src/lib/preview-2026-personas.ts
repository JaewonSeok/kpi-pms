import type { EvaluationGrade2026RoleGroup } from '../server/evaluation-grade-2026'
import type {
  EvaluationPolicyGradeCode,
  EvaluationPolicyThresholdGroupCode,
} from './evaluation-policy-2026'

// A1 시연 미리보기 (/admin/preview-2026-grade) 전용 — 가상 직원 5명 코드 상수.
// 설계 §4.2 표 그대로. 점수가 SUPER/OUTSTANDING/EXCELLENT/GOOD/NEED_IMPROVEMENT 5등급 스펙트럼.
//
// 슬라이더 cap 정책 (사용자 결정):
//   - 개인 점수: #4 (TEAM_MEMBER_NON_SALES)만 0–100, 나머지 4명은 0–130.
//   - 조직 점수(팀/실/본부): 모든 페르소나 0–130.

export type Preview2026PersonaSalesGroup = 'SALES' | 'NON_SALES'
export type Preview2026PersonaParentLabel = '실' | '본부'

export type Preview2026Persona = {
  id: string
  label: string
  roleGroup: EvaluationGrade2026RoleGroup
  thresholdGroup: EvaluationPolicyThresholdGroupCode
  salesGroup: Preview2026PersonaSalesGroup
  // 직속 상위 부서 level. DIVISION_HEAD는 null (팀·실 없음).
  parentLevel: 'SECTION' | 'DIVISION' | null
  // UI 라벨 — '실' 또는 '본부'. DIVISION_HEAD는 '본부'(자기 본부).
  parentLabel: Preview2026PersonaParentLabel
  initial: {
    teamScore?: number // DIVISION_HEAD는 미사용
    parentScore: number
    personalScore: number
  }
  range: {
    teamMax?: number // DIVISION_HEAD는 미사용
    parentMax: number
    personalMax: number
  }
  // 시연 의도된 등급 — 검산용 표시 (실제 등급은 calculateAbsoluteGrade2026 결과 사용).
  expectedGradeCode: EvaluationPolicyGradeCode
}

export const PREVIEW_2026_PERSONAS: readonly Preview2026Persona[] = [
  {
    id: 'persona-1-division-head',
    label: '가상_본부장',
    roleGroup: 'DIVISION_HEAD',
    thresholdGroup: 'DIVISION_HEAD',
    salesGroup: 'NON_SALES',
    parentLevel: null,
    parentLabel: '본부',
    initial: { parentScore: 124, personalScore: 122 },
    range: { parentMax: 130, personalMax: 130 },
    expectedGradeCode: 'SUPER',
  },
  {
    id: 'persona-2-team-section-leader-sales',
    label: '가상_팀장영업',
    roleGroup: 'TEAM_SECTION_LEADER',
    thresholdGroup: 'TEAM_SECTION_LEADER_SALES',
    salesGroup: 'SALES',
    parentLevel: 'SECTION',
    parentLabel: '실',
    initial: { teamScore: 108, parentScore: 106, personalScore: 104 },
    range: { teamMax: 130, parentMax: 130, personalMax: 130 },
    expectedGradeCode: 'OUTSTANDING',
  },
  {
    id: 'persona-3-team-section-leader-non-sales',
    label: '가상_팀장비영업',
    roleGroup: 'TEAM_SECTION_LEADER',
    thresholdGroup: 'TEAM_SECTION_LEADER_NON_SALES',
    salesGroup: 'NON_SALES',
    parentLevel: 'SECTION',
    parentLabel: '실',
    initial: { teamScore: 112, parentScore: 110, personalScore: 110 },
    range: { teamMax: 130, parentMax: 130, personalMax: 130 },
    expectedGradeCode: 'EXCELLENT',
  },
  {
    id: 'persona-4-team-member-non-sales',
    label: '가상_팀원비영업',
    roleGroup: 'TEAM_MEMBER',
    thresholdGroup: 'TEAM_MEMBER_NON_SALES',
    salesGroup: 'NON_SALES',
    parentLevel: 'SECTION',
    parentLabel: '실',
    initial: { teamScore: 80, parentScore: 82, personalScore: 80 },
    // ★ #4만 개인 cap 100 — 사용자 결정.
    range: { teamMax: 130, parentMax: 130, personalMax: 100 },
    expectedGradeCode: 'GOOD',
  },
  {
    id: 'persona-5-team-member-sales-division-direct',
    label: '가상_본부직속팀원영업',
    roleGroup: 'TEAM_MEMBER',
    thresholdGroup: 'TEAM_MEMBER_SALES',
    salesGroup: 'SALES',
    parentLevel: 'DIVISION',
    parentLabel: '본부',
    initial: { teamScore: 88, parentScore: 85, personalScore: 85 },
    range: { teamMax: 130, parentMax: 130, personalMax: 130 },
    expectedGradeCode: 'NEED_IMPROVEMENT',
  },
]
