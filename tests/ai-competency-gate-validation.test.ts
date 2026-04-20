/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import assert from 'node:assert/strict'

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kpi_pms_test'

const { validateCaseReadiness, validateReviewDecision } = require('../src/server/ai-competency-gate-shared') as typeof import('../src/server/ai-competency-gate-shared')

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function expectAppErrorCode(fn: () => void, code: string) {
  try {
    fn()
    assert.fail(`Expected AppError with code ${code}`)
  } catch (error) {
    assert.equal((error as { code?: string }).code, code)
  }
}

function makeCaseRecord(track: 'AI_PROJECT_EXECUTION' | 'AI_USE_CASE_EXPANSION' = 'AI_PROJECT_EXECUTION') {
  return {
    id: 'case-1',
    assignmentId: 'assignment-1',
    track,
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
    metrics: [
      {
        id: 'metric-1',
        metricName: '처리 시간',
        beforeValue: '50',
        afterValue: '30',
        unit: '분',
        verificationMethod: '주간 리포트',
      },
    ],
    evidenceItems: [
      {
        id: 'evidence-1',
        title: '개선 결과 리포트',
      },
    ],
    projectDetail: {
      projectBackground: '채용 운영 병목을 해결하려는 프로젝트였습니다.',
      stakeholders: '채용 담당자, 팀장',
      executionSteps: '문제 정의 - 프롬프트 설계 - 시범 운영 - 정착',
      deliverables: '프롬프트, 운영 가이드, 측정 리포트',
      ownerPmRoleDetail: '요구사항 정리와 운영 의사결정을 수행했습니다.',
      contributionSummary: '도입 의사결정과 운영 정착을 주도했습니다.',
    },
    adoptionDetail: {
      useCaseDescription: '회의록 초안 생성과 후속 액션 정리를 표준화했습니다.',
      teamDivisionScope: '인사팀 전원',
      repeatedUseExamples: '주간 회의와 채용 회의에서 반복 사용했습니다.',
      measuredEffectDetail: '회의 정리 시간이 평균 20분 줄었습니다.',
      seminarSharingEvidence: '본부 세미나에서 사례를 발표했습니다.',
      organizationExpansionDetail: '타 팀에서도 같은 템플릿을 재사용했습니다.',
    },
    reviews: [],
    decisionHistory: [],
    snapshots: [],
  } as any
}

function makeCriteria() {
  return [
    {
      id: 'criterion-1',
      criterionName: '실제 업무 문제',
      mandatory: true,
      knockout: false,
    },
    {
      id: 'criterion-2',
      criterionName: '사람의 최종 검토',
      mandatory: true,
      knockout: true,
    },
  ] as any
}

run('project track submission passes readiness validation when required evidence and fields exist', () => {
  validateCaseReadiness(makeCaseRecord('AI_PROJECT_EXECUTION'))
})

run('adoption track submission passes readiness validation when required expansion fields exist', () => {
  validateCaseReadiness(makeCaseRecord('AI_USE_CASE_EXPANSION'))
})

run('submission validation requires at least one evidence item', () => {
  const record = makeCaseRecord()
  record.evidenceItems = []
  expectAppErrorCode(() => validateCaseReadiness(record), 'AI_COMPETENCY_GATE_EVIDENCE_REQUIRED')
})

run('project track validation requires project background and execution detail', () => {
  const record = makeCaseRecord('AI_PROJECT_EXECUTION')
  record.projectDetail.projectBackground = ''
  expectAppErrorCode(
    () => validateCaseReadiness(record),
    'AI_COMPETENCY_GATE_PROJECT_BACKGROUND_REQUIRED'
  )
})

run('adoption track validation requires measurable effect detail', () => {
  const record = makeCaseRecord('AI_USE_CASE_EXPANSION')
  record.adoptionDetail.measuredEffectDetail = ''
  expectAppErrorCode(
    () => validateCaseReadiness(record),
    'AI_COMPETENCY_GATE_EFFECT_DETAIL_REQUIRED'
  )
})

run('review revision requests require at least one actionable fix comment', () => {
  expectAppErrorCode(
    () =>
      validateReviewDecision({
        criteria: makeCriteria(),
        items: [
          { criterionId: 'criterion-1', decision: 'REVISION_REQUIRED', comment: '추가 설명이 필요합니다.' },
          { criterionId: 'criterion-2', decision: 'PASS', comment: '문제 없습니다.' },
        ],
        action: 'REVISION_REQUIRED',
      }),
    'AI_COMPETENCY_GATE_REVISION_FIX_REQUIRED'
  )
})

run('final pass is blocked when a mandatory criterion did not pass', () => {
  expectAppErrorCode(
    () =>
      validateReviewDecision({
        criteria: makeCriteria(),
        items: [
          { criterionId: 'criterion-1', decision: 'REVISION_REQUIRED', comment: '보완 필요' },
          { criterionId: 'criterion-2', decision: 'PASS', comment: '문제 없음' },
        ],
        action: 'PASS',
      }),
    'AI_COMPETENCY_GATE_PASS_BLOCKED'
  )
})

run('fail requires either a knockout fail or explicit non-remediable confirmation', () => {
  expectAppErrorCode(
    () =>
      validateReviewDecision({
        criteria: makeCriteria(),
        items: [
          { criterionId: 'criterion-1', decision: 'FAIL', comment: '핵심 문제를 입증하지 못했습니다.' },
          { criterionId: 'criterion-2', decision: 'PASS', comment: '통제는 유지되었습니다.' },
        ],
        action: 'FAIL',
        nonRemediable: false,
      }),
    'AI_COMPETENCY_GATE_FAIL_REASON_REQUIRED'
  )

  validateReviewDecision({
    criteria: makeCriteria(),
    items: [
      { criterionId: 'criterion-1', decision: 'FAIL', comment: '핵심 문제를 입증하지 못했습니다.' },
      { criterionId: 'criterion-2', decision: 'PASS', comment: '통제는 유지되었습니다.' },
    ],
    action: 'FAIL',
    nonRemediable: true,
  })
})

console.log('AI competency gate validation tests completed')
