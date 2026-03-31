/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import assert from 'node:assert/strict'
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

const {
  getAiCompetencyPageData,
  reviewAiCompetencySubmission,
} = require('../src/server/ai-competency') as typeof import('../src/server/ai-competency')

function workspaceEmail(localPart: string) {
  return `${localPart}@${process.env.ALLOWED_DOMAIN?.trim() || 'company.com'}`
}

async function run(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function loadSeededUser(localPart: string) {
  const employee = await prisma.employee.findUnique({
    where: { gwsEmail: workspaceEmail(localPart) },
    include: {
      department: true,
    },
  })

  assert.ok(employee, `${localPart} seeded employee should exist`)
  assert.ok(employee.department, `${localPart} seeded employee should have department`)

  return employee
}

function makeSession(employee: Awaited<ReturnType<typeof loadSeededUser>>) {
  return {
    user: {
      id: employee.id,
      email: employee.gwsEmail,
      name: employee.empName,
      role: employee.role,
      empId: employee.empId,
      deptId: employee.deptId,
      deptName: employee.department?.deptName,
    },
  } as any
}

async function main() {
  await run('seeded admin sees a real AI competency operational page', async () => {
    const admin = await loadSeededUser('admin')
    const data = await getAiCompetencyPageData({
      session: makeSession(admin),
    })

    assert.equal(data.state, 'ready')
    assert.equal(data.permissions?.canManageCycles, true)
    assert.ok(data.selectedCycleId)
    assert.ok((data.availableCycles?.length ?? 0) >= 1)
    assert.ok(data.adminView)
    assert.ok((data.adminView?.assignments.length ?? 0) >= 2)
    assert.ok((data.adminView?.questionBank.length ?? 0) >= 4)
    assert.ok((data.adminView?.rubrics.length ?? 0) >= 1)
    assert.ok((data.adminView?.secondRoundQueue.length ?? 0) >= 1)
    assert.ok((data.adminView?.secondRoundQueue[0]?.reviewerNames.length ?? 0) >= 1)
  })

  await run('seeded member1 sees an assigned AI competency cycle instead of empty/setup state', async () => {
    const member = await loadSeededUser('member1')
    const data = await getAiCompetencyPageData({
      session: makeSession(member),
    })

    assert.equal(data.state, 'ready')
    assert.ok(data.employeeView?.assignment)
    assert.equal(data.employeeView?.attempt?.passStatus, 'PASSED')
    assert.equal(data.employeeView?.secondRound.application?.status, 'UNDER_REVIEW')
    assert.equal(data.employeeView?.secondRound.canSubmit, false)
    assert.match(data.employeeView?.secondRound.submitMessage ?? '', /심사 대기|심사/)
    assert.equal(data.employeeView?.externalCerts.masters.length ? data.employeeView.externalCerts.masters.length > 0 : false, true)
  })

  await run('seeded reviewer-capable user sees an assigned review queue', async () => {
    const reviewer = await loadSeededUser('section')
    const data = await getAiCompetencyPageData({
      session: makeSession(reviewer),
    })

    assert.equal(data.state, 'ready')
    assert.ok(data.reviewerView)
    assert.ok((data.reviewerView?.queue.length ?? 0) >= 1)
    assert.equal(data.reviewerView?.queue[0]?.employeeName?.length ? true : false, true)
  })

  await run('seeded reviewer can save draft and final submit a review, then page data refresh reflects the new status', async () => {
    const reviewer = await loadSeededUser('section')
    const review = await prisma.aiCompetencySubmissionReview.findFirst({
      where: {
        reviewerId: reviewer.id,
      },
      include: {
        submission: {
          include: {
            assignment: true,
            rubric: {
              include: {
                criteria: {
                  include: {
                    bands: {
                      orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
                    },
                  },
                  orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
          },
        },
      },
    })

    assert.ok(review, 'seeded reviewer assignment should exist')
    assert.ok(review.submission.rubric, 'seeded submission should have rubric')

    const criterionScores = review.submission.rubric!.criteria.map((criterion) => ({
      criterionId: criterion.id,
      score: criterion.bands[0]?.score ?? criterion.maxScore,
      comment: `${criterion.criterionName} 검토 완료`,
      knockoutTriggered: false,
    }))

    try {
      await reviewAiCompetencySubmission({
        session: makeSession(reviewer),
        submissionId: review.submissionId,
        input: {
          criterionScores,
          notes: '초안 저장 테스트',
          qnaNote: '추가 확인 메모',
          submitFinal: false,
        },
      })

      let savedReview = await prisma.aiCompetencySubmissionReview.findUnique({
        where: { id: review.id },
      })
      assert.equal(savedReview?.status, 'DRAFT')
      assert.equal(savedReview?.decision, null)

      await reviewAiCompetencySubmission({
        session: makeSession(reviewer),
        submissionId: review.submissionId,
        input: {
          criterionScores,
          decision: 'PASS',
          notes: '최종 제출 테스트',
          qnaNote: '최종 메모',
          submitFinal: true,
        },
      })

      savedReview = await prisma.aiCompetencySubmissionReview.findUnique({
        where: { id: review.id },
      })
      const savedSubmission = await prisma.aiCompetencySecondRoundSubmission.findUnique({
        where: { id: review.submissionId },
      })
      assert.equal(savedReview?.status, 'SUBMITTED')
      assert.equal(savedReview?.decision, 'PASS')
      assert.equal(savedSubmission?.status, 'PASSED')

      const refreshed = await getAiCompetencyPageData({
        session: makeSession(reviewer),
      })
      assert.equal(refreshed.reviewerView?.queue[0]?.reviewStatus, 'SUBMITTED')
      assert.equal(refreshed.reviewerView?.queue[0]?.status, 'PASSED')
    } finally {
      await prisma.aiCompetencySubmissionReviewScore.deleteMany({
        where: { reviewId: review.id },
      })
      await prisma.aiCompetencySubmissionReview.update({
        where: { id: review.id },
        data: {
          status: 'ASSIGNED',
          decision: null,
          score: null,
          bonusScore: null,
          notes: null,
          qnaNote: null,
          reviewedAt: null,
        },
      })
      await prisma.aiCompetencySecondRoundSubmission.update({
        where: { id: review.submissionId },
        data: {
          status: 'UNDER_REVIEW',
          aggregatedScore: null,
          aggregatedBonus: null,
          reviewerSummary: null,
          internalCertificationGranted: false,
          finalDecisionById: null,
          finalDecisionNote: null,
          decidedAt: null,
        },
      })
      await prisma.aiCompetencyResult.deleteMany({
        where: { assignmentId: review.submission.assignmentId },
      })
    }
  })

  console.log('Seeded AI competency runtime tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
