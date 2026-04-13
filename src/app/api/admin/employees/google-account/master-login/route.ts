import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import {
  MASTER_LOGIN_PERMISSION_KEY,
  canUseMasterLoginForActor,
  resolveMasterLoginAccess,
} from '@/lib/master-login'
import {
  AdminMasterLoginPermissionSchema,
  AdminMasterLoginSchema,
} from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { loadMasterLoginTargetPreview } from '@/server/admin/google-account-management'

async function assertMasterLoginPermission(session: Awaited<ReturnType<typeof authorizeMenu>>) {
  const allowed = await canUseMasterLoginForActor({
    employeeId: session.user.id,
    role: session.user.role,
    email: session.user.email,
  })

  if (!allowed) {
    throw new AppError(
      403,
      'MASTER_LOGIN_FORBIDDEN',
      '마스터 로그인 권한이 없습니다. 이 작업은 소유자 또는 권한이 부여된 HR관리자만 수행할 수 있습니다.'
    )
  }
}

async function loadMasterLoginPermissionTarget(targetEmployeeId: string) {
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
}

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')

    if (session.user.masterLogin?.active) {
      throw new AppError(
        400,
        'MASTER_LOGIN_ALREADY_ACTIVE',
        '이미 마스터 로그인 중입니다. 현재 세션을 먼저 종료해 주세요.'
      )
    }

    await assertMasterLoginPermission(session)

    const body = await request.json()
    const validated = AdminMasterLoginSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '마스터 로그인 대상이 올바르지 않습니다.'
      )
    }

    const preview = await loadMasterLoginTargetPreview(validated.data.targetEmployeeId)

    if (preview.employee.id === session.user.id) {
      throw new AppError(
        400,
        'MASTER_LOGIN_SELF_TARGET',
        '현재 로그인한 관리자 계정은 마스터 로그인 대상으로 선택할 수 없습니다.'
      )
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'MASTER_LOGIN_PREVIEW',
      entityType: 'Employee',
      entityId: preview.employee.id,
      newValue: {
        targetEmployeeId: preview.employee.id,
        targetEmployeeNumber: preview.employee.employeeNumber,
        reason: validated.data.reason,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      employee: preview.employee,
      actor: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      reason: validated.data.reason,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')

    if (session.user.masterLogin?.active) {
      throw new AppError(
        403,
        'MASTER_LOGIN_PERMISSION_UPDATE_BLOCKED',
        '마스터 로그인 중에는 권한을 변경할 수 없습니다. 먼저 현재 세션을 종료해 주세요.'
      )
    }

    await assertMasterLoginPermission(session)

    const body = await request.json()
    const validated = AdminMasterLoginPermissionSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '권한 변경 요청이 올바르지 않습니다.'
      )
    }

    const target = await loadMasterLoginPermissionTarget(validated.data.targetEmployeeId)
    if (!target) {
      throw new AppError(404, 'MASTER_LOGIN_TARGET_NOT_FOUND', '대상 HR관리자를 찾을 수 없습니다.')
    }

    if (target.role !== 'ROLE_ADMIN') {
      throw new AppError(
        400,
        'MASTER_LOGIN_TARGET_INVALID_ROLE',
        '마스터 로그인 권한은 HR관리자 계정에만 부여할 수 있습니다.'
      )
    }

    if (target.id === session.user.id && !validated.data.enabled) {
      const actorAccess = await canUseMasterLoginForActor({
        employeeId: session.user.id,
        role: session.user.role,
        email: session.user.email,
      })

      if (!actorAccess) {
        throw new AppError(403, 'MASTER_LOGIN_FORBIDDEN', '마스터 로그인 권한이 없습니다.')
      }
    }

    const previousAccess = resolveMasterLoginAccess({
      role: target.role,
      email: target.gwsEmail,
      masterLoginPermissionGranted: target.masterLoginPermissionGranted,
    })

    if (target.masterLoginPermissionGranted === validated.data.enabled) {
      return successResponse({
        targetUserId: target.id,
        permissionKey: MASTER_LOGIN_PERMISSION_KEY,
        enabled: target.masterLoginPermissionGranted,
        accessSource: previousAccess.source,
        effectiveAccess: previousAccess.allowed,
      })
    }

    const updated = await prisma.employee.update({
      where: { id: target.id },
      data: {
        masterLoginPermissionGranted: validated.data.enabled,
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

    const nextAccess = resolveMasterLoginAccess({
      role: updated.role,
      email: updated.gwsEmail,
      masterLoginPermissionGranted: updated.masterLoginPermissionGranted,
    })

    await createAuditLog({
      userId: session.user.id,
      action: validated.data.enabled
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
      ...getClientInfo(request),
    })

    return successResponse({
      targetUserId: updated.id,
      permissionKey: MASTER_LOGIN_PERMISSION_KEY,
      enabled: updated.masterLoginPermissionGranted,
      accessSource: nextAccess.source,
      effectiveAccess: nextAccess.allowed,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
