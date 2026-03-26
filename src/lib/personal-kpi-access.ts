import type { SystemRole } from '@prisma/client'
import { readAiAssistEnv, type AiAssistEnv } from './ai-env'

export type PersonalKpiPageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type PersonalKpiAiAccess = {
  allowed: boolean
  reason: 'role' | 'feature-disabled' | 'configuration-missing' | null
  message?: string
}

export const PERSONAL_KPI_MANAGE_ROLES: SystemRole[] = [
  'ROLE_ADMIN',
  'ROLE_CEO',
  'ROLE_DIV_HEAD',
  'ROLE_SECTION_CHIEF',
  'ROLE_TEAM_LEADER',
]

export const PERSONAL_KPI_REVIEW_ROLES: SystemRole[] = [...PERSONAL_KPI_MANAGE_ROLES]

export const PERSONAL_KPI_AI_ROLES: SystemRole[] = [
  'ROLE_ADMIN',
  'ROLE_CEO',
  'ROLE_DIV_HEAD',
  'ROLE_SECTION_CHIEF',
  'ROLE_TEAM_LEADER',
  'ROLE_MEMBER',
]

export function normalizeAccessibleDepartmentIds(accessibleDepartmentIds?: string[] | null) {
  if (!Array.isArray(accessibleDepartmentIds)) return []
  return accessibleDepartmentIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

export function getPersonalKpiScopeDepartmentIds(params: {
  role: SystemRole
  deptId: string
  accessibleDepartmentIds?: string[] | null
}) {
  if (params.role === 'ROLE_ADMIN' || params.role === 'ROLE_CEO') {
    return null
  }

  if (params.role === 'ROLE_MEMBER') {
    return [params.deptId]
  }

  const normalizedIds = normalizeAccessibleDepartmentIds(params.accessibleDepartmentIds)
  return normalizedIds.length ? normalizedIds : [params.deptId]
}

export function canManagePersonalKpi(role: SystemRole) {
  return PERSONAL_KPI_MANAGE_ROLES.includes(role)
}

export function canReviewPersonalKpi(role: SystemRole) {
  return PERSONAL_KPI_REVIEW_ROLES.includes(role)
}

export function resolvePersonalKpiAiAccess(params: {
  role: SystemRole
  env?: Pick<AiAssistEnv, 'enabled' | 'apiKey'>
}): PersonalKpiAiAccess {
  if (!PERSONAL_KPI_AI_ROLES.includes(params.role)) {
    return {
      allowed: false,
      reason: 'role',
      message: '현재 계정은 개인 KPI AI 보조를 사용할 권한이 없습니다.',
    }
  }

  const env = params.env ?? readAiAssistEnv()
  if (!env.enabled) {
    return {
      allowed: false,
      reason: 'feature-disabled',
      message: 'AI 기능이 비활성화되어 있어 개인 KPI AI 보조를 사용할 수 없습니다.',
    }
  }

  if (!env.apiKey) {
    return {
      allowed: false,
      reason: 'configuration-missing',
      message: 'OPENAI_API_KEY가 설정되지 않아 개인 KPI AI 보조를 현재 사용할 수 없습니다.',
    }
  }

  return {
    allowed: true,
    reason: null,
  }
}

export function buildPersonalKpiPermissions(params: {
  actorId: string
  actorRole: SystemRole
  targetEmployeeId: string
  pageState: PersonalKpiPageState
  aiAccess?: PersonalKpiAiAccess
}) {
  const pageReadyForAction = params.pageState !== 'permission-denied' && params.pageState !== 'error'
  const canManageTarget = params.actorId === params.targetEmployeeId || canManagePersonalKpi(params.actorRole)
  const aiAccess = params.aiAccess ?? resolvePersonalKpiAiAccess({ role: params.actorRole })

  return {
    canEdit: pageReadyForAction && canManageTarget,
    canCreate: pageReadyForAction && canManageTarget,
    canSubmit: pageReadyForAction && canManageTarget,
    canReview: pageReadyForAction && canReviewPersonalKpi(params.actorRole),
    canLock: pageReadyForAction && canReviewPersonalKpi(params.actorRole),
    canUseAi: pageReadyForAction && aiAccess.allowed,
    canOverride: pageReadyForAction && params.actorRole === 'ROLE_ADMIN',
  }
}
