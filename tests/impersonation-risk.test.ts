import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  buildImpersonationExpiry,
  buildImpersonationRiskHeaders,
  createImpersonationRiskCancelledError,
  createImpersonationSyncPayload,
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

run('risk confirmation headers include session, action, reason, and confirmation text', () => {
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
      reason: '운영 검증을 위해 대상 계정으로 로그인합니다.',
      startedAt: '2026-04-08T00:00:00.000Z',
      expiresAt: '2026-04-08T01:00:00.000Z',
    },
    'DOWNLOAD_EXPORT',
    {
      riskReason: '실제 다운로드 사유를 다시 기록합니다.',
      confirmationText: '다운로드',
    }
  )

  assert.equal(headers['x-impersonation-session-id'], 'imp-session-1')
  assert.equal(headers['x-impersonation-risk-action'], 'DOWNLOAD_EXPORT')
  assert.equal(headers['x-impersonation-risk-reason'], '실제 다운로드 사유를 다시 기록합니다.')
  assert.equal(headers['x-impersonation-confirm-text'], '다운로드')
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
