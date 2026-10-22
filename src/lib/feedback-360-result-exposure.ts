// 360(FULL_360) 결과를 누구에게 · 언제 · 얼마나 내려보낼지의 판정은 여기 하나다.
// 결과를 내려보내는 경로(결과 화면 데이터 · 결과 열람 기록 · 360 리포트)가 모두 이 함수들을 쓴다.
// '관리자'는 그 라운드의 관리 권한자(canManageFeedbackRoundByAccess 가 참)다.
// 온보딩 리뷰 라운드(onboarding_review_generations 에 연결된 FULL_360)와 다른 유형의 라운드는 대상이 아니다.

type ResultRound = {
  roundType: string
  status: string
  isAnonymous: boolean
  isOnboarding: boolean
  // 관리자가 결과를 공개한 시각(documentSettings.resultReleasedAt). 없으면 공개 전이다.
  resultReleasedAt: string | null
}

// 마감: 종료 API(rounds/[id]/status 의 CLOSE)는 COMPLETED 로 바꾸고, CLOSED 도 종료로 본다.
const ENDED_ROUND_STATUSES = new Set(['COMPLETED', 'CLOSED'])

export function isFeedback360RoundEnded(status: string) {
  return ENDED_ROUND_STATUSES.has(status)
}

// 공개 표시는 라운드 documentSettings(JSON)의 resultReleasedAt 이다. 별도 컬럼은 없다.
export function readFeedback360ResultReleasedAt(documentSettings: unknown) {
  if (!documentSettings || typeof documentSettings !== 'object' || Array.isArray(documentSettings)) return null
  const value = (documentSettings as Record<string, unknown>).resultReleasedAt
  return typeof value === 'string' && value.trim() ? value : null
}

const TAG_SUMMARY_HEADING = '[선택 태그 요약]'

// 태그는 이 횟수 이상 쓰인 것만 보낸다. 한 응답 안의 같은 태그는 한 번으로 센다.
export const FEEDBACK_360_MIN_TAG_USES = 2

export function isFeedback360ResultRuleRound(round: Pick<ResultRound, 'roundType' | 'isOnboarding'>) {
  return round.roundType === 'FULL_360' && !round.isOnboarding
}

// 관리자가 아니면 라운드가 마감됐고 관리자가 결과를 공개한 뒤에만 결과를 본다.
export function canOpenFeedback360Result(params: {
  round: Pick<ResultRound, 'roundType' | 'status' | 'isOnboarding' | 'resultReleasedAt'>
  isRoundManager: boolean
}) {
  if (!isFeedback360ResultRuleRound(params.round)) return true
  if (params.isRoundManager) return true
  return isFeedback360RoundEnded(params.round.status) && Boolean(params.round.resultReleasedAt)
}

// 익명 라운드의 평가자별 상세(이름 · 평가자별 점수 · 종합 의견)는 기준 충족 여부와 상관없이 관리자에게만 보낸다.
export function shouldHideFeedback360ReviewerDetails(params: {
  round: Pick<ResultRound, 'roundType' | 'isAnonymous' | 'isOnboarding'>
  isRoundManager: boolean
}) {
  return isFeedback360ResultRuleRound(params.round) && params.round.isAnonymous && !params.isRoundManager
}

// 익명 라운드에서 대상별 기준(SELF 를 뺀 제출 수 < minRaters)에 못 미치면,
// 관리자 외에는 점수 · 문항별 응답 · 태그 · 코멘트를 하나도 내려보내지 않는다.
export function shouldWithholdFeedback360Content(params: {
  round: Pick<ResultRound, 'roundType' | 'isAnonymous' | 'isOnboarding'>
  isRoundManager: boolean
  thresholdMet: boolean
}) {
  return (
    isFeedback360ResultRuleRound(params.round) &&
    params.round.isAnonymous &&
    !params.isRoundManager &&
    !params.thresholdMet
  )
}

// 기준을 넘어도 태그는 2회 이상 쓰인 것만 보낸다(관리자 외, 익명 라운드).
export function shouldLimitFeedback360TagsToRepeated(params: {
  round: Pick<ResultRound, 'roundType' | 'isAnonymous' | 'isOnboarding'>
  isRoundManager: boolean
}) {
  return isFeedback360ResultRuleRound(params.round) && params.round.isAnonymous && !params.isRoundManager
}

export function collectRepeatedFeedback360TagLabels(tagLabelsPerFeedback: string[][]) {
  const uses = new Map<string, number>()
  for (const labels of tagLabelsPerFeedback) {
    for (const label of new Set(labels)) {
      uses.set(label, (uses.get(label) ?? 0) + 1)
    }
  }
  return new Set([...uses].filter(([, count]) => count >= FEEDBACK_360_MIN_TAG_USES).map(([label]) => label))
}

// 종합 의견 안의 [선택 태그 요약] 블록에서 허용된 태그만 남긴다. 남는 태그가 없으면 블록을 지운다.
// 블록 형식(머리말 다음 줄부터 빈 줄 전까지, 줄마다 '긍정: a, b' · '보완: c')은 결과 집계의 태그 파싱과 같다.
export function keepAllowedTagsInComment(comment: string | null | undefined, allowedLabels: Set<string>) {
  if (!comment) return comment ?? null
  const lines = comment.split(/\r?\n/)
  const headingIdx = lines.findIndex((line) => line.trim() === TAG_SUMMARY_HEADING)
  if (headingIdx < 0) return comment

  let end = headingIdx + 1
  while (end < lines.length && lines[end].trim().length > 0) end += 1

  const keptLines = lines.slice(headingIdx + 1, end).flatMap((line) => {
    const prefixMatch = line.trim().match(/^(긍정|보완)\s*:\s*/)
    const prefix = prefixMatch ? `${prefixMatch[1]}: ` : ''
    const body = prefixMatch ? line.trim().slice(prefixMatch[0].length) : line.trim()
    const labels = body
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label && allowedLabels.has(label))
    return labels.length ? [`${prefix}${labels.join(', ')}`] : []
  })

  const before = lines.slice(0, headingIdx)
  const after = lines.slice(end)
  const block = keptLines.length ? [TAG_SUMMARY_HEADING, ...keptLines] : []
  return [...before, ...block, ...after].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
