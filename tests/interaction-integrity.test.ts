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
    'src/app/api/kpi/org/bulk/route.ts',
    'src/app/api/admin/notification-templates/test-send/route.ts',
  ]

  for (const file of requiredRoutes) {
    assert.equal(existsSync(path.resolve(process.cwd(), file)), true, `${file} should exist`)
  }
})

run('expired-session KPI pages redirect to login', () => {
  const personalPage = read('src/app/(main)/kpi/personal/page.tsx')
  const monthlyPage = read('src/app/(main)/kpi/monthly/page.tsx')

  assert.equal(personalPage.includes("redirect('/login')"), true)
  assert.equal(monthlyPage.includes("redirect('/login')"), true)
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

run('org KPI client resets stale selection and AI state when year or department context changes', () => {
  const file = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.equal(file.includes('const serverContextKey ='), true)
  assert.equal(file.includes('const viewContextKey ='), true)
  assert.equal(file.includes('setSelectedDepartmentId(defaultDepartmentSelection)'), true)
  assert.equal(file.includes("setTab('map')"), true)
  assert.equal(file.includes('setAiPreview(null)'), true)
  assert.equal(file.includes("const saved = await fetchJson<{ id: string; deptId: string }>("), true)
  assert.equal(file.includes('setSelectedKpiId(saved.id)'), true)
})

run('notification ops client uses real test send and dead-letter actions', () => {
  const file = read('src/components/notifications/NotificationOpsClient.tsx')

  assert.equal(file.includes('/api/admin/notification-templates/test-send'), true)
  assert.equal(file.includes('/api/admin/notification-dead-letters'), true)
  assert.equal(file.includes('/api/cron/notifications'), true)
})

run('evaluation workbench clears stale notices when cycle or evaluation context changes', () => {
  const file = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')

  assert.equal(file.includes('const workbenchContextKey ='), true)
  assert.equal(file.includes('previousWorkbenchContextKey'), true)
  assert.equal(file.includes("setNotice('')"), true)
  assert.equal(file.includes("setErrorNotice('')"), true)
  assert.equal(file.includes('setDecisionBusy(false)'), true)
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
