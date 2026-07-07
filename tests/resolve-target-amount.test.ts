import assert from 'node:assert/strict'
import { resolveTargetAmount } from '../src/lib/resolve-target-amount'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('personal targetAmount wins over linkedOrgKpi', () => {
  const result = resolveTargetAmount({
    targetAmount: BigInt(1_000_000),
    linkedOrgKpi: { targetAmount: BigInt(9_999_999) },
  })
  assert.equal(result, BigInt(1_000_000))
})

run('falls back to linkedOrgKpi when personal is null', () => {
  const result = resolveTargetAmount({
    targetAmount: null,
    linkedOrgKpi: { targetAmount: BigInt(5_000_000) },
  })
  assert.equal(result, BigInt(5_000_000))
})

run('returns null when both are null', () => {
  const result = resolveTargetAmount({
    targetAmount: null,
    linkedOrgKpi: { targetAmount: null },
  })
  assert.equal(result, null)
})

run('returns null when linkedOrgKpi is absent', () => {
  const result = resolveTargetAmount({
    targetAmount: null,
  })
  assert.equal(result, null)
})

run('returns null when linkedOrgKpi is null', () => {
  const result = resolveTargetAmount({
    targetAmount: null,
    linkedOrgKpi: null,
  })
  assert.equal(result, null)
})
