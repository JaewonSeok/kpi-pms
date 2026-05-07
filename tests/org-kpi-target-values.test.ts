import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildOrgKpiTargetValuePersistence,
  formatOrgKpiTargetValues,
  resolveOrgKpiTargetValues,
} from '../src/lib/org-kpi-target-values'
import { CreateOrgKpiSchema, UpdateOrgKpiSchema } from '../src/lib/validations'

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
  await run('legacy org KPI target value resolves to T-only when only legacy target exists', () => {
    const resolved = resolveOrgKpiTargetValues({ targetValue: 12 })

    assert.equal(resolved.targetValue, 12)
    assert.equal(resolved.targetValueT, 12)
    assert.equal(resolved.targetValueE, undefined)
    assert.equal(resolved.targetValueS, undefined)
  })

  await run('org KPI target formatter omits missing optional E/S values', () => {
    assert.equal(
      formatOrgKpiTargetValues({
        targetValueT: 10,
        unit: '점',
      }),
      'T 10 점'
    )

    assert.equal(
      formatOrgKpiTargetValues({
        targetValueT: 10,
        targetValueE: 12,
        unit: '%',
      }),
      'T 10 % / E 12 %'
    )

    assert.equal(
      formatOrgKpiTargetValues({
        targetValueT: 10,
        targetValueS: 14,
        unit: '건',
      }),
      'T 10 건 / S 14 건'
    )
  })

  await run('org KPI persistence stores optional E/S as null and keeps legacy targetValue compatible', () => {
    const tOnly = buildOrgKpiTargetValuePersistence({
      targetValueT: 10,
    })

    assert.deepEqual(tOnly, {
      targetValue: 10,
      targetValueT: 10,
      targetValueE: null,
      targetValueS: null,
    })

    const tAndSOnly = buildOrgKpiTargetValuePersistence({
      targetValueT: 10,
      targetValueS: 14,
    })

    assert.deepEqual(tAndSOnly, {
      targetValue: 10,
      targetValueT: 10,
      targetValueE: null,
      targetValueS: 14,
    })
  })

  await run('create schema accepts T-only, T+E, T+S, and T+E+S while still requiring T', () => {
    const base = {
      deptId: 'dept-hr',
      evalYear: 2026,
      kpiType: 'QUANTITATIVE' as const,
      kpiCategory: '업무혁신',
      kpiName: '경영지원본부장 만족도',
      weight: 10,
      difficulty: 'MEDIUM' as const,
      unit: '점',
    }

    assert.equal(
      CreateOrgKpiSchema.safeParse({
        ...base,
        targetValueT: 80,
      }).success,
      true
    )

    assert.equal(
      CreateOrgKpiSchema.safeParse({
        ...base,
        targetValueT: 80,
        targetValueE: 90,
      }).success,
      true
    )

    assert.equal(
      CreateOrgKpiSchema.safeParse({
        ...base,
        targetValueT: 80,
        targetValueS: 100,
      }).success,
      true
    )

    assert.equal(
      CreateOrgKpiSchema.safeParse({
        ...base,
        targetValueT: 80,
        targetValueE: 90,
        targetValueS: 100,
      }).success,
      true
    )

    const missingT = CreateOrgKpiSchema.safeParse({
      ...base,
      targetValueE: 90,
    })

    assert.equal(missingT.success, false)
  })

  await run('update schema allows clearing E/S while still requiring T when target values are edited', () => {
    assert.equal(
      UpdateOrgKpiSchema.safeParse({
        targetValueT: 80,
        targetValueE: null,
        targetValueS: null,
      }).success,
      true
    )

    assert.equal(
      UpdateOrgKpiSchema.safeParse({
        targetValueT: 80,
        targetValueS: 100,
      }).success,
      true
    )

    const missingT = UpdateOrgKpiSchema.safeParse({
      targetValueE: 90,
    })

    assert.equal(missingT.success, false)
    assert.equal(missingT.error?.issues[0]?.message.includes('T'), true)
  })

  await run('org KPI unit schema accepts Korean and common business units while rejecting overly long values', () => {
    for (const unit of ['점', '%', '건', '시간']) {
      const parsed = CreateOrgKpiSchema.safeParse({
        deptId: 'dept-hr',
        evalYear: 2026,
        kpiType: 'QUANTITATIVE',
        kpiCategory: '인사',
        kpiName: `단위 검증 ${unit}`,
        targetValueT: 10,
        unit,
        weight: 20,
        difficulty: 'MEDIUM',
      })

      assert.equal(parsed.success, true)
      if (parsed.success) {
        assert.equal(parsed.data.unit, unit)
      }
    }

    const emptyUnit = CreateOrgKpiSchema.safeParse({
      deptId: 'dept-hr',
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiCategory: '인사',
      kpiName: '공백 단위 검증',
      targetValueT: 10,
      unit: '   ',
      weight: 20,
      difficulty: 'MEDIUM',
    })

    assert.equal(emptyUnit.success, true)
    if (emptyUnit.success) {
      assert.equal(emptyUnit.data.unit, undefined)
    }

    const tooLong = CreateOrgKpiSchema.safeParse({
      deptId: 'dept-hr',
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiCategory: '인사',
      kpiName: '긴 단위 검증',
      targetValueT: 10,
      unit: '가'.repeat(21),
      weight: 20,
      difficulty: 'MEDIUM',
    })

    assert.equal(tooLong.success, false)
  })

  await run('org KPI client form supports optional E/S and edit-time clearing without fake defaults', () => {
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(clientSource.includes("const message = 'E 목표값을 입력해 주세요.'"), false)
    assert.equal(clientSource.includes('const parsedTargetValueE = form.targetValueE.trim() ? parseNumber(form.targetValueE) : undefined'), true)
    assert.equal(clientSource.includes('const parsedTargetValueS = form.targetValueS.trim() ? parseNumber(form.targetValueS) : undefined'), true)
    assert.equal(clientSource.includes("{ targetValueE: parsedTargetValueE ?? null }"), true)
    assert.equal(clientSource.includes("{ targetValueS: parsedTargetValueS ?? null }"), true)
    assert.equal(clientSource.includes('const validatedDraft = (editingKpiId ? UpdateOrgKpiSchema : CreateOrgKpiSchema).safeParse(draftPayload)'), true)
  })

  await run('org KPI routes and page model preserve optional E/S fields instead of forcing all three bands', () => {
    const createRouteSource = read('src/app/api/kpi/org/route.ts')
    const updateRouteSource = read('src/app/api/kpi/org/[id]/route.ts')
    const pageSource = read('src/server/org-kpi-page.ts')

    assert.equal(createRouteSource.includes('buildOrgKpiTargetValuePersistence'), true)
    assert.equal(createRouteSource.includes('fieldErrors'), true)
    assert.equal(createRouteSource.includes('ORG_KPI_CREATE_FAILED'), true)
    assert.equal(createRouteSource.includes('ORG_KPI_NAME_DUPLICATED'), true)
    assert.equal(createRouteSource.includes("error.code === 'P2002'"), true)
    assert.equal(updateRouteSource.includes('buildOrgKpiTargetValuePersistence'), true)
    assert.equal(updateRouteSource.includes('data.targetValueT !== undefined'), true)
    assert.equal(updateRouteSource.includes('data.targetValueE !== undefined &&'), false)
    assert.equal(pageSource.includes('resolveOrgKpiTargetValues'), true)
    assert.equal(pageSource.includes('targetValueE: resolvedTargetValues.targetValueE'), true)
    assert.equal(pageSource.includes('targetValueS: resolvedTargetValues.targetValueS'), true)
  })

  await run('org KPI clone and bulk create paths keep legacy rows compatible by filling T / E / S bands', () => {
    const cloneSource = read('src/server/kpi-clone.ts')
    const bulkRouteSource = read('src/app/api/kpi/org/bulk/route.ts')

    assert.equal(cloneSource.includes('buildOrgKpiTargetValuePersistence'), true)
    assert.equal(cloneSource.includes('resolveOrgKpiTargetValues'), true)
    assert.equal(bulkRouteSource.includes('buildOrgKpiTargetValuePersistence'), true)
    assert.equal(bulkRouteSource.includes('targetValueT: row.targetValue'), true)
    assert.equal(bulkRouteSource.includes('targetValueE: row.targetValue'), true)
    assert.equal(bulkRouteSource.includes('targetValueS: row.targetValue'), true)
  })

  await run('org KPI modal preserves structured API validation errors inside the editor', () => {
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(clientSource.includes('type ModalErrorState = {'), true)
    assert.equal(clientSource.includes('error.fieldErrors = json.error?.fieldErrors'), true)
    assert.equal(clientSource.includes('errorFieldErrors={editorError?.fieldErrors}'), true)
    assert.equal(clientSource.includes('Object.entries(errorFieldErrors)'), true)
  })
}

void main()
