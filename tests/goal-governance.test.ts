import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { EvalCycleSchema, UpdateEvalCycleSchema } from '../src/lib/validations'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
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
  await run('eval cycle schemas accept goal edit mode values for 운영 읽기 모드 설정', () => {
    const createParsed = EvalCycleSchema.safeParse({
      orgId: 'org-1',
      evalYear: 2026,
      cycleName: '2026 상반기',
      goalEditMode: 'CHECKIN_ONLY',
    })
    const updateParsed = UpdateEvalCycleSchema.safeParse({
      goalEditMode: 'FULL',
    })

    assert.equal(createParsed.success, true)
    assert.equal(updateParsed.success, true)
  })

  await run('admin eval cycle surfaces and persists goal edit mode settings', () => {
    const adminClient = read('src/components/admin/AdminEvalCycleClient.tsx')
    const createRoute = read('src/app/api/admin/eval-cycles/route.ts')
    const updateRoute = read('src/app/api/admin/eval-cycles/[id]/route.ts')

    assert.equal(adminClient.includes('goalEditMode'), true)
    assert.equal(adminClient.includes('CHECKIN_ONLY'), true)
    assert.equal(adminClient.includes('체크인 / 코멘트만 허용'), true)
    assert.equal(createRoute.includes('goalEditMode: data.goalEditMode'), true)
    assert.equal(updateRoute.includes('goalEditMode: data.goalEditMode'), true)
  })

  await run('personal and org KPI routes block goal mutations in check-in-only mode on the server', () => {
    const personalCreate = read('src/app/api/kpi/personal/route.ts')
    const personalUpdate = read('src/app/api/kpi/personal/[id]/route.ts')
    const personalWorkflow = read('src/app/api/kpi/personal/[id]/workflow/route.ts')
    const orgCreate = read('src/app/api/kpi/org/route.ts')
    const orgUpdate = read('src/app/api/kpi/org/[id]/route.ts')
    const orgWorkflow = read('src/app/api/kpi/org/[id]/workflow/route.ts')

    assert.equal(personalCreate.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(personalUpdate.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(personalWorkflow.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(personalWorkflow.includes("['SAVE_DRAFT', 'SUBMIT', 'REOPEN']"), true)
    assert.equal(orgCreate.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(orgUpdate.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(orgWorkflow.includes("targetCycle?.goalEditMode === 'CHECKIN_ONLY'"), true)
    assert.equal(orgWorkflow.includes("['SUBMIT', 'REOPEN']"), true)
  })

  await run('personal KPI loader and client expose read-only alerts, rejected count context, and goal tags', () => {
    const loaderSource = read('src/server/personal-kpi-page.ts')
    const clientSource = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(loaderSource.includes("title: '현재 목표는 읽기 전용 모드입니다.'"), true)
    assert.equal(loaderSource.includes('canCreate: goalEditLocked ? false : basePermissions.canCreate'), true)
    assert.equal(loaderSource.includes('canSubmit: goalEditLocked ? false : basePermissions.canSubmit'), true)
    assert.equal(loaderSource.includes('tags: parseTags(kpi.tags)'), true)
    assert.equal(clientSource.includes('parseTagInput'), true)
    assert.equal(clientSource.includes('목표 태그'), true)
    assert.equal(clientSource.includes('props.summary.rejectedCount'), true)
    assert.equal(clientSource.includes('selectedItem.tags.length'), true)
    assert.equal(clientSource.includes('data-testid="personal-kpi-rejected-count"'), true)
    assert.equal(clientSource.includes('goalEditLocked'), true)
  })

  await run('org KPI loader and client reflect read-only gating, team approval state, and tag context in the live workspace', () => {
    const loaderSource = read('src/server/org-kpi-page.ts')
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(loaderSource.includes("title: '현재 목표는 읽기 전용 모드입니다.'"), true)
    assert.equal(loaderSource.includes('canCreate: goalEditLocked ? false : canManage'), true)
    assert.equal(loaderSource.includes('tags: parseTags(kpi.tags)'), true)
    assert.equal(clientSource.includes('goalEditLocked'), true)
    assert.equal(clientSource.includes('parseTagInput'), true)
    assert.equal(clientSource.includes('kpi.tags.length'), true)
    assert.equal(clientSource.includes('내 팀원 목표 승인 상태'), true)
    assert.equal(clientSource.includes('kpi.linkedConfirmedPersonalKpiCount'), true)
    assert.equal(clientSource.includes('kpi.linkedPersonalKpis.length'), true)
    assert.equal(clientSource.includes("goalEditLocked || !['DRAFT', 'SUBMITTED', 'LOCKED'].includes(kpi.status)"), true)
  })

  console.log('Goal governance tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
