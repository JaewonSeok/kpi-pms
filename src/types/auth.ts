export const AUTH_ROLES = [
  'ROLE_ADMIN',
  'ROLE_CEO',
  'ROLE_DIV_HEAD',
  'ROLE_SECTION_CHIEF',
  'ROLE_TEAM_LEADER',
  'ROLE_MEMBER',
] as const

export type AuthRole = (typeof AUTH_ROLES)[number]

export const MENU_KEYS = [
  'ORG_MANAGE',
  'ORG_UPLOAD',
  'GRADE_SETTING',
  'EVAL_CYCLE',
  'ORG_KPI_UPLOAD',
  'PERSONAL_KPI_UPLOAD',
  'KPI_SETTING',
  'MONTHLY_INPUT',
  'SELF_EVAL',
  'EVAL_1ST',
  'EVAL_2ND',
  'EVAL_FINAL',
  'GRADE_ADJUST',
  'EVAL_RESULT',
  'APPEAL',
  'FEEDBACK_360',
  'WORD_CLOUD_360',
  'DASHBOARD',
  'AUDIT_LOG',
  'SYSTEM_SETTING',
  'CHECKIN',
  'COMPENSATION_MANAGE',
  'COMPENSATION_SELF',
  'NOTIFICATIONS',
  'AI_ASSIST',
  'AI_COMPETENCY',
] as const

export type MenuKey = (typeof MENU_KEYS)[number]

export type SessionUserClaims = {
  id: string
  email: string
  name: string
  image?: string
  role: AuthRole
  empId: string
  position: string
  deptId: string
  deptName: string
  departmentCode: string
  managerId: string | null
  orgPath: string
  accessibleDepartmentIds: string[]
}
