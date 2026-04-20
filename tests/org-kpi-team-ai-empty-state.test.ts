import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  getOrgKpiTeamAiEmptyStateFlags,
  resolveOrgKpiTeamAiResultMode,
} from '../src/lib/org-kpi-team-ai-empty-state'

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
const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

void (async () => {
  await run('business plan empty is the highest non-error empty state', () => {
    const flags = getOrgKpiTeamAiEmptyStateFlags({
      businessPlan: null,
      recommendationSetCount: 0,
      reviewRunCount: 0,
    })
    const mode = resolveOrgKpiTeamAiResultMode({
      businessPlan: null,
      recommendationSetCount: 0,
      reviewRunCount: 0,
      hasTrueFallback: false,
    })

    assert.deepEqual(flags, {
      businessPlanMissing: true,
      recommendationMissing: true,
      reviewMissing: true,
    })
    assert.equal(mode, 'BUSINESS_PLAN_EMPTY')
    assert.equal(workspaceSource.includes('사업계획서가 아직 등록되지 않았습니다.'), true)
    assert.equal(workspaceSource.includes('사업계획서 등록하기'), true)
    assert.equal(workspaceSource.includes('직접 KPI 작성하기'), true)
  })

  await run('recommendation empty appears only after business plan exists', () => {
    const mode = resolveOrgKpiTeamAiResultMode({
      businessPlan: { id: 'bp-1' },
      recommendationSetCount: 0,
      reviewRunCount: 0,
      hasTrueFallback: false,
    })

    assert.equal(mode, 'RECOMMENDATION_EMPTY')
    assert.equal(workspaceSource.includes('아직 AI 추천 결과가 없습니다.'), true)
    assert.equal(workspaceSource.includes('AI 추천 받기'), true)
    assert.equal(workspaceSource.includes('직접 KPI 작성하기'), true)
  })

  await run('review empty appears only after recommendation data exists', () => {
    const mode = resolveOrgKpiTeamAiResultMode({
      businessPlan: { id: 'bp-1' },
      recommendationSetCount: 1,
      reviewRunCount: 0,
      hasTrueFallback: false,
    })

    assert.equal(mode, 'REVIEW_EMPTY')
    assert.equal(workspaceSource.includes('아직 AI 검토 결과가 없습니다.'), true)
    assert.equal(workspaceSource.includes('AI 검토 실행하기'), true)
    assert.equal(workspaceSource.includes('나중에 검토하기'), true)
  })

  await run('true fallback wins over every empty state and keeps a separate copy deck', () => {
    const mode = resolveOrgKpiTeamAiResultMode({
      businessPlan: null,
      recommendationSetCount: 0,
      reviewRunCount: 0,
      hasTrueFallback: true,
    })

    assert.equal(mode, 'TRUE_FALLBACK')
    assert.equal(workspaceSource.includes('AI 결과를 불러오는 중 문제가 발생했습니다.'), true)
    assert.equal(workspaceSource.includes('일시적인 문제로 기본 결과를 표시하고 있습니다. 잠시 후 다시 시도해 주세요.'), true)
    assert.equal(workspaceSource.includes('다시 시도'), true)
    assert.equal(workspaceSource.includes('기본 화면으로 계속'), true)
  })

  await run('workspace receives runtime fallback state and actions from org kpi client', () => {
    assert.equal(clientSource.includes('runtimeState={teamAiRuntimeState}'), true)
    assert.equal(clientSource.includes("onRetryRuntimeFallback={() => void loadTeamAiContext(selectedDepartmentId)}"), true)
    assert.equal(clientSource.includes("onContinueWithoutAi={() => setTab('list')}"), true)
  })
})()
