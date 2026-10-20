export type AdminJobTitleLeaderTier = 'TEAM_LEADER' | 'SECTION_CHIEF' | 'DIV_HEAD'

// ROLE_ADMIN 은 권한 플래그라 평가 역할 정보가 없다. jobTitle 로만 분류한다.
// role 이 평가 역할을 담으면 그것이 권위다. 이 함수는 ADMIN 의 jobTitle 만 본다.
export function resolveAdminJobTitleLeaderTier(
  jobTitle: string | null | undefined
): AdminJobTitleLeaderTier | null {
  if (jobTitle === '팀장') return 'TEAM_LEADER'
  if (jobTitle === '실장' || jobTitle === '부문장') return 'SECTION_CHIEF'
  if (jobTitle === '본부장' || jobTitle === '대표이사') return 'DIV_HEAD'
  return null
}

// Prisma SystemRole 과 employeeHierarchy 의 EmployeeRole 이 같은 값 집합이다. 둘 다 받는다.
export type EvaluationRole =
  | 'ROLE_MEMBER'
  | 'ROLE_ADMIN'
  | 'ROLE_TEAM_LEADER'
  | 'ROLE_SECTION_CHIEF'
  | 'ROLE_DIV_HEAD'
  | 'ROLE_CEO'

// 평가 계층의 높낮이. ROLE_ADMIN 은 resolveEvaluationRole 을 거치면 나오지 않지만
// 원래 role 을 그대로 넘기는 호출도 받을 수 있게 팀원과 같은 0 으로 둔다.
export const EVALUATION_ROLE_ORDER: Record<EvaluationRole, number> = {
  ROLE_MEMBER: 0,
  ROLE_ADMIN: 0,
  ROLE_TEAM_LEADER: 1,
  ROLE_SECTION_CHIEF: 2,
  ROLE_DIV_HEAD: 3,
  ROLE_CEO: 4,
}

const ADMIN_TIER_ROLE: Record<AdminJobTitleLeaderTier, EvaluationRole> = {
  TEAM_LEADER: 'ROLE_TEAM_LEADER',
  SECTION_CHIEF: 'ROLE_SECTION_CHIEF',
  DIV_HEAD: 'ROLE_DIV_HEAD',
}

// 평가 역할로 바꾼다. ROLE_ADMIN 은 jobTitle 로 리더 등급을 구하고, 등급이 없으면 팀원이다.
// 권한 판정에는 쓰지 않는다 — ADMIN 의 권한은 원래 role 이 정한다.
export function resolveEvaluationRole(employee: {
  role: EvaluationRole
  jobTitle?: string | null
}): EvaluationRole {
  if (employee.role !== 'ROLE_ADMIN') return employee.role
  const tier = resolveAdminJobTitleLeaderTier(employee.jobTitle)
  return tier ? ADMIN_TIER_ROLE[tier] : 'ROLE_MEMBER'
}
