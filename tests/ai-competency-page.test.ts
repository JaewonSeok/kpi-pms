/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'

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

const { getAiCompetencyPageData } = require('../src/server/ai-competency') as typeof import('../src/server/ai-competency')

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
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

type PrismaDelegateMethod = (...args: any[]) => any

type AiCompetencyPrismaSnapshot = {
  employeeFindUnique: PrismaDelegateMethod
  employeeFindMany: PrismaDelegateMethod
  departmentFindMany: PrismaDelegateMethod
  evalCycleFindMany: PrismaDelegateMethod
  aiCompetencyCycleFindMany: PrismaDelegateMethod
  aiCompetencyExternalCertMasterCount: PrismaDelegateMethod
  aiCompetencyExternalCertMasterFindMany: PrismaDelegateMethod
  aiCompetencyExternalCertMasterCreateMany: PrismaDelegateMethod
  aiCompetencyAssignmentFindMany: PrismaDelegateMethod
  aiCompetencyAssignmentCount: PrismaDelegateMethod
  aiCompetencyQuestionFindMany: PrismaDelegateMethod
  aiCompetencySubmissionReviewFindMany: PrismaDelegateMethod
  aiCompetencyAttemptCount: PrismaDelegateMethod
  aiCompetencySecondRoundSubmissionCount: PrismaDelegateMethod
  aiCompetencyResultCount: PrismaDelegateMethod
  aiCompetencyExamBlueprintFindMany: PrismaDelegateMethod
  aiCompetencyReviewRubricFindMany: PrismaDelegateMethod
  aiCompetencyAnswerFindMany: PrismaDelegateMethod
}

function captureSnapshot(): AiCompetencyPrismaSnapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    departmentFindMany: prismaAny.department.findMany,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    aiCompetencyCycleFindMany: prismaAny.aiCompetencyCycle.findMany,
    aiCompetencyExternalCertMasterCount: prismaAny.aiCompetencyExternalCertMaster.count,
    aiCompetencyExternalCertMasterFindMany: prismaAny.aiCompetencyExternalCertMaster.findMany,
    aiCompetencyExternalCertMasterCreateMany: prismaAny.aiCompetencyExternalCertMaster.createMany,
    aiCompetencyAssignmentFindMany: prismaAny.aiCompetencyAssignment.findMany,
    aiCompetencyAssignmentCount: prismaAny.aiCompetencyAssignment.count,
    aiCompetencyQuestionFindMany: prismaAny.aiCompetencyQuestion.findMany,
    aiCompetencySubmissionReviewFindMany: prismaAny.aiCompetencySubmissionReview.findMany,
    aiCompetencyAttemptCount: prismaAny.aiCompetencyAttempt.count,
    aiCompetencySecondRoundSubmissionCount: prismaAny.aiCompetencySecondRoundSubmission.count,
    aiCompetencyResultCount: prismaAny.aiCompetencyResult.count,
    aiCompetencyExamBlueprintFindMany: prismaAny.aiCompetencyExamBlueprint.findMany,
    aiCompetencyReviewRubricFindMany: prismaAny.aiCompetencyReviewRubric.findMany,
    aiCompetencyAnswerFindMany: prismaAny.aiCompetencyAnswer.findMany,
  }
}

function restoreSnapshot(snapshot: AiCompetencyPrismaSnapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.department.findMany = snapshot.departmentFindMany
  prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
  prismaAny.aiCompetencyCycle.findMany = snapshot.aiCompetencyCycleFindMany
  prismaAny.aiCompetencyExternalCertMaster.count = snapshot.aiCompetencyExternalCertMasterCount
  prismaAny.aiCompetencyExternalCertMaster.findMany = snapshot.aiCompetencyExternalCertMasterFindMany
  prismaAny.aiCompetencyExternalCertMaster.createMany = snapshot.aiCompetencyExternalCertMasterCreateMany
  prismaAny.aiCompetencyAssignment.findMany = snapshot.aiCompetencyAssignmentFindMany
  prismaAny.aiCompetencyAssignment.count = snapshot.aiCompetencyAssignmentCount
  prismaAny.aiCompetencyQuestion.findMany = snapshot.aiCompetencyQuestionFindMany
  prismaAny.aiCompetencySubmissionReview.findMany = snapshot.aiCompetencySubmissionReviewFindMany
  prismaAny.aiCompetencyAttempt.count = snapshot.aiCompetencyAttemptCount
  prismaAny.aiCompetencySecondRoundSubmission.count = snapshot.aiCompetencySecondRoundSubmissionCount
  prismaAny.aiCompetencyResult.count = snapshot.aiCompetencyResultCount
  prismaAny.aiCompetencyExamBlueprint.findMany = snapshot.aiCompetencyExamBlueprintFindMany
  prismaAny.aiCompetencyReviewRubric.findMany = snapshot.aiCompetencyReviewRubricFindMany
  prismaAny.aiCompetencyAnswer.findMany = snapshot.aiCompetencyAnswerFindMany
}

async function withStubbedAiCompetencyData(
  overrides: Partial<Record<keyof AiCompetencyPrismaSnapshot, PrismaDelegateMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async () => ({
      id: 'emp-1',
      empId: 'EMP-001',
      empName: '홍길동',
      role: 'ROLE_MEMBER',
      department: {
        id: 'dept-1',
        deptName: '경영지원',
        orgId: 'org-1',
        organization: {
          id: 'org-1',
          name: 'RSUPPORT',
        },
      },
    }))

  prismaAny.employee.findMany = overrides.employeeFindMany ?? (async () => [])
  prismaAny.department.findMany = overrides.departmentFindMany ?? (async () => [{ id: 'dept-1' }])
  prismaAny.evalCycle.findMany =
    overrides.evalCycleFindMany ??
    (async () => [
      {
        id: 'eval-2026',
        cycleName: '2026 AI 평가',
        evalYear: 2026,
        organization: { name: 'RSUPPORT' },
        aiCompetencyCycle: { id: 'ai-cycle-1' },
      },
    ])
  prismaAny.aiCompetencyCycle.findMany =
    overrides.aiCompetencyCycleFindMany ??
    (async () => [
      {
        id: 'ai-cycle-1',
        evalCycleId: 'eval-2026',
        cycleName: '2026 AI 활용능력 평가',
        status: 'PUBLISHED',
        firstRoundPassThreshold: 70,
        secondRoundBonusCap: 10,
        scoreCap: 100,
        timeLimitMinutes: 60,
        randomizeQuestions: true,
        companyEmailDomain: 'company.test',
        firstRoundOpenAt: null,
        firstRoundCloseAt: null,
        secondRoundApplyOpenAt: null,
        secondRoundApplyCloseAt: null,
        reviewOpenAt: null,
        reviewCloseAt: null,
        calibrationOpenAt: null,
        calibrationCloseAt: null,
        resultPublishAt: null,
        artifactMinCount: 2,
        artifactMaxCount: 3,
        policyAcknowledgementText: '정책 숙지',
        evalCycle: {
          id: 'eval-2026',
          evalYear: 2026,
          orgId: 'org-1',
        },
      },
    ])
  prismaAny.aiCompetencyExternalCertMaster.count = overrides.aiCompetencyExternalCertMasterCount ?? (async () => 1)
  prismaAny.aiCompetencyExternalCertMaster.findMany =
    overrides.aiCompetencyExternalCertMasterFindMany ??
    (async () => [
      {
        id: 'cert-1',
        name: 'AWS Certified AI Practitioner',
        vendor: 'AWS',
        mappedScore: 85,
        validityMonths: 36,
        requiresPolicyAcknowledgement: true,
      },
    ])
  prismaAny.aiCompetencyExternalCertMaster.createMany =
    overrides.aiCompetencyExternalCertMasterCreateMany ?? (async () => ({ count: 0 }))
  prismaAny.aiCompetencyAssignment.findMany = overrides.aiCompetencyAssignmentFindMany ?? (async () => [])
  prismaAny.aiCompetencyAssignment.count = overrides.aiCompetencyAssignmentCount ?? (async () => 0)
  prismaAny.aiCompetencyQuestion.findMany = overrides.aiCompetencyQuestionFindMany ?? (async () => [])
  prismaAny.aiCompetencySubmissionReview.findMany =
    overrides.aiCompetencySubmissionReviewFindMany ?? (async () => [])
  prismaAny.aiCompetencyAttempt.count = overrides.aiCompetencyAttemptCount ?? (async () => 0)
  prismaAny.aiCompetencySecondRoundSubmission.count =
    overrides.aiCompetencySecondRoundSubmissionCount ?? (async () => 0)
  prismaAny.aiCompetencyResult.count = overrides.aiCompetencyResultCount ?? (async () => 0)
  prismaAny.aiCompetencyExamBlueprint.findMany = overrides.aiCompetencyExamBlueprintFindMany ?? (async () => [])
  prismaAny.aiCompetencyReviewRubric.findMany = overrides.aiCompetencyReviewRubricFindMany ?? (async () => [])
  prismaAny.aiCompetencyAnswer.findMany = overrides.aiCompetencyAnswerFindMany ?? (async () => [])

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
      name: '홍길동',
      role: 'ROLE_MEMBER',
      empId: 'EMP-001',
      deptId: 'dept-1',
      deptName: '경영지원',
      ...overrides,
    },
  } as any
}

async function main() {
  await run('admin without active AI cycle gets a real setup state instead of the broken placeholder', async () => {
    await withStubbedAiCompetencyData(
      {
        aiCompetencyCycleFindMany: async () => [],
      },
      async () => {
        const data = await getAiCompetencyPageData({
          session: makeSession({ role: 'ROLE_ADMIN' }),
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.permissions?.canManageCycles, true)
        assert.equal(data.availableEvalCycles?.length, 1)
        assert.equal(data.adminView?.assignments.length, 0)
      }
    )
  })

  await run('employee page no longer loads reviewer or admin-only datasets when the user is not allowed to use them', async () => {
    let reviewerQueryCount = 0
    let blueprintQueryCount = 0
    let rubricQueryCount = 0

    await withStubbedAiCompetencyData(
      {
        aiCompetencySubmissionReviewFindMany: async () => {
          reviewerQueryCount += 1
          throw new Error('review queue should not load for members')
        },
        aiCompetencyExamBlueprintFindMany: async () => {
          blueprintQueryCount += 1
          throw new Error('blueprint admin library should not load for members')
        },
        aiCompetencyReviewRubricFindMany: async () => {
          rubricQueryCount += 1
          throw new Error('rubric admin library should not load for members')
        },
      },
      async () => {
        const data = await getAiCompetencyPageData({
          session: makeSession({ role: 'ROLE_MEMBER' }),
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.employeeView?.questions.length, 0)
        assert.equal(data.reviewerView, undefined)
        assert.equal(reviewerQueryCount, 0)
        assert.equal(blueprintQueryCount, 0)
        assert.equal(rubricQueryCount, 0)
      }
    )
  })

  await run('review queue failure only degrades the reviewer section and keeps the page renderable', async () => {
    await withStubbedAiCompetencyData(
      {
        aiCompetencySubmissionReviewFindMany: async () => {
          throw new Error('review queue unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getAiCompetencyPageData({
            session: makeSession({ role: 'ROLE_TEAM_LEADER' }),
          })

          assert.equal(data.state, 'ready')
          assert.equal(data.reviewerView?.queue.length, 0)
          assert.equal(data.alerts?.some((item) => item.title === '심사 대기 목록을 불러오지 못했습니다.'), true)
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('admin blueprint and rubric failures degrade to alerts instead of the global broken placeholder', async () => {
    await withStubbedAiCompetencyData(
      {
        aiCompetencyExamBlueprintFindMany: async () => {
          throw new Error('blueprints unavailable')
        },
        aiCompetencyReviewRubricFindMany: async () => {
          throw new Error('rubrics unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getAiCompetencyPageData({
            session: makeSession({ role: 'ROLE_ADMIN' }),
          })

          assert.equal(data.state, 'ready')
          assert.equal(data.adminView?.blueprints.length, 0)
          assert.equal(data.adminView?.rubrics.length, 0)
          assert.equal(data.alerts?.length ? data.alerts.length >= 2 : false, true)
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('the placeholder error state is now reserved for genuine unrecoverable loader failures only', async () => {
    await withStubbedAiCompetencyData(
      {
        evalCycleFindMany: async () => {
          throw new Error('eval cycles unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getAiCompetencyPageData({
            session: makeSession(),
          })

          assert.equal(data.state, 'error')
          assert.equal(typeof data.message, 'string')
          assert.equal((data.message ?? '').length > 0, true)
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('client page shows partial-loading alerts instead of dropping into the old broken placeholder', () => {
    const source = read('src/components/evaluation/AiCompetencyClient.tsx')

    assert.equal(source.includes('data.alerts?.length'), true)
    assert.equal(source.includes('일부 운영 데이터를 불러오지 못해 기본 화면으로 표시 중입니다.'), true)
    assert.equal(source.includes('AI 활용능력 평가 화면을 불러오지 못했습니다.'), true)
  })

  console.log('AI competency page tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
