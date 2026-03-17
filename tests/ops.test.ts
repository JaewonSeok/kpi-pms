import assert from 'node:assert/strict'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  const { getFeatureFlagSnapshot, isFeatureEnabled } = await import('../src/lib/feature-flags')
  const { getAppEnvironment } = await import('../src/lib/operations')

  run('AI feature respects compatibility alias and feature flag env', () => {
    process.env.AI_FEATURE_ENABLED = 'true'
    process.env.FEATURE_AI_ASSIST = 'false'
    assert.equal(isFeatureEnabled('aiAssist'), true)
  })

  run('feature flag snapshot exposes configured states', () => {
    process.env.FEATURE_OPS_DASHBOARD = 'true'
    const snapshot = getFeatureFlagSnapshot()
    const opsFlag = snapshot.find((flag) => flag.key === 'opsDashboard')
    assert.equal(opsFlag?.enabled, true)
  })

  run('app environment defaults and normalizes values', () => {
    process.env.APP_ENV = 'stage'
    assert.equal(getAppEnvironment(), 'stage')
    process.env.APP_ENV = 'unexpected'
    assert.equal(getAppEnvironment(), 'dev')
  })

  console.log('Ops tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
