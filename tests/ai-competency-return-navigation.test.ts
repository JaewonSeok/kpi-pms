import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  AI_COMPETENCY_EMPLOYEE_PATH,
  buildAiCompetencyAdminCaseHref,
  buildAiCompetencyAdminHref,
  buildAiCompetencyAdminListHref,
  buildAiCompetencyEmployeeReturnTarget,
  isSafeInternalReturnPath,
  resolveSafeReturnTo,
} from '../src/lib/ai-competency-gate-navigation'

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

const employeeSource = read('src/components/evaluation/AiCompetencyClient.tsx')
const adminSource = read('src/components/evaluation/AiCompetencyAdminPanel.tsx')
const detailSource = read('src/components/evaluation/AiCompetencyCaseReviewPage.tsx')

run('safe returnTo resolver accepts only safe internal paths', () => {
  assert.equal(isSafeInternalReturnPath('/evaluation/ai-competency'), true)
  assert.equal(isSafeInternalReturnPath('/evaluation/ai-competency?cycleId=cycle-1'), true)
  assert.equal(isSafeInternalReturnPath('https://example.com/evil'), false)
  assert.equal(isSafeInternalReturnPath('javascript:alert(1)'), false)
  assert.equal(isSafeInternalReturnPath('//evil.example.com'), false)
  assert.equal(isSafeInternalReturnPath('/\\evil'), false)
})

run('unsafe or missing returnTo values fall back to the employee AI competency route', () => {
  assert.equal(resolveSafeReturnTo(undefined), AI_COMPETENCY_EMPLOYEE_PATH)
  assert.equal(resolveSafeReturnTo('https://example.com/evil'), AI_COMPETENCY_EMPLOYEE_PATH)
  assert.equal(resolveSafeReturnTo('javascript:alert(1)'), AI_COMPETENCY_EMPLOYEE_PATH)
})

run('employee to admin href builder preserves useful employee search params in returnTo', () => {
  const employeeReturnTarget = buildAiCompetencyEmployeeReturnTarget({
    pathname: AI_COMPETENCY_EMPLOYEE_PATH,
    searchParams: 'cycleId=cycle-2026&tab=guide&returnTo=https://evil.example.com',
  })

  assert.equal(
    employeeReturnTarget,
    '/evaluation/ai-competency?cycleId=cycle-2026&tab=guide'
  )
  assert.equal(
    buildAiCompetencyAdminHref({ returnTo: employeeReturnTarget }),
    '/evaluation/ai-competency/admin?returnTo=%2Fevaluation%2Fai-competency%3FcycleId%3Dcycle-2026%26tab%3Dguide'
  )
})

run('admin list and detail href builders preserve returnTo and optional cycle context', () => {
  assert.equal(
    buildAiCompetencyAdminListHref({
      cycleId: 'cycle-2026',
      returnTo: '/evaluation/ai-competency?cycleId=cycle-2026',
    }),
    '/evaluation/ai-competency/admin?cycleId=cycle-2026&returnTo=%2Fevaluation%2Fai-competency%3FcycleId%3Dcycle-2026'
  )

  assert.equal(
    buildAiCompetencyAdminCaseHref({
      caseId: 'case-1',
      cycleId: 'cycle-2026',
      returnTo: '/evaluation/ai-competency?cycleId=cycle-2026',
    }),
    '/evaluation/ai-competency/admin/case-1?cycleId=cycle-2026&returnTo=%2Fevaluation%2Fai-competency%3FcycleId%3Dcycle-2026'
  )
})

run('employee, admin, and detail screens all wire the reciprocal return action in the header action area', () => {
  assert.match(employeeSource, /관리자\/검토자 화면/)
  assert.match(employeeSource, /buildAiCompetencyAdminHref/)
  assert.match(employeeSource, /buildAiCompetencyEmployeeReturnTarget/)

  assert.match(adminSource, /내 AI 역량평가 화면/)
  assert.match(adminSource, /ArrowLeft/)
  assert.match(adminSource, /actions=\{/)
  assert.match(adminSource, /buildAiCompetencyAdminListHref/)
  assert.match(adminSource, /buildAiCompetencyAdminCaseHref/)

  assert.match(detailSource, /내 AI 역량평가 화면/)
  assert.match(detailSource, /ArrowLeft/)
  assert.match(detailSource, /대시보드로 돌아가기/)
  assert.match(detailSource, /buildAiCompetencyAdminListHref/)
})

console.log('AI competency return-navigation tests completed')
