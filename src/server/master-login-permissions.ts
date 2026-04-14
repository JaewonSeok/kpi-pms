import type { SystemRole } from '@prisma/client'
import { MASTER_LOGIN_PERMISSION_KEY, isFixedMasterLoginAccessSource, resolveMasterLoginAccess, resolveMasterLoginPermissionManagementState } from '@/lib/master-login'
import { AppError } from '@/lib/utils'

type AuditLogPayload = {
  userId: string
  action: string
  entityType: string
  entityId?: string
  oldValue?: object
  newValue?: object
  ipAddress?: string
  userAgent?: string
}

type MasterLoginPermissionTarget = {
  id: string
  empId: string
  empName: string
  gwsEmail: string
  role: SystemRole
  masterLoginPermissionGranted: boolean
}

type MasterLoginPermissionActor = {
  id: string
  name: string
  email: string
  role: SystemRole
  canManage: boolean
  masterLoginActive: boolean
}

type MasterLoginPermissionAuditContext = Pick<
  AuditLogPayload,
  'ipAddress' | 'userAgent'
>

type MasterLoginPermissionServiceDeps = {
  loadTarget: (targetEmployeeId: string) => Promise<MasterLoginPermissionTarget | null>
  updateTarget: (
    targetEmployeeId: string,
    enabled: boolean
  ) => Promise<MasterLoginPermissionTarget>
  createAuditEntry: (payload: AuditLogPayload) => Promise<void>
}

type UpdateMasterLoginPermissionParams = {
  actor: MasterLoginPermissionActor
  targetEmployeeId: string
  enabled: boolean
  auditContext: MasterLoginPermissionAuditContext
}

export type MasterLoginPermissionMutationResult = {
  targetUserId: string
  permissionKey: typeof MASTER_LOGIN_PERMISSION_KEY
  enabled: boolean
  accessSource: ReturnType<typeof resolveMasterLoginAccess>['source']
  effectiveAccess: boolean
}

const defaultDeps: MasterLoginPermissionServiceDeps = {
  async loadTarget(targetEmployeeId) {
    const { prisma } = await import('@/lib/prisma')
    return prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        role: true,
        masterLoginPermissionGranted: true,
      },
    })
  },
  async updateTarget(targetEmployeeId, enabled) {
    const { prisma } = await import('@/lib/prisma')
    return prisma.employee.update({
      where: { id: targetEmployeeId },
      data: {
        masterLoginPermissionGranted: enabled,
      },
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        role: true,
        masterLoginPermissionGranted: true,
      },
    })
  },
  async createAuditEntry(payload) {
    const { createAuditLog } = await import('@/lib/audit')
    await createAuditLog(payload)
  },
}

export async function updateMasterLoginPermission(
  params: UpdateMasterLoginPermissionParams,
  deps: MasterLoginPermissionServiceDeps = defaultDeps
): Promise<MasterLoginPermissionMutationResult> {
  if (!params.actor.canManage) {
    throw new AppError(
      403,
      'MASTER_LOGIN_FORBIDDEN',
      '마스터 로그인 권한을 관리할 수 없습니다. 시스템 설정 권한이 있는 관리자만 수행할 수 있습니다.'
    )
  }

  const management = resolveMasterLoginPermissionManagementState({
    isAuthenticated: true,
    hasActiveMasterLogin: params.actor.masterLoginActive,
  })

  if (!management.allowed) {
    throw new AppError(
      403,
      'MASTER_LOGIN_PERMISSION_UPDATE_BLOCKED',
      management.message ?? '마스터 로그인 권한을 변경할 수 없습니다.'
    )
  }

  const target = await deps.loadTarget(params.targetEmployeeId)
  if (!target) {
    throw new AppError(404, 'MASTER_LOGIN_TARGET_NOT_FOUND', '대상 HR 관리자 계정을 찾을 수 없습니다.')
  }

  if (target.role !== 'ROLE_ADMIN') {
    throw new AppError(
      400,
      'MASTER_LOGIN_TARGET_INVALID_ROLE',
      '마스터 로그인 권한은 HR 관리자 계정에만 부여할 수 있습니다.'
    )
  }

  const previousAccess = resolveMasterLoginAccess({
    role: target.role,
    email: target.gwsEmail,
    masterLoginPermissionGranted: target.masterLoginPermissionGranted,
  })

  if (isFixedMasterLoginAccessSource(previousAccess.source)) {
    throw new AppError(
      400,
      'MASTER_LOGIN_PERMISSION_FIXED_ACCOUNT',
      '소유자 또는 기본 허용 HR 관리자 계정의 마스터 로그인 권한은 여기에서 변경할 수 없습니다.'
    )
  }

  if (target.masterLoginPermissionGranted === params.enabled) {
    return {
      targetUserId: target.id,
      permissionKey: MASTER_LOGIN_PERMISSION_KEY,
      enabled: target.masterLoginPermissionGranted,
      accessSource: previousAccess.source,
      effectiveAccess: previousAccess.allowed,
    }
  }

  const updated = await deps.updateTarget(target.id, params.enabled)

  const nextAccess = resolveMasterLoginAccess({
    role: updated.role,
    email: updated.gwsEmail,
    masterLoginPermissionGranted: updated.masterLoginPermissionGranted,
  })

  await deps.createAuditEntry({
    userId: params.actor.id,
    action: params.enabled
      ? 'MASTER_LOGIN_PERMISSION_GRANTED'
      : 'MASTER_LOGIN_PERMISSION_REVOKED',
    entityType: 'Employee',
    entityId: updated.id,
    oldValue: {
      targetUserId: target.id,
      targetEmployeeNumber: target.empId,
      targetEmail: target.gwsEmail,
      grantedPermission: MASTER_LOGIN_PERMISSION_KEY,
      permissionGranted: target.masterLoginPermissionGranted,
      accessSource: previousAccess.source,
      effectiveAccess: previousAccess.allowed,
    },
    newValue: {
      targetUserId: updated.id,
      targetEmployeeNumber: updated.empId,
      targetEmail: updated.gwsEmail,
      grantedPermission: MASTER_LOGIN_PERMISSION_KEY,
      permissionGranted: updated.masterLoginPermissionGranted,
      accessSource: nextAccess.source,
      effectiveAccess: nextAccess.allowed,
    },
    ...params.auditContext,
  })

  return {
    targetUserId: updated.id,
    permissionKey: MASTER_LOGIN_PERMISSION_KEY,
    enabled: updated.masterLoginPermissionGranted,
    accessSource: nextAccess.source,
    effectiveAccess: nextAccess.allowed,
  }
}
