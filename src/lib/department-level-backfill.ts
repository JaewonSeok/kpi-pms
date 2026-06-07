import { DepartmentLevel } from '@prisma/client'

// 조직 30% 점수(M1) 서브시스템용 부서 level 자동 추천 helper.
//
// 출력은 추천일 뿐 — HR이 UI에서 검수·확정한다. 분류 신호로 deptName은 의도적으로
// 무시한다: 이름이 '본부'로 끝나는 본부 직속 팀이 실재해 이름 기반 추론은 오분류를
//유발한다(예: deptCode='DIV-1-TEAM-2', deptName='SaaS영업본부' — TEAM이지만 이름은 본부).
//
// 우선순위:
//   1) parentDeptId == null              → DIVISION   (루트 부서 = 본부)
//   2) deptCode가 -TEAM 패턴(끝 또는 -TEAM-N) → TEAM       (예: HR-TEAM, DIV-1-TEAM-2)
//   3) deptCode가 -SEC 패턴(끝 또는 -SEC-N)   → SECTION    (예: DEV-SEC, DIV-1-SEC-1)
//   4) 그 외                              → null       (미분류, HR 수동 지정)
//
// pure function: 외부 의존성 0, 동일 입력 = 동일 출력.

export type DepartmentLevelBackfillInput = {
  deptCode: string
  parentDeptId: string | null
}

const TEAM_PATTERN = /(?:^|-)TEAM(?:-\d+)?$/
const SEC_PATTERN = /(?:^|-)SEC(?:-\d+)?$/

export function suggestDepartmentLevel(
  input: DepartmentLevelBackfillInput
): DepartmentLevel | null {
  if (input.parentDeptId === null) {
    return DepartmentLevel.DIVISION
  }

  if (TEAM_PATTERN.test(input.deptCode)) {
    return DepartmentLevel.TEAM
  }

  if (SEC_PATTERN.test(input.deptCode)) {
    return DepartmentLevel.SECTION
  }

  return null
}
