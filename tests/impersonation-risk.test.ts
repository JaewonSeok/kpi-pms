import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  buildImpersonationExpiry,
  buildImpersonationRiskHeaders,
  createImpersonationRiskCancelledError,
  createImpersonationSyncPayload,
  decodeImpersonationHeaderValue,
  isImpersonationExpired,
  isImpersonationRiskCancelledError,
  parseImpersonationSyncPayload,
} from '../src/lib/impersonation'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

run('impersonation expiry is one hour later than the start time', () => {
  const startedAt = new Date('2026-04-08T00:00:00.000Z')
  const expiresAt = buildImpersonationExpiry(startedAt)

  assert.equal(expiresAt.getTime() - startedAt.getTime(), 60 * 60 * 1000)
})

run('impersonation expiry helper detects active and expired sessions', () => {
  assert.equal(
    isImpersonationExpired(
      {
        active: true,
        expiresAt: '2026-04-08T10:00:00.000Z',
      },
      new Date('2026-04-08T09:59:59.000Z')
    ),
    false
  )

  assert.equal(
    isImpersonationExpired(
      {
        active: true,
        expiresAt: '2026-04-08T10:00:00.000Z',
      },
      new Date('2026-04-08T10:00:00.000Z')
    ),
    true
  )
})

run('risk confirmation headers keep custom metadata ASCII-safe and decodable', () => {
  const riskReason =
    '\uc2e4\uc81c \ub2e4\uc6b4\ub85c\ub4dc \uc0ac\uc720\ub97c \ub2e4\uc2dc \uae30\ub85d\ud569\ub2c8\ub2e4.'
  const confirmationText = '\ub2e4\uc6b4\ub85c\ub4dc'
  const headers = buildImpersonationRiskHeaders(
    {
      active: true,
      sessionId: 'imp-session-1',
      actorId: 'admin-1',
      actorName: 'Admin Kim',
      actorEmail: 'admin@rsupport.com',
      targetId: 'member-1',
      targetName: 'Member Park',
      targetEmail: 'member@rsupport.com',
      reason:
        '\ub300\uc6a9 \uac80\uc99d\uc744 \uc704\ud574 \ud14c\uc2a4\ud2b8 \uacc4\uc815\uc73c\ub85c \ub85c\uadf8\uc778\ud569\ub2c8\ub2e4.',
      startedAt: '2026-04-08T00:00:00.000Z',
      expiresAt: '2026-04-08T01:00:00.000Z',
    },
    'DOWNLOAD_EXPORT',
    {
      riskReason,
      confirmationText,
    }
  )

  assert.equal(headers['x-impersonation-session-id'], 'imp-session-1')
  assert.equal(headers['x-impersonation-risk-action'], 'DOWNLOAD_EXPORT')
  assert.equal(/[^\u0000-\u00ff]/.test(headers['x-impersonation-risk-reason']), false)
  assert.equal(headers['x-impersonation-confirm-text'], encodeURIComponent(confirmationText))
  assert.equal(/[^\u0000-\u00ff]/.test(headers['x-impersonation-confirm-text'] ?? ''), false)
  assert.equal(
    decodeImpersonationHeaderValue(headers['x-impersonation-risk-reason']),
    riskReason
  )
  assert.equal(
    decodeImpersonationHeaderValue(headers['x-impersonation-confirm-text']),
    confirmationText
  )
})

run('sync payload roundtrip is parseable', () => {
  const payload = createImpersonationSyncPayload('start', 'imp-session-1')
  const parsed = parseImpersonationSyncPayload(payload)

  assert.equal(parsed?.type, 'start')
  assert.equal(parsed?.sessionId, 'imp-session-1')
  assert.equal(typeof parsed?.at, 'string')
})

run('cancelled risk helper is recognized', () => {
  const error = createImpersonationRiskCancelledError()

  assert.equal(isImpersonationRiskCancelledError(error), true)
  assert.equal(isImpersonationRiskCancelledError(new Error('other')), false)
})

run('server routes enforce impersonation risk validation and execution logging', () => {
  const guardedRoutes = [
    'src/app/api/evaluation/results/[cycleId]/export/route.ts',
    'src/app/api/evaluation/[id]/submit/route.ts',
    'src/app/api/evaluation/[id]/review/route.ts',
    'src/app/api/feedback/route.ts',
    'src/app/api/kpi/personal/[id]/workflow/route.ts',
    'src/app/api/evaluation/word-cloud-360/actions/route.ts',
    'src/app/api/evaluation/word-cloud-360/export/[cycleId]/route.ts',
    'src/app/api/evaluation/word-cloud-360/targets/upload/route.ts',
    'src/app/api/evaluation/word-cloud-360/comparison/upload/route.ts',
    'src/app/api/feedback/rounds/[id]/notifications/route.ts',
  ]

  for (const routePath of guardedRoutes) {
    const source = readSource(routePath)
    assert.match(source, /validateImpersonationRiskRequest/)
    assert.match(source, /logImpersonationRiskExecution/)
  }
})

run('client surfaces mount the impersonation risk dialog where needed', () => {
  const guardedClients = [
    'src/components/evaluation/EvaluationResultsClient.tsx',
    'src/components/evaluation/EvaluationWorkbenchClient.tsx',
    'src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx',
    'src/components/kpi/PersonalKpiManagementClient.tsx',
    'src/components/evaluation/wordcloud360/WordCloud360WorkspaceClient.tsx',
    'src/components/evaluation/feedback360/Feedback360AdminPanel.tsx',
  ]

  for (const filePath of guardedClients) {
    const source = readSource(filePath)
    assert.match(source, /useImpersonationRiskAction/)
    assert.match(source, /riskDialog/)
  }
})

console.log('Impersonation risk tests completed')
