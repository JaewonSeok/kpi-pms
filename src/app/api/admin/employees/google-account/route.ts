import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { authorizeMenu } from '@/server/auth/authorize'
import { assertAllowedGoogleWorkspaceEmail, getAllowedGoogleWorkspaceDomain } from '@/lib/google-workspace'
import { RegisterGoogleAccountSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

const EMPLOYEE_SEARCH_LIMIT = 20

export async function GET(request: Request) {
  try {
    await authorizeMenu('SYSTEM_SETTING')

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()

    const employees = await prisma.employee.findMany({
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
            deptName: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { empName: 'asc' }],
      take: EMPLOYEE_SEARCH_LIMIT,
    })

    return successResponse({
      allowedDomain: getAllowedGoogleWorkspaceDomain(),
      employees: employees.map((employee) => ({
        id: employee.id,
        empId: employee.empId,
        empName: employee.empName,
        role: employee.role,
        status: employee.status,
        deptName: employee.department.deptName,
        gwsEmail: employee.gwsEmail,
      })),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')

    const body = await request.json()
    const validated = RegisterGoogleAccountSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '입력값이 올바르지 않습니다.')
    }

    const normalizedEmail = assertAllowedGoogleWorkspaceEmail(validated.data.gwsEmail)

    const employee = await prisma.employee.findUnique({
      where: { id: validated.data.employeeId },
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        status: true,
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
      data: { gwsEmail: normalizedEmail },
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        status: true,
      },
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'EMPLOYEE_GOOGLE_EMAIL_UPDATE',
      entityType: 'Employee',
      entityId: employee.id,
      oldValue: {
        gwsEmail: employee.gwsEmail,
        status: employee.status,
      },
      newValue: {
        gwsEmail: updatedEmployee.gwsEmail,
        status: updatedEmployee.status,
      },
      ...clientInfo,
    })

    return successResponse({
      employee: updatedEmployee,
      allowedDomain: getAllowedGoogleWorkspaceDomain(),
      loginReady: updatedEmployee.status === 'ACTIVE',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
