import type { Session } from 'next-auth'
import type { DepartmentLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// M1-B2 / 서버 로더 — ADMIN 점수 입력 화면용 read-only data.
// 화면 라우팅 레벨에서 ROLE_ADMIN 게이트가 보장된다고 가정하고 권한 검증은 본 로더에서 안 한다
// (eval-cycles 등 기존 admin 로더 동일 패턴).

export type DepartmentScoreIntakePageCycle = {
  id: string
  cycleName: string
  evalYear: number
  status: string
}

// ★ Department.level enum을 levelTag로 alias — 기존 클라이언트의 `department.level: number`
// (parentDept depth) 와 이름 충돌을 막기 위함.
export type DepartmentScoreIntakePageDepartment = {
  id: string
  deptCode: string
  deptName: string
  parentDeptId: string | null
  levelTag: DepartmentLevel | null
}

export type DepartmentScoreIntakePageIntake = {
  deptId: string
  score: number
  note: string | null
  receivedAt: Date
  receivedById: string
}

export type DepartmentScoreIntakePageData = {
  cycles: DepartmentScoreIntakePageCycle[]
  selectedCycleId: string | null
  departments: DepartmentScoreIntakePageDepartment[]
  intakes: DepartmentScoreIntakePageIntake[]
}

export async function getDepartmentScoreIntakePageData(params: {
  session: Session
  evalCycleId?: string
}): Promise<DepartmentScoreIntakePageData> {
  void params.session // 권한 게이트는 페이지 레벨. 세션 인자는 향후 사용자별 필터 확장 대비.

  // 활성 cycle 후보: 2026 evalYear 또는 status != 'CLOSED'. evalYear desc → 최신 우선.
  const cycles = await prisma.evalCycle.findMany({
    where: {
      OR: [{ evalYear: 2026 }, { status: { not: 'CLOSED' } }],
    },
    select: {
      id: true,
      cycleName: true,
      evalYear: true,
      status: true,
    },
    orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
  })

  const selectedCycleId = params.evalCycleId ?? cycles[0]?.id ?? null

  const departmentsRaw = await prisma.department.findMany({
    select: {
      id: true,
      deptCode: true,
      deptName: true,
      parentDeptId: true,
      level: true, // DepartmentLevel?(enum) — 응답엔 levelTag로 alias
    },
    orderBy: [{ deptCode: 'asc' }],
  })

  const departments: DepartmentScoreIntakePageDepartment[] = departmentsRaw.map((row) => ({
    id: row.id,
    deptCode: row.deptCode,
    deptName: row.deptName,
    parentDeptId: row.parentDeptId,
    levelTag: row.level,
  }))

  const intakes: DepartmentScoreIntakePageIntake[] = selectedCycleId
    ? await prisma.departmentScoreIntake.findMany({
        where: { evalCycleId: selectedCycleId },
        select: {
          deptId: true,
          score: true,
          note: true,
          receivedAt: true,
          receivedById: true,
        },
      })
    : []

  return {
    cycles,
    selectedCycleId,
    departments,
    intakes,
  }
}
