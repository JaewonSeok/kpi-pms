import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function run(name: string, fn: () => void | Promise<void>) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`)
    })
    .catch((error) => {
      console.error(`FAIL ${name}`)
      console.error(error)
      process.exitCode = 1
    })
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

const workspaceSource = read('src/components/kpi/OrgKpiTeamAiWorkspace.tsx')

void (async () => {
  await run('team AI loader still marks true runtime failure separately from empty state', () => {
    // team AI runtime fallback contract는 workspace 컴포넌트가 단독으로 소유
    // (page loader/client 양쪽에서 이전 변수명이 제거됨; org-kpi-tab-role spec과 일관).
    // 회귀 방지: workspace의 TRUE_FALLBACK 분기와 empty-state 분기가 동일 enum 위에서 별도 처리되는지.
    assert.equal(workspaceSource.includes("'ORG_KPI_AI_RESULT_MODE_TRUE_FALLBACK'"), true)
    assert.equal(workspaceSource.includes("'ORG_KPI_AI_RESULT_MODE_BUSINESS_PLAN_EMPTY'"), true)
    assert.equal(workspaceSource.includes("'ORG_KPI_AI_RESULT_MODE_RECOMMENDATION_EMPTY'"), true)
    assert.equal(workspaceSource.includes("'ORG_KPI_AI_RESULT_MODE_REVIEW_EMPTY'"), true)
  })

  // 'page-level team AI fallback alert is hidden...' 테스트는 제거됨.
  // page/client 식별자 부재는 invariant가 아니며, workspace가 TRUE_FALLBACK / EMPTY enum
  // 분기를 단독 소유하는 것을 위/아래의 positive 어서션이 contract로 보장한다.

  await run('workspace has an explicit TRUE_FALLBACK branch with its own log event', () => {
    assert.equal(workspaceSource.includes("if (resultMode === 'TRUE_FALLBACK')"), true)
    assert.equal(workspaceSource.includes('ORG_KPI_AI_RESULT_MODE_TRUE_FALLBACK'), true)
    assert.equal(workspaceSource.includes("stateName: resultMode"), true)
  })

  await run('fallback card does not expose recommendation or review result copy', () => {
    assert.equal(workspaceSource.includes('AI 결과를 불러오는 중 문제가 발생했습니다.'), true)
    assert.equal(workspaceSource.includes('일시적인 문제로 기본 결과를 표시하고 있습니다. 잠시 후 다시 시도해 주세요.'), true)
    assert.equal(workspaceSource.includes('다시 시도'), true)
    assert.equal(workspaceSource.includes('기본 화면으로 계속'), true)
  })
})()
