import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { buildOrgKpiTargetValuePersistence } from '@/lib/org-kpi-target-values'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { BulkOrgKpiUploadSchema } from '@/lib/validations'
import { assertOrgKpiScopeMatchesDepartments } from '@/server/org-kpi-scope-validation'

function canManage(role: string) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

function getScopeDepartmentIds(session: Session | null) {
  if (!session) return []
  if (session.user.role === 'ROLE_ADMIN' || session.user.role === 'ROLE_CEO') {
    return null
  }
  if (session.user.role === 'ROLE_MEMBER') {
    return [session.user.deptId]
  }
  return session.user.accessibleDepartmentIds.length
    ? session.user.accessibleDepartmentIds
    : [session.user.deptId]
}

type WeightKey = `${string}:${number}`

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (!canManage(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '조직 KPI 일괄 업로드 권한이 없습니다.')
    }

    const body = await request.json()
    const validated = BulkOrgKpiUploadSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '업로드 형식이 올바르지 않습니다.')
    }

    const scopeDepartmentIds = getScopeDepartmentIds(session)
    const rows = validated.data.rows
    const departmentIds = Array.from(new Set(rows.map((row) => row.deptId)))

    await assertOrgKpiScopeMatchesDepartments({
      requestedScope: validated.data.scope ?? null,
      deptIds: departmentIds,
    })

    if (scopeDepartmentIds) {
      const unauthorizedDept = departmentIds.find((deptId) => !scopeDepartmentIds.includes(deptId))
      if (unauthorizedDept) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 부서가 업로드 파일에 포함되어 있습니다.')
      }
    }

    const [departments, existingKpis] = await Promise.all([
      prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, deptName: true },
      }),
      prisma.orgKpi.findMany({
        where: {
          OR: rows.map((row) => ({
            deptId: row.deptId,
            evalYear: row.evalYear,
          })),
        },
        select: {
          id: true,
          deptId: true,
          evalYear: true,
          kpiName: true,
          weight: true,
        },
      }),
    ])

    const departmentNameMap = new Map(departments.map((department) => [department.id, department.deptName]))
    const existingWeightMap = new Map<WeightKey, number>()
    const existingNameSet = new Set<string>()

    existingKpis.forEach((kpi) => {
      const weightKey = `${kpi.deptId}:${kpi.evalYear}` as WeightKey
      existingWeightMap.set(weightKey, (existingWeightMap.get(weightKey) ?? 0) + kpi.weight)
      existingNameSet.add(`${kpi.deptId}:${kpi.evalYear}:${kpi.kpiName.toLowerCase()}`)
    })

    const clientInfo = getClientInfo(request)
    const createdIds: string[] = []
    const errors: Array<{ row: number; kpiName: string; message: string }> = []

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2
      const deptName = departmentNameMap.get(row.deptId)
      if (!deptName) {
        errors.push({ row: rowNumber, kpiName: row.kpiName, message: '대상 부서를 찾을 수 없습니다.' })
        continue
      }

      const duplicateKey = `${row.deptId}:${row.evalYear}:${row.kpiName.toLowerCase()}`
      if (existingNameSet.has(duplicateKey)) {
        errors.push({ row: rowNumber, kpiName: row.kpiName, message: '같은 부서/연도에 동일한 KPI명이 이미 있습니다.' })
        continue
      }

      const weightKey = `${row.deptId}:${row.evalYear}` as WeightKey
      const nextWeight = (existingWeightMap.get(weightKey) ?? 0) + row.weight
      if (nextWeight > 100) {
        errors.push({
          row: rowNumber,
          kpiName: row.kpiName,
          message: `가중치 합이 100을 초과합니다. (${Math.round(nextWeight * 10) / 10})`,
        })
        continue
      }

      const created = await prisma.orgKpi.create({
        data: {
          deptId: row.deptId,
          evalYear: row.evalYear,
          kpiType: row.kpiType,
          kpiCategory: row.kpiCategory,
          kpiName: row.kpiName,
          definition: row.definition,
          formula: row.formula,
          ...(row.targetValue != null
            ? buildOrgKpiTargetValuePersistence({
                targetValueT: row.targetValue,
                targetValueE: row.targetValue,
                targetValueS: row.targetValue,
              })
            : {}),
          unit: row.unit,
          weight: row.weight,
          difficulty: row.difficulty,
          status: 'DRAFT',
        },
      })

      createdIds.push(created.id)
      existingNameSet.add(duplicateKey)
      existingWeightMap.set(weightKey, nextWeight)

      await createAuditLog({
        userId: session.user.id,
        action: 'ORG_KPI_BULK_CREATED',
        entityType: 'OrgKpi',
        entityId: created.id,
        newValue: {
          deptId: created.deptId,
          evalYear: created.evalYear,
          kpiName: created.kpiName,
          weight: created.weight,
          status: created.status,
          source: 'bulk-upload',
        },
        ...clientInfo,
      })
    }

    await prisma.uploadHistory.create({
      data: {
        uploadType: 'ORG_KPI_BULK',
        uploaderId: session.user.id,
        fileName: validated.data.fileName || 'org-kpi-bulk-upload.xlsx',
        totalRows: rows.length,
        successCount: createdIds.length,
        failCount: errors.length,
        errorDetails: errors,
      },
    })

    return successResponse({
      createdCount: createdIds.length,
      failedCount: errors.length,
      errors,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
