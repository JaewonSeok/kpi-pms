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
