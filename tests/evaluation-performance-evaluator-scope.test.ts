import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8')
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
  const loaderSource = read('src/server/evaluation-workbench.ts')
  const performancePageSource = read('src/app/(main)/evaluation/performance/page.tsx')
  const permissionsSource = read('src/lib/auth/permissions.ts')
  const dashboardSource = read('src/components/evaluation/performance/PerformanceHrOpsDashboard.tsx')
  const workbenchSource = read('src/app/(main)/evaluation/workbench/page.tsx')
  const navigationSource = read('src/lib/navigation.ts')

  await run('loadEvaluations scopes to evaluatorId + SELF for non-ADMIN sessions', () => {
    assert.match(loaderSource, /sessionUser\.role === 'ROLE_ADMIN'/)
    assert.match(loaderSource, /evalCycleId: cycleId/)
    assert.match(loaderSource, /evaluatorId: sessionUser\.id/)
    assert.match(loaderSource, /targetId: sessionUser\.id/)
    assert.match(loaderSource, /evalStage: 'SELF'/)
  })

  await run('performance/page.tsx opens to evaluator roles and replaces ROLE_ADMIN-only guard', () => {
    assert.match(performancePageSource, /ROLE_CEO/)
    assert.match(performancePageSource, /ROLE_DIV_HEAD/)
    assert.match(performancePageSource, /ROLE_SECTION_CHIEF/)
    assert.match(performancePageSource, /ROLE_TEAM_LEADER/)
    assert.match(performancePageSource, /canSeeAllInCycle/)
    assert.doesNotMatch(performancePageSource, /session\.user\.role !== 'ROLE_ADMIN'/)
    assert.match(performancePageSource, /canSeeAllInCycle = session\.user\.role === 'ROLE_ADMIN'/)
  })

  await run('PERFORMANCE_OPS permission set includes all evaluator roles', () => {
    assert.match(permissionsSource, /PERFORMANCE_OPS:/)
    assert.match(permissionsSource, /ROLE_CEO/)
    assert.match(permissionsSource, /ROLE_DIV_HEAD/)
    assert.match(permissionsSource, /ROLE_SECTION_CHIEF/)
    assert.match(permissionsSource, /ROLE_TEAM_LEADER/)
  })

  await run('PerformanceHrOpsDashboard accepts canSeeAllInCycle and hides aggregate blocks for evaluators', () => {
    assert.match(dashboardSource, /canSeeAllInCycle: boolean/)
    assert.match(dashboardSource, /canSeeAllInCycle \? '업적평가 모니터링' : '업적평가'/)
    assert.match(dashboardSource, /canSeeAllInCycle \? '전체 대상자' : '담당 대상자'/)
    assert.match(dashboardSource, /canSeeAllInCycle \? '본부별 현황' : '담당 조직 현황'/)
    assert.match(dashboardSource, /canSeeAllInCycle \? '전체 대상자 기준' : '담당 인원 분포'/)
    assert.match(dashboardSource, /canSeeAllInCycle && \(/)
    assert.match(dashboardSource, /HR 관리자/)
    assert.match(dashboardSource, /resolveEvalHref/)
    assert.match(dashboardSource, /EvalLinkCell/)
    assert.match(dashboardSource, /평가 화면 열기/)
  })

  await run('workbench redirects evaluator roles to /evaluation/performance when no view param', () => {
    assert.match(workbenchSource, /redirect\('\/evaluation\/performance'\)/)
    assert.match(workbenchSource, /!requestedView/)
    assert.match(workbenchSource, /activeView === 'leader'/)
    assert.match(workbenchSource, /activeView === 'executive'/)
  })

  await run('navigation removes 업적평가 모니터링 entry — evaluators reach /evaluation/performance via workbench redirect', () => {
    assert.equal(navigationSource.includes("label: '업적평가 모니터링'"), false)
    assert.equal(navigationSource.includes("href: '/evaluation/workbench'"), true)
    assert.equal(navigationSource.includes("label: '업적평가'"), true)
  })

  console.log('Performance evaluator scope tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
