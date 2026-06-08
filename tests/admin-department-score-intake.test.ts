import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { CreateDepartmentScoreIntakeSchema } from '../src/lib/validations'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const BASE = {
  evalCycleId: 'cycle-1',
  deptId: 'dept-1',
  score: 50,
}

async function main() {
  // ────────────────────────────────────────────
  // score 경계값 — 0/130 통과, -1/131 거부 (DB CHECK와 2중 방어)
  // ────────────────────────────────────────────

  await run('score 0 → accept (경계 하단)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, score: 0 })
    assert.equal(r.success, true)
  })

  await run('score 130 → accept (경계 상단)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, score: 130 })
    assert.equal(r.success, true)
  })

  await run('score -1 → reject (한국어 메시지 "0 이상" 포함)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, score: -1 })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.match(r.error.issues[0].message, /0 이상/)
    }
  })

  await run('score 131 → reject (한국어 메시지 "130 이하" 포함)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, score: 131 })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.match(r.error.issues[0].message, /130 이하/)
    }
  })

  await run('score 65.5 (소수) → accept (Float 컬럼)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, score: 65.5 })
    assert.equal(r.success, true)
  })

  // ────────────────────────────────────────────
  // 필수 필드 검증
  // ────────────────────────────────────────────

  await run('evalCycleId 누락 → reject', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ deptId: 'd', score: 50 })
    assert.equal(r.success, false)
  })

  await run('deptId 누락 → reject', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ evalCycleId: 'c', score: 50 })
    assert.equal(r.success, false)
  })

  await run('score 누락 → reject', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ evalCycleId: 'c', deptId: 'd' })
    assert.equal(r.success, false)
  })

  await run('evalCycleId 빈 문자열 → reject (min(1))', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, evalCycleId: '' })
    assert.equal(r.success, false)
  })

  await run('deptId 빈 문자열 → reject (min(1))', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, deptId: '' })
    assert.equal(r.success, false)
  })

  // ────────────────────────────────────────────
  // 타입 검증
  // ────────────────────────────────────────────

  await run('score 문자열 → reject (number 강제)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, score: '50' as unknown as number })
    assert.equal(r.success, false)
  })

  await run('evalCycleId number → reject (string 강제)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({
      ...BASE,
      evalCycleId: 123 as unknown as string,
    })
    assert.equal(r.success, false)
  })

  // ────────────────────────────────────────────
  // note 옵셔널 — 생략 통과, 길이 제한
  // ────────────────────────────────────────────

  await run('note 생략 → accept (optional)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse(BASE)
    assert.equal(r.success, true)
    if (r.success) assert.equal(r.data.note, undefined)
  })

  await run('note 정상 문자열 → accept', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, note: '전략기획팀 1차 채점 결과' })
    assert.equal(r.success, true)
    if (r.success) assert.equal(r.data.note, '전략기획팀 1차 채점 결과')
  })

  await run('note 1000자 정확히 → accept (경계)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, note: 'a'.repeat(1000) })
    assert.equal(r.success, true)
  })

  await run('note 1001자 → reject (max(1000) 초과)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({ ...BASE, note: 'a'.repeat(1001) })
    assert.equal(r.success, false)
  })

  // ────────────────────────────────────────────
  // source/receivedById/receivedAt — schema 미포함 (DB default·세션 주입 위임)
  // ────────────────────────────────────────────

  await run('source 필드 schema에 없음 — 보내도 strip되지 않고 무시 (정상 동작)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({
      ...BASE,
      source: 'HR 수동',
    })
    assert.equal(r.success, true)
    if (r.success) {
      // zod는 기본적으로 unknown key를 strip — data.source는 undefined여야
      assert.equal((r.data as { source?: string }).source, undefined)
    }
  })

  await run('receivedById schema에 없음 — 보내도 무시 (DB는 세션에서 주입)', () => {
    const r = CreateDepartmentScoreIntakeSchema.safeParse({
      ...BASE,
      receivedById: 'malicious-id',
    })
    assert.equal(r.success, true)
    if (r.success) {
      assert.equal((r.data as { receivedById?: string }).receivedById, undefined)
    }
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
