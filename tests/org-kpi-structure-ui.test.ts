import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

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

run('org KPI hierarchy panel keeps the current structure workspace hooks', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.equal(source.includes('function OrgKpiHierarchyPanel'), true)
  assert.equal(source.includes('HierarchySummaryField'), true)
  assert.equal(source.includes('handleCreateChildGoal'), true)
  assert.equal(source.includes('handleViewLinkage'), true)
})

run('org KPI hierarchy source removes noisy badge-cloud era helpers', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.doesNotMatch(source, /buildOrgKpiConnectionBadges\(/)
  assert.doesNotMatch(source, /function OrgKpiStructureLegend/)
  assert.doesNotMatch(source, /StatusBadge status=\{node\.kpi\.status\}/)
})

run('org KPI detail card exposes an independently scrollable sidebar shell on wide layouts', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(source, /data-testid="org-kpi-detail-scroll-region"/)
  assert.match(source, /xl:max-h-\[calc\(100vh-8rem\)\]/)
  assert.match(source, /xl:overflow-y-auto/)
  assert.match(source, /xl:overscroll-y-contain/)
  assert.match(source, /data-testid="org-kpi-detail-sticky-header"/)
  assert.match(source, /xl:sticky/)
  assert.match(source, /role="region"/)
  assert.match(source, /tabIndex=\{0\}/)
})

run('org KPI map and list tabs keep the search field only in the upper toolbar area', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(source, /<OrgKpiSearchField\s+value=\{search\}\s+onChange=\{setSearch\}\s+searchTargetLabel=\{searchTargetLabel\}/)
  assert.match(source, /tab === 'map' \|\| tab === 'list' \? \(\s*<div className="w-full lg:w-80 xl:w-96">\s*<OrgKpiSearchField/)
  assert.match(source, /mt-5 border-t border-slate-200 pt-4/)
  assert.equal(source.includes('searchTargetLabel'), true)
})

run('org KPI map and list tabs use true two-column bodies without reviving removed top filters', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_440px\]/)
  assert.doesNotMatch(source, /Field label="연도"/)
  assert.doesNotMatch(source, /본부 범위/)
  assert.doesNotMatch(source, /팀 범위/)
  assert.doesNotMatch(source, /function OrgKpiDepartmentFilterToolbar/)
  assert.doesNotMatch(source, /function OrgKpiDepartmentFilterButtons/)
  assert.doesNotMatch(source, /function OrgKpiScopeSidebar/)
  assert.match(source, /\{tab === 'list' \? \([\s\S]*?xl:grid-cols-\[minmax\(0,1fr\)_440px\]/)
  assert.match(source, /\{tab === 'map' \? \([\s\S]*?xl:grid-cols-\[minmax\(0,1fr\)_440px\]/)
})

run('org KPI workspace removes dashboard-style summary metric rows from the top area', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.doesNotMatch(source, /function MetricCard/)
})

run('org KPI tabs use list-first ordering with stable key-based content mapping', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(source, /const TAB_ORDER: TabKey\[\] = \['list', 'map', 'linkage', 'history'\]/)
  assert.match(source, /const MEMBER_TAB_ORDER: TabKey\[\] = \['list', 'map', 'linkage', 'history'\]/)
  assert.match(source, /const defaultTab =\s*normalizedInitialTab && visibleTabs\.includes\(normalizedInitialTab\) \? normalizedInitialTab : visibleTabs\[0\] \?\? 'list'/)
  assert.match(source, /setTab\(visibleTabs\[0\] \?\? 'list'\)/)
  assert.match(source, /\{tab === 'list' \? \(/)
  assert.match(source, /\{tab === 'map' \? \(/)
  assert.doesNotMatch(source, /\{tab === 'ai' \? \(/)
})

run('org KPI route and client drop removed year and department URL wiring', () => {
  const pageSource = read('src/app/(main)/kpi/org/page.tsx')
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
  const loaderSource = read('src/server/org-kpi-page.ts')

  assert.doesNotMatch(pageSource, /selectedDepartmentId: resolvedSearchParams\.dept/)
  assert.doesNotMatch(pageSource, /initialDepartmentFilterId/)
  assert.doesNotMatch(pageSource, /const year = resolvedSearchParams\.year/)
  assert.doesNotMatch(clientSource, /useSearchParams/)
  assert.doesNotMatch(clientSource, /\['year',/)
  assert.doesNotMatch(clientSource, /\['dept',/)
  assert.doesNotMatch(loaderSource, /availableYears: number\[\]/)
})

run('org KPI loader keeps scope labels and empty-state copy as readable Korean UTF-8 literals', () => {
  const loaderSource = read('src/server/org-kpi-page.ts')

  assert.match(loaderSource, /label: '본부 KPI'/)
  assert.match(loaderSource, /label: '팀 KPI'/)
  assert.match(loaderSource, /본부·실 등 상위 조직이 관리하는 KPI를 확인합니다/)
  assert.match(loaderSource, /실제 실행 조직이 운영하는 KPI를 확인합니다/)
  assert.match(loaderSource, /message: '조직 정보가 아직 준비되지 않았습니다\.'/)
})

run('org KPI action areas remove lock and duplicate history-view entry points while preserving the history tab', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.doesNotMatch(source, /ActionButton label="?좉툑"/)
  assert.doesNotMatch(source, /ActionButton label="?대젰 蹂닿린"/)
  assert.doesNotMatch(source, /onWorkflow\('LOCK'\)/)
  assert.doesNotMatch(source, /\(action: 'SUBMIT' \| 'LOCK' \| 'REOPEN'\)/)
  assert.match(source, /\{tab === 'history' \? \(/)
})

run('org KPI removes the bounded AI improve trigger and the dedicated AI tab workspace', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.doesNotMatch(source, /ActionButton label=\"AI 媛쒖꽑\"/)
  assert.doesNotMatch(source, /onAi:\s*\(action:\s*AiAction\)\s*=>\s*void/)
  assert.doesNotMatch(source, /onAi=\{handleAiAction\}/)
  assert.doesNotMatch(source, /const handleAiAction = useCallback/)
  assert.doesNotMatch(source, /\{tab === 'ai' \? \(/)
  assert.doesNotMatch(source, /<KpiAiPreviewPanel/)
  assert.doesNotMatch(source, /OrgKpiTeamAiWorkspace/)
  assert.doesNotMatch(source, /requestAi\(/)
  assert.doesNotMatch(source, /decideAi\(/)
})

