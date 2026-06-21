type EmployeeRoleLike =
  | 'ROLE_MEMBER'
  | 'ROLE_TEAM_LEADER'
  | 'ROLE_SECTION_CHIEF'
  | 'ROLE_DIV_HEAD'
  | 'ROLE_CEO'
  | 'ROLE_ADMIN'
  | string

type EmployeePositionLike =
  | 'MEMBER'
  | 'TEAM_LEADER'
  | 'SECTION_CHIEF'
  | 'DIV_HEAD'
  | 'CEO'
  | string

const POSITION_LABELS: Record<string, string> = {
  MEMBER: '팀원',
  TEAM_LEADER: '팀장',
  SECTION_CHIEF: '실장',
  DIV_HEAD: '본부장',
  CEO: 'CEO',
}

const ROLE_POSITION_LABELS: Record<string, string> = {
  ROLE_MEMBER: '팀원',
  ROLE_TEAM_LEADER: '팀장',
  ROLE_SECTION_CHIEF: '실장',
  ROLE_DIV_HEAD: '본부장',
  ROLE_CEO: 'CEO',
  ROLE_ADMIN: 'HR 관리자',
}

const LEADERSHIP_ROLES = new Set(['ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO'])

function normalizePositionText(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  return POSITION_LABELS[trimmed] ?? ROLE_POSITION_LABELS[trimmed] ?? trimmed
}

export function resolveEmployeePositionLabel(params: {
  role?: EmployeeRoleLike | null
  position?: EmployeePositionLike | null
  jobTitle?: string | null
}) {
  const role = params.role?.trim()
  if (role && LEADERSHIP_ROLES.has(role)) {
    return ROLE_POSITION_LABELS[role] ?? role
  }

  const jobTitleLabel = normalizePositionText(params.jobTitle)
  if (jobTitleLabel) return jobTitleLabel

  const positionLabel = normalizePositionText(params.position)
  if (positionLabel) return positionLabel

  if (role) return ROLE_POSITION_LABELS[role] ?? role

  return '-'
}
