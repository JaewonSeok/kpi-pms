import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import { flattenNavigationItems, NAV_ITEMS } from '../src/lib/navigation'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function readProjectFile(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

const pageSource = readProjectFile('src/app/(main)/evaluation/ai-competency/page.tsx')
const adminPageSource = readProjectFile('src/app/(main)/evaluation/ai-competency/admin/page.tsx')
const caseReviewPageSource = readProjectFile(
  'src/app/(main)/evaluation/ai-competency/admin/[caseId]/page.tsx'
)
const actionRouteSource = readProjectFile('src/app/api/evaluation/ai-competency/actions/route.ts')
const evidenceRouteSource = readProjectFile(
  'src/app/api/evaluation/ai-competency/evidence/[evidenceId]/route.ts'
)
const exportRouteSource = readProjectFile(
  'src/app/api/evaluation/ai-competency/export/[cycleId]/route.ts'
)
const employeeClientSource = readProjectFile('src/components/evaluation/AiCompetencyClient.tsx')
const adminPanelSource = readProjectFile('src/components/evaluation/AiCompetencyAdminPanel.tsx')
const reviewPageClientSource = readProjectFile(
  'src/components/evaluation/AiCompetencyCaseReviewPage.tsx'
)
const gateConfigSource = readProjectFile('src/lib/ai-competency-gate-config.ts')
const gateSharedSource = readProjectFile('src/server/ai-competency-gate-shared.ts')
const gateServerSource = readProjectFile('src/server/ai-competency-gate.ts')
const validationsSource = readProjectFile('src/lib/validations.ts')
const resultsSource = readProjectFile('src/server/evaluation-results.ts')
const calibrationSource = readProjectFile('src/server/evaluation-calibration.ts')
const compensationSource = readProjectFile('src/server/compensation-manage.ts')
const calendarSource = readProjectFile('src/server/admin/performance-calendar.ts')
const promotionHelperSource = readProjectFile('src/server/ai-competency-gate-promotion.ts')
const navigationItems = flattenNavigationItems(NAV_ITEMS)

run('AI competency route remains registered under the existing evaluation navigation and permissions', () => {
  assert.equal(resolveMenuFromPath('/evaluation/ai-competency'), 'AI_COMPETENCY')
  assert.equal(resolveMenuFromPath('/api/evaluation/ai-competency/actions'), 'AI_COMPETENCY')
  assert.equal(
    navigationItems.some(
      (item) => item.href === '/evaluation/ai-competency' && item.menuKey === 'AI_COMPETENCY'
    ),
    true
  )
  assert.equal(
    existsSync(path.resolve(process.cwd(), 'src/app/(main)/evaluation/ai-competency/page.tsx')),
    true
  )
  assert.match(pageSource, /getAiCompetencyGatePageData/)
  assert.match(pageSource, /AiCompetencyClient/)
})

run('employee, admin, and reviewer routes are all wired to the new gate modules', () => {
  assert.match(adminPageSource, /getAiCompetencyGateAdminPageData/)
  assert.match(adminPageSource, /AiCompetencyAdminPanel/)
  assert.match(caseReviewPageSource, /getAiCompetencyGateCaseReviewPageData/)
  assert.match(caseReviewPageSource, /AiCompetencyCaseReviewPage/)
})

run('the actions route exposes only the gate workflow actions', () => {
  for (const actionName of [
    'upsertCycle',
    'upsertAssignment',
    'saveDraft',
    'uploadEvidence',
    'deleteEvidence',
    'submitCase',
    'startReview',
    'saveReviewDraft',
    'finalizeDecision',
  ]) {
    assert.match(actionRouteSource, new RegExp(`case '${actionName}'`))
  }

  assert.match(actionRouteSource, /AiCompetencyGateCycleUpsertSchema/)
  assert.match(actionRouteSource, /AiCompetencyGateAssignmentUpsertSchema/)
  assert.match(actionRouteSource, /AiCompetencyGateDraftSchema/)
  assert.match(actionRouteSource, /AiCompetencyGateReviewDraftSchema/)
  assert.match(actionRouteSource, /AiCompetencyGateDecisionSubmitSchema/)
  assert.match(evidenceRouteSource, /getAiCompetencyGateEvidenceDownload/)
  assert.match(exportRouteSource, /exportAiCompetencyGateReport/)
})

run('employee, admin, and reviewer UI shells expose Korean gate-oriented copy', () => {
  assert.equal(employeeClientSource.includes('AI 역량평가'), true)
  assert.equal(gateConfigSource.includes('AI 기반 프로젝트 수행 T/K'), true)
  assert.equal(gateConfigSource.includes('조직 기여 AI 활용 사례'), true)
  assert.equal(gateConfigSource.includes('AI 실무 역량 인증'), true)
  assert.equal(employeeClientSource.includes('단순 교육 이수나 도구 사용 경험만으로는 인정되지 않습니다.'), true)
  assert.equal(employeeClientSource.includes('제출서 작성'), true)
  assert.equal(employeeClientSource.includes('증빙 자료'), true)
  assert.equal(employeeClientSource.includes('이력 / 결정 내역'), true)

  assert.equal(adminPanelSource.includes('AI 역량평가 운영'), true)
  assert.equal(adminPanelSource.includes('회차 선택'), true)
  assert.equal(adminPanelSource.includes('회차 관리'), true)
  assert.equal(adminPanelSource.includes('대상자 배정'), true)
  assert.equal(adminPanelSource.includes('2026 AI 활용평가 readiness'), true)
  assert.equal(adminPanelSource.includes('정량 개선 누락'), true)
  assert.equal(adminPanelSource.includes('제출 및 검토 대기열'), true)
  assert.equal(adminPanelSource.includes('등록된 AI 역량평가 회차가 없습니다.'), true)

  assert.equal(reviewPageClientSource.includes('AI 역량평가 제출서 검토'), true)
  assert.equal(reviewPageClientSource.includes('검토 의견'), true)
  assert.equal(reviewPageClientSource.includes('보완 요청'), true)
  assert.equal(reviewPageClientSource.includes('통과'), true)
  assert.equal(reviewPageClientSource.includes('Fail'), true)
})

run('2026 AI evidence paths are stored as readiness metadata without schema changes', () => {
  for (const route of [
    'AI_PROJECT_TK',
    'ORG_CONTRIBUTION_CASE',
    'PRACTICAL_AI_CERTIFICATION',
  ]) {
    assert.equal(gateConfigSource.includes(route), true)
    assert.equal(validationsSource.includes(route), true)
  }

  assert.equal(gateSharedSource.includes('AI_COMPETENCY_GATE_RECOGNITION_ROUTE_REQUIRED'), true)
  assert.equal(
    gateSharedSource.includes('AI_COMPETENCY_GATE_QUANTITATIVE_BEFORE_AFTER_REQUIRED'),
    true
  )
  assert.match(gateServerSource, /policyRecognitionRoute/)
  assert.match(gateServerSource, /2026-PPT-AI-PASS-FAIL/)
})

run('AI evidence readiness stays separate from annual performance totals and grades', () => {
  assert.equal(gateServerSource.includes('totalScore'), false)
  assert.equal(gateServerSource.includes('gradeId'), false)
  assert.equal(gateSharedSource.includes('totalScore'), false)
  assert.equal(gateSharedSource.includes('gradeId'), false)
  assert.equal(reviewPageClientSource.includes('통과'), true)
  assert.equal(reviewPageClientSource.includes('Fail'), true)
})

run('evaluation, calibration, compensation, and calendar integrations use the gate status instead of a numeric AI score for gate cycles', () => {
  assert.match(resultsSource, /loadAiCompetencyGatePromotionStatuses/)
  assert.equal(resultsSource.includes('aiCompetencyGateStatusLabel'), true)
  assert.equal(resultsSource.includes('aiCompetencyGateSatisfied'), true)

  assert.match(calibrationSource, /loadAiCompetencyGatePromotionStatuses/)
  assert.equal(calibrationSource.includes('aiCompetencyGateStatusLabel'), true)
  assert.equal(calibrationSource.includes('aiCompetencyGateSatisfied'), true)

  assert.match(compensationSource, /aiCompetencyGateCycle/)
  assert.match(calendarSource, /aiCompetencyGateCycle/)
  assert.match(promotionHelperSource, /isSatisfied: assignment.status === 'PASSED'/)
})

console.log('AI competency gate integration tests completed')
