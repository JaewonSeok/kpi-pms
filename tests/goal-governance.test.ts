import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { EvalCycleSchema, UpdateEvalCycleSchema } from '../src/lib/validations'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
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

async function main() {
  await run('eval cycle schemas accept goal edit mode values for 운영 읽기 모드 설정', () => {
    const createParsed = EvalCycleSchema.safeParse({
      orgId: 'org-1',
      evalYear: 2026,
      cycleName: '2026 상반기',
      goalEditMode: 'CHECKIN_ONLY',
    })
    const updateParsed = UpdateEvalCycleSchema.safeParse({
      goalEditMode: 'FULL',
    })

    assert.equal(createParsed.success, true)
    assert.equal(updateParsed.success, true)
  })

  await run('admin eval cycle surfaces and persists goal edit mode settings', () => {
    const adminClient = read('src/components/admin/AdminEvalCycleClient.tsx')
    const createRoute = read('src/app/api/admin/eval-cycles/route.ts')
    const updateRoute = read('src/app/api/admin/eval-cycles/[id]/route.ts')

    assert.equal(adminClient.includes('goalEditMode'), true)
    assert.equal(adminClient.includes('CHECKIN_ONLY'), true)
    assert.equal(adminClient.includes('체크인 / 코멘트만 허용'), true)
    assert.equal(createRoute.includes('goalEditMode: data.goalEditMode'), true)
    assert.equal(updateRoute.includes('goalEditMode: data.goalEditMode'), true)
  })

  await run('personal and org KPI routes block goal mutations in check-in-only mode on the server', () => {
    const personalCreate = read('src/app/api/kpi/personal/route.ts')
    const personalUpdate = read('src/app/api/kpi/personal/[id]/route.ts')
    const personalWorkflow = read('src/app/api/kpi/personal/[id]/workflow/route.ts')
    const orgCreate = read('src/app/api/kpi/org/route.ts')
    const orgUpdate = read('src/app/api/kpi/org/[id]/route.ts')
    const orgWorkflow = read('src/app/api/kpi/org/[id]/workflow/route.ts')

    assert.equal(personalCreate.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(personalUpdate.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(personalWorkflow.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(personalWorkflow.includes("['SAVE_DRAFT', 'SUBMIT', 'REOPEN']"), true)
    assert.equal(orgCreate.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(orgUpdate.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(orgWorkflow.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(orgWorkflow.includes("['SUBMIT', 'REOPEN']"), true)
  })

  await run('personal KPI loader and client expose read-only alerts, rejected count context, and goal tags', () => {
    const loaderSource = read('src/server/personal-kpi-page.ts')
    const clientSource = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(loaderSource.includes("title: '현재 목표는 읽기 전용 모드입니다.'"), true)
    assert.equal(loaderSource.includes('canCreate: goalEditLocked ? false : basePermissions.canCreate'), true)
    assert.equal(loaderSource.includes('canSubmit: goalEditLocked ? false : basePermissions.canSubmit'), true)
    assert.equal(loaderSource.includes('tags: parseTags(kpi.tags)'), true)
    assert.equal(clientSource.includes('parseTagInput'), true)
    assert.equal(clientSource.includes('목표 태그'), true)
    assert.equal(clientSource.includes('props.summary.rejectedCount'), true)
    assert.equal(clientSource.includes('selectedItem.tags.length'), true)
    assert.equal(clientSource.includes('data-testid="personal-kpi-rejected-count"'), true)
    assert.equal(clientSource.includes('goalEditLocked'), true)
  })

  await run('personal KPI workspace supports weight approval context, re-request labels, and bulk goal edit flow', () => {
    const clientSource = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const bulkRoute = read('src/app/api/kpi/personal/bulk/route.ts')
    const workflowRoute = read('src/app/api/kpi/personal/[id]/workflow/route.ts')

    assert.equal(clientSource.includes('WeightApprovalSummaryCard'), true)
    assert.equal(clientSource.includes('BulkEditPersonalKpiModal'), true)
    assert.equal(clientSource.includes('handleSaveBulkEdit'), true)
    assert.equal(clientSource.includes('/api/kpi/personal/bulk'), true)
    assert.equal(clientSource.includes('current weight'), false)
    assert.equal(clientSource.includes('orgLineage'), true)
    assert.equal(clientSource.includes('submitLabel'), true)
    assert.equal(clientSource.includes('수정 후 승인 재요청'), true)
    assert.equal(bulkRoute.includes('PERSONAL_KPI_BULK_UPDATED'), true)
    assert.equal(workflowRoute.includes("weightApprovalStatus: 'REQUESTED'"), true)
  })

  await run('org KPI loader and client reflect read-only gating, team approval state, and tag context in the live workspace', () => {
    const loaderSource = read('src/server/org-kpi-page.ts')
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(loaderSource.includes("title: '현재 목표는 읽기 전용 모드입니다.'"), true)
    assert.equal(loaderSource.includes('canCreate: goalEditLocked ? false : canManage'), true)
    assert.equal(loaderSource.includes('tags: parseTags(kpi.tags)'), true)
    assert.equal(clientSource.includes('goalEditLocked'), true)
    assert.equal(clientSource.includes('parseTagInput'), true)
    assert.equal(clientSource.includes('kpi.tags.length'), true)
    assert.equal(clientSource.includes('내 팀원 목표 승인 상태'), true)
    assert.equal(clientSource.includes('kpi.linkedConfirmedPersonalKpiCount'), true)
    assert.equal(clientSource.includes('kpi.linkedPersonalKpis.length'), true)
    assert.equal(clientSource.includes("!['DRAFT', 'SUBMITTED', 'LOCKED'].includes(kpi.status)"), true)
    assert.equal(clientSource.includes('data-testid="org-kpi-detail-scroll-region"'), true)
    assert.equal(clientSource.includes('data-testid="org-kpi-detail-sticky-header"'), true)
    assert.equal(clientSource.includes('xl:max-h-[calc(100vh-8rem)]'), true)
    assert.equal(clientSource.includes('xl:overflow-y-auto'), true)
    assert.equal(clientSource.includes('xl:overscroll-y-contain'), true)
    assert.equal(clientSource.includes('OrgKpiSearchField'), true)
    assert.equal(clientSource.includes('searchTargetLabel'), true)
    assert.equal(clientSource.includes('Field label="연도"'), false)
    assert.equal(clientSource.includes('본부 범위'), false)
    assert.equal(clientSource.includes('팀 범위'), false)
    assert.equal(clientSource.includes('OrgKpiDepartmentFilterToolbar'), false)
    assert.equal(clientSource.includes('OrgKpiDepartmentFilterButtons'), false)
    assert.equal(clientSource.includes('ActionButton label="잠금"'), false)
    assert.equal(clientSource.includes('ActionButton label="이력 보기"'), false)
    assert.equal(clientSource.includes("(action: 'SUBMIT' | 'LOCK' | 'REOPEN')"), false)
    assert.equal(clientSource.includes("tab === 'map' || tab === 'list'"), true)
    assert.equal(clientSource.includes('xl:grid-cols-[minmax(0,1fr)_440px]'), true)
    assert.equal(clientSource.includes('mt-5 border-t border-slate-200 pt-4'), true)
    assert.equal(clientSource.includes('function OrgKpiScopeSidebar'), false)
    assert.equal(clientSource.includes("const TAB_ORDER: TabKey[] = ['list', 'map', 'linkage', 'history', 'ai']"), true)
    assert.equal(clientSource.includes("const MEMBER_TAB_ORDER: TabKey[] = ['list', 'map', 'linkage', 'history']"), true)
    assert.equal(clientSource.includes('하위 KPI 연결 비율'), false)
    assert.equal(clientSource.includes('월간 실적 반영 비율'), false)
    assert.equal(clientSource.includes('function MetricCard'), false)
    assert.equal(loaderSource.includes('unlinkedCount'), false)
    assert.equal(loaderSource.includes('cascadeRate'), false)
    assert.equal(loaderSource.includes('monthlyCoverageRate'), false)
    assert.equal(loaderSource.includes('availableYears: number[]'), false)
    assert.equal(loaderSource.includes('canLock: boolean'), false)
  })

  await run('org KPI workspace supports bulk edit and export mode selection routes', () => {
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
    const bulkRoute = read('src/app/api/kpi/org/bulk-edit/route.ts')
    const exportRoute = read('src/app/api/kpi/export/route.ts')
    const exportService = read('src/server/kpi-export.ts')

    assert.equal(clientSource.includes('handleSaveBulkEdit'), true)
    assert.equal(clientSource.includes('handleExportGoals'), true)
    assert.equal(clientSource.includes('OrgBulkEditModal'), true)
    assert.equal(clientSource.includes('GoalExportModal'), true)
    assert.equal(clientSource.includes('/api/kpi/org/bulk-edit'), true)
    assert.equal(clientSource.includes('/api/kpi/export?'), true)
    assert.equal(clientSource.includes("mode: 'goal'"), true)
    assert.equal(clientSource.includes("mode: 'employee'"), true)
    assert.equal(bulkRoute.includes('ORG_KPI_BULK_UPDATED'), true)
    assert.equal(exportRoute.includes('GoalExportSchema'), true)
    assert.equal(exportService.includes("mode === 'goal'"), true)
  })

  await run('review reference goal context uses shared goal weight display formatting', () => {
    const source = read('src/server/feedback-360.ts')

    assert.equal(source.includes('formatGoalWeightLabel'), true)
  })

  console.log('Goal governance tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
