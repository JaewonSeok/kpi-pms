/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'

const moduleLoader = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string
}
const originalResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const {
  getPerformanceCalendarPageData,
} = require('../src/server/admin/performance-calendar') as typeof import('../src/server/admin/performance-calendar')

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function makeSession(role: string = 'ROLE_ADMIN') {
  return {
    user: {
      id: 'admin-1',
      email: role === 'ROLE_ADMIN' ? 'admin@rsupport.com' : 'member1@rsupport.com',
      role,
      deptId: 'dept-1',
      accessibleDepartmentIds: ['dept-1'],
      name: role === 'ROLE_ADMIN' ? '관리자' : '사용자',
    },
  }
}

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('performance calendar merges multiple event sources and milestone filters', async () => {
    const data = await getPerformanceCalendarPageData(
      makeSession(),
      {
        month: '2026-03',
        types: ['goal', 'anniversary', 'milestone'],
      },
      {
        loadEvalCycles: async () => [
          {
            id: 'cycle-1',
            cycleName: '2026 상반기',
            evalYear: 2026,
            kpiSetupStart: new Date('2026-03-03T00:00:00.000Z'),
            kpiSetupEnd: new Date('2026-03-12T00:00:00.000Z'),
            selfEvalStart: null,
            selfEvalEnd: null,
            firstEvalStart: null,
            firstEvalEnd: null,
            secondEvalStart: null,
            secondEvalEnd: null,
            finalEvalStart: null,
            finalEvalEnd: null,
            ceoAdjustStart: null,
            ceoAdjustEnd: null,
            resultOpenStart: null,
            resultOpenEnd: null,
            appealDeadline: null,
            performanceDesignConfig: {
              milestones: [
                {
                  id: 'milestone-goal',
                  key: 'GOAL_FINALIZED',
                  label: '목표 확정',
                  ownerRole: 'MANAGER',
                  startAt: '2026-03-09T00:00:00.000Z',
                  endAt: '2026-03-11T00:00:00.000Z',
                  description: '목표 확정 회의',
                },
              ],
            },
            organization: { name: 'RSUPPORT' },
          },
        ],
        loadFeedbackRounds: async () => [
          {
            id: 'round-1',
            roundName: '3월 360 피드백',
            roundType: 'PEER',
            startDate: new Date('2026-03-10T00:00:00.000Z'),
            endDate: new Date('2026-03-20T00:00:00.000Z'),
            status: 'IN_PROGRESS',
            evalCycle: {
              id: 'cycle-1',
              cycleName: '2026 상반기',
              organization: { name: 'RSUPPORT' },
            },
          },
        ],
        loadAiCompetencyCycles: async () => [
          {
            id: 'ai-cycle-1',
            cycleName: '2026 AI 평가',
            submissionOpenAt: new Date('2026-03-15T00:00:00.000Z'),
            submissionCloseAt: new Date('2026-03-18T00:00:00.000Z'),
            reviewOpenAt: null,
            reviewCloseAt: null,
            resultPublishAt: null,
            evalCycle: {
              id: 'cycle-1',
              cycleName: '2026 상반기',
              organization: { name: 'RSUPPORT' },
            },
          },
        ],
        loadEmployees: async () => [
          {
            id: 'emp-1',
            empName: '홍길동',
            joinDate: new Date('2022-03-21T00:00:00.000Z'),
            department: { deptName: '경영지원부' },
          },
        ],
      }
    )

    assert.equal(data.state, 'ready')
    assert.deepEqual(data.selectedTypes, ['goal', 'anniversary', 'milestone'])
    assert.equal(data.events.length, 3)
    assert.equal(data.events.some((item) => item.type === 'milestone'), true)
    assert.equal(data.filters.find((item) => item.type === 'survey')?.count, 1)
    assert.equal(data.summary.totalCount, 3)
    assert.equal(
      data.summary.nextUpcoming?.href === '/admin/eval-cycle' ||
        data.summary.nextUpcoming?.href === '/admin/performance-design',
      true
    )
  })

  await run('performance calendar tolerates one failing source and reports a degraded alert', async () => {
    const originalConsoleError = console.error
    console.error = () => undefined

    try {
      const data = await getPerformanceCalendarPageData(
        makeSession(),
        { month: '2026-03' },
        {
          loadEvalCycles: async () => [
            {
              id: 'cycle-1',
              cycleName: '2026 상반기',
              evalYear: 2026,
              kpiSetupStart: new Date('2026-03-03T00:00:00.000Z'),
              kpiSetupEnd: new Date('2026-03-12T00:00:00.000Z'),
              selfEvalStart: null,
              selfEvalEnd: null,
              firstEvalStart: null,
              firstEvalEnd: null,
              secondEvalStart: null,
              secondEvalEnd: null,
              finalEvalStart: null,
              finalEvalEnd: null,
              ceoAdjustStart: null,
              ceoAdjustEnd: null,
              resultOpenStart: null,
              resultOpenEnd: null,
              appealDeadline: null,
              performanceDesignConfig: null,
              organization: { name: 'RSUPPORT' },
            },
          ],
          loadFeedbackRounds: async () => {
            throw new Error('feedback source unavailable')
          },
          loadAiCompetencyCycles: async () => [],
          loadEmployees: async () => [],
        }
      )

      assert.equal(data.state, 'ready')
      assert.equal(data.events.length, 1)
      assert.equal(data.alerts.length, 1)
    } finally {
      console.error = originalConsoleError
    }
  })

  await run('performance calendar denies non-admin access without crashing', async () => {
    const data = await getPerformanceCalendarPageData(makeSession('ROLE_MEMBER'), { month: '2026-03' })

    assert.equal(data.state, 'permission-denied')
    assert.equal(data.events.length, 0)
    assert.equal(data.filters.length, 0)
  })

  await run('performance calendar route and client are wired into the admin IA', () => {
    const clientSource = read('src/components/admin/PerformanceCalendarClient.tsx')
    const dashboardSource = read('src/server/dashboard-page.ts')
    const navigationSource = read('src/lib/navigation.ts')
    const pageSource = read('src/app/(main)/admin/performance-calendar/page.tsx')

    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/(main)/admin/performance-calendar/page.tsx')), true)
    assert.equal(clientSource.includes('/admin/performance-calendar?'), true)
    assert.equal(clientSource.includes("milestone: 'border-slate-300"), true)
    assert.equal(dashboardSource.includes('/admin/performance-calendar'), true)
    assert.equal(navigationSource.includes('/admin/performance-calendar'), true)
    assert.equal(pageSource.includes("item === 'milestone'"), true)
  })

  console.log('Performance calendar tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
