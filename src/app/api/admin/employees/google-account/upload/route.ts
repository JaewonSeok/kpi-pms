import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  applyEmployeeUpload,
  loadEmployeeValidationContext,
  parseEmployeeUploadWorkbook,
  validateEmployeeUploadRows,
} from '@/server/admin/google-account-management'

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')
    const formData = await request.formData()
    const mode = String(formData.get('mode') ?? 'preview').toLowerCase()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new AppError(400, 'UPLOAD_FILE_MISSING', '업로드할 파일을 선택해 주세요.')
    }

    if (file.size <= 0) {
      throw new AppError(400, 'EMPTY_UPLOAD_FILE', '빈 파일은 업로드할 수 없습니다.')
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      throw new AppError(
        400,
        'UPLOAD_FILE_TOO_LARGE',
        `업로드 파일 크기는 ${Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)}MB 이하여야 합니다.`
      )
    }

    const workbook = parseEmployeeUploadWorkbook(file.name, Buffer.from(await file.arrayBuffer()))
    const validationContext = await loadEmployeeValidationContext()
    const validation = validateEmployeeUploadRows({
      fileName: workbook.fileName,
      rows: workbook.rows,
      existingEmployees: validationContext.existingEmployees,
      existingDepartments: validationContext.existingDepartments,
    })

    if (mode !== 'apply') {
      return successResponse({
        mode: 'preview',
        ...validation,
      })
    }

    const applyResult =
      validation.validRows.length > 0
        ? await applyEmployeeUpload({
            fileName: validation.fileName,
            rows: validation.validRows,
          })
        : {
            fileName: validation.fileName,
            totalRows: validation.summary.totalRows,
            createdDepartmentCount: 0,
            createdCount: 0,
            updatedCount: 0,
            failedCount: validation.summary.invalidRows,
            hierarchyUpdatedCount: 0,
          }

    await prisma.uploadHistory.create({
      data: {
        uploadType: 'EMPLOYEE_BULK',
        uploaderId: session.user.id,
        fileName: validation.fileName,
        totalRows: validation.summary.totalRows,
        successCount: applyResult.createdCount + applyResult.updatedCount,
        failCount: validation.summary.invalidRows,
        errorDetails: {
          createdDepartmentCount: applyResult.createdDepartmentCount,
          createdCount: applyResult.createdCount,
          updatedCount: applyResult.updatedCount,
          hierarchyUpdatedCount: applyResult.hierarchyUpdatedCount,
          errors: validation.errors.slice(0, 100),
        },
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'EMPLOYEE_BULK_UPSERT',
      entityType: 'Employee',
      entityId: 'bulk-upload',
      newValue: {
        fileName: validation.fileName,
        totalRows: validation.summary.totalRows,
        createdDepartmentCount: applyResult.createdDepartmentCount,
        createdCount: applyResult.createdCount,
        updatedCount: applyResult.updatedCount,
        failedCount: validation.summary.invalidRows,
        hierarchyUpdatedCount: applyResult.hierarchyUpdatedCount,
        errors: validation.errors.slice(0, 20),
      },
      ...getClientInfo(request),
    })

    return successResponse({
      mode: 'apply',
      ...validation,
      applyResult: {
        ...applyResult,
        failedCount: validation.summary.invalidRows,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
