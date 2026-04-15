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
  await run('legacy org KPI target value falls back to T / E / S consistently', () => {
    const resolved = resolveOrgKpiTargetValues({ targetValue: 12 })

    assert.equal(resolved.targetValue, 12)
    assert.equal(resolved.targetValueT, 12)
    assert.equal(resolved.targetValueE, 12)
    assert.equal(resolved.targetValueS, 12)
  })

  await run('org KPI target formatter renders T / E / S values with unit', () => {
    const formatted = formatOrgKpiTargetValues({
      targetValueT: 10,
      targetValueE: 12,
      targetValueS: 14,
      unit: '%',
    })

    assert.equal(formatted, 'T 10 % / E 12 % / S 14 %')
  })

  await run('org KPI persistence stores E as legacy targetValue while keeping T / E / S columns', () => {
    const persisted = buildOrgKpiTargetValuePersistence({
      targetValueT: 10,
      targetValueE: 12,
      targetValueS: 14,
    })

    assert.deepEqual(persisted, {
      targetValue: 12,
      targetValueT: 10,
      targetValueE: 12,
      targetValueS: 14,
    })
  })

  await run('create schema requires ordered T / E / S target values', () => {
    const result = CreateOrgKpiSchema.safeParse({
      deptId: 'dept-hr',
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiCategory: '인사',
      kpiName: '채용 완료율',
      targetValueT: 10,
      targetValueE: 12,
      targetValueS: 14,
      weight: 20,
      difficulty: 'MEDIUM',
    })

    assert.equal(result.success, true)

    const invalid = CreateOrgKpiSchema.safeParse({
      deptId: 'dept-hr',
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiCategory: '인사',
      kpiName: '채용 완료율',
      targetValueT: 15,
      targetValueE: 12,
      targetValueS: 14,
      weight: 20,
      difficulty: 'MEDIUM',
    })

    assert.equal(invalid.success, false)
    assert.equal(invalid.error?.issues[0]?.message, '목표값은 T <= E <= S 순서여야 합니다.')
  })

  await run('update schema requires complete T / E / S sets when one target band changes', () => {
    const partial = UpdateOrgKpiSchema.safeParse({
      targetValueT: 10,
    })

    assert.equal(partial.success, false)
    assert.equal(partial.error?.issues[0]?.message, 'T / E / S 목표값을 모두 입력해 주세요.')

    const ordered = UpdateOrgKpiSchema.safeParse({
      targetValueT: 10,
      targetValueE: 12,
      targetValueS: 14,
    })

    assert.equal(ordered.success, true)
  })

  await run('org KPI client form renders dedicated T / E / S inputs and no longer submits a single targetValue field', () => {
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(clientSource.includes('label="T 목표값"'), true)
    assert.equal(clientSource.includes('label="E 목표값"'), true)
    assert.equal(clientSource.includes('label="S 목표값"'), true)
    assert.equal(clientSource.includes('targetValueT: parseNumber(form.targetValueT)'), true)
    assert.equal(clientSource.includes('targetValueE: parseNumber(form.targetValueE)'), true)
    assert.equal(clientSource.includes('targetValueS: parseNumber(form.targetValueS)'), true)
    assert.equal(clientSource.includes('targetValue: parseNumber(form.targetValue)'), false)
    assert.equal(clientSource.includes('formatOrgKpiTargetValues({'), true)
  })

  await run('org KPI routes persist T / E / S target values and keep legacy targetValue for compatibility', () => {
    const createRouteSource = read('src/app/api/kpi/org/route.ts')
    const updateRouteSource = read('src/app/api/kpi/org/[id]/route.ts')
    const pageSource = read('src/server/org-kpi-page.ts')

    assert.equal(createRouteSource.includes('buildOrgKpiTargetValuePersistence'), true)
    assert.equal(updateRouteSource.includes('buildOrgKpiTargetValuePersistence'), true)
    assert.equal(updateRouteSource.includes('targetValueT: true'), true)
    assert.equal(updateRouteSource.includes('targetValueE: true'), true)
    assert.equal(updateRouteSource.includes('targetValueS: true'), true)
    assert.equal(pageSource.includes('resolveOrgKpiTargetValues'), true)
    assert.equal(pageSource.includes('targetValueT: resolvedTargetValues.targetValueT'), true)
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
}

void main()
