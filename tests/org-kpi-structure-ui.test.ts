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

run('org KPI hierarchy panel uses the simplified structure copy and actions', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(source, /연결된 목표 구조/)
  assert.match(source, /현재 선택한 목표와 연결된 상위·하위 구조를 간단히 확인할 수 있습니다\./)
  assert.match(source, /연결 현황 요약/)
  assert.match(source, /표시할 하위 목표가 없습니다/)
  assert.match(source, /현재 필터 조건에서 보이는 하위 목표가 없습니다/)
  assert.match(source, /상세 보기/)
  assert.match(source, /하위 목표 펼치기/)
  assert.match(source, /하위 목표 접기/)
  assert.match(source, /연결 현황 보기/)
  assert.match(source, /담당자/)
})

run('org KPI hierarchy source removes noisy badge-cloud era strings', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.doesNotMatch(source, /buildOrgKpiConnectionBadges\(/)
  assert.doesNotMatch(source, /function OrgKpiStructureLegend/)
  assert.doesNotMatch(source, /연결 상태 확인/)
  assert.doesNotMatch(source, /상위 목표로 이동/)
  assert.doesNotMatch(source, /연결 주의/)
  assert.doesNotMatch(source, /cascade 후보 부족/)
  assert.doesNotMatch(source, /StatusBadge status=\{node\.kpi\.status\}/)
})

run('org KPI detail summary keeps diagnostics after first-view simplification', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(source, /대상 인원 연결률/)
  assert.match(source, /연결 리스크/)
  assert.match(source, /개인 KPI 연결과 대상 인원 연결률은 하위 KPI 수가 아니라/)
  assert.match(source, /하위 목표 추가/)
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

run('org KPI map tab promotes the search field into the upper toolbar area', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(source, /<OrgKpiSearchField\s+value=\{search\}\s+onChange=\{setSearch\}\s+departmentFilterLabel=\{departmentFilterLabel\}/)
  assert.match(source, /tab === 'map' \? \(\s*<div className="w-full lg:w-80 xl:w-96">\s*<OrgKpiSearchField/)
  assert.match(source, /mt-5 border-t border-slate-200 pt-4/)
  assert.match(source, /placeholder=\{`KPI명 또는 \$\{props\.departmentFilterLabel\.replace\(' 범위', ''\)\} 검색`\}/)
})

run('org KPI map tab uses a true two-column body with the department filter moved above the workspace', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(source, /<OrgKpiDepartmentFilterToolbar/)
  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_440px\]/)
  assert.match(source, /function OrgKpiDepartmentFilterButtons/)
  assert.match(source, /className="self-start space-y-3"/)
})

run('org KPI workspace removes dashboard-style summary metric rows from the top area', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.doesNotMatch(source, /하위 KPI 연결 비율/)
  assert.doesNotMatch(source, /미연결 .* 수/)
  assert.doesNotMatch(source, /월간 실적 반영 비율/)
  assert.doesNotMatch(source, /function MetricCard/)
})
