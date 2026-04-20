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

run('org KPI workspace removes the duplicate map tab and normalizes legacy map links', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /type TabKey = 'list' \| 'linkage' \| 'history' \| 'ai'/)
  assert.equal(clientSource.includes("map: '목표 맵'"), false)
  assert.match(clientSource, /function normalizeOrgKpiTab/)
  assert.match(clientSource, /if \(value === 'map'\) return 'list'/)
  assert.match(clientSource, /조직 KPI 목록/)
  assert.match(clientSource, /조직 KPI를 검색하고, 부서별로 살펴보며 연결 상태와 상세 정보를 확인합니다\./)
  assert.match(clientSource, /목록에서 KPI를 선택하면 상세 정보가 표시됩니다\./)
})

run('goal alignment links no longer generate the removed map tab query', () => {
  const source = read('src/server/goal-alignment.ts')

  assert.equal(source.includes('tab=map'), false)
  assert.match(source, /href: `\/kpi\/org\?year=\$\{selectedYear\}&dept=\$\{encodeURIComponent\(goal\.deptId\)\}&kpiId=\$\{encodeURIComponent\(goal\.id\)\}`/)
  assert.match(source, /selectedDepartmentId === 'ALL'\s*\?\s*`\/kpi\/org\?year=\$\{selectedYear\}`/)
})

console.log('Org KPI tab role tests completed')
