import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { evaluateMonthlySubmit } from '../src/lib/monthly-submit-validation'

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
  await run('quantitative monthly submission blocks when actual value is missing', () => {
    const result = evaluateMonthlySubmit({
      hasSelection: true,
      hasSubmitPermission: true,
      status: 'DRAFT',
      type: 'QUANTITATIVE',
      actualValue: undefined,
      attachmentsCount: 0,
      linkedCheckinCount: 0,
    })

    assert.equal(result.canSubmit, false)
    assert.deepEqual(result.blockingReasons, ['정량 KPI의 실적값을 입력해 주세요.'])
    assert.equal(result.summary, '제출할 수 없습니다. 정량 KPI의 실적값을 입력해 주세요.')
  })

  await run('missing evidence alone stays a recommendation and does not block submission', () => {
    const result = evaluateMonthlySubmit({
      hasSelection: true,
      hasSubmitPermission: true,
      status: 'DRAFT',
      type: 'QUANTITATIVE',
      actualValue: 88,
      attachmentsCount: 0,
      linkedCheckinCount: 0,
      achievementRate: 88,
    })

    assert.equal(result.canSubmit, true)
    assert.equal(result.blockingReasons.length, 0)
    assert.equal(
      result.recommendationReasons.includes('증빙은 필수는 아니지만 근거 정리를 위해 첨부를 권장합니다.'),
      true
    )
  })

  await run('risk note without blocker comment remains a recommendation instead of a hard blocker', () => {
    const result = evaluateMonthlySubmit({
      hasSelection: true,
      hasSubmitPermission: true,
      status: 'DRAFT',
      type: 'QUANTITATIVE',
      actualValue: 62,
      attachmentsCount: 0,
      linkedCheckinCount: 0,
      achievementRate: 62,
      blockerNote: '',
    })

    assert.equal(result.canSubmit, true)
    assert.equal(result.blockingReasons.length, 0)
    assert.equal(
      result.recommendationReasons.includes('위험 신호 KPI는 장애 요인 코멘트를 남기면 리뷰에 도움이 됩니다.'),
      true
    )
  })

  await run('monthly client and workflow route share the centralized submit validator', () => {
    const clientSource = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    const workflowRouteSource = read('src/app/api/kpi/monthly-record/[id]/workflow/route.ts')

    assert.equal(clientSource.includes("evaluateMonthlySubmit"), true)
    assert.equal(clientSource.includes('제출 차단 사유'), true)
    assert.equal(workflowRouteSource.includes("evaluateMonthlySubmit"), true)
    assert.equal(workflowRouteSource.includes("submitValidation.summary"), true)
  })

  console.log('Monthly submit validation tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
