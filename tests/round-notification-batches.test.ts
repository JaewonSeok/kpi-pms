import './register-path-aliases'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// 한 건이 실패해도 나머지 케이스 결과를 함께 보도록 끝까지 돌고, 실패가 있으면 exit 1 로 끝낸다.
async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

// 아직 없는 모듈(수정 전)도 테스트가 돌 수 있게 경로 문자열로 불러온다. 없으면 null.
const requireFromTest = createRequire(__filename)
function loadOptional<T>(request: string): T | null {
  try {
    return requireFromTest(request) as T
  } catch {
    return null
  }
}

type SendResponse = { queuedCount?: number; suppressedCount?: number; duplicateCount?: number; message?: string }
type Outcome = {
  batchCount: number
  completedBatches: number
  sentRecipientCount: number
  remainingRecipientIds: string[]
  queuedCount: number
  suppressedCount: number
  duplicateCount: number
  failedBatchIndex: number | null
  errorMessage: string | null
}
type Post = (url: string, body: Record<string, unknown>) => Promise<SendResponse>
type BatchModule = {
  ROUND_NOTIFICATION_BATCH_SIZE: number
  sendRecipientsInBatches: (params: {
    recipientIds: string[]
    send: (batchIds: string[]) => Promise<SendResponse>
    startBatchIndex?: number
    onProgress?: (current: number, total: number) => void
  }) => Promise<Outcome>
  sendUpwardLeadershipReminders: (params: {
    round: { id: string; roundName: string }
    targetIds: string[]
    post: Post
  }) => Promise<Outcome>
  sendFeedback360Reminders: (params: {
    mode: 'send' | 'test'
    roundId: string
    action: string
    targetIds: string[]
    subject: string
    body: string
    shareAudience: string
    testEmail?: string
    post: Post
  }) => Promise<Outcome>
}

const ids = (count: number, prefix = 'emp') => Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`)

// 요청을 기록하는 가짜 전송. failAt(0부터 센 요청 순번)에서 한 번 던진다.
function recorder(failAt: number | null = null) {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = []
  let failed = false
  const post: Post = async (url, body) => {
    if (failAt !== null && requests.length === failAt && !failed) {
      failed = true
      requests.push({ url, body })
      throw new Error('묶음 전송 실패')
    }
    requests.push({ url, body })
    const count = Array.isArray(body.targetIds) ? body.targetIds.length : 0
    return { queuedCount: count * 2, suppressedCount: 0, duplicateCount: 0 }
  }
  return { requests, post }
}

async function main() {
  const batches = loadOptional<BatchModule>('../src/lib/round-notification-batches')

  await run('ⓐ 250명이면 요청 3번(100 · 100 · 50)이고, 모든 사람이 정확히 한 번씩 들어간다', async () => {
    assert.ok(batches, 'round-notification-batches 모듈이 없다')
    const everyone = ids(250)
    const sent: string[][] = []
    const progress: string[] = []
    const outcome = await batches.sendRecipientsInBatches({
      recipientIds: everyone,
      send: async (batchIds) => {
        sent.push(batchIds)
        return { queuedCount: batchIds.length, duplicateCount: 0, suppressedCount: 0 }
      },
      onProgress: (current, total) => progress.push(`${current}/${total}`),
    })
    const flattened = sent.flat()
    assert.deepEqual(
      {
        sizes: sent.map((batch) => batch.length),
        everyoneOnce: flattened.length === everyone.length && new Set(flattened).size === everyone.length,
        sameSet: [...flattened].sort().join(',') === [...everyone].sort().join(','),
        progress,
        outcome: [outcome.batchCount, outcome.completedBatches, outcome.sentRecipientCount, outcome.queuedCount, outcome.failedBatchIndex],
      },
      {
        sizes: [100, 100, 50],
        everyoneOnce: true,
        sameSet: true,
        progress: ['1/3', '2/3', '3/3'],
        outcome: [3, 3, 250, 250, null],
      }
    )
  })

  await run('ⓑ 100명 이하는 요청 1번이고 요청 본문이 지금과 같다', async () => {
    assert.ok(batches, 'round-notification-batches 모듈이 없다')
    const upward = recorder()
    await batches.sendUpwardLeadershipReminders({ round: { id: 'up-1', roundName: '2026 리더십 진단' }, targetIds: ids(100), post: upward.post })
    const full = recorder()
    await batches.sendFeedback360Reminders({
      mode: 'send',
      roundId: 'r360-1',
      action: 'send-review-reminder',
      targetIds: ids(3),
      subject: '응답 요청',
      body: '<p>응답 부탁드립니다.</p>',
      shareAudience: 'REVIEWEE',
      post: full.post,
    })
    // 지금 화면이 보내는 본문(그대로): 상향평가 handleSendLeadershipReminder · 360 handleReminder
    assert.deepEqual(
      {
        upwardRequests: upward.requests.length,
        upwardUrl: upward.requests[0]?.url,
        upwardBody: JSON.parse(JSON.stringify(upward.requests[0]?.body ?? null)),
        fullRequests: full.requests.length,
        fullUrl: full.requests[0]?.url,
        fullBody: JSON.parse(JSON.stringify(full.requests[0]?.body ?? null)),
      },
      {
        upwardRequests: 1,
        upwardUrl: '/api/feedback/rounds/up-1/notifications',
        upwardBody: {
          action: 'send-review-reminder',
          roundId: 'up-1',
          targetIds: ids(100),
          subject: '[리더십 진단] 2026 리더십 진단 응답 요청',
          body: `
              <p>안녕하세요.</p>
              <p>2026 리더십 진단 리더십 진단 응답이 배정되었습니다.</p>
              <p>기한 내 리더십 진단 화면에서 응답을 작성해 주세요.</p>
            `,
        },
        fullRequests: 1,
        fullUrl: '/api/feedback/rounds/r360-1/notifications',
        fullBody: {
          action: 'send-review-reminder',
          roundId: 'r360-1',
          targetIds: ids(3),
          subject: '응답 요청',
          body: '<p>응답 부탁드립니다.</p>',
          shareAudience: 'REVIEWEE',
        },
      }
    )
  })

  await run('ⓒ 두 번째 묶음이 실패하면 세 번째를 보내지 않고 보낸 수 · 남은 수를 돌려준다. 다시 보내기는 실패한 묶음부터 보낸다', async () => {
    assert.ok(batches, 'round-notification-batches 모듈이 없다')
    const everyone = ids(250)
    const attempts: string[][] = []
    const failing = await batches.sendRecipientsInBatches({
      recipientIds: everyone,
      send: async (batchIds) => {
        attempts.push(batchIds)
        if (attempts.length === 2) throw new Error('두 번째 묶음 실패')
        return { queuedCount: batchIds.length, duplicateCount: 0, suppressedCount: 0 }
      },
    })
    const retried: string[][] = []
    const retry = await batches.sendRecipientsInBatches({
      recipientIds: everyone,
      startBatchIndex: failing.failedBatchIndex ?? 0,
      send: async (batchIds) => {
        retried.push(batchIds)
        return { queuedCount: batchIds.length, duplicateCount: 0, suppressedCount: 0 }
      },
    })
    assert.deepEqual(
      {
        attempts: attempts.length,
        sent: failing.sentRecipientCount,
        remaining: failing.remainingRecipientIds.length,
        remainingStartsAt: failing.remainingRecipientIds[0],
        failedBatchIndex: failing.failedBatchIndex,
        hasError: Boolean(failing.errorMessage),
        retrySizes: retried.map((batch) => batch.length),
        retryFirst: retried[0]?.[0],
        retryDone: [retry.completedBatches, retry.failedBatchIndex, retry.sentRecipientCount],
      },
      {
        attempts: 2,
        sent: 100,
        remaining: 150,
        remainingStartsAt: 'emp-101',
        failedBatchIndex: 1,
        hasError: true,
        retrySizes: [100, 50],
        retryFirst: 'emp-101',
        retryDone: [3, null, 150],
      }
    )
  })

  await run("ⓓ 상향평가 '미제출자 메일 발송'의 발송 함수가 250명을 받으면 요청 3번", async () => {
    assert.ok(batches, 'round-notification-batches 모듈이 없다')
    const upward = recorder()
    const outcome = await batches.sendUpwardLeadershipReminders({
      round: { id: 'up-1', roundName: '2026 리더십 진단' },
      targetIds: ids(250),
      post: upward.post,
    })
    assert.deepEqual(
      {
        requests: upward.requests.map((request) => (request.body.targetIds as string[]).length),
        queued: outcome.queuedCount,
      },
      { requests: [100, 100, 50], queued: 500 }
    )
  })

  await run('ⓔ 360 리마인드 발송(선택 없음 = 보이는 전원)의 발송 함수가 250명을 받으면 요청 3번', async () => {
    assert.ok(batches, 'round-notification-batches 모듈이 없다')
    const full = recorder()
    await batches.sendFeedback360Reminders({
      mode: 'send',
      roundId: 'r360-1',
      action: 'send-review-reminder',
      targetIds: ids(250),
      subject: '응답 요청',
      body: '<p>응답 부탁드립니다.</p>',
      shareAudience: 'REVIEWEE',
      post: full.post,
    })
    // 테스트 발송은 메일 한 통이므로 요청 1번(대상 목록은 서버 검증 한도 100 안에서 보낸다).
    const test = recorder()
    await batches.sendFeedback360Reminders({
      mode: 'test',
      roundId: 'r360-1',
      action: 'send-review-reminder',
      targetIds: ids(250),
      subject: '응답 요청',
      body: '<p>응답 부탁드립니다.</p>',
      shareAudience: 'REVIEWEE',
      testEmail: 'tester@example.com',
      post: test.post,
    })
    assert.deepEqual(
      {
        requests: full.requests.map((request) => (request.body.targetIds as string[]).length),
        actions: [...new Set(full.requests.map((request) => request.body.action))],
        testRequests: test.requests.map((request) => [request.body.action, (request.body.targetIds as string[]).length]),
      },
      { requests: [100, 100, 50], actions: ['send-review-reminder'], testRequests: [['test-send', 100]] }
    )
  })

  console.log('Round notification batch tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
