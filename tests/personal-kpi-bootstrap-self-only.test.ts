/* eslint-disable @typescript-eslint/no-require-imports */
import './setup-test-env'
import './register-path-aliases'
import assert from 'node:assert/strict'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function makeBootstrapMock(orgKpis: unknown[]) {
  const calls = { createMany: 0 }
  const mock = {
    orgKpi: {
      findMany: async () => orgKpis,
    },
    personalKpi: {
      findMany: async () => [],
      createMany: async () => {
        calls.createMany++
        return { count: orgKpis.length }
      },
    },
  }
  return { mock, calls }
}

import type { SystemRole, JobCategory } from '@prisma/client'

function makeEmployee(id: string, role: SystemRole, deptId: string) {
  return {
    id,
    empId: `E-${id}`,
    empName: '테스트',
    role,
    deptId,
    teamLeaderId: null as string | null,
    sectionChiefId: null as string | null,
    divisionHeadId: null as string | null,
    jobCategory: 'GENERAL' as JobCategory,
  }
}

function makeDeptsMap(deptId: string, leaderId: string | null = null) {
  return new Map([
    [
      deptId,
      {
        id: deptId,
        deptName: '팀1',
        parentDeptId: null as string | null,
        leaderEmployeeId: leaderId,
        deptCode: null as string | null,
      },
    ],
  ])
}

async function withMockedPrisma<T>(
  mock: Record<string, unknown>,
  fn: (mod: typeof import('../src/server/personal-kpi-page')) => T | Promise<T>
): Promise<T> {
  const prismaPath = require.resolve('@/lib/prisma')
  const pagePath = require.resolve('@/server/personal-kpi-page')

  const savedPrisma = require.cache[prismaPath]
  const savedPage = require.cache[pagePath]

  require.cache[prismaPath] = Object.assign(Object.create(null), {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: { prisma: mock },
    children: [] as NodeModule[],
    paths: [] as string[],
  }) as NodeModule

  delete require.cache[pagePath]
  const mod = require('@/server/personal-kpi-page') as typeof import('../src/server/personal-kpi-page')

  try {
    return await fn(mod)
  } finally {
    delete require.cache[pagePath]
    if (savedPrisma !== undefined) {
      require.cache[prismaPath] = savedPrisma
    } else {
      delete require.cache[prismaPath]
    }
    if (savedPage !== undefined) {
      require.cache[pagePath] = savedPage
    }
  }
}

const orgKpiFixture = [
  {
    id: 'org-kpi-1',
    deptId: 'dept-leader',
    evalYear: 2026,
    kpiType: 'QUANTITATIVE',
    kpiName: '매출 목표',
    definition: null,
    formula: null,
    targetValue: null,
    targetValueT: 100,
    targetValueE: null,
    targetValueS: null,
    weight: 40,
    difficulty: 'MEDIUM',
    status: 'CONFIRMED',
  },
]

async function main() {
  // ① 자기 자신 조회 + ROLE_TEAM_LEADER → createMany 호출됨
  await run('bootstrap self-only: self target + ROLE_TEAM_LEADER → createMany called', async () => {
    const { mock, calls } = makeBootstrapMock(orgKpiFixture)
    await withMockedPrisma(mock, (mod) =>
      mod.autoBootstrapLeadershipPersonalKpis({
        sessionUserId: 'emp-leader',
        targetEmployee: makeEmployee('emp-leader', 'ROLE_TEAM_LEADER', 'dept-leader'),
        departmentsById: makeDeptsMap('dept-leader'),
        selectedYear: 2026,
        goalEditLocked: false,
      })
    )
    assert.equal(calls.createMany, 1)
  })

  // ② 대행 조회 (admin이 다른 직원 열람) + ROLE_TEAM_LEADER → createMany 호출 안 됨
  await run('bootstrap self-only: proxy target + ROLE_TEAM_LEADER → createMany not called', async () => {
    const { mock, calls } = makeBootstrapMock(orgKpiFixture)
    await withMockedPrisma(mock, (mod) =>
      mod.autoBootstrapLeadershipPersonalKpis({
        sessionUserId: 'admin-user',
        targetEmployee: makeEmployee('emp-leader', 'ROLE_TEAM_LEADER', 'dept-leader'),
        departmentsById: makeDeptsMap('dept-leader'),
        selectedYear: 2026,
        goalEditLocked: false,
      })
    )
    assert.equal(calls.createMany, 0)
  })

  // ③ 자기 자신 조회 + ROLE_MEMBER (scope null) → createMany 호출 안 됨
  await run('bootstrap self-only: self target + ROLE_MEMBER (no scope) → createMany not called', async () => {
    const { mock, calls } = makeBootstrapMock(orgKpiFixture)
    await withMockedPrisma(mock, (mod) =>
      mod.autoBootstrapLeadershipPersonalKpis({
        sessionUserId: 'emp-member',
        targetEmployee: makeEmployee('emp-member', 'ROLE_MEMBER', 'dept-1'),
        departmentsById: makeDeptsMap('dept-1', 'other-leader'),
        selectedYear: 2026,
        goalEditLocked: false,
      })
    )
    assert.equal(calls.createMany, 0)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
