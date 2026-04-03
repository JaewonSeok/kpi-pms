import * as XLSX from 'xlsx'
import type { Session } from 'next-auth'
import { AppError } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { getPersonalKpiScopeDepartmentIds } from '@/lib/personal-kpi-access'
import { formatGoalApprovalStatus } from '@/lib/goal-display'

export type GoalExportMode = 'goal' | 'employee'

function getScopeDepartmentIds(session: Session) {
  return getPersonalKpiScopeDepartmentIds({
    role: session.user.role,
    deptId: session.user.deptId,
    accessibleDepartmentIds: session.user.accessibleDepartmentIds,
  })
}

export async function buildGoalExportWorkbook(params: {
  session: Session
  mode: GoalExportMode
  year: number
  departmentId?: string
}) {
  const scopeDepartmentIds = getScopeDepartmentIds(params.session)

  if (
    params.departmentId &&
    scopeDepartmentIds &&
    !scopeDepartmentIds.includes(params.departmentId)
  ) {
    throw new AppError(403, 'FORBIDDEN', '선택한 조직 범위의 목표를 다운로드할 권한이 없습니다.')
  }

  if (params.session.user.role === 'ROLE_MEMBER') {
    throw new AppError(403, 'FORBIDDEN', '목표 엑셀 다운로드는 리더 이상 권한이 필요합니다.')
  }

  if (params.mode === 'goal') {
    const goals = await prisma.orgKpi.findMany({
      where: {
        evalYear: params.year,
        ...(params.departmentId ? { deptId: params.departmentId } : {}),
        ...(scopeDepartmentIds ? { deptId: { in: scopeDepartmentIds } } : {}),
      },
      include: {
        department: {
          select: {
            deptName: true,
          },
        },
        parentOrgKpi: {
          select: {
            kpiName: true,
          },
        },
        personalKpis: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
    })

    const rows = goals.map((goal) => ({
      연도: goal.evalYear,
      담당조직: goal.department.deptName,
      목표명: goal.kpiName,
      상위목표: goal.parentOrgKpi?.kpiName ?? '',
      카테고리: goal.kpiCategory ?? '',
      상태: formatGoalApprovalStatus(goal.status),
      가중치: goal.weight,
      유형: goal.kpiType,
      승인된_개인목표_수: goal.personalKpis.filter((item) => item.status === 'CONFIRMED').length,
      연결된_개인목표_수: goal.personalKpis.length,
      태그: Array.isArray(goal.tags) ? goal.tags.join(', ') : '',
    }))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'goals')
    return {
      body: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
      fileName: `goals-${params.year}-goal.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  }

  const goals = await prisma.personalKpi.findMany({
    where: {
      evalYear: params.year,
      employee: scopeDepartmentIds
        ? {
            deptId: {
              in: params.departmentId ? [params.departmentId] : scopeDepartmentIds,
            },
          }
        : params.departmentId
          ? {
              deptId: params.departmentId,
            }
          : undefined,
    },
    include: {
      employee: {
        include: {
          department: {
            select: {
              deptName: true,
            },
          },
        },
      },
      linkedOrgKpi: {
        select: {
          kpiName: true,
          status: true,
        },
      },
      monthlyRecords: {
        orderBy: {
          yearMonth: 'desc',
        },
        take: 1,
      },
    },
    orderBy: [{ employee: { empName: 'asc' } }, { kpiName: 'asc' }],
  })

  const rows = goals.map((goal) => ({
    연도: goal.evalYear,
    구성원: goal.employee.empName,
    조직: goal.employee.department?.deptName ?? '',
    개인목표: goal.kpiName,
    연결조직목표: goal.linkedOrgKpi?.kpiName ?? '',
    승인상태: formatGoalApprovalStatus(goal.status),
    연결조직목표_승인상태: formatGoalApprovalStatus(goal.linkedOrgKpi?.status),
    가중치: goal.weight,
    최근진행률: goal.monthlyRecords[0]?.achievementRate ?? '',
    태그: Array.isArray(goal.tags) ? goal.tags.join(', ') : '',
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'employees')
  return {
    body: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
    fileName: `goals-${params.year}-employee.xlsx`,
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
}
