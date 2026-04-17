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

const serverSource = read('src/server/org-kpi-team-ai.ts')
const pageSource = read('src/server/org-kpi-page.ts')
const workspaceSource = read('src/components/kpi/OrgKpiTeamAiWorkspace.tsx')

void (async () => {
  await run('team AI context loader reads Organization.name instead of invalid orgName', () => {
    assert.equal(serverSource.includes('orgName: true'), false)
    assert.equal(serverSource.includes('organization: {\n    id: string\n    name: string'), true)
    assert.equal(serverSource.includes('organizationName: targetDepartment.organization.name'), true)
    assert.equal(serverSource.includes('organizationName: planningDepartment.organization.name'), true)
    assert.equal(serverSource.includes("select: {\n          id: true,\n          name: true,"), true)
  })

  await run('team AI context loader emits structured diagnostics for true runtime failures', () => {
    assert.equal(serverSource.includes('ORG_KPI_AI_CONTEXT_LOAD_START'), true)
    assert.equal(serverSource.includes('ORG_KPI_AI_BUSINESS_PLAN_LOOKUP'), true)
    assert.equal(serverSource.includes('ORG_KPI_AI_RECOMMENDATION_LOOKUP'), true)
    assert.equal(serverSource.includes('ORG_KPI_AI_REVIEW_LOOKUP'), true)
    assert.equal(serverSource.includes('ORG_KPI_AI_CONTEXT_LOAD_SUCCESS'), true)
    assert.equal(serverSource.includes('ORG_KPI_AI_CONTEXT_LOAD_FAILED'), true)
    assert.equal(serverSource.includes('stepName'), true)
    assert.equal(serverSource.includes('prismaCode'), true)
    assert.equal(serverSource.includes('shortMessage'), true)
  })

  await run('missing business plan, recommendation, and review are modeled as empty state instead of loader failure', () => {
    assert.equal(serverSource.includes('businessPlan: businessPlan ? mapBusinessPlan(businessPlan) : null'), true)
    assert.equal(
      serverSource.includes('divisionJobDescription: divisionJobDescription ? mapJobDescription(divisionJobDescription) : null'),
      true
    )
    assert.equal(serverSource.includes('teamJobDescription: teamJobDescription ? mapJobDescription(teamJobDescription) : null'), true)
    assert.equal(serverSource.includes('recommendationSets: recommendationSets.map(mapRecommendationSet)'), true)
    assert.equal(serverSource.includes('reviewRuns: reviewRuns.map(mapReviewRun)'), true)
    assert.equal(workspaceSource.includes('getOrgKpiTeamAiEmptyStateFlags'), true)
    assert.equal(workspaceSource.includes('emptyStateFlags.businessPlanMissing'), true)
    assert.equal(workspaceSource.includes('emptyStateFlags.recommendationMissing'), true)
    assert.equal(workspaceSource.includes('latestReviewRun ? ('), true)
  })

  await run('page-level fallback remains the last resort around the team AI context loader', () => {
    assert.equal(pageSource.includes('teamAi = await loadOrgKpiTeamAiContext({'), true)
    assert.equal(pageSource.includes("console.warn('[org-kpi-page:team-ai]', error)"), true)
    assert.equal(pageSource.includes("title: '팀 KPI AI 추천'"), true)
    assert.equal(pageSource.includes('teamAi = buildEmptyTeamAiContext({'), true)
  })
})()
