/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'
import {
  aggregateWordCloudResponses,
  buildSuggestedWordCloudAssignments,
  validateWordCloudSelections,
} from '../src/lib/word-cloud-360'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import { flattenNavigationItems, filterNavigationItemsByRole, NAV_ITEMS } from '../src/lib/navigation'

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

const { getWordCloud360PageData } = require('../src/server/word-cloud-360') as typeof import('../src/server/word-cloud-360')

function hrefsForRole(role: string) {
  return flattenNavigationItems(filterNavigationItemsByRole(NAV_ITEMS, role)).map((item) => item.href)
}

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

type PrismaMethod = (...args: any[]) => any
type Snapshot = {
  employeeFindUnique: PrismaMethod
  employeeFindMany: PrismaMethod
  evalCycleFindMany: PrismaMethod
  wordCloud360CycleFindMany: PrismaMethod
  wordCloud360KeywordFindMany: PrismaMethod
  wordCloud360AssignmentFindMany: PrismaMethod
  wordCloud360ResponseFindMany: PrismaMethod
}

function captureSnapshot(): Snapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    wordCloud360CycleFindMany: prismaAny.wordCloud360Cycle.findMany,
    wordCloud360KeywordFindMany: prismaAny.wordCloud360Keyword.findMany,
    wordCloud360AssignmentFindMany: prismaAny.wordCloud360Assignment.findMany,
    wordCloud360ResponseFindMany: prismaAny.wordCloud360Response.findMany,
  }
}

function restoreSnapshot(snapshot: Snapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
  prismaAny.wordCloud360Cycle.findMany = snapshot.wordCloud360CycleFindMany
  prismaAny.wordCloud360Keyword.findMany = snapshot.wordCloud360KeywordFindMany
  prismaAny.wordCloud360Assignment.findMany = snapshot.wordCloud360AssignmentFindMany
  prismaAny.wordCloud360Response.findMany = snapshot.wordCloud360ResponseFindMany
}

async function withStubbedWordCloudData(
  overrides: Partial<Record<keyof Snapshot, PrismaMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async () => ({
      id: 'emp-1',
      empId: 'EMP-001',
      empName: '김담당',
      role: 'ROLE_MEMBER',
      department: {
        id: 'dept-1',
        deptName: '경영지원',
        orgId: 'org-1',
        organization: { id: 'org-1', name: 'RSUPPORT' },
      },
    }))

  prismaAny.employee.findMany =
    overrides.employeeFindMany ??
    (async () => [
      { id: 'emp-1', empId: 'EMP-001', empName: '김담당', department: { deptName: '경영지원' }, managerId: null, status: 'ACTIVE' },
      { id: 'emp-2', empId: 'EMP-002', empName: '이매니저', department: { deptName: '경영지원' }, managerId: null, status: 'ACTIVE' },
    ])

  prismaAny.evalCycle.findMany =
    overrides.evalCycleFindMany ??
    (async () => [
      {
        id: 'eval-2026',
        cycleName: '2026 평가',
        evalYear: 2026,
      },
    ])

  prismaAny.wordCloud360Cycle.findMany =
    overrides.wordCloud360CycleFindMany ??
    (async () => [
      {
        id: 'wc-cycle-1',
        orgId: 'org-1',
        evalCycleId: 'eval-2026',
        cycleName: '2026 상반기 워드클라우드',
        status: 'OPEN',
        startDate: null,
        endDate: null,
        positiveSelectionLimit: 10,
        negativeSelectionLimit: 10,
        resultPrivacyThreshold: 3,
        evaluatorGroups: ['MANAGER', 'PEER', 'SUBORDINATE'],
        publishedAt: null,
        notes: null,
        evalCycle: {
          id: 'eval-2026',
          evalYear: 2026,
        },
      },
    ])

  prismaAny.wordCloud360Keyword.findMany =
    overrides.wordCloud360KeywordFindMany ??
    (async () => [
      { id: 'p1', keyword: '책임감 있음', polarity: 'POSITIVE', category: 'ATTITUDE', warningFlag: false },
      { id: 'n1', keyword: '책임 회피', polarity: 'NEGATIVE', category: 'ATTITUDE', warningFlag: false },
    ])

  prismaAny.wordCloud360Assignment.findMany =
    overrides.wordCloud360AssignmentFindMany ??
    (async () => [])

  prismaAny.wordCloud360Response.findMany =
    overrides.wordCloud360ResponseFindMany ??
    (async () => [])

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

function makeSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'emp-1',
      email: 'emp-1@company.test',
      name: '김담당',
      role: 'ROLE_MEMBER',
      empId: 'EMP-001',
      deptId: 'dept-1',
      deptName: '경영지원',
      ...overrides,
    },
  } as any
}

async function main() {
  await run('word cloud route is registered in navigation and permission resolver', () => {
    assert.equal(resolveMenuFromPath('/evaluation/word-cloud-360'), 'WORD_CLOUD_360')
    assert.equal(hrefsForRole('ROLE_MEMBER').includes('/evaluation/word-cloud-360'), true)
    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/(main)/evaluation/word-cloud-360/page.tsx')), true)
    assert.equal(
      existsSync(path.resolve(process.cwd(), 'src/app/api/evaluation/word-cloud-360/actions/route.ts')),
      true
    )
  })

  await run('selection validation enforces exact 10+10 and blocks duplicates', () => {
    const invalid = validateWordCloudSelections({
      positiveKeywordIds: ['a', 'a'],
      negativeKeywordIds: ['n1'],
      positiveLimit: 10,
      negativeLimit: 10,
    })

    assert.equal(invalid.isValid, false)
    assert.equal(invalid.errors.some((message) => message.includes('중복')), true)
    assert.equal(invalid.errors.some((message) => message.includes('정확히 10개')), true)
  })

  await run('suggested assignments include manager, peer, subordinate, and stay unique', () => {
    const assignments = buildSuggestedWordCloudAssignments({
      cycleId: 'cycle-1',
      includeSelf: true,
      peerLimit: 2,
      subordinateLimit: 2,
      employees: [
        { id: 'mgr', deptId: 'dept-1', managerId: null, status: 'ACTIVE' },
        { id: 'emp-a', deptId: 'dept-1', managerId: 'mgr', status: 'ACTIVE' },
        { id: 'emp-b', deptId: 'dept-1', managerId: 'mgr', status: 'ACTIVE' },
      ],
    })

    assert.equal(assignments.some((item) => item.evaluateeId === 'emp-a' && item.evaluatorId === 'mgr' && item.evaluatorGroup === 'MANAGER'), true)
    assert.equal(assignments.some((item) => item.evaluateeId === 'mgr' && item.evaluatorId === 'emp-a' && item.evaluatorGroup === 'SUBORDINATE'), true)
    assert.equal(assignments.some((item) => item.evaluateeId === 'emp-a' && item.evaluatorGroup === 'SELF'), true)
    assert.equal(new Set(assignments.map((item) => `${item.evaluatorId}:${item.evaluateeId}:${item.evaluatorGroup}`)).size, assignments.length)
  })

  await run('aggregation returns positive and negative word cloud data without numeric score coercion', () => {
    const aggregated = aggregateWordCloudResponses({
      minimumResponses: 2,
      responses: [
        {
          status: 'SUBMITTED',
          evaluatorGroup: 'PEER',
          items: [
            { keywordId: 'p1', keywordTextSnapshot: '책임감 있음', polarity: 'POSITIVE', category: 'ATTITUDE', evaluatorGroup: 'PEER' },
            { keywordId: 'n1', keywordTextSnapshot: '책임 회피', polarity: 'NEGATIVE', category: 'ATTITUDE', evaluatorGroup: 'PEER' },
          ],
        },
        {
          status: 'SUBMITTED',
          evaluatorGroup: 'MANAGER',
          items: [
            { keywordId: 'p1', keywordTextSnapshot: '책임감 있음', polarity: 'POSITIVE', category: 'ATTITUDE', evaluatorGroup: 'MANAGER' },
            { keywordId: 'p2', keywordTextSnapshot: '협업적임', polarity: 'POSITIVE', category: 'ATTITUDE', evaluatorGroup: 'MANAGER' },
          ],
        },
      ],
    })

    assert.equal(aggregated.thresholdMet, true)
    assert.equal(aggregated.positiveKeywords[0]?.keyword, '책임감 있음')
    assert.equal(aggregated.positiveKeywords[0]?.count, 2)
    assert.equal(aggregated.negativeKeywords[0]?.keyword, '책임 회피')
  })

  await run('admin page with no cycle shows setup-ready state instead of broken placeholder', async () => {
    await withStubbedWordCloudData(
      {
        employeeFindUnique: async () => ({
          id: 'admin-1',
          empId: 'ADM-001',
          empName: '관리자',
          role: 'ROLE_ADMIN',
          department: {
            id: 'dept-1',
            deptName: '경영지원',
            orgId: 'org-1',
            organization: { id: 'org-1', name: 'RSUPPORT' },
          },
        }),
        wordCloud360CycleFindMany: async () => [],
      },
      async () => {
        const data = await getWordCloud360PageData({
          session: makeSession({ role: 'ROLE_ADMIN' }),
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.permissions?.canManage, true)
        assert.equal(data.availableEvalCycles?.length, 1)
      }
    )
  })

  await run('evaluatee results stay hidden when publication threshold is not met', async () => {
    await withStubbedWordCloudData(
      {
        wordCloud360ResponseFindMany: async () => [
          {
            id: 'resp-1',
            status: 'SUBMITTED',
            items: [
              { keywordId: 'p1', keywordTextSnapshot: '책임감 있음', polarity: 'POSITIVE', category: 'ATTITUDE', evaluatorGroup: 'PEER' },
            ],
          },
        ],
      },
      async () => {
        const data = await getWordCloud360PageData({
          session: makeSession(),
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.evaluateeView?.resultVisible, false)
        assert.equal(Boolean(data.evaluateeView?.hiddenReason), true)
        assert.equal(Object.keys(data.evaluateeView ?? {}).includes('evaluatorNames'), false)
      }
    )
  })

  await run('evaluator page loads assigned evaluatees and preserves draft selections', async () => {
    await withStubbedWordCloudData(
      {
        wordCloud360AssignmentFindMany: async () => [
          {
            id: 'assign-1',
            evaluateeId: 'emp-2',
            evaluatee: {
              empName: '이동료',
              department: { deptName: '경영지원' },
            },
            evaluatorGroup: 'PEER',
            status: 'IN_PROGRESS',
            submittedAt: null,
            response: {
              status: 'DRAFT',
              submittedAt: null,
              items: [
                { keywordId: 'p1', polarity: 'POSITIVE' },
                { keywordId: 'n1', polarity: 'NEGATIVE' },
              ],
            },
          },
        ],
      },
      async () => {
        const data = await getWordCloud360PageData({
          session: makeSession(),
        })

        assert.equal(data.permissions?.canEvaluate, true)
        assert.equal(data.evaluatorView?.assignments.length, 1)
        assert.deepEqual(data.evaluatorView?.assignments[0]?.selectedPositiveKeywordIds, ['p1'])
        assert.deepEqual(data.evaluatorView?.assignments[0]?.selectedNegativeKeywordIds, ['n1'])
      }
    )
  })

  const pageSource = readFileSync(path.resolve(process.cwd(), 'src/components/evaluation/wordcloud360/WordCloud360WorkspaceClient.tsx'), 'utf8')
  await run('client page renders real workflow tabs and removes score-form-only behavior', () => {
    assert.equal(pageSource.includes('워드클라우드형 다면평가'), true)
    assert.equal(pageSource.includes('점수형 다면평가와 분리된 키워드 선택 기반 평가'), true)
    assert.equal(pageSource.includes('긍정 워드클라우드'), true)
    assert.equal(pageSource.includes('부정 워드클라우드'), true)
  })

  console.log('Word cloud 360 tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
