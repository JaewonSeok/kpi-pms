import type { Position, SystemRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { authorizeMenu } from '@/server/auth/authorize'
import { assertAllowedGoogleWorkspaceEmail, getAllowedGoogleWorkspaceDomain } from '@/lib/google-workspace'
import { recalculateEmployeeLeadershipLinks } from '@/server/admin/employeeHierarchy'
import {
  CreateAdminEmployeeSchema,
  UpdateGoogleAccountEmployeeSchema,
} from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

const EMPLOYEE_SEARCH_LIMIT = 100

function getAuditLogValue(value: unknown, key: string) {
  if (typeof value !== 'object' || value === null || !(key in value)) {
    return undefined
  }

  return (value as Record<string, unknown>)[key]
}

function roleToPosition(role: SystemRole): Position {
  switch (role) {
    case 'ROLE_TEAM_LEADER':
      return 'TEAM_LEADER'
    case 'ROLE_SECTION_CHIEF':
      return 'SECTION_CHIEF'
    case 'ROLE_DIV_HEAD':
      return 'DIV_HEAD'
    case 'ROLE_CEO':
      return 'CEO'
    case 'ROLE_ADMIN':
    case 'ROLE_MEMBER':
    default:
      return 'MEMBER'
  }
}

async function getDepartmentOrThrow(deptId: string) {
  const department = await prisma.department.findUnique({
    where: { id: deptId },
    select: {
      id: true,
      deptCode: true,
      deptName: true,
    },
  })

  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '선택한 부서를 찾을 수 없습니다.')
  }

  return department
}

export async function GET(request: Request) {
  try {
    await authorizeMenu('SYSTEM_SETTING')

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()

    const [employees, departments, uploadHistory] = await Promise.all([
      prisma.employee.findMany({
        where: query
          ? {
              OR: [
                { empId: { contains: query, mode: 'insensitive' } },
                { empName: { contains: query, mode: 'insensitive' } },
                { gwsEmail: { contains: query, mode: 'insensitive' } },
              ],
            }
          : undefined,
        include: {
          department: {
            select: {
              id: true,
              deptCode: true,
              deptName: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { empName: 'asc' }],
        take: EMPLOYEE_SEARCH_LIMIT,
      }),
      prisma.department.findMany({
        select: {
          id: true,
          deptCode: true,
          deptName: true,
        },
        orderBy: [{ deptName: 'asc' }],
      }),
      prisma.uploadHistory.findMany({
        where: {
          uploadType: 'EMPLOYEE_BULK',
        },
        orderBy: {
          uploadedAt: 'desc',
        },
        take: 10,
      }),
    ])

    return successResponse({
      allowedDomain: getAllowedGoogleWorkspaceDomain(),
      departments,
      uploadHistory: uploadHistory.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        totalRows: item.totalRows,
        createdCount: Number(getAuditLogValue(item.errorDetails, 'createdCount') ?? 0),
        updatedCount: Number(getAuditLogValue(item.errorDetails, 'updatedCount') ?? 0),
        failedCount: item.failCount,
        hierarchyUpdatedCount: Number(getAuditLogValue(item.errorDetails, 'hierarchyUpdatedCount') ?? 0),
        userId: item.uploaderId,
        timestamp: item.uploadedAt.toISOString(),
      })),
      employees: employees.map((employee) => ({
        id: employee.id,
        empId: employee.empId,
        empName: employee.empName,
        role: employee.role,
        status: employee.status,
        deptId: employee.department.id,
        deptCode: employee.department.deptCode,
        deptName: employee.department.deptName,
        gwsEmail: employee.gwsEmail,
        joinDate: employee.joinDate.toISOString(),
      })),
    })
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

    const normalizedEmail = assertAllowedGoogleWorkspaceEmail(validated.data.gwsEmail)
    const department = await getDepartmentOrThrow(validated.data.deptId)

    const duplicateEmpId = await prisma.employee.findUnique({
      where: { empId: validated.data.empId },
      select: { id: true },
    })
    if (duplicateEmpId) {
      throw new AppError(409, 'EMPLOYEE_ID_ALREADY_EXISTS', '이미 등록된 사번입니다.')
    }

    const duplicateEmail = await prisma.employee.findUnique({
      where: { gwsEmail: normalizedEmail },
      select: { empId: true, empName: true },
    })
    if (duplicateEmail) {
      throw new AppError(
        409,
        'GOOGLE_EMAIL_ALREADY_ASSIGNED',
        `${normalizedEmail} 은(는) 이미 ${duplicateEmail.empName}(${duplicateEmail.empId})에게 등록되어 있습니다.`
      )
    }

    const employee = await prisma.employee.create({
      data: {
        empId: validated.data.empId.trim(),
        empName: validated.data.empName.trim(),
        gwsEmail: normalizedEmail,
        deptId: department.id,
        role: validated.data.role,
        position: roleToPosition(validated.data.role),
        status: validated.data.status,
        joinDate: new Date(validated.data.joinDate),
      },
      include: {
        department: {
          select: {
            id: true,
            deptCode: true,
            deptName: true,
          },
        },
      },
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'EMPLOYEE_MANUAL_CREATE',
      entityType: 'Employee',
      entityId: employee.id,
      oldValue: undefined,
      newValue: {
        empId: employee.empId,
        empName: employee.empName,
        gwsEmail: employee.gwsEmail,
        role: employee.role,
        deptId: employee.deptId,
        status: employee.status,
      },
      ...clientInfo,
    })

    const hierarchyResult = await recalculateEmployeeLeadershipLinks()

    return successResponse({
      employee: {
        id: employee.id,
        empId: employee.empId,
        empName: employee.empName,
        role: employee.role,
        status: employee.status,
        deptId: employee.department.id,
        deptCode: employee.department.deptCode,
        deptName: employee.department.deptName,
        gwsEmail: employee.gwsEmail,
        joinDate: employee.joinDate.toISOString(),
      },
      allowedDomain: getAllowedGoogleWorkspaceDomain(),
      loginReady: employee.status === 'ACTIVE',
      hierarchyUpdatedCount: hierarchyResult.updatedCount,
    })
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

    const normalizedEmail = assertAllowedGoogleWorkspaceEmail(validated.data.gwsEmail)
    const department = await getDepartmentOrThrow(validated.data.deptId)

    const employee = await prisma.employee.findUnique({
      where: { id: validated.data.employeeId },
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        role: true,
        status: true,
        deptId: true,
      },
    })

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const duplicate = await prisma.employee.findFirst({
      where: {
        gwsEmail: normalizedEmail,
        NOT: { id: employee.id },
      },
      select: {
        empId: true,
        empName: true,
      },
    })

    if (duplicate) {
      throw new AppError(
        409,
        'GOOGLE_EMAIL_ALREADY_ASSIGNED',
        `${normalizedEmail} 은(는) 이미 ${duplicate.empName}(${duplicate.empId})에게 등록되어 있습니다.`
      )
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        gwsEmail: normalizedEmail,
        role: validated.data.role,
        position: roleToPosition(validated.data.role),
        deptId: department.id,
        status: validated.data.status,
      },
      include: {
        department: {
          select: {
            id: true,
            deptCode: true,
            deptName: true,
          },
        },
      },
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'EMPLOYEE_GOOGLE_ACCESS_UPDATE',
      entityType: 'Employee',
      entityId: employee.id,
      oldValue: {
        gwsEmail: employee.gwsEmail,
        role: employee.role,
        status: employee.status,
        deptId: employee.deptId,
      },
      newValue: {
        gwsEmail: updatedEmployee.gwsEmail,
        role: updatedEmployee.role,
        status: updatedEmployee.status,
        deptId: updatedEmployee.deptId,
      },
      ...clientInfo,
    })

    const hierarchyResult = await recalculateEmployeeLeadershipLinks()

    return successResponse({
      employee: {
        id: updatedEmployee.id,
        empId: updatedEmployee.empId,
        empName: updatedEmployee.empName,
        role: updatedEmployee.role,
        status: updatedEmployee.status,
        deptId: updatedEmployee.department.id,
        deptCode: updatedEmployee.department.deptCode,
        deptName: updatedEmployee.department.deptName,
        gwsEmail: updatedEmployee.gwsEmail,
        joinDate: updatedEmployee.joinDate.toISOString(),
      },
      allowedDomain: getAllowedGoogleWorkspaceDomain(),
      loginReady: updatedEmployee.status === 'ACTIVE',
      hierarchyUpdatedCount: hierarchyResult.updatedCount,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
