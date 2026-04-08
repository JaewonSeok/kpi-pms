import type { AuthRole, MenuKey } from '@/types/auth'

export const MENU_PERMISSIONS: Record<MenuKey, AuthRole[]> = {
  ORG_MANAGE: ['ROLE_ADMIN'],
  ORG_UPLOAD: ['ROLE_ADMIN'],
  GRADE_SETTING: ['ROLE_ADMIN'],
  EVAL_CYCLE: ['ROLE_ADMIN'],
  ORG_KPI_UPLOAD: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
  ],
  PERSONAL_KPI_UPLOAD: ['ROLE_ADMIN', 'ROLE_TEAM_LEADER'],
  KPI_SETTING: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  MONTHLY_INPUT: ['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_MEMBER'],
  SELF_EVAL: ['ROLE_MEMBER'],
  EVAL_1ST: ['ROLE_ADMIN', 'ROLE_TEAM_LEADER'],
  EVAL_2ND: ['ROLE_ADMIN', 'ROLE_SECTION_CHIEF'],
  EVAL_FINAL: ['ROLE_ADMIN', 'ROLE_DIV_HEAD'],
  GRADE_ADJUST: ['ROLE_ADMIN', 'ROLE_CEO'],
  EVAL_RESULT: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  APPEAL: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  FEEDBACK_360: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  WORD_CLOUD_360: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  DASHBOARD: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  AUDIT_LOG: ['ROLE_ADMIN'],
  SYSTEM_SETTING: ['ROLE_ADMIN'],
  CHECKIN: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  COMPENSATION_MANAGE: ['ROLE_ADMIN', 'ROLE_DIV_HEAD', 'ROLE_CEO'],
  COMPENSATION_SELF: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  NOTIFICATIONS: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  AI_ASSIST: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
  AI_COMPETENCY: [
    'ROLE_ADMIN',
    'ROLE_CEO',
    'ROLE_DIV_HEAD',
    'ROLE_SECTION_CHIEF',
    'ROLE_TEAM_LEADER',
    'ROLE_MEMBER',
  ],
}

const PATH_MENU_ENTRIES: Array<{ prefix: string; menuKey: MenuKey }> = [
  { prefix: '/admin/org-chart', menuKey: 'ORG_MANAGE' },
  { prefix: '/api/admin/org-chart', menuKey: 'ORG_UPLOAD' },
  { prefix: '/admin/grades', menuKey: 'GRADE_SETTING' },
  { prefix: '/api/admin/grades', menuKey: 'GRADE_SETTING' },
  { prefix: '/admin/eval-cycle', menuKey: 'EVAL_CYCLE' },
  { prefix: '/admin/performance-calendar', menuKey: 'EVAL_CYCLE' },
  { prefix: '/admin/performance-design', menuKey: 'EVAL_CYCLE' },
  { prefix: '/admin/goal-alignment', menuKey: 'EVAL_CYCLE' },
  { prefix: '/api/admin/performance-design', menuKey: 'EVAL_CYCLE' },
  { prefix: '/api/admin/goal-alignment', menuKey: 'EVAL_CYCLE' },
  { prefix: '/api/admin/eval-cycles', menuKey: 'EVAL_CYCLE' },
  { prefix: '/kpi/org', menuKey: 'ORG_KPI_UPLOAD' },
  { prefix: '/api/kpi/org', menuKey: 'ORG_KPI_UPLOAD' },
  { prefix: '/kpi/personal', menuKey: 'KPI_SETTING' },
  { prefix: '/api/kpi/personal', menuKey: 'KPI_SETTING' },
  { prefix: '/kpi/monthly', menuKey: 'MONTHLY_INPUT' },
  { prefix: '/api/kpi/monthly-record', menuKey: 'MONTHLY_INPUT' },
  { prefix: '/dashboard', menuKey: 'DASHBOARD' },
  { prefix: '/checkin', menuKey: 'CHECKIN' },
  { prefix: '/api/checkin', menuKey: 'CHECKIN' },
  { prefix: '/evaluation/workbench', menuKey: 'AI_ASSIST' },
  { prefix: '/evaluation/assistant', menuKey: 'AI_ASSIST' },
  { prefix: '/evaluation/ai-competency', menuKey: 'AI_COMPETENCY' },
  { prefix: '/evaluation/360', menuKey: 'FEEDBACK_360' },
  { prefix: '/evaluation/word-cloud-360', menuKey: 'WORD_CLOUD_360' },
  { prefix: '/evaluation/results', menuKey: 'EVAL_RESULT' },
  { prefix: '/evaluation/appeal', menuKey: 'APPEAL' },
  { prefix: '/evaluation/ceo-adjust', menuKey: 'GRADE_ADJUST' },
  { prefix: '/api/evaluation/ai-competency', menuKey: 'AI_COMPETENCY' },
  { prefix: '/api/evaluation/word-cloud-360', menuKey: 'WORD_CLOUD_360' },
  { prefix: '/compensation/manage', menuKey: 'COMPENSATION_MANAGE' },
  { prefix: '/api/compensation/scenarios', menuKey: 'COMPENSATION_MANAGE' },
  { prefix: '/api/compensation/rules', menuKey: 'COMPENSATION_MANAGE' },
  { prefix: '/compensation/my', menuKey: 'COMPENSATION_SELF' },
  { prefix: '/api/compensation/self', menuKey: 'COMPENSATION_SELF' },
  { prefix: '/notifications', menuKey: 'NOTIFICATIONS' },
  { prefix: '/api/notifications', menuKey: 'NOTIFICATIONS' },
  { prefix: '/admin/google-access', menuKey: 'SYSTEM_SETTING' },
  { prefix: '/api/admin/employees/google-account', menuKey: 'SYSTEM_SETTING' },
  { prefix: '/admin/notifications', menuKey: 'SYSTEM_SETTING' },
  { prefix: '/admin/ops', menuKey: 'SYSTEM_SETTING' },
]

export function canAccessMenu(role: string, menuKey: MenuKey) {
  const allowedRoles = MENU_PERMISSIONS[menuKey]
  return allowedRoles.includes(role as AuthRole)
}

export function getAccessibleMenus(role: string) {
  return (Object.keys(MENU_PERMISSIONS) as MenuKey[]).filter((menuKey) =>
    canAccessMenu(role, menuKey)
  )
}

export function resolveMenuFromPath(pathname: string) {
  return PATH_MENU_ENTRIES.find((entry) => pathname.startsWith(entry.prefix))?.menuKey ?? null
}
