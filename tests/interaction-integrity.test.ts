import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  PERSONAL_KPI_REVIEW_CTA_LABEL,
  getPersonalKpiHeroCtaTransition,
  getPersonalKpiSubmitCtaState,
} from '../src/lib/personal-kpi-cta'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

run('critical interaction routes exist', () => {
  const requiredRoutes = [
    'src/app/api/evaluation/results/[cycleId]/acknowledge/route.ts',
    'src/app/api/evaluation/results/[cycleId]/export/route.ts',
    'src/app/api/kpi/org/bulk-edit/route.ts',
    'src/app/api/kpi/personal/bulk/route.ts',
    'src/app/api/kpi/export/route.ts',
    'src/app/api/admin/notification-templates/test-send/route.ts',
  ]

  for (const file of requiredRoutes) {
    assert.equal(existsSync(path.resolve(process.cwd(), file)), true, `${file} should exist`)
  }
})

run('critical KPI pages use the shared protected session helper', () => {
  const personalPage = read('src/app/(main)/kpi/personal/page.tsx')
  const monthlyPage = read('src/app/(main)/kpi/monthly/page.tsx')

  assert.equal(personalPage.includes('requireProtectedPageSession'), true)
  assert.equal(monthlyPage.includes('requireProtectedPageSession'), true)
  assert.equal(personalPage.includes("redirect('/login')"), false)
  assert.equal(monthlyPage.includes("redirect('/login')"), false)
})

run('evaluation results client is wired to acknowledge and export endpoints', () => {
  const file = read('src/components/evaluation/EvaluationResultsClient.tsx')

  assert.equal(file.includes('/api/evaluation/results/'), true)
  assert.equal(file.includes('/acknowledge'), true)
  assert.equal(file.includes('/export'), true)
})

run('org KPI client opens real bulk upload modal', () => {
  const file = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.equal(file.includes('OrgKpiBulkUploadModal'), true)
  assert.equal(file.includes('setShowBulkUpload(true)'), true)
  assert.equal(file.includes('/api/kpi/org/ai'), true)
})

run('org KPI client exposes clone flow with carry-over options and clone metadata detail', () => {
  const file = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.equal(file.includes('CloneOrgKpiModal'), true)
  assert.equal(file.includes('/api/kpi/org/${selectedKpi.id}/clone'), true)
  assert.equal(file.includes('includeProgress'), true)
  assert.equal(file.includes('includeCheckins'), true)
  assert.equal(file.includes('cloneInfo'), true)
})

run('org KPI client resets stale selection and AI state when year or department context changes', () => {
  const file = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.equal(file.includes('const serverContextKey ='), true)
  assert.equal(file.includes('const viewContextKey ='), true)
  assert.equal(file.includes('buildOrgKpiServerListSignature(pageData.list)'), true)
  assert.equal(file.includes('setSelectedDepartmentId(nextDepartmentSelection)'), true)
  assert.equal(file.includes("setTab('list')"), true)
  assert.equal(file.includes('setAiPreview(null)'), true)
  assert.equal(file.includes('const saved = pendingRecommendationDecision'), true)
  assert.equal(file.includes('/api/kpi/org/team-ai/recommendations/${pendingRecommendationDecision.itemId}/decision'), true)
  assert.equal(file.includes('applySavedOrgKpiToList'), true)
  assert.equal(file.includes("nextParams.set('dept', saved.deptId)"), true)
  assert.equal(file.includes('setSelectedKpiId(saved.id)'), true)
})

run('notification ops client uses real test send and dead-letter actions', () => {
  const file = read('src/components/notifications/NotificationOpsClient.tsx')

  assert.equal(file.includes('/api/admin/notification-templates/test-send'), true)
  assert.equal(file.includes('/api/admin/notification-dead-letters'), true)
  assert.equal(file.includes('/api/cron/notifications'), true)
})

run('notification ops client supports targeted goal and checkpoint reminder runs', () => {
  const file = read('src/components/notifications/NotificationOpsClient.tsx')
  const routeSource = read('src/app/api/cron/notifications/route.ts')

  assert.equal(file.includes("reminderTypes: ['goal']"), true)
  assert.equal(file.includes("reminderTypes: ['checkpoint']"), true)
  assert.equal(file.includes('목표 수립 리마인드 전체 발송'), true)
  assert.equal(file.includes('체크인 현황 리마인드 전체 발송'), true)
  assert.equal(routeSource.includes('reminderTypes: validated.data.reminderTypes'), true)
})

run('admin performance calendar route is wired from dashboard and navigation', () => {
  const dashboardSource = read('src/server/dashboard-page.ts')
  const clientSource = read('src/components/admin/PerformanceCalendarClient.tsx')
  const pageSource = read('src/app/(main)/admin/performance-calendar/page.tsx')

  assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/(main)/admin/performance-calendar/page.tsx')), true)
  assert.equal(dashboardSource.includes('/admin/performance-calendar'), true)
  assert.equal(clientSource.includes('router.push(`/admin/performance-calendar?${params.toString()}`)'), true)
  assert.equal(pageSource.includes('getPerformanceCalendarPageData'), true)
})

run('evaluation workbench clears stale notices when cycle or evaluation context changes', () => {
  const file = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')

  assert.equal(file.includes('const workbenchContextKey ='), true)
  assert.equal(file.includes('previousWorkbenchContextKey'), true)
  assert.equal(file.includes("const [assistMode, setAssistMode] = useState<EvaluationAssistMode>('draft')"), true)
  assert.equal(file.includes('const [copiedPreviewMode, setCopiedPreviewMode] = useState<EvaluationAssistMode | null>(null)'), true)
  assert.equal(file.includes("const [selectedEvidenceSection, setSelectedEvidenceSection] = useState<EvidenceSectionKey>('highlights')"), true)
  assert.equal(file.includes("const [guideStatus, setGuideStatus] = useState({ viewed: false, confirmed: false })"), true)
  assert.equal(file.includes("setNotice('')"), true)
  assert.equal(file.includes("setErrorNotice('')"), true)
  assert.equal(file.includes('setDecisionBusy(false)'), true)
  assert.equal(file.includes('setGuideBusy(false)'), true)
  assert.equal(file.includes('setPreview(null)'), true)
  assert.equal(file.includes("setSelectedEvidenceSection('highlights')"), true)
  assert.equal(file.includes("setAssistMode('draft')"), true)
})

run('evaluation workbench renders goal-linked context with safe link handling and stale reset', () => {
  const file = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
  const loader = read('src/server/evaluation-workbench.ts')

  assert.equal(file.includes('GoalContextBlock'), true)
  assert.equal(file.includes('const [expandedGoalContextId, setExpandedGoalContextId] = useState<string | null>(null)'), true)
  assert.equal(file.includes('setExpandedGoalContextId(null)'), true)
  assert.equal(file.includes('연결 목표 맥락'), true)
  assert.equal(file.includes('관련 링크'), true)
  assert.equal(file.includes('target="_blank"'), true)
  assert.equal(file.includes('rel="noreferrer noopener"'), true)
  assert.equal(loader.includes('goalContext:'), true)
  assert.equal(loader.includes('buildGoalContextPeriodLabel'), true)
  assert.equal(loader.includes('buildGoalAchievementSummary'), true)
})

run('evaluation workbench exposes integrated guide and guide audit route for evaluator education', () => {
  const file = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
  const guideRoute = read('src/app/api/evaluation/[id]/guide/route.ts')

  assert.equal(file.includes('평가 가이드'), true)
  assert.equal(file.includes("activeTab === 'guide' ? ("), true)
  assert.equal(file.includes('guideStatus.confirmed'), true)
  assert.equal(file.includes("props.currentUser?.role === 'ROLE_ADMIN' && props.adminSummary ? ("), true)
  assert.equal(guideRoute.includes('EVALUATION_GUIDE_VIEWED'), true)
  assert.equal(guideRoute.includes('EVALUATION_GUIDE_CONFIRMED'), true)
  assert.equal(guideRoute.includes("evaluation.evaluatorId === session.user.id || session.user.role === 'ROLE_ADMIN'"), true)
})

run('evaluation workbench quality warnings guide without blocking the existing save flow', () => {
  const file = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')

  assert.equal(file.includes('QualityWarningPanel'), true)
  assert.equal(file.includes('buildEvaluationQualityWarnings'), true)
  assert.equal(file.includes("disabled={!selected?.permissions.canEdit || isPending}"), true)
})

run('personal KPI create CTA transition opens editor even outside ready state', () => {
  const transition = getPersonalKpiHeroCtaTransition('create')
  const file = read('src/components/kpi/PersonalKpiManagementClient.tsx')

  assert.deepEqual(transition, { nextTab: 'mine', openEditor: true })
  assert.equal(file.includes("setForm(buildEmptyForm(props.selectedYear, props.selectedEmployeeId))"), true)
  assert.equal(file.includes('setAiPreview(null)'), true)
  assert.equal(file.includes('setEditorOpen(true)'), true)
})

run('personal KPI AI CTA transition opens visible AI surface in non-ready states', () => {
  const transition = getPersonalKpiHeroCtaTransition('ai')
  const file = read('src/components/kpi/PersonalKpiManagementClient.tsx')

  assert.deepEqual(transition, { nextTab: 'ai', openEditor: false })
  assert.equal(file.includes("const transition = getPersonalKpiHeroCtaTransition('ai')"), true)
  assert.equal(file.includes('setActiveTab(transition.nextTab)'), true)
  assert.equal(file.includes("activeTab === 'ai' ? ("), true)
})

run('personal KPI history and review CTAs stay usable in non-ready states', () => {
  const file = read('src/components/kpi/PersonalKpiManagementClient.tsx')

  assert.equal(PERSONAL_KPI_REVIEW_CTA_LABEL, '검토 대기 보기')
  assert.equal(file.includes(PERSONAL_KPI_REVIEW_CTA_LABEL), true)
  assert.equal(file.includes("activeTab === 'review' ? ("), true)
  assert.equal(file.includes("activeTab === 'history' ? ("), true)
  assert.equal(file.includes('<StatePanel state={props.state} message={props.message} />'), true)
  assert.equal(file.includes('<Tabs activeTab={activeTab} onChange={setActiveTab} />'), true)
})

run('personal KPI submit CTA explains disabled reasons and enables only for draft selection', () => {
  const emptyState = getPersonalKpiSubmitCtaState({
    canSubmit: true,
    totalCount: 0,
    selectedKpiStatus: null,
    hasSelectedKpi: false,
    workflowSaving: false,
  })
  const nonDraftState = getPersonalKpiSubmitCtaState({
    canSubmit: true,
    totalCount: 2,
    selectedKpiStatus: 'CONFIRMED',
    hasSelectedKpi: true,
    workflowSaving: false,
  })
  const readyState = getPersonalKpiSubmitCtaState({
    canSubmit: true,
    totalCount: 2,
    selectedKpiStatus: 'DRAFT',
    hasSelectedKpi: true,
    workflowSaving: false,
  })
  const file = read('src/components/kpi/PersonalKpiManagementClient.tsx')

  assert.equal(emptyState.disabled, true)
  assert.equal(emptyState.reason, '제출하려면 KPI를 먼저 1개 이상 작성하세요.')
  assert.equal(nonDraftState.disabled, true)
  assert.equal(nonDraftState.reason, '제출하려면 선택한 KPI가 초안 상태여야 합니다.')
  assert.equal(readyState.disabled, false)
  assert.equal(file.includes('data-testid="personal-kpi-submit-helper"'), true)
  assert.equal(file.includes('disabled={props.submitState.disabled}'), true)
})

run('personal KPI client no longer uses early return that hides CTA targets', () => {
  const file = read('src/components/kpi/PersonalKpiManagementClient.tsx')

  assert.equal(file.includes("if (props.state !== 'ready') {"), false)
  assert.equal(file.includes("props.state === 'ready' ? ("), true)
  assert.equal(file.includes('{editorOpen ? ('), true)
})

console.log('Interaction integrity tests completed')
