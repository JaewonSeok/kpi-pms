import type { SystemRole } from '@prisma/client'
import { readAiAssistEnv, type AiAssistEnv } from './ai-env'

export type PersonalKpiPageState =
  | 'ready'
  | 'empty'
  | 'no-target'
  | 'setup-required'
  | 'permission-denied'
  | 'error'

export type PersonalKpiAiAccess = {
  allowed: boolean
  reason: 'role' | 'feature-disabled' | 'configuration-missing' | null
  message?: string
}

export type PersonalKpiAiAccessReasonCode =
  | 'available'
  | 'permission-denied'
  | 'feature-disabled'
  | 'configuration-missing'
  | 'provider-unavailable'
  | 'not-self-scope'
  | 'setup-required'
  | 'page-error'

export type PersonalKpiAiAccessView = {
  enabled: boolean
  canUse: boolean
  reasonCode: PersonalKpiAiAccessReasonCode
  message: string
}

export const PERSONAL_KPI_AI_AVAILABLE_MESSAGE =
  'AI는 개인 KPI 작성과 표현 정리를 돕는 보조 기능입니다. 결과는 저장 전 초안이며 사용자가 직접 확인해야 합니다.'

export const PERSONAL_KPI_AI_PERMISSION_DENIED_MESSAGE =
  '현재 계정에는 개인 KPI AI 작성 보조 권한이 없습니다.'

export const PERSONAL_KPI_AI_FEATURE_DISABLED_MESSAGE =
  '서버 AI 작성 보조 기능이 꺼져 있어 초안 생성을 사용할 수 없습니다.'

export const PERSONAL_KPI_AI_CONFIGURATION_MISSING_MESSAGE =
  'AI provider 설정이 완료되지 않아 초안 생성을 사용할 수 없습니다. 관리자에게 설정 확인을 요청하세요.'

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

export const PERSONAL_KPI_MIDCHECK_COACH_ROLES: SystemRole[] = [
  'ROLE_ADMIN',
  'ROLE_CEO',
  'ROLE_DIV_HEAD',
  'ROLE_SECTION_CHIEF',
  'ROLE_TEAM_LEADER',
]

type PersonalKpiCoachingTarget = {
  id: string
  teamLeaderId?: string | null
  sectionChiefId?: string | null
  divisionHeadId?: string | null
}

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

export function canAccessPersonalKpiTarget(params: {
  actorId: string
  actorRole: SystemRole
  targetEmployeeId: string
}) {
  return params.actorId === params.targetEmployeeId || canManagePersonalKpi(params.actorRole)
}

export function canCoachPersonalKpiTarget(params: {
  actorId: string
  actorRole: SystemRole
  targetEmployee: PersonalKpiCoachingTarget
}) {
  if (!PERSONAL_KPI_MIDCHECK_COACH_ROLES.includes(params.actorRole)) {
    return false
  }

  if (params.targetEmployee.id === params.actorId) {
    return false
  }

  if (params.actorRole === 'ROLE_ADMIN' || params.actorRole === 'ROLE_CEO') {
    return true
  }

  return (
    params.targetEmployee.teamLeaderId === params.actorId ||
    params.targetEmployee.sectionChiefId === params.actorId ||
    params.targetEmployee.divisionHeadId === params.actorId
  )
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
      message: PERSONAL_KPI_AI_PERMISSION_DENIED_MESSAGE,
    }
  }

  const env = params.env ?? readAiAssistEnv()
  if (!env.enabled) {
    return {
      allowed: false,
      reason: 'feature-disabled',
      message: PERSONAL_KPI_AI_FEATURE_DISABLED_MESSAGE,
    }
  }

  if (!env.apiKey) {
    return {
      allowed: false,
      reason: 'configuration-missing',
      message: PERSONAL_KPI_AI_CONFIGURATION_MISSING_MESSAGE,
    }
  }

  return {
    allowed: true,
    reason: null,
  }
}

export function toPersonalKpiAiAccessView(access: PersonalKpiAiAccess): PersonalKpiAiAccessView {
  if (access.allowed) {
    return {
      enabled: true,
      canUse: true,
      reasonCode: 'available',
      message: access.message ?? PERSONAL_KPI_AI_AVAILABLE_MESSAGE,
    }
  }

  if (access.reason === 'feature-disabled') {
    return {
      enabled: false,
      canUse: false,
      reasonCode: 'feature-disabled',
      message: access.message ?? PERSONAL_KPI_AI_FEATURE_DISABLED_MESSAGE,
    }
  }

  if (access.reason === 'configuration-missing') {
    return {
      enabled: true,
      canUse: false,
      reasonCode: 'configuration-missing',
      message: access.message ?? PERSONAL_KPI_AI_CONFIGURATION_MISSING_MESSAGE,
    }
  }

  return {
    enabled: true,
    canUse: false,
    reasonCode: 'permission-denied',
    message: access.message ?? PERSONAL_KPI_AI_PERMISSION_DENIED_MESSAGE,
  }
}

export function buildPersonalKpiPermissions(params: {
  actorId: string
  actorRole: SystemRole
  targetEmployeeId: string
  targetEmployee?: PersonalKpiCoachingTarget
  pageState: PersonalKpiPageState
  aiAccess?: PersonalKpiAiAccess
}) {
  const pageReadyForAction =
    params.pageState === 'ready' || params.pageState === 'empty'
  const canManageTarget = canAccessPersonalKpiTarget({
    actorId: params.actorId,
    actorRole: params.actorRole,
    targetEmployeeId: params.targetEmployeeId,
  })
  const aiAccess = params.aiAccess ?? resolvePersonalKpiAiAccess({ role: params.actorRole })

  return {
    canEdit: pageReadyForAction && canManageTarget,
    canCreate: pageReadyForAction && canManageTarget,
    canSubmit: pageReadyForAction && canManageTarget,
    canReview: pageReadyForAction && canReviewPersonalKpi(params.actorRole),
    canLock: pageReadyForAction && canReviewPersonalKpi(params.actorRole),
    canUseAi: pageReadyForAction && canManageTarget && aiAccess.allowed,
    canUseMidcheckCoach:
      pageReadyForAction &&
      Boolean(params.targetEmployee) &&
      canCoachPersonalKpiTarget({
        actorId: params.actorId,
        actorRole: params.actorRole,
        targetEmployee: params.targetEmployee!,
      }),
    canOverride: pageReadyForAction && params.actorRole === 'ROLE_ADMIN',
  }
}
