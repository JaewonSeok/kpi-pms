/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import assert from 'node:assert/strict'

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kpi_pms_test'

const { buildCaseSnapshotPayload } = require('../src/server/ai-competency-gate-shared') as typeof import('../src/server/ai-competency-gate-shared')

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function makeAssignment() {
  return {
    id: 'assignment-1',
    cycleId: 'gate-cycle-1',
    employeeId: 'emp-1',
    employeeNameSnapshot: '구성원',
    departmentNameSnapshot: '인사팀',
    positionSnapshot: '사원',
    reviewerId: 'leader-1',
    reviewerNameSnapshot: '팀장',
    currentRevisionRound: 1,
    status: 'SUBMITTED',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-12T00:00:00.000Z'),
    cycle: {
      cycleName: '2026 AI 역량평가',
      evalCycleId: 'eval-cycle-1',
    },
  } as any
}

function makeCaseRecord() {
  return {
    id: 'case-1',
    track: 'AI_PROJECT_EXECUTION',
    title: '채용 운영 AI 개선',
    problemStatement: '지원서 분류 시간이 오래 걸렸습니다.',
    importanceReason: '채용 지연이 반복되었습니다.',
    goalStatement: '분류 시간을 줄입니다.',
    scopeDescription: '채용 운영에 적용했습니다.',
    ownerRoleDescription: 'Owner로 프로젝트를 운영했습니다.',
    beforeWorkflow: '수작업 검토',
    afterWorkflow: 'AI 초안 + 사람 검토',
    impactSummary: '처리 시간이 40% 단축되었습니다.',
    teamOrganizationAdoption: '팀 전체가 사용했습니다.',
    reusableOutputSummary: '재사용 가이드를 만들었습니다.',
    humanReviewControl: '최종 판단은 사람이 했습니다.',
    factCheckMethod: '표본 검수와 운영 지표를 확인했습니다.',
    securityEthicsPrivacyHandling: '개인정보를 마스킹했습니다.',
    sharingExpansionActivity: '팀 세미나에서 공유했습니다.',
    toolList: 'ChatGPT Enterprise',
    approvedToolBasis: '사내 승인 도구입니다.',
    sensitiveDataHandling: '민감 정보는 입력하지 않았습니다.',
    maskingAnonymizationHandling: '익명화했습니다.',
    prohibitedAutomationAcknowledged: true,
    finalDeclarationAccepted: true,
    metrics: [
      {
        id: 'metric-1',
        metricName: '처리 시간',
        beforeValue: '50',
        afterValue: '30',
        unit: '분',
        verificationMethod: '주간 리포트',
        displayOrder: 0,
      },
    ],
    projectDetail: {
      projectBackground: '채용 운영 병목을 해결하려는 프로젝트였습니다.',
      stakeholders: '채용 담당자, 팀장',
      executionSteps: '문제 정의 - 시범 운영 - 정착',
      deliverables: '프롬프트, 운영 가이드',
      projectStartedAt: new Date('2026-03-10T00:00:00.000Z'),
      projectEndedAt: new Date('2026-04-10T00:00:00.000Z'),
      ownerPmRoleDetail: '요구사항과 운영 결정을 총괄했습니다.',
      contributionSummary: '도입과 정착을 주도했습니다.',
    },
    adoptionDetail: null,
    evidenceItems: [
      {
        id: 'evidence-1',
        evidenceType: 'AFTER',
        title: '운영 결과 리포트',
        description: '개선 후 리포트',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        content: Buffer.from('report'),
        linkUrl: null,
        textNote: null,
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    ],
    reviews: [
      {
        id: 'review-1',
        overallDecision: 'REVISION_REQUIRED',
        overallComment: '효과 측정 근거를 보완해 주세요.',
        reviewedAt: new Date('2026-04-15T00:00:00.000Z'),
        reviewerNameSnapshot: '팀장',
        items: [
          {
            criterionId: 'criterion-1',
            decision: 'REVISION_REQUIRED',
            comment: '보완 필요',
            requiredFix: '처리 시간 비교 표를 추가해 주세요.',
          },
        ],
        template: {
          criteria: [
            {
              id: 'criterion-1',
              criterionName: '측정 가능한 효과',
            },
          ],
        },
      },
    ],
    decisionHistory: [],
    snapshots: [],
  } as any
}

run('snapshot payload captures assignment, form, evidence, and latest review data together', () => {
  const payload = buildCaseSnapshotPayload({
    assignment: makeAssignment(),
    caseRecord: makeCaseRecord(),
    actorId: 'reviewer-1',
    actorName: '팀장',
  })

  assert.equal(payload.assignment.id, 'assignment-1')
  assert.equal(payload.assignment.status, 'SUBMITTED')
  assert.equal(payload.submissionCase.id, 'case-1')
  assert.equal(payload.submissionCase.track, 'AI_PROJECT_EXECUTION')
  assert.equal(payload.submissionCase.form.title, '채용 운영 AI 개선')
  assert.equal(payload.submissionCase.evidenceItems.length, 1)
  assert.equal(payload.submissionCase.latestReview?.overallDecision, 'REVISION_REQUIRED')
  assert.equal(payload.actor.id, 'reviewer-1')
  assert.equal(payload.actor.name, '팀장')
})

console.log('AI competency gate snapshot tests completed')
