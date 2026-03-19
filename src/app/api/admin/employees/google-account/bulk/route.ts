import type { EmployeeStatus, Position, SystemRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { authorizeMenu } from '@/server/auth/authorize'
import { assertAllowedGoogleWorkspaceEmail } from '@/lib/google-workspace'
import { BulkAdminEmployeeUploadSchema } from '@/lib/validations'
import { recalculateEmployeeLeadershipLinks } from '@/server/admin/employeeHierarchy'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

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

type BulkRowResult = {
  rowNumber: number
  empId?: string
  empName?: string
  message: string
}

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')

    const body = await request.json()
    const validated = BulkAdminEmployeeUploadSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '업로드 데이터 형식이 올바르지 않습니다.'
      )
    }

    const [organization, departments] = await Promise.all([
      prisma.organization.findFirst({
        select: { id: true },
      }),
      prisma.department.findMany({
        select: {
          id: true,
          deptCode: true,
        },
      }),
    ])

    if (!organization) {
      throw new AppError(404, 'ORG_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')
    }

    const departmentMap = new Map(
      departments.map((department) => [department.deptCode.trim().toUpperCase(), department.id] as const)
    )

    const uniqueDepartmentRows = [
      ...new Map(
        validated.data.rows.map((row) => [
          row.deptCode.trim().toUpperCase(),
          {
            deptCode: row.deptCode.trim(),
            deptName: row.deptName.trim(),
            parentDeptCode: row.parentDeptCode?.trim().toUpperCase() || '',
          },
        ])
      ).values(),
    ]

    let createdDepartmentCount = 0
    let pendingDepartments = uniqueDepartmentRows.filter(
      (department) => !departmentMap.has(department.deptCode.toUpperCase())
    )

    while (pendingDepartments.length > 0) {
      let progressed = false
      const nextPending: typeof pendingDepartments = []

      for (const department of pendingDepartments) {
        const parentDeptId = department.parentDeptCode
          ? departmentMap.get(department.parentDeptCode)
          : null

        if (department.parentDeptCode && !parentDeptId) {
          nextPending.push(department)
          continue
        }

        const createdDepartment = await prisma.department.create({
          data: {
            deptCode: department.deptCode,
            deptName: department.deptName,
            orgId: organization.id,
            parentDeptId: parentDeptId ?? null,
          },
          select: {
            id: true,
          },
        })

        departmentMap.set(department.deptCode.toUpperCase(), createdDepartment.id)
        createdDepartmentCount += 1
        progressed = true
      }

      if (!progressed && nextPending.length > 0) {
        throw new AppError(
          400,
          'INVALID_PARENT_DEPARTMENT',
          `상위 부서를 찾을 수 없는 신규 부서가 있습니다: ${nextPending
            .map((department) => department.deptCode)
            .join(', ')}`
        )
      }

      pendingDepartments = nextPending
    }

    let createdCount = 0
    let updatedCount = 0
    const errors: BulkRowResult[] = []

    for (const [index, row] of validated.data.rows.entries()) {
      try {
        const normalizedDeptCode = row.deptCode.trim().toUpperCase()
        const deptId = departmentMap.get(normalizedDeptCode)
        if (!deptId) {
          throw new AppError(404, 'DEPARTMENT_NOT_FOUND', `부서코드 ${row.deptCode} 를 찾을 수 없습니다.`)
        }

        const normalizedEmail = assertAllowedGoogleWorkspaceEmail(row.gwsEmail)
        const role = row.role as SystemRole
        const status = row.status as EmployeeStatus

        const existingEmployee = await prisma.employee.findUnique({
          where: { empId: row.empId.trim() },
          select: {
            id: true,
            empId: true,
          },
        })

        const duplicateByEmail = await prisma.employee.findFirst({
          where: {
            gwsEmail: normalizedEmail,
            NOT: existingEmployee ? { id: existingEmployee.id } : undefined,
          },
          select: {
            empId: true,
            empName: true,
          },
        })

        if (duplicateByEmail) {
          throw new AppError(
            409,
            'GOOGLE_EMAIL_ALREADY_ASSIGNED',
            `${normalizedEmail} 은(는) 이미 ${duplicateByEmail.empName}(${duplicateByEmail.empId})에게 등록되어 있습니다.`
          )
        }

        const data = {
          empName: row.empName.trim(),
          gwsEmail: normalizedEmail,
          deptId,
          role,
          position: roleToPosition(role),
          status,
          joinDate: row.joinDate ? new Date(row.joinDate) : new Date(),
        }

        if (existingEmployee) {
          await prisma.employee.update({
            where: { id: existingEmployee.id },
            data,
          })
          updatedCount += 1
        } else {
          await prisma.employee.create({
            data: {
              empId: row.empId.trim(),
              ...data,
            },
          })
          createdCount += 1
        }
      } catch (error) {
        const message =
          error instanceof AppError ? error.message : '행 처리 중 오류가 발생했습니다.'
        errors.push({
          rowNumber: index + 2,
          empId: row.empId,
          empName: row.empName,
          message,
        })
      }
    }

    const hierarchyResult = await recalculateEmployeeLeadershipLinks()

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'EMPLOYEE_BULK_UPSERT',
      entityType: 'Employee',
      entityId: 'bulk-upload',
      oldValue: undefined,
        newValue: {
          fileName: validated.data.fileName ?? '',
          totalRows: validated.data.rows.length,
          createdDepartmentCount,
          createdCount,
          updatedCount,
          failedCount: errors.length,
        hierarchyUpdatedCount: hierarchyResult.updatedCount,
        errors: errors.slice(0, 20),
      },
      ...clientInfo,
    })

    await prisma.uploadHistory.create({
      data: {
        uploadType: 'EMPLOYEE_BULK',
        uploaderId: session.user.id,
        fileName: validated.data.fileName ?? 'employee-bulk-upload.xlsx',
        totalRows: validated.data.rows.length,
        successCount: createdCount + updatedCount,
        failCount: errors.length,
        errorDetails: {
          createdDepartmentCount,
          createdCount,
          updatedCount,
          hierarchyUpdatedCount: hierarchyResult.updatedCount,
          errors: errors.slice(0, 50),
        },
      },
    })

    return successResponse({
      fileName: validated.data.fileName ?? '',
      totalRows: validated.data.rows.length,
      createdDepartmentCount,
      createdCount,
      updatedCount,
      failedCount: errors.length,
      errors,
      hierarchyUpdatedCount: hierarchyResult.updatedCount,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
