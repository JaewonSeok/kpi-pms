// 라운드 수동 알림(rounds/[id]/notifications)은 요청당 수신자를 100명까지 받는다(FeedbackRoundReminderSchema).
// 화면은 받는 사람이 100명을 넘으면 100명씩 나눠, 앞 요청이 끝난 뒤 다음 요청을 보낸다. 360 관리 화면 · 상향평가 화면이 함께 쓴다.
export const ROUND_NOTIFICATION_BATCH_SIZE = 100

export type RoundNotificationSendResponse = {
  queuedCount?: number
  suppressedCount?: number
  duplicateCount?: number
  message?: string
}

export type RoundNotificationBatchOutcome = {
  batchCount: number
  // 끝까지 보낸 묶음 수(다시 보내기면 건너뛴 앞 묶음도 센다)
  completedBatches: number
  // 이번 호출에서 보낸 사람 수
  sentRecipientCount: number
  // 실패한 묶음부터 끝까지의 사람(다시 보낼 대상)
  remainingRecipientIds: string[]
  queuedCount: number
  suppressedCount: number
  duplicateCount: number
  // 실패한 묶음의 순번(0부터). 다 보냈으면 null. 다시 보내기는 이 값을 startBatchIndex 로 넘긴다.
  failedBatchIndex: number | null
  errorMessage: string | null
}

export function splitIntoBatches<T>(items: T[], size = ROUND_NOTIFICATION_BATCH_SIZE): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

// 묶음을 차례로 보낸다. 한 묶음이 실패하면 거기서 멈추고 보낸 수 · 남은 사람 · 실패한 묶음 순번을 돌려준다.
export async function sendRecipientsInBatches(params: {
  recipientIds: string[]
  send: (batchIds: string[]) => Promise<RoundNotificationSendResponse>
  startBatchIndex?: number
  onProgress?: (current: number, total: number) => void
}): Promise<RoundNotificationBatchOutcome> {
  const batches = splitIntoBatches(params.recipientIds)
  const startBatchIndex = Math.max(0, params.startBatchIndex ?? 0)
  const outcome: RoundNotificationBatchOutcome = {
    batchCount: batches.length,
    completedBatches: Math.min(startBatchIndex, batches.length),
    sentRecipientCount: 0,
    remainingRecipientIds: [],
    queuedCount: 0,
    suppressedCount: 0,
    duplicateCount: 0,
    failedBatchIndex: null,
    errorMessage: null,
  }

  for (let index = startBatchIndex; index < batches.length; index += 1) {
    params.onProgress?.(index + 1, batches.length)
    try {
      const response = await params.send(batches[index])
      outcome.queuedCount += response.queuedCount ?? 0
      outcome.suppressedCount += response.suppressedCount ?? 0
      outcome.duplicateCount += response.duplicateCount ?? 0
      outcome.sentRecipientCount += batches[index].length
      outcome.completedBatches = index + 1
    } catch (error) {
      outcome.failedBatchIndex = index
      outcome.errorMessage = error instanceof Error ? error.message : '알림 발송에 실패했습니다.'
      outcome.remainingRecipientIds = batches.slice(index).flat()
      break
    }
  }

  return outcome
}

type PostRoundNotification = (url: string, body: Record<string, unknown>) => Promise<RoundNotificationSendResponse>

const roundNotificationUrl = (roundId: string) => `/api/feedback/rounds/${encodeURIComponent(roundId)}/notifications`

// 상향평가 '미제출자 메일 발송'. 요청 본문은 묶음마다 targetIds 만 다르다.
export async function sendUpwardLeadershipReminders(params: {
  round: { id: string; roundName: string }
  targetIds: string[]
  post: PostRoundNotification
  startBatchIndex?: number
  onProgress?: (current: number, total: number) => void
}) {
  return sendRecipientsInBatches({
    recipientIds: params.targetIds,
    startBatchIndex: params.startBatchIndex,
    onProgress: params.onProgress,
    send: (batchIds) =>
      params.post(roundNotificationUrl(params.round.id), {
        action: 'send-review-reminder',
        roundId: params.round.id,
        targetIds: batchIds,
        subject: `[리더십 진단] ${params.round.roundName} 응답 요청`,
        body: `
              <p>안녕하세요.</p>
              <p>${params.round.roundName} 리더십 진단 응답이 배정되었습니다.</p>
              <p>기한 내 리더십 진단 화면에서 응답을 작성해 주세요.</p>
            `,
      }),
  })
}

// 360 관리 화면 '리마인드 발송'(모든 탭)과 테스트 발송. 테스트 발송은 메일 한 통이라 요청 1번이고,
// 대상 목록은 서버 검증 한도(100) 안의 앞 100명만 싣는다.
export async function sendFeedback360Reminders(params: {
  mode: 'send' | 'test'
  roundId: string
  action: string
  targetIds: string[]
  subject: string
  body: string
  shareAudience: string
  testEmail?: string
  post: PostRoundNotification
  startBatchIndex?: number
  onProgress?: (current: number, total: number) => void
}) {
  const buildBody = (batchIds: string[]) => ({
    action: params.mode === 'test' ? 'test-send' : params.action,
    roundId: params.roundId,
    targetIds: batchIds,
    subject: params.subject,
    body: params.body,
    shareAudience: params.shareAudience,
    testEmail: params.mode === 'test' ? params.testEmail : undefined,
  })

  if (params.mode === 'test') {
    return sendRecipientsInBatches({
      recipientIds: params.targetIds.slice(0, ROUND_NOTIFICATION_BATCH_SIZE),
      send: (batchIds) => params.post(roundNotificationUrl(params.roundId), buildBody(batchIds)),
    })
  }

  return sendRecipientsInBatches({
    recipientIds: params.targetIds,
    startBatchIndex: params.startBatchIndex,
    onProgress: params.onProgress,
    send: (batchIds) => params.post(roundNotificationUrl(params.roundId), buildBody(batchIds)),
  })
}

// 끝난 뒤 보이는 합계 문구. 실제 발송은 cron(평일 09시) 또는 알림 운영 화면의 '즉시 실행' 때다.
export function describeRoundNotificationOutcome(outcome: RoundNotificationBatchOutcome) {
  const summary = `대기열 ${outcome.queuedCount}건 · 중복으로 건너뜀 ${outcome.duplicateCount}건 · 실패 ${outcome.remainingRecipientIds.length}명`
  const progress =
    outcome.failedBatchIndex === null
      ? `${outcome.batchCount}개 묶음을 모두 보냈습니다.`
      : `${outcome.failedBatchIndex + 1}/${outcome.batchCount} 묶음에서 멈췄습니다. 보낸 ${outcome.sentRecipientCount}명, 남은 ${outcome.remainingRecipientIds.length}명.`
  return `${progress} ${summary}. 실제 발송은 평일 09시 또는 알림 운영 화면의 '즉시 실행' 때 나갑니다.`
}
