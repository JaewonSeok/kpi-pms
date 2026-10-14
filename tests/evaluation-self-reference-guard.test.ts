import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

// F4 — evaluatorId === session.user.id || role === 'ROLE_ADMIN' 는 targetId 를 제외하지 않아
// ROLE_ADMIN 인 피평가자가 자기 자신의 평가를 스스로 제출·확정·반려·가이드 조작할 수 있었다.
// 네 라우트 전부 (role === 'ROLE_ADMIN' && evaluation.targetId !== session.user.id) 로 막는다.
const SELF_EXCLUDED_ADMIN_BYPASS =
  "(session.user.role === 'ROLE_ADMIN' && evaluation.targetId !== session.user.id)"

run('evaluation draft save route excludes self-target from the ROLE_ADMIN bypass', () => {
  const source = read('src/app/api/evaluation/[id]/route.ts')
  assert.equal(source.includes(SELF_EXCLUDED_ADMIN_BYPASS), true)
})

run('evaluation submit route excludes self-target from the ROLE_ADMIN bypass', () => {
  const source = read('src/app/api/evaluation/[id]/submit/route.ts')
  assert.equal(source.includes(SELF_EXCLUDED_ADMIN_BYPASS), true)
})

run('evaluation review (reject) route excludes self-target from the ROLE_ADMIN bypass', () => {
  const source = read('src/app/api/evaluation/[id]/review/route.ts')
  assert.equal(source.includes(SELF_EXCLUDED_ADMIN_BYPASS), true)
})

run('evaluation guide route excludes self-target from the ROLE_ADMIN bypass and selects targetId', () => {
  const source = read('src/app/api/evaluation/[id]/guide/route.ts')
  assert.equal(source.includes(SELF_EXCLUDED_ADMIN_BYPASS), true)
  // guide/route.ts 는 select 제한형이라 targetId 를 select 하지 않으면 위 가드 자체가
  // undefined !== session.user.id 로 항상 true 가 되어 조용히 무력화된다.
  assert.match(source, /select:\s*\{\s*\n\s*id: true,\s*\n\s*evaluatorId: true,\s*\n\s*targetId: true,/)
})

console.log('Evaluation self-reference guard tests completed')
