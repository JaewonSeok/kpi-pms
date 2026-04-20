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

const pageSource = read('src/server/org-kpi-page.ts')
const workspaceSource = read('src/components/kpi/OrgKpiTeamAiWorkspace.tsx')
const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

void (async () => {
  await run('team AI loader still marks true runtime failure separately from empty state', () => {
    assert.equal(pageSource.includes('teamAiRuntimeState = buildOrgKpiTeamAiRuntimeState(error)'), true)
    assert.equal(pageSource.includes('teamAi = buildEmptyTeamAiContext({'), true)
  })

  await run('page-level team AI fallback alert is hidden from generic load alerts', () => {
    assert.equal(clientSource.includes("return alert.title.includes('팀 KPI AI 추천')"), true)
    assert.equal(clientSource.includes('(pageData.alerts ?? []).filter((alert) => !isTeamAiFallbackAlert(alert))'), true)
  })

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
