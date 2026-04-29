import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveOrgKpiScopeFromDepartmentId, type OrgKpiScope } from '@/lib/org-kpi-scope'
import { AppError } from '@/lib/utils'

type DepartmentScopeLite = {
  id: string
  parentDeptId: string | null
}

async function loadDepartments(prismaClient: PrismaClient | typeof prisma) {
  return prismaClient.department.findMany({
    select: {
      id: true,
      parentDeptId: true,
    },
  }) as Promise<DepartmentScopeLite[]>
}

function getOrgKpiScopeMismatchMessage(scope: OrgKpiScope, mode: 'select' | 'write') {
  switch (scope) {
    case 'division':
      return mode === 'select'
        ? '본부 KPI 탭에서는 본부 조직만 선택할 수 있습니다.'
        : '본부 KPI 탭에서는 본부 조직만 업로드하거나 수정할 수 있습니다.'
    case 'section':
      return mode === 'select'
        ? '실 KPI 탭에서는 실 조직만 선택할 수 있습니다.'
        : '실 KPI 탭에서는 실 조직만 업로드하거나 수정할 수 있습니다.'
    case 'team':
    default:
      return mode === 'select'
        ? '팀 KPI 탭에서는 팀 조직만 선택할 수 있습니다.'
        : '팀 KPI 탭에서는 팀 조직만 업로드하거나 수정할 수 있습니다.'
  }
}

export async function assertOrgKpiScopeMatchesDepartment(params: {
  requestedScope?: OrgKpiScope | null
  deptId: string
  prismaClient?: PrismaClient | typeof prisma
}) {
  if (!params.requestedScope) {
    return
  }

  const prismaClient = params.prismaClient ?? prisma
  const departments = await loadDepartments(prismaClient)
  const targetDepartment = departments.find((department) => department.id === params.deptId)

  if (!targetDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '대상 조직을 찾을 수 없습니다.')
  }

  const derivedScope = resolveOrgKpiScopeFromDepartmentId(params.deptId, departments)
  if (derivedScope !== params.requestedScope) {
    throw new AppError(
      400,
      'ORG_KPI_SCOPE_MISMATCH',
      getOrgKpiScopeMismatchMessage(params.requestedScope, 'select'),
    )
  }
}

export async function assertOrgKpiScopeMatchesDepartments(params: {
  requestedScope?: OrgKpiScope | null
  deptIds: string[]
  prismaClient?: PrismaClient | typeof prisma
}) {
  if (!params.requestedScope || !params.deptIds.length) {
    return
  }

  const prismaClient = params.prismaClient ?? prisma
  const departments = await loadDepartments(prismaClient)
  const departmentIds = new Set(departments.map((department) => department.id))

  for (const deptId of params.deptIds) {
    if (!departmentIds.has(deptId)) {
      throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '대상 조직을 찾을 수 없습니다.')
    }

    const derivedScope = resolveOrgKpiScopeFromDepartmentId(deptId, departments)
    if (derivedScope !== params.requestedScope) {
      throw new AppError(
        400,
        'ORG_KPI_SCOPE_MISMATCH',
        getOrgKpiScopeMismatchMessage(params.requestedScope, 'write'),
      )
    }
  }
}
