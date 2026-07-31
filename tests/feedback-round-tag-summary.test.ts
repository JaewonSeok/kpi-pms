import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  parseFeedback360TagSummaryFromComment,
  getSelectedFeedback360ResponseTagLabels,
  buildFeedback360TagSummaryText,
  FEEDBACK_360_TAG_SUMMARY_HEADING,
} from '../src/components/evaluation/feedback360/feedback360-response-tag-pool'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function buildComment(posLabels: string[], impLabels: string[], freeText = '') {
  const tags = [
    ...posLabels.map((l) => ({ id: l, label: l, tone: 'positive' as const, category: '' })),
    ...impLabels.map((l) => ({ id: l, label: l, tone: 'improvement' as const, category: '' })),
  ]
  const summary = buildFeedback360TagSummaryText(tags)
  return [summary, freeText].filter(Boolean).join('\n\n')
}

function aggregateRoundTags(feedbacks: Array<{ overallComment: string | null }>) {
  const positiveCounts = new Map<string, number>()
  const improvementCounts = new Map<string, number>()
  for (const feedback of feedbacks) {
    const { selectedTags } = parseFeedback360TagSummaryFromComment(feedback.overallComment)
    const tagItems = getSelectedFeedback360ResponseTagLabels(selectedTags)
    for (const tag of tagItems) {
      const map = tag.tone === 'positive' ? positiveCounts : improvementCounts
      map.set(tag.label, (map.get(tag.label) ?? 0) + 1)
    }
  }
  const sortTagCounts = (counts: Map<string, number>) =>
    [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
  return {
    positiveTags: sortTagCounts(positiveCounts),
    improvementTags: sortTagCounts(improvementCounts),
  }
}

async function main() {
  await run('[선택 태그 요약] 블록이 있는 comment — 라벨 집계 및 원문 미포함', () => {
    const pos1 = '공동 목표에 함께 기여해요'
    const pos2 = '의견을 명확하게 전달해요'
    const imp1 = '업무 공유가 조금 더 필요해요'

    const feedbacks = [
      { overallComment: buildComment([pos1, pos2], [imp1], '별도 자유서술 A') },
      { overallComment: buildComment([pos1], [], '별도 자유서술 B') },
      { overallComment: buildComment([], [imp1]) },
    ]

    const { positiveTags, improvementTags } = aggregateRoundTags(feedbacks)

    // pos1이 2명, pos2가 1명
    assert.equal(positiveTags[0].label, pos1)
    assert.equal(positiveTags[0].count, 2)
    assert.equal(positiveTags[1].label, pos2)
    assert.equal(positiveTags[1].count, 1)

    // imp1이 2명
    assert.equal(improvementTags[0].label, imp1)
    assert.equal(improvementTags[0].count, 2)

    // 원문이 결과에 포함되지 않음
    const resultStr = JSON.stringify({ positiveTags, improvementTags })
    assert.equal(resultStr.includes('자유서술'), false)
    assert.equal(resultStr.includes(FEEDBACK_360_TAG_SUMMARY_HEADING), false)
  })

  await run('[선택 태그 요약] 블록 없는 comment — 집계 결과 빈 배열, 원문 미포함', () => {
    const feedbacks = [
      { overallComment: '태그 없이 자유서술만 작성했습니다.' },
      { overallComment: null },
      { overallComment: '' },
    ]

    const { positiveTags, improvementTags } = aggregateRoundTags(feedbacks)

    assert.equal(positiveTags.length, 0)
    assert.equal(improvementTags.length, 0)

    const resultStr = JSON.stringify({ positiveTags, improvementTags })
    assert.equal(resultStr.includes('자유서술'), false)
  })

  await run('자유서술만 있는 comment는 태그 집계에 영향 없음 — 태그 있는 피드백과 혼재 시 정확히 분리', () => {
    const pos1 = '맡은 일을 끝까지 완수해요'
    const imp1 = '실행 속도를 조금 높이면 좋아요'

    const feedbacks = [
      { overallComment: buildComment([pos1], [imp1]) },
      { overallComment: '이 사람은 정말 열심히 합니다. [선택 태그 요약] 없는 자유서술.' },
      { overallComment: buildComment([pos1], []) },
    ]

    const { positiveTags, improvementTags } = aggregateRoundTags(feedbacks)

    assert.equal(positiveTags[0].label, pos1)
    assert.equal(positiveTags[0].count, 2)

    assert.equal(improvementTags[0].label, imp1)
    assert.equal(improvementTags[0].count, 1)

    // 원문 미포함 확인
    const resultStr = JSON.stringify({ positiveTags, improvementTags })
    assert.equal(resultStr.includes('정말 열심히'), false)
  })

  // 서버 로더 소스 패턴 검증
  const loaderSource = readFileSync(
    path.join(process.cwd(), 'src/server/evaluation-workbench.ts'),
    'utf8'
  )
  const clientSource = readFileSync(
    path.join(process.cwd(), 'src/components/evaluation/EvaluationWorkbenchClient.tsx'),
    'utf8'
  )

  await run('로더가 parseFeedback360TagSummaryFromComment와 getSelectedFeedback360ResponseTagLabels를 import한다', () => {
    assert.equal(loaderSource.includes('parseFeedback360TagSummaryFromComment'), true)
    assert.equal(loaderSource.includes('getSelectedFeedback360ResponseTagLabels'), true)
  })

  await run('로더가 positiveTags·improvementTags·meetsMinRaters를 반환하고 overallComment 원문을 반환하지 않는다', () => {
    assert.equal(loaderSource.includes('positiveTags'), true)
    assert.equal(loaderSource.includes('improvementTags'), true)
    assert.equal(loaderSource.includes('meetsMinRaters'), true)
    // 원문 필드를 result에 직접 노출하지 않음 (타입 내부 선언은 허용, return 객체에서만 제외)
    assert.equal(loaderSource.includes("overallComment: feedback.overallComment"), false)
  })

  await run('클라이언트가 meetsMinRaters 조건으로 태그 영역을 조건부 렌더링한다', () => {
    assert.equal(clientSource.includes('meetsMinRaters'), true)
    assert.equal(clientSource.includes('positiveTags'), true)
    assert.equal(clientSource.includes('improvementTags'), true)
    assert.equal(clientSource.includes('긍정'), true)
    assert.equal(clientSource.includes('보완'), true)
  })

  console.log('Feedback round tag summary tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
