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

function makeCycle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cycle-2026',
    cycleName: '2026 상반기',
    evalYear: 2026,
    kpiSetupStart: new Date('2026-03-03T00:00:00.000Z'),
    kpiSetupEnd: new Date('2026-03-12T00:00:00.000Z'),
    selfEvalStart: new Date('2026-11-01T00:00:00.000Z'),
    selfEvalEnd: new Date('2026-11-15T00:00:00.000Z'),
    firstEvalStart: null,
    firstEvalEnd: null,
    secondEvalStart: null,
    secondEvalEnd: null,
    finalEvalStart: new Date('2026-12-01T00:00:00.000Z'),
    finalEvalEnd: new Date('2026-12-15T00:00:00.000Z'),
    ceoAdjustStart: null,
    ceoAdjustEnd: null,
    resultOpenStart: null,
    resultOpenEnd: null,
    appealDeadline: null,
    performanceDesignConfig: {
      policy2026OfficialReadinessEnabled: true,
      milestones: [],
    },
    organization: { name: 'RSUPPORT' },
    ...overrides,
  }
}

function makeReadiness(overrides: Record<string, unknown> = {}) {
  return {
    mboSetupCoverage: {
      employeesMissingAnyPersonalKpiCount: 0,
    },
    employeesMissingConfirmedPersonalKpiCount: 0,
    policyCategoryMissingCount: 0,
    teamKpiHrReviewCoverage: {
      pendingReviewCount: 0,
      needsDiscussionCount: 0,
    },
    gradePolicyReadiness: {
      blockers: [],
    },
    ...overrides,
  } as any
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

  await run('2026 operations checklist renders PPT milestones and current actions from readiness blockers', async () => {
    const data = await getPerformanceCalendarPageData(
      makeSession(),
      { month: '2026-07', today: '2026-07-28' },
      {
        loadEvalCycles: async () => [makeCycle()],
        loadFeedbackRounds: async () => [],
        loadAiCompetencyCycles: async () => [],
        loadEmployees: async () => [],
        loadReadinessPopulationDryRun: async () =>
          makeReadiness({
            mboSetupCoverage: {
              employeesMissingAnyPersonalKpiCount: 12,
            },
            employeesMissingConfirmedPersonalKpiCount: 8,
          }),
        loadAssignmentCoverage: async () => ({
          assignmentCount: 0,
          targetCount: 0,
          evaluatorCount: 0,
        }),
        loadAiCompetencyReadiness: async () => ({
          cycleExists: true,
          targetCount: 3,
          missingSubmissionCount: 2,
          needsRevisionCount: 0,
          pendingReviewCount: 1,
          passedCount: 0,
          failedCount: 0,
        }),
      }
    )

    assert.equal(data.operationsChecklist.mode, 'read_only')
    assert.equal(data.operationsChecklist.milestones.length, 13)
    assert.equal(data.operationsChecklist.selectedCycleIsOfficialReadinessTarget, true)
    assert.equal(data.operationsChecklist.schedule.referenceDate, '2026-07-28')
    assert.equal(data.operationsChecklist.milestones.some((item) => item.name === '팀원 업적목표 수립 및 확정'), true)
    assert.equal(data.operationsChecklist.milestones.some((item) => item.name === 'AI 사례 준비 및 축적'), true)
    assert.equal(data.operationsChecklist.milestones.find((item) => item.id === 'mid-review-feedback')?.scheduleStatus, 'ACTIVE')
    assert.equal(data.operationsChecklist.milestones.find((item) => item.id === 'goal-change-request')?.scheduleStatus, 'ACTIVE')
    assert.equal(data.operationsChecklist.milestones.find((item) => item.id === 'performance-result-writing')?.plannedRangeLabel, '2027.01.04 ~ 2027.01.08')
    assert.equal(data.operationsChecklist.milestones.find((item) => item.id === 'org-evaluation-close')?.plannedRangeLabel, '2027.01.11 ~ 2027.01.30')
    assert.equal(data.operationsChecklist.summary.scheduleStatusCounts.ACTIVE >= 2, true)
    assert.equal(data.operationsChecklist.nowActions.some((item) => item.label === 'MBO 미작성자 확인'), true)
    assert.equal(data.operationsChecklist.safety.officialScoringEnabled, false)
    assert.equal(data.operationsChecklist.safety.officialGradeEnabled, false)
    assert.equal(data.operationsChecklist.safety.totalScoreChanged, false)
    assert.equal(data.operationsChecklist.safety.gradeIdChanged, false)
  })

  await run('2026 operations checklist surfaces team KPI, grade policy, AI, and assignment blockers', async () => {
    const data = await getPerformanceCalendarPageData(
      makeSession(),
      { month: '2026-03' },
      {
        loadEvalCycles: async () => [makeCycle()],
        loadFeedbackRounds: async () => [],
        loadAiCompetencyCycles: async () => [],
        loadEmployees: async () => [],
        loadReadinessPopulationDryRun: async () =>
          makeReadiness({
            policyCategoryMissingCount: 5,
            teamKpiHrReviewCoverage: {
              pendingReviewCount: 2,
              needsDiscussionCount: 1,
            },
            gradePolicyReadiness: {
              blockers: [
                {
                  code: 'TEAM_MEMBER_SALES_THRESHOLD_AMBIGUITY',
                  message: 'HR 확인 필요',
                },
              ],
            },
          }),
        loadAssignmentCoverage: async () => ({
          assignmentCount: 0,
          targetCount: 0,
          evaluatorCount: 0,
        }),
        loadAiCompetencyReadiness: async () => ({
          cycleExists: false,
          targetCount: 0,
          missingSubmissionCount: 0,
          needsRevisionCount: 0,
          pendingReviewCount: 0,
          passedCount: 0,
          failedCount: 0,
        }),
      }
    )

    const byId = new Map(data.operationsChecklist.milestones.map((item) => [item.id, item]))
    assert.equal(byId.get('team-kpi-finalization')?.status, 'BLOCKED')
    assert.equal(byId.get('org-evaluation-close')?.status, 'BLOCKED')
    assert.equal(byId.get('ai-competency-submission')?.status, 'BLOCKED')
    assert.equal(byId.get('performance-result-writing')?.status, 'BLOCKED')
    assert.equal(data.operationsChecklist.nowActions.some((item) => item.label === '팀 KPI 검토 완료'), true)
    assert.equal(data.operationsChecklist.nowActions.some((item) => item.label === '등급 기준 HR 확인'), true)
    assert.equal(data.operationsChecklist.nowActions.some((item) => item.label === 'AI 활용평가 대상자 배정'), true)
    assert.equal(data.operationsChecklist.nowActions.some((item) => item.label === '평가자 배정 확인'), true)
  })

  await run('performance calendar denies non-admin access without crashing', async () => {
    const data = await getPerformanceCalendarPageData(makeSession('ROLE_MEMBER'), { month: '2026-03' })

    assert.equal(data.state, 'permission-denied')
    assert.equal(data.events.length, 0)
    assert.equal(data.filters.length, 0)
    assert.equal(data.operationsChecklist.milestones.length, 0)
  })

  await run('performance calendar route and client are wired into the admin IA', () => {
    const clientSource = read('src/components/admin/PerformanceCalendarClient.tsx')
    const dashboardSource = read('src/server/dashboard-page.ts')
    const navigationSource = read('src/lib/navigation.ts')
    const pageSource = read('src/app/(main)/admin/performance-calendar/page.tsx')

    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/(main)/admin/performance-calendar/page.tsx')), true)
    assert.equal(clientSource.includes('/admin/performance-calendar?'), true)
    assert.equal(clientSource.includes("milestone: 'border-slate-300"), true)
    assert.equal(clientSource.includes('2026 운영 체크리스트'), true)
    assert.equal(clientSource.includes('지금 해야 할 일'), true)
    assert.equal(clientSource.includes('2026 schedule gate readiness'), true)
    assert.equal(clientSource.includes('SCHEDULE_STATUS_FILTER_LABELS'), true)
    assert.equal(clientSource.includes('NEEDS_SETUP'), true)
    assert.equal(clientSource.includes('아직 공식 점수/등급 미적용'), true)
    assert.equal(clientSource.includes('OWNER_FILTER_LABELS'), true)
    assert.equal(clientSource.includes('STATUS_FILTER_LABELS'), true)
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
