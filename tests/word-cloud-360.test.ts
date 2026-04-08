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
  validateWordCloudSubmitSelections,
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
      empName: 'Kim Admin',
      role: 'ROLE_MEMBER',
      department: {
        id: 'dept-1',
        deptName: 'People Ops',
        orgId: 'org-1',
        organization: { id: 'org-1', name: 'RSUPPORT' },
      },
    }))

  prismaAny.employee.findMany =
    overrides.employeeFindMany ??
    (async () => [
      {
        id: 'emp-1',
        empId: 'EMP-001',
        empName: 'Kim Admin',
        department: { deptName: 'People Ops' },
        managerId: null,
        status: 'ACTIVE',
      },
      {
        id: 'emp-2',
        empId: 'EMP-002',
        empName: 'Lee Member',
        department: { deptName: 'People Ops' },
        managerId: 'emp-1',
        status: 'ACTIVE',
      },
    ])

  prismaAny.evalCycle.findMany =
    overrides.evalCycleFindMany ??
    (async () => [
      {
        id: 'eval-2026',
        cycleName: '2026 상반기 평가',
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
      name: 'Kim Admin',
      role: 'ROLE_MEMBER',
      empId: 'EMP-001',
      deptId: 'dept-1',
      deptName: 'People Ops',
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

  await run('suggested assignments include self manager peer and subordinate without duplicates', () => {
    const suggestions = buildSuggestedWordCloudAssignments({
      cycleId: 'wc-cycle-1',
      includeSelf: true,
      peerLimit: 2,
      subordinateLimit: 2,
      employees: [
        { id: 'mgr-1', deptId: 'dept-a', managerId: null, status: 'ACTIVE' },
        { id: 'emp-1', deptId: 'dept-a', managerId: 'mgr-1', status: 'ACTIVE' },
        { id: 'emp-2', deptId: 'dept-a', managerId: 'mgr-1', status: 'ACTIVE' },
        { id: 'sub-1', deptId: 'dept-b', managerId: 'emp-1', status: 'ACTIVE' },
      ],
    })

    const keys = new Set(suggestions.map((item) => `${item.evaluatorId}:${item.evaluateeId}:${item.evaluatorGroup}`))
    assert.equal(keys.size, suggestions.length)
    assert.equal(keys.has('emp-1:emp-1:SELF'), true)
    assert.equal(keys.has('mgr-1:emp-1:MANAGER'), true)
    assert.equal(keys.has('emp-2:emp-1:PEER'), true)
    assert.equal(keys.has('sub-1:emp-1:SUBORDINATE'), true)
  })

  await run('aggregate summary counts only submitted responses and respects the privacy threshold', () => {
    const aggregate = aggregateWordCloudResponses({
      minimumResponses: 3,
      responses: [
        {
          status: 'SUBMITTED',
          evaluatorGroup: 'MANAGER',
          items: [
            {
              keywordId: 'p1',
              keywordTextSnapshot: '책임감 있음',
              polarity: 'POSITIVE',
              category: 'ATTITUDE',
              evaluatorGroup: 'MANAGER',
            },
            {
              keywordId: 'n1',
              keywordTextSnapshot: '책임 회피',
              polarity: 'NEGATIVE',
              category: 'ATTITUDE',
              evaluatorGroup: 'MANAGER',
            },
          ],
        },
        {
          status: 'DRAFT',
          evaluatorGroup: 'PEER',
          items: [
            {
              keywordId: 'p1',
              keywordTextSnapshot: '책임감 있음',
              polarity: 'POSITIVE',
              category: 'ATTITUDE',
              evaluatorGroup: 'PEER',
            },
          ],
        },
        {
          status: 'SUBMITTED',
          evaluatorGroup: 'PEER',
          items: [
            {
              keywordId: 'p1',
              keywordTextSnapshot: '책임감 있음',
              polarity: 'POSITIVE',
              category: 'ATTITUDE',
              evaluatorGroup: 'PEER',
            },
          ],
        },
      ],
    })

    assert.equal(aggregate.responseCount, 2)
    assert.equal(aggregate.thresholdMet, false)
    assert.equal(aggregate.positiveSelectionCount, 2)
    assert.equal(aggregate.negativeSelectionCount, 1)
    assert.equal(aggregate.positiveKeywords[0]?.keywordId, 'p1')
  })

  await run('selection validation still blocks duplicate keyword selections', () => {
    const invalid = validateWordCloudSubmitSelections({
      positiveKeywordIds: ['a', 'a'],
      negativeKeywordIds: ['n1'],
      positiveLimit: 10,
      negativeLimit: 10,
    })

    assert.equal(invalid.isValid, false)
    assert.equal(invalid.errors.some((message) => message.includes('중복')), true)
  })

  await run('selection validation allows final submit from 1+1 up to the configured max', () => {
    const minimum = validateWordCloudSubmitSelections({
      positiveKeywordIds: ['p1'],
      negativeKeywordIds: ['n1'],
      positiveLimit: 10,
      negativeLimit: 10,
    })
    const partial = validateWordCloudSubmitSelections({
      positiveKeywordIds: ['p1', 'p2', 'p3'],
      negativeKeywordIds: ['n1', 'n2'],
      positiveLimit: 10,
      negativeLimit: 10,
    })
    const maximum = validateWordCloudSubmitSelections({
      positiveKeywordIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'],
      negativeKeywordIds: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'],
      positiveLimit: 10,
      negativeLimit: 10,
    })

    assert.equal(minimum.isValid, true)
    assert.equal(partial.isValid, true)
    assert.equal(maximum.isValid, true)
  })

  await run('selection validation blocks final submit when either polarity is missing', () => {
    const missingPositive = validateWordCloudSubmitSelections({
      positiveKeywordIds: [],
      negativeKeywordIds: ['n1', 'n2', 'n3'],
      positiveLimit: 10,
      negativeLimit: 10,
    })
    const missingNegative = validateWordCloudSubmitSelections({
      positiveKeywordIds: ['p1', 'p2'],
      negativeKeywordIds: [],
      positiveLimit: 10,
      negativeLimit: 10,
    })
    const missingBoth = validateWordCloudSubmitSelections({
      positiveKeywordIds: [],
      negativeKeywordIds: [],
      positiveLimit: 10,
      negativeLimit: 10,
    })

    assert.equal(missingPositive.isValid, false)
    assert.equal(missingNegative.isValid, false)
    assert.equal(missingBoth.isValid, false)
    assert.equal(missingPositive.errors.some((message) => message.includes('각각 1개 이상')), true)
    assert.equal(missingNegative.errors.some((message) => message.includes('각각 1개 이상')), true)
    assert.equal(missingBoth.errors.some((message) => message.includes('각각 1개 이상')), true)
  })

  await run('selection validation keeps configured maximum selection limits', () => {
    const invalid = validateWordCloudSubmitSelections({
      positiveKeywordIds: ['p1', 'p2', 'p3', 'p4'],
      negativeKeywordIds: ['n1'],
      positiveLimit: 3,
      negativeLimit: 2,
    })

    assert.equal(invalid.isValid, false)
    assert.equal(invalid.errors.some((message) => message.includes('최대 3개까지')), true)
  })

  await run('admin create mode stays ready without requiring a selected cycle', async () => {
    await withStubbedWordCloudData(
      {
        employeeFindUnique: async () => ({
          id: 'admin-1',
          empId: 'ADM-001',
          empName: 'Admin User',
          role: 'ROLE_ADMIN',
          department: {
            id: 'dept-1',
            deptName: 'People Ops',
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
        assert.equal(Boolean(data.selectedCycleId), false)
        assert.equal(Boolean(data.summary), false)
        assert.equal(Boolean(data.adminView?.cycle), false)
        assert.equal(data.availableEvalCycles?.length, 1)
      }
    )
  })

  await run('existing cycle auto-selects the first option and loads summary only after selection exists', async () => {
    await withStubbedWordCloudData({}, async () => {
      const data = await getWordCloud360PageData({
        session: makeSession({ role: 'ROLE_ADMIN' }),
      })

      assert.equal(data.state, 'ready')
      assert.equal(data.availableCycles.length, 1)
      assert.equal(data.selectedCycleId, 'wc-cycle-1')
      assert.equal(Boolean(data.summary), true)
    })
  })

  await run('evaluator page loads assigned evaluatees and preserves draft selections', async () => {
    await withStubbedWordCloudData(
      {
        wordCloud360AssignmentFindMany: async () => [
          {
            id: 'assign-1',
            evaluateeId: 'emp-2',
            evaluatee: {
              empName: 'Lee Member',
              department: { deptName: 'People Ops' },
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
  const serverSource = readFileSync(path.resolve(process.cwd(), 'src/server/word-cloud-360.ts'), 'utf8')

  await run('client source separates create mode and uses the 1+1 minimum submit rule', () => {
    assert.equal(pageSource.includes('const isCreateMode = Boolean(data.permissions?.canManage && !hasSelectedCycle)'), true)
    assert.equal(pageSource.includes('const canSubmitFinal = positiveSelections.length >= 1 && negativeSelections.length >= 1'), true)
    assert.equal(pageSource.includes("disabled={isPending || selectedAssignment.responseStatus === 'SUBMITTED' || !canSubmitFinal}"), true)
    assert.equal(pageSource.includes('긍정 키워드와 부정 키워드는 각각 1개 이상 선택해 주세요.'), true)
    assert.equal(pageSource.includes('최대 선택 가능 개수는 운영 설정을 따릅니다.'), true)
  })

  await run('server source validates final submit with the minimum 1+1 helper', () => {
    assert.equal(serverSource.includes('validateWordCloudSubmitSelections'), true)
  })

  console.log('Word cloud 360 tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
