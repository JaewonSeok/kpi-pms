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

const { getAiCompetencyGatePageData } = require('../src/server/ai-competency-gate') as typeof import('../src/server/ai-competency-gate')

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

type GatePageSnapshot = {
  employeeFindUnique: PrismaDelegateMethod
  aiCompetencyGuideEntryUpsert: PrismaDelegateMethod
  aiCompetencyGuideEntryFindMany: PrismaDelegateMethod
  aiCompetencyGateCycleFindMany: PrismaDelegateMethod
  aiCompetencyGateAssignmentFindUnique: PrismaDelegateMethod
  aiCompetencyGateReviewTemplateFindFirst: PrismaDelegateMethod
  aiCompetencyGateReviewTemplateCreate: PrismaDelegateMethod
}

function captureSnapshot(): GatePageSnapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    aiCompetencyGuideEntryUpsert: prismaAny.aiCompetencyGuideEntry.upsert,
    aiCompetencyGuideEntryFindMany: prismaAny.aiCompetencyGuideEntry.findMany,
    aiCompetencyGateCycleFindMany: prismaAny.aiCompetencyGateCycle.findMany,
    aiCompetencyGateAssignmentFindUnique: prismaAny.aiCompetencyGateAssignment.findUnique,
    aiCompetencyGateReviewTemplateFindFirst: prismaAny.aiCompetencyGateReviewTemplate.findFirst,
    aiCompetencyGateReviewTemplateCreate: prismaAny.aiCompetencyGateReviewTemplate.create,
  }
}

function restoreSnapshot(snapshot: GatePageSnapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.aiCompetencyGuideEntry.upsert = snapshot.aiCompetencyGuideEntryUpsert
  prismaAny.aiCompetencyGuideEntry.findMany = snapshot.aiCompetencyGuideEntryFindMany
  prismaAny.aiCompetencyGateCycle.findMany = snapshot.aiCompetencyGateCycleFindMany
  prismaAny.aiCompetencyGateAssignment.findUnique = snapshot.aiCompetencyGateAssignmentFindUnique
  prismaAny.aiCompetencyGateReviewTemplate.findFirst = snapshot.aiCompetencyGateReviewTemplateFindFirst
  prismaAny.aiCompetencyGateReviewTemplate.create = snapshot.aiCompetencyGateReviewTemplateCreate
}

function makeSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'emp-1',
      email: 'member1@company.test',
      name: '구성원',
      role: 'ROLE_MEMBER',
      empId: 'EMP-001',
      deptId: 'dept-1',
      deptName: '인사팀',
      ...overrides,
    },
  } as any
}

function makeEmployee(withDepartment: boolean = true) {
  return {
    id: 'emp-1',
    empId: 'EMP-001',
    empName: '구성원',
    role: 'ROLE_MEMBER',
    position: 'MEMBER',
    department: withDepartment
      ? {
          id: 'dept-1',
          deptName: '인사팀',
          organization: {
            id: 'org-1',
            name: 'RSUPPORT',
          },
        }
      : null,
  }
}

function makeCycle() {
  return {
    id: 'gate-cycle-1',
    evalCycleId: 'eval-cycle-1',
    cycleName: '2026 AI 역량평가',
    status: 'OPEN',
    submissionOpenAt: new Date('2026-04-01T00:00:00.000Z'),
    submissionCloseAt: new Date('2026-04-30T00:00:00.000Z'),
    reviewOpenAt: new Date('2026-05-01T00:00:00.000Z'),
    reviewCloseAt: new Date('2026-05-15T00:00:00.000Z'),
    resultPublishAt: new Date('2026-05-20T00:00:00.000Z'),
    promotionGateEnabled: true,
    policyAcknowledgementText: '정책 확인',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    evalCycle: {
      id: 'eval-cycle-1',
      evalYear: 2026,
      organization: {
        id: 'org-1',
        name: 'RSUPPORT',
      },
    },
  }
}

function makeGuideEntries() {
  return [
    {
      id: 'guide-1',
      entryKey: 'default:overview-guide',
      cycleId: null,
      entryType: 'GUIDE',
      trackApplicability: 'COMMON',
      title: 'AI 역량평가 안내',
      summary: '승진 게이트용 제출 안내입니다.',
      body: '실제 업무 개선과 증빙을 중심으로 작성합니다.',
      displayOrder: 10,
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
  ]
}

function makeTemplate() {
  return {
    id: 'template-1',
    cycleId: 'gate-cycle-1',
    templateName: '기본 검토 기준',
    templateVersion: 1,
    isActive: true,
    createdById: 'admin-1',
    updatedById: 'admin-1',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    criteria: [
      {
        id: 'criterion-1',
        templateId: 'template-1',
        criterionCode: 'REAL_BUSINESS_PROBLEM',
        criterionName: '실제 업무 문제',
        criterionDescription: '실제 업무 문제 정의가 있는지 확인합니다.',
        trackApplicability: 'COMMON',
        displayOrder: 0,
        mandatory: true,
        knockout: false,
        passGuidance: '통과',
        revisionGuidance: '보완',
        failGuidance: '실패',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ],
  }
}

function makeSubmissionCase() {
  return {
    id: 'case-1',
    assignmentId: 'assignment-1',
    track: 'AI_PROJECT_EXECUTION',
    title: '채용 운영 AI 개선',
    problemStatement: '지원서 분류 시간이 오래 걸렸습니다.',
    importanceReason: '채용 지연이 반복되고 있었습니다.',
    goalStatement: '분류 시간을 단축합니다.',
    scopeDescription: '채용 운영 프로세스 일부에 적용했습니다.',
    ownerRoleDescription: '프로젝트 Owner로 일정과 산출물을 총괄했습니다.',
    beforeWorkflow: '수작업으로 메일과 이력을 검토했습니다.',
    afterWorkflow: 'AI 분류 초안을 만들고 사람이 최종 확인했습니다.',
    impactSummary: '처리 시간이 40% 단축되었습니다.',
    teamOrganizationAdoption: '채용 담당자 3명이 함께 사용했습니다.',
    reusableOutputSummary: '분류 프롬프트와 운영 가이드를 문서화했습니다.',
    humanReviewControl: '최종 채용 판단은 사람이 수행했습니다.',
    factCheckMethod: '표본 검수와 운영 지표로 검증했습니다.',
    securityEthicsPrivacyHandling: '개인정보를 마스킹했습니다.',
    sharingExpansionActivity: '팀 세미나에서 사례를 공유했습니다.',
    toolList: 'ChatGPT Enterprise',
    approvedToolBasis: '사내 승인 도구 목록에 포함되어 있습니다.',
    sensitiveDataHandling: '민감 정보는 입력하지 않았습니다.',
    maskingAnonymizationHandling: '지원자 식별 정보는 익명화했습니다.',
    prohibitedAutomationAcknowledged: true,
    finalDeclarationAccepted: true,
    lastSavedAt: new Date('2026-04-10T00:00:00.000Z'),
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-10T00:00:00.000Z'),
    metrics: [
      {
        id: 'metric-1',
        caseId: 'case-1',
        metricName: '처리 시간',
        beforeValue: '50',
        afterValue: '30',
        unit: '분',
        verificationMethod: '주간 리포트',
        displayOrder: 0,
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        updatedAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    ],
    projectDetail: {
      caseId: 'case-1',
      projectBackground: '채용 운영 병목을 해결하려는 프로젝트였습니다.',
      stakeholders: '채용 담당자, 팀장',
      executionSteps: '문제 정의 - 프롬프트 설계 - 시범 운영 - 정착',
      deliverables: '프롬프트, 운영 가이드, 측정 리포트',
      projectStartedAt: new Date('2026-03-10T00:00:00.000Z'),
      projectEndedAt: new Date('2026-04-10T00:00:00.000Z'),
      ownerPmRoleDetail: '요구사항 정리와 운영 의사결정을 수행했습니다.',
      contributionSummary: '도입 의사결정과 운영 정착을 주도했습니다.',
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      updatedAt: new Date('2026-04-10T00:00:00.000Z'),
    },
    adoptionDetail: {
      caseId: 'case-1',
      useCaseDescription: '',
      teamDivisionScope: '',
      repeatedUseExamples: '',
      measuredEffectDetail: '',
      seminarSharingEvidence: '',
      organizationExpansionDetail: '',
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      updatedAt: new Date('2026-04-10T00:00:00.000Z'),
    },
    evidenceItems: [
      {
        id: 'evidence-1',
        caseId: 'case-1',
        evidenceType: 'AFTER',
        title: '운영 결과 리포트',
        description: '개선 후 주간 운영 리포트입니다.',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        content: Buffer.from('report'),
        linkUrl: null,
        textNote: null,
        uploadedById: 'emp-1',
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    ],
    reviews: [
      {
        id: 'review-1',
        assignmentId: 'assignment-1',
        caseId: 'case-1',
        reviewerId: 'leader-1',
        reviewerNameSnapshot: '팀장',
        templateId: 'template-1',
        revisionRound: 1,
        status: 'SUBMITTED',
        overallDecision: 'REVISION_REQUIRED',
        overallComment: '효과 측정 근거를 조금 더 보완해 주세요.',
        nonRemediable: false,
        reviewedAt: new Date('2026-04-15T00:00:00.000Z'),
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
        updatedAt: new Date('2026-04-15T00:00:00.000Z'),
        items: [
          {
            id: 'review-item-1',
            reviewId: 'review-1',
            criterionId: 'criterion-1',
            decision: 'REVISION_REQUIRED',
            comment: '효과 측정 근거를 보완해 주세요.',
            requiredFix: '처리 시간 비교 표를 추가해 주세요.',
            createdAt: new Date('2026-04-15T00:00:00.000Z'),
            updatedAt: new Date('2026-04-15T00:00:00.000Z'),
          },
        ],
        template: makeTemplate(),
      },
    ],
    decisionHistory: [],
    snapshots: [],
  }
}

function makeAssignment(status: 'DRAFT' | 'REVISION_REQUESTED' = 'DRAFT') {
  return {
    id: 'assignment-1',
    cycleId: 'gate-cycle-1',
    employeeId: 'emp-1',
    reviewerId: 'leader-1',
    reviewerNameSnapshot: '팀장',
    employeeNameSnapshot: '구성원',
    departmentNameSnapshot: '인사팀',
    positionSnapshot: '사원',
    status,
    assignedAt: new Date('2026-04-01T00:00:00.000Z'),
    submittedAt: new Date('2026-04-12T00:00:00.000Z'),
    reviewStartedAt: null,
    decisionAt: null,
    closedAt: null,
    currentRevisionRound: status === 'REVISION_REQUESTED' ? 1 : 0,
    adminNote: null,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-12T00:00:00.000Z'),
    cycle: makeCycle(),
    employee: {
      id: 'emp-1',
      empName: '구성원',
      department: {
        id: 'dept-1',
        deptName: '인사팀',
      },
    },
    submissionCase: makeSubmissionCase(),
  }
}

async function withStubbedGatePageData(
  overrides: Partial<Record<keyof GatePageSnapshot, PrismaDelegateMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique = overrides.employeeFindUnique ?? (async () => makeEmployee())
  prismaAny.aiCompetencyGuideEntry.upsert = overrides.aiCompetencyGuideEntryUpsert ?? (async () => ({ id: 'guide-1' }))
  prismaAny.aiCompetencyGuideEntry.findMany = overrides.aiCompetencyGuideEntryFindMany ?? (async () => makeGuideEntries())
  prismaAny.aiCompetencyGateCycle.findMany = overrides.aiCompetencyGateCycleFindMany ?? (async () => [makeCycle()])
  prismaAny.aiCompetencyGateAssignment.findUnique = overrides.aiCompetencyGateAssignmentFindUnique ?? (async () => null)
  prismaAny.aiCompetencyGateReviewTemplate.findFirst =
    overrides.aiCompetencyGateReviewTemplateFindFirst ?? (async () => makeTemplate())
  prismaAny.aiCompetencyGateReviewTemplate.create =
    overrides.aiCompetencyGateReviewTemplateCreate ?? (async () => makeTemplate())

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('employee page returns an empty state when no active gate cycle exists', async () => {
    await withStubbedGatePageData(
      {
        aiCompetencyGateCycleFindMany: async () => [],
      },
      async () => {
        const data = await getAiCompetencyGatePageData({
          session: makeSession(),
        })

        assert.equal(data.state, 'empty')
        assert.equal(data.cycleOptions.length, 0)
        assert.equal(data.guideLibrary.guides.length, 1)
      }
    )
  })

  await run('employee page returns permission-denied when employee organization context is missing', async () => {
    await withStubbedGatePageData(
      {
        employeeFindUnique: async () => makeEmployee(false),
      },
      async () => {
        const data = await getAiCompetencyGatePageData({
          session: makeSession(),
        })

        assert.equal(data.state, 'permission-denied')
        assert.equal(typeof data.message, 'string')
      }
    )
  })

  await run('employee page stays ready with guidance and a message when the employee has no assignment yet', async () => {
    await withStubbedGatePageData({}, async () => {
      const data = await getAiCompetencyGatePageData({
        session: makeSession(),
      })

      assert.equal(data.state, 'ready')
      assert.equal(data.assignmentId, undefined)
      assert.equal(data.selectedCycleId, 'gate-cycle-1')
      assert.equal(data.reviewCriteria.length, 1)
      assert.equal(data.guideLibrary.guides.length, 1)
      assert.equal(typeof data.message, 'string')
      assert.equal((data.message ?? '').length > 0, true)
    })
  })

  await run('employee page exposes resubmission guidance and reviewer feedback for revision-requested cases', async () => {
    await withStubbedGatePageData(
      {
        aiCompetencyGateAssignmentFindUnique: async () => makeAssignment('REVISION_REQUESTED'),
      },
      async () => {
        const data = await getAiCompetencyGatePageData({
          session: makeSession(),
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.assignmentId, 'assignment-1')
        assert.equal(data.statusCard?.canEdit, true)
        assert.equal(data.statusCard?.canResubmit, true)
        assert.equal(data.evidenceItems.length, 1)
        assert.equal(data.reviewerComment, '효과 측정 근거를 조금 더 보완해 주세요.')
      }
    )
  })

  await run('employee page route and client use the new gate loader and Korean status copy', () => {
    const pageSource = read('src/app/(main)/evaluation/ai-competency/page.tsx')
    const clientSource = read('src/components/evaluation/AiCompetencyClient.tsx')

    assert.equal(pageSource.includes('getAiCompetencyGatePageData'), true)
    assert.equal(clientSource.includes('AI 역량평가'), true)
    assert.equal(clientSource.includes('보완 요청'), true)
    assert.equal(clientSource.includes('증빙 자료'), true)
  })

  console.log('AI competency gate page tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
