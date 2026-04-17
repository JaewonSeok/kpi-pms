import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getOrgKpiTeamAiEmptyStateFlags } from '../src/lib/org-kpi-team-ai-empty-state'

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
const pageSource = read('src/server/org-kpi-page.ts')

void (async () => {
  await run('business plan missing is treated as a neutral empty state', () => {
    const flags = getOrgKpiTeamAiEmptyStateFlags({
      businessPlan: null,
      recommendationSetCount: 0,
      reviewRunCount: 0,
    })

    assert.deepEqual(flags, {
      businessPlanMissing: true,
      recommendationMissing: true,
      reviewMissing: true,
    })
    assert.equal(workspaceSource.includes('사업계획서가 아직 등록되지 않았습니다.'), true)
    assert.equal(workspaceSource.includes('사업계획서 등록하기'), true)
    assert.equal(workspaceSource.includes('직접 KPI 작성하기'), true)
    assert.equal(workspaceSource.includes("scrollToSection('team-ai-business-plan-section')"), true)
  })

  await run('recommendation missing is shown as recommendation empty state, not fallback copy', () => {
    const flags = getOrgKpiTeamAiEmptyStateFlags({
      businessPlan: {
        id: 'bp-1',
        departmentId: 'dept-1',
        departmentName: '경영지원본부',
        evalYear: 2026,
        title: '사업계획서',
        sourceType: 'TEXT',
        bodyText: '본문',
        createdById: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      recommendationSetCount: 0,
      reviewRunCount: 0,
    })

    assert.equal(flags.businessPlanMissing, false)
    assert.equal(flags.recommendationMissing, true)
    assert.equal(workspaceSource.includes('아직 AI 추천 결과가 없습니다.'), true)
    assert.equal(workspaceSource.includes('AI 추천 받기'), true)
    assert.equal(workspaceSource.includes('title="AI 추천 결과"'), true)
  })

  await run('review missing is shown as review empty state with the real review action', () => {
    const flags = getOrgKpiTeamAiEmptyStateFlags({
      businessPlan: {
        id: 'bp-1',
        departmentId: 'dept-1',
        departmentName: '경영지원본부',
        evalYear: 2026,
        title: '사업계획서',
        sourceType: 'TEXT',
        bodyText: '본문',
        createdById: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      recommendationSetCount: 1,
      reviewRunCount: 0,
    })

    assert.equal(flags.reviewMissing, true)
    assert.equal(workspaceSource.includes('아직 AI 검토 결과가 없습니다.'), true)
    assert.equal(workspaceSource.includes('AI 검토 실행하기'), true)
    assert.equal(workspaceSource.includes('나중에 검토하기'), true)
    assert.equal(workspaceSource.includes("scrollToSection('team-ai-adopted-drafts-section')"), true)
  })

  await run('workspace CTA wiring reuses the existing org KPI create and review flows', () => {
    assert.equal(clientSource.includes('function openDirectKpiCreate()'), true)
    assert.equal(clientSource.includes('setForm(buildEmptyForm(pageData.selectedYear, activeTeamDepartmentId))'), true)
    assert.equal(clientSource.includes('canCreateKpi={pageData.permissions.canCreate && !goalEditLocked}'), true)
    assert.equal(clientSource.includes('canRunReviewAction={teamAiContext?.canRunReview === true && hasReviewableTeamKpis}'), true)
    assert.equal(clientSource.includes('onCreateKpi={openDirectKpiCreate}'), true)
  })

  await run('true runtime fallback banner remains page-level for loader exceptions only', () => {
    assert.equal(pageSource.includes("title: '팀 KPI AI 추천'"), true)
    assert.equal(pageSource.includes("description: '사업계획서 기반 AI 추천/검토 정보를 불러오지 못해 기본 화면만 표시합니다.'"), true)
    assert.equal(pageSource.includes('teamAi = buildEmptyTeamAiContext({'), true)
  })
})()
