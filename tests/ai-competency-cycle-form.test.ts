import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  toAiCompetencyGateCycleLocalInputValue,
  toAiCompetencyGateCyclePayload,
} from '../src/lib/ai-competency-gate-cycle-form'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('cycle payload converts datetime-local values into ISO-safe request fields', () => {
  const payload = toAiCompetencyGateCyclePayload({
    evalCycleId: 'eval-cycle-1',
    cycleName: 'AI 역량평가 1차',
    status: 'OPEN',
    submissionOpenAt: '2026-04-21T14:25',
    submissionCloseAt: '2026-04-22T14:25',
    reviewOpenAt: '',
    reviewCloseAt: '2026-04-23T09:00',
    resultPublishAt: '2026-04-24T18:30',
    promotionGateEnabled: true,
    policyAcknowledgementText: '정책 확인 문구',
  })

  assert.match(payload.submissionOpenAt ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.match(payload.submissionCloseAt ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.equal(payload.reviewOpenAt, undefined)
  assert.match(payload.reviewCloseAt ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.match(payload.resultPublishAt ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.equal(payload.policyAcknowledgementText, '정책 확인 문구')
})

run('cycle datetime values round-trip between local input and ISO without shifting the intended local time', () => {
  const localDateTime = '2026-04-21T14:25'
  const payload = toAiCompetencyGateCyclePayload({
    evalCycleId: 'eval-cycle-1',
    cycleName: 'AI 역량평가 1차',
    status: 'OPEN',
    submissionOpenAt: localDateTime,
    submissionCloseAt: '',
    reviewOpenAt: '',
    reviewCloseAt: '',
    resultPublishAt: '',
    promotionGateEnabled: true,
    policyAcknowledgementText: '',
  })

  assert.equal(toAiCompetencyGateCycleLocalInputValue(payload.submissionOpenAt), localDateTime)
})

run('admin panel sends cycle saves through the ISO payload converter before hitting validation', () => {
  const source = readFileSync(
    path.resolve(process.cwd(), 'src/components/evaluation/AiCompetencyAdminPanel.tsx'),
    'utf8'
  )

  assert.match(source, /toAiCompetencyGateCyclePayload\(cycleForm\)/)
})

console.log('AI competency cycle form tests completed')
