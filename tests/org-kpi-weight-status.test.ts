import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  calculateOrgKpiWeightSummary,
  formatOrgKpiWeight,
} from '../src/lib/org-kpi-weight'

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
  await run('org KPI weight formatter appends percent consistently', () => {
    assert.equal(formatOrgKpiWeight(10), '10%')
    assert.equal(formatOrgKpiWeight(10.5), '10.5%')
    assert.equal(formatOrgKpiWeight('10%'), '10%')
    assert.equal(formatOrgKpiWeight('10.5'), '10.5%')
    assert.equal(formatOrgKpiWeight(null), '-')
  })

  await run('org KPI weight summary marks 100 as normal', () => {
    const summary = calculateOrgKpiWeightSummary([{ weight: 40 }, { weight: 60 }])

    assert.equal(summary.status, 'normal')
    assert.equal(summary.totalWeight, 100)
    assert.equal(summary.remainingWeight, 0)
    assert.equal(summary.excessWeight, 0)
  })

  await run('org KPI weight summary marks under-allocation and remaining weight', () => {
    const summary = calculateOrgKpiWeightSummary([{ weight: 30 }, { weight: 50 }])

    assert.equal(summary.status, 'under')
    assert.equal(summary.totalWeight, 80)
    assert.equal(summary.remainingWeight, 20)
    assert.equal(summary.excessWeight, 0)
  })

  await run('org KPI weight summary marks over-allocation and excess weight', () => {
    const summary = calculateOrgKpiWeightSummary([{ weight: 40 }, { weight: 70 }])

    assert.equal(summary.status, 'over')
    assert.equal(summary.totalWeight, 110)
    assert.equal(summary.remainingWeight, 0)
    assert.equal(summary.excessWeight, 10)
  })

  await run('org KPI weight summary handles decimal totals with tolerance', () => {
    const summary = calculateOrgKpiWeightSummary([{ weight: 33.33 }, { weight: 33.33 }, { weight: 33.34 }])

    assert.equal(summary.status, 'normal')
    assert.equal(summary.totalWeight, 100)
  })

  await run('org KPI client shows weight percent labels and status panel', () => {
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(clientSource.includes('가중치 현황'), true)
    assert.equal(clientSource.includes('총 가중치'), true)
    assert.equal(clientSource.includes('남은 가중치'), true)
    assert.equal(clientSource.includes('초과 가중치'), true)
    assert.equal(clientSource.includes('formatOrgKpiWeight(props.kpi.weight)'), true)
    assert.equal(clientSource.includes('InfoPill label="가중치" value={formatOrgKpiWeight(kpi.weight)}'), true)
    assert.equal(clientSource.includes('예: 10 또는 10%'), true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
