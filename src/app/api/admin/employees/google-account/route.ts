import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import {
  AdminEmployeeLifecycleActionSchema,
  CreateAdminEmployeeSchema,
  DeleteGoogleAccountEmployeeSchema,
  UpdateGoogleAccountEmployeeSchema,
} from '@/lib/validations'
import { errorResponse, AppError, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  applyEmployeeLifecycleAction,
  loadEmployeeDirectory,
  safeDeleteEmployeeRecord,
  upsertEmployeeRecord,
} from '@/server/admin/google-account-management'

async function loadEmployeeAuditSnapshot(employeeId: string) {
  return prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      empId: true,
      empName: true,
      gwsEmail: true,
      deptId: true,
      teamName: true,
      jobTitle: true,
      role: true,
      status: true,
      masterLoginPermissionGranted: true,
      managerId: true,
      joinDate: true,
      resignationDate: true,
      sortOrder: true,
      notes: true,
    },
  })
}

export async function GET(request: Request) {
  try {
    await authorizeMenu('SYSTEM_SETTING')

    const { searchParams } = new URL(request.url)
    return successResponse(
      await loadEmployeeDirectory({
        query: searchParams.get('q') ?? undefined,
        status: searchParams.get('status') ?? undefined,
        departmentId: searchParams.get('departmentId') ?? undefined,
      })
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')
    const body = await request.json()
    const validated = CreateAdminEmployeeSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '입력값이 올바르지 않습니다.'
      )
    }

    const result = await upsertEmployeeRecord({
      employeeNumber: validated.data.employeeNumber,
      name: validated.data.name,
      gwsEmail: validated.data.gwsEmail,
      deptId: validated.data.deptId,
      teamName: validated.data.teamName,
      jobTitle: validated.data.jobTitle,
      role: validated.data.role,
      employmentStatus: validated.data.employmentStatus,
      managerEmployeeNumber: validated.data.managerEmployeeNumber,
      joinDate: validated.data.joinDate,
      resignationDate: validated.data.resignationDate,
      sortOrder: validated.data.sortOrder ?? null,
      notes: validated.data.notes,
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'EMPLOYEE_MANUAL_CREATE',
      entityType: 'Employee',
      entityId: result.employee.id,
      newValue: result.employee,
      ...getClientInfo(request),
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')
    const body = await request.json()
    const validated = UpdateGoogleAccountEmployeeSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '입력값이 올바르지 않습니다.'
      )
    }

    const previousEmployee = await loadEmployeeAuditSnapshot(validated.data.employeeId)
    if (!previousEmployee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const result = await upsertEmployeeRecord({
      employeeId: validated.data.employeeId,
      employeeNumber: validated.data.employeeNumber,
      name: validated.data.name,
      gwsEmail: validated.data.gwsEmail,
      deptId: validated.data.deptId,
      teamName: validated.data.teamName,
      jobTitle: validated.data.jobTitle,
      role: validated.data.role,
      employmentStatus: validated.data.employmentStatus,
      managerEmployeeNumber: validated.data.managerEmployeeNumber,
      joinDate: validated.data.joinDate,
      resignationDate: validated.data.resignationDate,
      sortOrder: validated.data.sortOrder ?? null,
      notes: validated.data.notes,
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'EMPLOYEE_GOOGLE_ACCESS_UPDATE',
      entityType: 'Employee',
      entityId: result.employee.id,
      oldValue: previousEmployee,
      newValue: result.employee,
      ...getClientInfo(request),
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')
    const body = await request.json()
    const validated = AdminEmployeeLifecycleActionSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '처리 요청이 올바르지 않습니다.'
      )
    }

    const previousEmployee = await loadEmployeeAuditSnapshot(validated.data.employeeId)
    if (!previousEmployee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const result = await applyEmployeeLifecycleAction({
      employeeId: validated.data.employeeId,
      action: validated.data.action,
      resignationDate: validated.data.resignationDate,
    })

    await createAuditLog({
      userId: session.user.id,
      action: `EMPLOYEE_${validated.data.action}`,
      entityType: 'Employee',
      entityId: result.employee.id,
      oldValue: previousEmployee,
      newValue: {
        ...result.employee,
        note: validated.data.note ?? null,
      },
      ...getClientInfo(request),
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')
    const body = await request.json()
    const validated = DeleteGoogleAccountEmployeeSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '삭제 요청이 올바르지 않습니다.'
      )
    }

    const previousEmployee = await loadEmployeeAuditSnapshot(validated.data.employeeId)
    if (!previousEmployee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const result = await safeDeleteEmployeeRecord(validated.data.employeeId)

    await createAuditLog({
      userId: session.user.id,
      action: 'EMPLOYEE_DELETE',
      entityType: 'Employee',
      entityId: validated.data.employeeId,
      oldValue: previousEmployee,
      newValue: {
        ...result.deletedEmployee,
        forceDelete: true,
        cleanupSummary: result.cleanupSummary,
      },
      ...getClientInfo(request),
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
