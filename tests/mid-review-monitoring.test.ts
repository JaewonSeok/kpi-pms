import './register-path-aliases'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'
process.env.AUTH_URL ||= 'http://localhost:3000'
process.env.AUTH_SECRET ||= 'test-secret'
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client'
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-secret'
process.env.ALLOWED_DOMAIN ||= 'example.com'

import { prisma } from '../src/lib/prisma'
import { getMidReviewMonitoringView } from '../src/server/mid-review'

type PrismaMethod = (...args: any[]) => Promise<any>

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
  const prismaAny = prisma as any
  const snapshot: { midReviewAssignmentFindMany: PrismaMethod } = {
    midReviewAssignmentFindMany: prismaAny.midReviewAssignment.findMany,
  }

  prismaAny.midReviewAssignment.findMany = async () => [
    {
      id: 'assignment-1',
      status: 'LEADER_DRAFT',
      targetDepartment: {
        id: 'dept-1',
        deptName: '영업1팀',
      },
      targetEmployee: null,
      record: {
        directionClarity: 'PARTIAL',
        goalReviews: [
          {
            revisionRequested: true,
            goalValidityDecision: 'REVISE_GOAL',
          },
        ],
        peopleReview: {
          retentionRiskLevel: 'HIGH',
          supportPlan: '',
        },
        actionItems: [],
      },
      cycle: {
        id: 'cycle-1',
        reviewType: 'ALIGNMENT',
        status: 'ACTIVE',
        leaderDueAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    },
    {
      id: 'assignment-2',
      status: 'CLOSED',
      targetDepartment: null,
      targetEmployee: {
        deptId: 'dept-2',
        department: {
          id: 'dept-2',
          deptName: '개발팀',
        },
      },
      record: {
        directionClarity: 'CLEAR',
        goalReviews: [
          {
            revisionRequested: false,
            goalValidityDecision: 'KEEP_GOAL',
          },
        ],
        peopleReview: {
          retentionRiskLevel: 'LOW',
          supportPlan: '월 1회 코칭 유지',
        },
        actionItems: [{ id: 'action-1' }],
      },
      cycle: {
        id: 'cycle-1',
        reviewType: 'ASSESSMENT',
        status: 'ACTIVE',
        leaderDueAt: new Date('2026-05-10T00:00:00.000Z'),
      },
    },
  ]

  try {
    await run('mid-review monitoring aggregates progress, action gaps, and risk signals', async () => {
      const result = await getMidReviewMonitoringView('cycle-2026')

      assert.equal(result.summary.activeCycleCount, 1)
      assert.equal(result.summary.activeAssignmentCount, 2)
      assert.equal(result.summary.completedAssignmentCount, 1)
      assert.equal(result.summary.progressRate, 50)
      assert.equal(result.summary.noActionTeamCount, 1)
      assert.equal(result.summary.revisionRequestedCount, 1)
      assert.equal(result.summary.peopleRiskWithoutPlanCount, 1)
      assert.equal(result.summary.alignmentRiskCount, 1)

      const salesTeam = result.departments.find((item) => item.departmentId === 'dept-1')
      assert.ok(salesTeam)
      assert.equal(salesTeam.totalAssignments, 1)
      assert.equal(salesTeam.completedAssignments, 0)
      assert.equal(salesTeam.overdueCount, 1)
      assert.equal(salesTeam.noActionCount, 1)
      assert.equal(salesTeam.highRiskWithoutPlanCount, 1)
    })

    console.log('Mid-review monitoring tests completed')
  } finally {
    prismaAny.midReviewAssignment.findMany = snapshot.midReviewAssignmentFindMany
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
