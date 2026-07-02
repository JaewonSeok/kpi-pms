import assert from 'node:assert/strict'
import {
  buildPersonalKpiTargetValuePersistence,
  formatPersonalKpiTargetValues,
  resolvePersonalKpiTargetValues,
} from '../src/lib/personal-kpi-target-values'
import { CreatePersonalKpiSchema, UpdatePersonalKpiSchema } from '../src/lib/validations'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('legacy personal KPI target values resolve single target as T', () => {
  const resolved = resolvePersonalKpiTargetValues({ targetValue: 88 })

  assert.equal(resolved.targetValue, 88)
  assert.equal(resolved.targetValueT, 88)
  assert.equal(resolved.targetValueE, undefined)
  assert.equal(resolved.targetValueS, undefined)
})

run('personal KPI target formatter prints T/E/S with optional blanks', () => {
  const formatted = formatPersonalKpiTargetValues({
    targetValueT: 90,
    targetValueE: 95,
    targetValueS: undefined,
  })

  assert.equal(formatted, 'T 90 / E 95 / S -')
})

run('create personal KPI schema accepts T only and full T/E/S payloads', () => {
  const tOnly = CreatePersonalKpiSchema.safeParse({
    employeeId: 'emp-1',
    evalYear: 2026,
    kpiType: 'QUANTITATIVE',
    kpiName: '응대 속도 개선',
    definition: '정의',
    formula: '산식',
    targetValueT: 90,
    weight: 25,
    difficulty: 'MEDIUM',
  })
  const full = CreatePersonalKpiSchema.safeParse({
    employeeId: 'emp-1',
    evalYear: 2026,
    kpiType: 'QUANTITATIVE',
    kpiName: '응대 속도 개선',
    definition: '정의',
    formula: '산식',
    targetValueT: 90,
    targetValueE: 95,
    targetValueS: 98,
    weight: 25,
    difficulty: 'MEDIUM',
  })

  assert.equal(tOnly.success, true)
  assert.equal(full.success, true)
})

run('create personal KPI schema rejects missing T and out-of-order target values', () => {
  const missingT = CreatePersonalKpiSchema.safeParse({
    employeeId: 'emp-1',
    evalYear: 2026,
    kpiType: 'QUANTITATIVE',
    kpiName: '응대 속도 개선',
    targetValueE: 95,
    weight: 25,
    difficulty: 'MEDIUM',
  })
  const invalidOrder = CreatePersonalKpiSchema.safeParse({
    employeeId: 'emp-1',
    evalYear: 2026,
    kpiType: 'QUANTITATIVE',
    kpiName: '응대 속도 개선',
    targetValueT: 96,
    targetValueE: 95,
    weight: 25,
    difficulty: 'MEDIUM',
  })

  assert.equal(missingT.success, false)
  assert.equal(invalidOrder.success, false)
})

run('update personal KPI schema rejects E/S updates without T', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    targetValueE: 95,
    targetValueS: 98,
  })

  assert.equal(result.success, false)
})

run('personal KPI target persistence keeps legacy targetValue aligned with T', () => {
  const persisted = buildPersonalKpiTargetValuePersistence({
    targetValueT: 91,
    targetValueE: 95,
    targetValueS: null,
    copyMetadata: { source: 'test' },
  })

  assert.deepEqual(persisted, {
    targetValue: 91,
    copyMetadata: {
      source: 'test',
      personalTargetValues: {
        targetValueT: 91,
        targetValueE: 95,
        targetValueS: null,
      },
    },
  })
})
