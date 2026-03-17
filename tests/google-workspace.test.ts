import assert from 'node:assert/strict'
import {
  assertAllowedGoogleWorkspaceEmail,
  normalizeGoogleWorkspaceEmail,
} from '../src/lib/google-workspace'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('normalize trims and lowercases workspace email', () => {
  assert.equal(
    normalizeGoogleWorkspaceEmail('  Admin@RSupport.com '),
    'admin@rsupport.com'
  )
})

run('allowed domain validation accepts matching workspace email', () => {
  assert.equal(
    assertAllowedGoogleWorkspaceEmail('member1@rsupport.com', 'rsupport.com'),
    'member1@rsupport.com'
  )
})

run('allowed domain validation rejects mismatched workspace email', () => {
  assert.throws(
    () => assertAllowedGoogleWorkspaceEmail('member1@gmail.com', 'rsupport.com'),
    /허용된 Google Workspace 도메인/
  )
})

console.log('Google workspace tests completed')
