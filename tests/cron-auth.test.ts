import assert from 'node:assert/strict'
import { isAuthorizedCronRequest } from '../src/lib/cron-auth'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/cron/notifications', {
    method: 'POST',
    headers,
  })
}

function withSecret(secret: string | undefined, fn: () => void) {
  const original = process.env.CRON_SECRET
  if (secret === undefined) {
    delete process.env.CRON_SECRET
  } else {
    process.env.CRON_SECRET = secret
  }
  try {
    fn()
  } finally {
    if (original === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = original
    }
  }
}

// ⓐ secret 미설정 + 외부 호출 → 거부
run('CRON_SECRET 미설정 — x-cron-secret 헤더가 있어도 거부', () => {
  withSecret(undefined, () => {
    assert.equal(isAuthorizedCronRequest(makeRequest({ 'x-cron-secret': 'anything' })), false)
  })
})

run('CRON_SECRET 미설정 — Authorization Bearer 헤더가 있어도 거부', () => {
  withSecret(undefined, () => {
    assert.equal(isAuthorizedCronRequest(makeRequest({ authorization: 'Bearer anything' })), false)
  })
})

run('CRON_SECRET 미설정 — 헤더 없는 외부 호출 거부', () => {
  withSecret(undefined, () => {
    assert.equal(isAuthorizedCronRequest(makeRequest()), false)
  })
})

// ⓑ secret 설정 + 올바른 헤더 → 통과 (두 헤더 형식 각각)
run('CRON_SECRET 설정 — x-cron-secret 헤더 일치 → 통과 (기존 경로)', () => {
  withSecret('test-secret-abc', () => {
    assert.equal(isAuthorizedCronRequest(makeRequest({ 'x-cron-secret': 'test-secret-abc' })), true)
  })
})

run('CRON_SECRET 설정 — Authorization: Bearer 헤더 일치 → 통과 (Vercel cron 형식)', () => {
  withSecret('test-secret-abc', () => {
    assert.equal(
      isAuthorizedCronRequest(makeRequest({ authorization: 'Bearer test-secret-abc' })),
      true
    )
  })
})

// ⓒ secret 설정 + 잘못된 헤더 → 거부
run('CRON_SECRET 설정 — x-cron-secret 값 불일치 → 거부', () => {
  withSecret('test-secret-abc', () => {
    assert.equal(isAuthorizedCronRequest(makeRequest({ 'x-cron-secret': 'wrong' })), false)
  })
})

run('CRON_SECRET 설정 — Authorization Bearer 값 불일치 → 거부', () => {
  withSecret('test-secret-abc', () => {
    assert.equal(
      isAuthorizedCronRequest(makeRequest({ authorization: 'Bearer wrong' })),
      false
    )
  })
})

run('CRON_SECRET 설정 — Authorization Basic 스킴은 거부 (Bearer만 허용)', () => {
  withSecret('test-secret-abc', () => {
    assert.equal(
      isAuthorizedCronRequest(makeRequest({ authorization: 'Basic test-secret-abc' })),
      false
    )
  })
})

run('CRON_SECRET 설정 — 헤더 없는 외부 호출 거부', () => {
  withSecret('test-secret-abc', () => {
    assert.equal(isAuthorizedCronRequest(makeRequest()), false)
  })
})

// ⓓ ADMIN 세션 → 통과 (secret 설정 여부 무관)
run('ROLE_ADMIN 세션 — CRON_SECRET 미설정이어도 통과', () => {
  withSecret(undefined, () => {
    assert.equal(isAuthorizedCronRequest(makeRequest(), 'ROLE_ADMIN'), true)
  })
})

run('ROLE_ADMIN 세션 — CRON_SECRET 설정되어도 통과', () => {
  withSecret('test-secret-abc', () => {
    assert.equal(isAuthorizedCronRequest(makeRequest(), 'ROLE_ADMIN'), true)
  })
})

run('일반 사용자 세션 — ROLE_TEAM_LEADER는 거부', () => {
  withSecret('test-secret-abc', () => {
    assert.equal(isAuthorizedCronRequest(makeRequest(), 'ROLE_TEAM_LEADER'), false)
  })
})

console.log('Cron auth tests completed')
