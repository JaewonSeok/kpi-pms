import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { resolvePreloadSource2026 } from '../src/server/preview-2026-grade-page'

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
  // resolvePreloadSource2026 만 검증 — prisma·DB 비의존 순수 함수.

  await run('preloadSource: policy2026OrganizationWeights 키 있음 → stored', () => {
    const result = resolvePreloadSource2026({
      policy2026OrganizationWeights: {
        withSection: { division: 0, section: 0.1, team: 0.2 },
        withoutSection: { division: 0.1, team: 0.2 },
        personal: 0.7,
      },
    })
    assert.equal(result, 'stored')
  })

  await run('preloadSource: 다른 키만 있고 policy2026OrganizationWeights 없음 → default', () => {
    const result = resolvePreloadSource2026({
      milestones: { step1: 'done' },
      policy2026PreviewMappings: { salesGroupsByDivisionId: {} },
    })
    assert.equal(result, 'default')
  })

  await run('preloadSource: 빈 객체 → default', () => {
    const result = resolvePreloadSource2026({})
    assert.equal(result, 'default')
  })

  await run('preloadSource: null → default', () => {
    assert.equal(resolvePreloadSource2026(null), 'default')
  })

  await run('preloadSource: undefined → default', () => {
    assert.equal(resolvePreloadSource2026(undefined), 'default')
  })

  await run('preloadSource: 배열(record 아님) → default', () => {
    assert.equal(resolvePreloadSource2026([1, 2, 3]), 'default')
  })

  await run('preloadSource: 문자열(record 아님) → default', () => {
    assert.equal(resolvePreloadSource2026('not an object'), 'default')
  })

  await run('preloadSource: policy2026OrganizationWeights 값이 invalid여도 키 존재 = stored', () => {
    // resolveOrganizationWeights2026 은 DEFAULT 로 fallback하지만,
    // 본 함수는 "저장 시도 흔적" 만 판정 — 키 존재 자체로 stored.
    const result = resolvePreloadSource2026({
      policy2026OrganizationWeights: { foo: 'invalid' },
    })
    assert.equal(result, 'stored')
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
