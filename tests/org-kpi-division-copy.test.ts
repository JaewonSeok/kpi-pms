import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isOrgKpiTopLevelDivisionGoal } from '../src/lib/org-kpi-hierarchy'

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

run('top-level division helper matches only division KPIs without upper-goal links', () => {
  assert.equal(
    isOrgKpiTopLevelDivisionGoal({
      scope: 'division',
      parentOrgKpiId: null,
      parentOrgKpiTitle: null,
      parentReference: null,
    }),
    true,
  )

  assert.equal(
    isOrgKpiTopLevelDivisionGoal({
      scope: 'team',
      parentOrgKpiId: null,
      parentOrgKpiTitle: null,
      parentReference: null,
    }),
    false,
  )

  assert.equal(
    isOrgKpiTopLevelDivisionGoal({
      scope: 'division',
      parentOrgKpiId: 'parent-kpi',
      parentOrgKpiTitle: null,
      parentReference: null,
    }),
    false,
  )
})

run('org KPI detail copy explains top-level division goals without replacing true missing-link copy', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(source, /현재 목표와 연결된 하위 목표 및 실행 상태를 확인할 수 있습니다\./)
  assert.match(source, /본부 KPI는 최상위 목표로 관리되며, 별도의 상위 KPI가 없습니다\./)
  assert.match(source, /현재 KPI는 상위 목표와 아직 연결되지 않았습니다\./)
  assert.match(source, /현재 KPI는 상위 조직 목표와 아직 연결되지 않았습니다\./)
  assert.match(source, /isOrgKpiTopLevelDivisionGoal/)
})
