import { resolveEvaluationRole, type EvaluationRole } from '@/lib/evaluation-leader-role'

// 평가 대상의 정의는 여기 하나다: ACTIVE · 사이클 조직 소속 · 평가 역할이 대표가 아님.
// 자기평가 일괄 생성(population)과 평가자 routing readiness 가 같은 함수를 쓴다.
export type EvaluationTargetCandidate = {
  status: string
  deptId: string
  role: EvaluationRole
  jobTitle?: string | null
}

export type EvaluationTargetScope = {
  // 사이클 조직의 부서 id. null 이면 조직으로 거르지 않는다(사이클을 모르는 호출).
  orgDepartmentIds: ReadonlySet<string> | null
}

export function isEvaluationTarget(employee: EvaluationTargetCandidate, scope: EvaluationTargetScope) {
  if (employee.status !== 'ACTIVE') return false
  if (scope.orgDepartmentIds && !scope.orgDepartmentIds.has(employee.deptId)) return false
  return resolveEvaluationRole(employee) !== 'ROLE_CEO'
}

export function selectEvaluationTargets<T extends EvaluationTargetCandidate>(employees: T[], scope: EvaluationTargetScope) {
  return employees.filter((employee) => isEvaluationTarget(employee, scope))
}
