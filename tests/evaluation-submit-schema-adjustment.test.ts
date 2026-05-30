import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { SubmitEvaluationSchema, SaveEvaluationDraftSchema } from '../src/lib/validations'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const validBase = {
  comment: '종합 의견 본문이 최소 50자 이상이어야 통과합니다. 이 문자열은 그 조건을 만족하도록 충분히 길게 작성되어 있습니다.',
  strengthComment: '강점을 잘 정리한 내용입니다.',
  improvementComment: '보완 포인트를 잘 정리한 내용입니다.',
}

function item(overrides: Record<string, unknown> = {}) {
  return { personalKpiId: 'pk-1', quantScore: 90, ...overrides }
}

async function main() {
  // ---- SubmitEvaluationSchema ----
  await run('Submit: 가감점 필드 없어도 통과 (하위호환)', () => {
    const result = SubmitEvaluationSchema.safeParse({ ...validBase, items: [item()] })
    assert.equal(result.success, true)
  })

  await run('Submit: adjustmentScore=0 이면 reason 없어도 통과', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: 0 })],
    })
    assert.equal(result.success, true)
  })

  await run('Submit: adjustmentScore=3 + reason 있음 → 통과', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: 3, adjustmentReason: '핵심 기여' })],
    })
    assert.equal(result.success, true)
  })

  await run('Submit: adjustmentScore=3 + reason 누락 → 거부 (custom path adjustmentReason)', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: 3 })],
    })
    assert.equal(result.success, false)
    if (!result.success) {
      const reasonIssue = result.error.issues.find((i) => i.path.includes('adjustmentReason'))
      assert.ok(reasonIssue, 'reason path 에러가 있어야 함')
    }
  })

  await run('Submit: adjustmentScore=-5 + reason 있음 → 통과 (경계값)', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: -5, adjustmentReason: '미흡' })],
    })
    assert.equal(result.success, true)
  })

  await run('Submit: adjustmentScore=5 + reason 있음 → 통과 (경계값)', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: 5, adjustmentReason: '핵심 기여' })],
    })
    assert.equal(result.success, true)
  })

  await run('Submit: adjustmentScore=-6 → 거부 (범위 밖)', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: -6, adjustmentReason: '...' })],
    })
    assert.equal(result.success, false)
  })

  await run('Submit: adjustmentScore=6 → 거부 (범위 밖)', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: 6, adjustmentReason: '...' })],
    })
    assert.equal(result.success, false)
  })

  await run('Submit: reason 공백만 (trim 후 빈 문자열) → 거부', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: 2, adjustmentReason: '   ' })],
    })
    assert.equal(result.success, false)
  })

  await run('Submit: adjustmentGroupKey 100자 초과 → 거부', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: 2, adjustmentReason: 'r', adjustmentGroupKey: 'g'.repeat(101) })],
    })
    assert.equal(result.success, false)
  })

  await run('Submit: adjustmentReason 500자 초과 → 거부', () => {
    const result = SubmitEvaluationSchema.safeParse({
      ...validBase,
      items: [item({ adjustmentScore: 2, adjustmentReason: 'r'.repeat(501) })],
    })
    assert.equal(result.success, false)
  })

  // ---- SaveEvaluationDraftSchema ----
  await run('Draft: 가감점 없어도 통과', () => {
    const result = SaveEvaluationDraftSchema.safeParse({ items: [item()] })
    assert.equal(result.success, true)
  })

  await run('Draft: adjustmentScore=null + reason=null → 통과 (모두 nullable)', () => {
    const result = SaveEvaluationDraftSchema.safeParse({
      items: [item({ adjustmentScore: null, adjustmentReason: null })],
    })
    assert.equal(result.success, true)
  })

  await run('Draft: adjustmentScore=2 + reason 없음 → 거부 (refine 동일)', () => {
    const result = SaveEvaluationDraftSchema.safeParse({
      items: [item({ adjustmentScore: 2 })],
    })
    assert.equal(result.success, false)
  })

  await run('Draft: adjustmentScore=2 + reason="r" → 통과', () => {
    const result = SaveEvaluationDraftSchema.safeParse({
      items: [item({ adjustmentScore: 2, adjustmentReason: 'r' })],
    })
    assert.equal(result.success, true)
  })

  await run('Draft: items 누락 → default([])로 통과', () => {
    const result = SaveEvaluationDraftSchema.safeParse({})
    assert.equal(result.success, true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
