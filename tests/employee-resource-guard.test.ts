import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// 한 건이 실패해도 나머지 케이스 결과를 함께 보도록 끝까지 돌고, 실패가 있으면 exit 1 로 끝낸다.
function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function countOccurrences(source: string, needle: string) {
  return source.split(needle).length - 1
}

function sliceBetween(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `시작 표식을 찾지 못했다: ${startMarker}`)
  const end = source.indexOf(endMarker, start)
  assert.notEqual(end, -1, `끝 표식을 찾지 못했다: ${endMarker}`)
  return source.slice(start, end)
}

// F5·F7·F11 — 역할만 보고 actor-target 관계를 보지 않던 세 라우트가
// canAccessManagedEmployeeContext(직속 3슬롯 · ADMIN/CEO · 자기 제외)를 거친다.
const developmentPlanRoute = read('src/app/api/development-plans/route.ts')
const monthlyWorkflowRoute = read('src/app/api/kpi/monthly-record/[id]/workflow/route.ts')
const personalWorkflowRoute = read('src/app/api/kpi/personal/[id]/workflow/route.ts')

// await 를 하나라도 빠뜨리면 Promise 가 truthy 라 가드가 통째로 무력화된다. 그래서 "있다"가 아니라 "정확히 3회"다.
run('① development-plans: GET·POST·PATCH 가 모두 await canManageEmployeePlan 을 거친다', () => {
  assert.equal(countOccurrences(developmentPlanRoute, 'await canManageEmployeePlan'), 3)
})

run('② development-plans: canAccessManagedEmployeeContext 를 import 한다', () => {
  const importsHelper =
    /import \{[^}]*\bcanAccessManagedEmployeeContext\b[^}]*\} from '@\/server\/checkin-access'/.test(developmentPlanRoute)
  assert.equal(importsHelper, true)
})

// 헬퍼는 employee.id === sessionUserId 를 false 로 처리한다. 본인 분기가 헬퍼보다 앞에 없으면
// 자기 성장계획을 본인이 못 본다.
run('③ development-plans: 본인 분기가 헬퍼 호출보다 앞에 남아 있다', () => {
  const guard = sliceBetween(developmentPlanRoute, 'async function canManageEmployeePlan(', 'export async function GET')
  const selfBranch = guard.indexOf('session.user.id === employeeId')
  const helperCall = guard.indexOf('canAccessManagedEmployeeContext(')
  assert.notEqual(selfBranch, -1)
  assert.notEqual(helperCall, -1)
  assert.equal(selfBranch < helperCall, true)
})

run('④ monthly-record workflow: REVIEW·REQUEST_UPDATE 분기가 canAccessManagedEmployeeContext 를 호출한다', () => {
  const reviewBranch = sliceBetween(
    monthlyWorkflowRoute,
    "validated.data.action === 'REVIEW'",
    "validated.data.action === 'LOCK'"
  )
  assert.equal(reviewBranch.includes('canAccessManagedEmployeeContext('), true)
})

run('⑤ personal workflow: LOCKED·CONFIRMED 재오픈 분기가 canAccessManagedEmployeeContext 를 호출한다', () => {
  const reopenBranch = sliceBetween(
    personalWorkflowRoute,
    "operationalStatus === 'LOCKED' || operationalStatus === 'CONFIRMED'",
    'PERSONAL_KPI_REOPENED'
  )
  assert.equal(reopenBranch.includes('canAccessManagedEmployeeContext('), true)
})

// ⑤와 같은 파일이라 "파일에 호출이 있다"로는 ⑤만으로 통과한다. ARCHIVED 분기 블록으로 범위를 좁힌다.
run('⑥ personal workflow: ARCHIVED 재오픈 분기가 canAccessManagedEmployeeContext 를 호출한다', () => {
  const archivedMarker = "operationalStatus === 'ARCHIVED'"
  assert.equal(countOccurrences(personalWorkflowRoute, archivedMarker), 1)
  const archivedBranch = sliceBetween(
    personalWorkflowRoute,
    archivedMarker,
    "operationalStatus === 'LOCKED' || operationalStatus === 'CONFIRMED'"
  )
  assert.equal(archivedBranch.includes('canAccessManagedEmployeeContext('), true)
})

console.log('Employee resource guard tests completed')
