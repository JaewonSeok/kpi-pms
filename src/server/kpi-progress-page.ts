import type { Session } from 'next-auth'
import type { JobCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SELF_MANAGED_DIVISION_IDS } from '@/config/evaluation-scope'

export type KpiProgressPageState = 'ready' | 'empty' | 'permission-denied'

export type KpiProgressSummary = {
  targetCount: number
  completedCount: number
  remainingCount: number
  completionRate: number
}

export type KpiProgressTrack = {
  jobCategory: JobCategory
  notStartedCount: number
  inProgressCount: number
}

export type KpiProgressDepartment = {
  deptName: string
  remainingCount: number
}

export type KpiProgressPageData = {
  state: KpiProgressPageState
  summary: KpiProgressSummary
  tracks: KpiProgressTrack[]
  departments: KpiProgressDepartment[]
}

type EmployeeKpiStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

function classifyEmployee(rowCount: number, weightSum: number): EmployeeKpiStatus {
  if (rowCount === 0) return 'NOT_STARTED'
  if (Math.round(weightSum) === 100) return 'COMPLETED'
  return 'IN_PROGRESS'
}

const EMPTY_DATA: KpiProgressPageData = {
  state: 'empty',
  summary: { targetCount: 0, completedCount: 0, remainingCount: 0, completionRate: 0 },
  tracks: [],
  departments: [],
}

export async function getKpiProgressPageData(session: Session): Promise<KpiProgressPageData> {
  if (session.user.role !== 'ROLE_ADMIN') {
    return { ...EMPTY_DATA, state: 'permission-denied' }
  }

  // 직계 1단계만. 재귀 유틸을 새로 만들지 않는다.
  // 연구개발본부 직계 자식 16 · 손자 0 (2026-08-07 실측)
  const allDepartments = await prisma.department.findMany({
    select: { id: true, parentDeptId: true },
  })
  const directChildren = allDepartments
    .filter((d) => d.parentDeptId !== null && SELF_MANAGED_DIVISION_IDS.includes(d.parentDeptId))
    .map((d) => d.id)
  const excludedDeptIds = [...SELF_MANAGED_DIVISION_IDS, ...directChildren]

  const employees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      jobTitle: '팀원',
      deptId: { notIn: excludedDeptIds },
    },
    select: {
      id: true,
      jobCategory: true,
      department: { select: { deptName: true } },
      personalKpis: {
        where: {
          evalYear: 2026,
          status: { in: ['DRAFT', 'CONFIRMED'] },
        },
        select: { weight: true },
      },
    },
  })

  if (employees.length === 0) return EMPTY_DATA

  const trackMap = new Map<JobCategory, { notStartedCount: number; inProgressCount: number }>()
  const deptMap = new Map<string, number>()
  let completedCount = 0

  for (const employee of employees) {
    const rowCount = employee.personalKpis.length
    const weightSum = employee.personalKpis.reduce((sum, kpi) => sum + kpi.weight, 0)
    const kpiStatus = classifyEmployee(rowCount, weightSum)
    const deptName = employee.department.deptName

    if (kpiStatus === 'COMPLETED') {
      completedCount += 1
    } else {
      const track = trackMap.get(employee.jobCategory) ?? { notStartedCount: 0, inProgressCount: 0 }
      if (kpiStatus === 'NOT_STARTED') {
        track.notStartedCount += 1
      } else {
        track.inProgressCount += 1
      }
      trackMap.set(employee.jobCategory, track)

      deptMap.set(deptName, (deptMap.get(deptName) ?? 0) + 1)
    }
  }

  const targetCount = employees.length
  const remainingCount = targetCount - completedCount
  const completionRate = targetCount ? Math.round((completedCount / targetCount) * 100) : 0

  const tracks: KpiProgressTrack[] = Array.from(trackMap.entries())
    .map(([jobCategory, counts]) => ({ jobCategory, ...counts }))
    .sort((a, b) => (b.notStartedCount + b.inProgressCount) - (a.notStartedCount + a.inProgressCount))

  const departments: KpiProgressDepartment[] = Array.from(deptMap.entries())
    .map(([deptName, remainingCount]) => ({ deptName, remainingCount }))
    .sort((a, b) => b.remainingCount - a.remainingCount)

  return { state: 'ready', summary: { targetCount, completedCount, remainingCount, completionRate }, tracks, departments }
}
