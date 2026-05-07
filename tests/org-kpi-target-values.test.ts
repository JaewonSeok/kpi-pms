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
  await run('legacy numeric org KPI target values resolve as strings', () => {
    const resolved = resolveOrgKpiTargetValues({ targetValue: 12 })

    assert.equal(resolved.targetValue, '12')
    assert.equal(resolved.targetValueT, '12')
    assert.equal(resolved.targetValueE, undefined)
    assert.equal(resolved.targetValueS, undefined)
  })

  await run('org KPI target formatter supports Korean and omits blank optional values', () => {
    assert.equal(
      formatOrgKpiTargetValues({
        targetValueT: '적정',
        unit: '',
      }),
      'T 적정'
    )

    assert.equal(
      formatOrgKpiTargetValues({
        targetValueT: '90',
        targetValueE: '93',
        unit: '점',
      }),
      'T 90점 / E 93점'
    )

    assert.equal(
      formatOrgKpiTargetValues({
        targetValueT: '외부감사 적정의견',
        targetValueS: '탁월',
      }),
      'T 외부감사 적정의견 / S 탁월'
    )
  })

  await run('org KPI persistence keeps T required and preserves blank E/S as null', () => {
    const tOnly = buildOrgKpiTargetValuePersistence({
      targetValueT: '적정',
    })

    assert.deepEqual(tOnly, {
      targetValue: '적정',
      targetValueT: '적정',
      targetValueE: null,
      targetValueS: null,
    })

    const tAndEOnly = buildOrgKpiTargetValuePersistence({
      targetValueT: '90',
      targetValueE: '93',
      targetValueS: '',
    })

    assert.deepEqual(tAndEOnly, {
      targetValue: '93',
      targetValueT: '90',
      targetValueE: '93',
      targetValueS: null,
    })
  })

  await run('create schema accepts Korean/text targets and blank unit', () => {
    const base = {
      deptId: 'dept-section',
      evalYear: 2026,
      kpiType: 'QUANTITATIVE' as const,
      kpiCategory: '업무혁신',
      kpiName: '경비절감',
      weight: 10,
      difficulty: 'MEDIUM' as const,
    }

    assert.equal(
      CreateOrgKpiSchema.safeParse({
        ...base,
        targetValueT: '적정',
      }).success,
      true
    )

    assert.equal(
      CreateOrgKpiSchema.safeParse({
        ...base,
        targetValueT: '외부감사 적정의견',
        targetValueE: '우수',
        targetValueS: '탁월',
        unit: '점',
      }).success,
      true
    )

    const blankUnit = CreateOrgKpiSchema.safeParse({
      ...base,
      targetValueT: '90',
      unit: '   ',
    })

    assert.equal(blankUnit.success, true)
    if (blankUnit.success) {
      assert.equal(blankUnit.data.unit, undefined)
    }
  })

  await run('update schema allows text targets, blank optional E/S, and still requires T when editing targets', () => {
    assert.equal(
      UpdateOrgKpiSchema.safeParse({
        targetValueT: '상반기 내 완료',
        targetValueE: null,
        targetValueS: null,
      }).success,
      true
    )

    assert.equal(
      UpdateOrgKpiSchema.safeParse({
        targetValueT: '적정',
        targetValueS: '탁월',
      }).success,
      true
    )

    const missingT = UpdateOrgKpiSchema.safeParse({
      targetValueE: '우수',
    })

    assert.equal(missingT.success, false)
    assert.equal(missingT.error?.issues[0]?.message.includes('T 목표값'), true)
  })

  await run('org KPI unit schema accepts Korean and common business units while rejecting overly long values', () => {
    for (const unit of ['점', '%', '건', '시간']) {
      const parsed = CreateOrgKpiSchema.safeParse({
        deptId: 'dept-hr',
        evalYear: 2026,
        kpiType: 'QUANTITATIVE',
        kpiCategory: '인사',
        kpiName: `단위 검증 ${unit}`,
        targetValueT: '적정',
        unit,
        weight: 20,
        difficulty: 'MEDIUM',
      })

      assert.equal(parsed.success, true)
      if (parsed.success) {
        assert.equal(parsed.data.unit, unit)
      }
    }

    const tooLong = CreateOrgKpiSchema.safeParse({
      deptId: 'dept-hr',
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiCategory: '인사',
      kpiName: '긴 단위 검증',
      targetValueT: '적정',
      unit: '가'.repeat(21),
      weight: 20,
      difficulty: 'MEDIUM',
    })

    assert.equal(tooLong.success, false)
  })

  await run('org KPI client form uses text inputs for targets and blank unit defaults', () => {
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
    const recommendationDraftSource = read('src/lib/org-kpi-ai-recommendation-draft.ts')
    const aiAssistSource = read('src/lib/ai-assist.ts')

    assert.equal(clientSource.includes("unit: '%'"), false)
    assert.equal(clientSource.includes("unit: ''"), true)
    assert.equal(clientSource.includes("const message = 'T 목표값은 숫자로 입력해 주세요.'"), false)
    assert.equal(clientSource.includes("const message = 'E 목표값은 숫자로 입력해 주세요.'"), false)
    assert.equal(clientSource.includes("const message = 'S 목표값은 숫자로 입력해 주세요.'"), false)
    assert.equal(
      clientSource.includes('type="number"\r\n              inputMode="decimal"\r\n              value={form.targetValueT}'),
      false
    )
    assert.equal(
      clientSource.includes('type="number"\r\n              inputMode="decimal"\r\n              value={form.targetValueE}'),
      false
    )
    assert.equal(
      clientSource.includes('type="number"\r\n              inputMode="decimal"\r\n              value={form.targetValueS}'),
      false
    )
    assert.equal(clientSource.includes("targetValueT: form.targetValueT.trim()"), true)
    assert.equal(clientSource.includes("{ targetValueE: form.targetValueE.trim() || null }"), true)
    assert.equal(clientSource.includes("{ targetValueS: form.targetValueS.trim() || null }"), true)
    assert.equal(recommendationDraftSource.includes("item.unit?.trim() || ''"), true)
    assert.equal(aiAssistSource.includes("payload.unit ?? '%'"), false)
  })

  await run('org KPI schema and persistence now keep text-capable targets as strings', () => {
    const schemaSource = read('prisma/schema.prisma')
    const helperSource = read('src/lib/org-kpi-target-values.ts')
    const createRouteSource = read('src/app/api/kpi/org/route.ts')
    const updateRouteSource = read('src/app/api/kpi/org/[id]/route.ts')
    const pageSource = read('src/server/org-kpi-page.ts')

    assert.equal(schemaSource.includes('targetValue  String?'), true)
    assert.equal(schemaSource.includes('targetValueT String?'), true)
    assert.equal(schemaSource.includes('targetValueE String?'), true)
    assert.equal(schemaSource.includes('targetValueS String?'), true)
    assert.equal(helperSource.includes('function normalizeTargetValue'), true)
    assert.equal(helperSource.includes("const unitSuffix = input.unit ? `${input.unit}` : ''"), true)
    assert.equal(createRouteSource.includes('buildOrgKpiTargetValuePersistence'), true)
    assert.equal(updateRouteSource.includes('buildOrgKpiTargetValuePersistence'), true)
    assert.equal(pageSource.includes('targetValue?: number | string'), true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
