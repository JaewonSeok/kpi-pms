import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('managed employee helper is wired to real leadership review context rules', () => {
    const accessSource = read('src/server/checkin-access.ts')

    assert.equal(accessSource.includes('export function canAccessManagedEmployeeContext('), true)
    assert.equal(accessSource.includes('if (!canOperateCheckinRole(sessionRole)) {'), true)
    assert.equal(accessSource.includes('if (employee.id === sessionUserId) {'), true)
    assert.equal(accessSource.includes("sessionRole === 'ROLE_ADMIN' || sessionRole === 'ROLE_CEO'"), true)
    assert.equal(accessSource.includes('employee.teamLeaderId === sessionUserId'), true)
    assert.equal(accessSource.includes('employee.sectionChiefId === sessionUserId'), true)
    assert.equal(accessSource.includes('employee.divisionHeadId === sessionUserId'), true)
  })

  await run('monthly leader AI actions UI and route are both leadership-scoped', () => {
    const clientSource = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    const routeSource = read('src/app/api/kpi/monthly-record/ai/route.ts')

    assert.equal(clientSource.includes('const canUseMonthlyCommentDraft = pageData.permissions.canReview'), true)
    assert.equal(clientSource.includes('LEADER_ONLY_MONTHLY_AI_ACTION_IDS'), true)
    assert.equal(clientSource.includes("'generate-summary'"), true)
    assert.equal(clientSource.includes("'generate-review'"), true)
    assert.equal(clientSource.includes("'summarize-evaluation-evidence'"), true)
    assert.equal(
      clientSource.includes('!LEADER_ONLY_MONTHLY_AI_ACTION_IDS.has(action) || canUseMonthlyCommentDraft'),
      true
    )
    assert.equal(clientSource.includes('showGenerateSummaryAction={canUseMonthlyCommentDraft}'), true)
    assert.equal(clientSource.includes('visibleActions={visibleAiActions}'), true)
    assert.equal(routeSource.includes('LEADER_ONLY_MONTHLY_AI_ACTIONS'), true)
    assert.equal(routeSource.includes("'generate-review'"), true)
    assert.equal(routeSource.includes("'summarize-evaluation-evidence'"), true)
    assert.equal(routeSource.includes('assertManagedMonthlyAiAccess'), true)
    assert.equal(
      routeSource.includes('canAccessManagedEmployeeContext(params.sessionUserId, params.sessionRole, targetEmployee)'),
      true
    )
    assert.equal(
      routeSource.includes('팀장·실장·본부장 등 관리 범위가 있는 직책자만 월간 실적 리뷰 AI를 사용할 수 있습니다.'),
      true
    )
  })

  console.log('Monthly AI comment access tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
