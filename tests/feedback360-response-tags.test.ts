import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  FEEDBACK_360_TAG_SUMMARY_HEADING,
  FEEDBACK_360_RESPONSE_TAG_CATEGORIES,
  buildFeedback360OverallCommentForSubmit,
  buildFeedback360TagSummaryText,
  parseFeedback360TagSummaryFromComment,
  getFeedback360ResponseTagPoolStats,
} from '../src/components/evaluation/feedback360/feedback360-response-tag-pool'
import { NAV_ITEMS, flattenNavigationItems } from '../src/lib/navigation'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function main() {
  await run('feedback 360 soft sentence tag pool has enough categories and choices', () => {
    const stats = getFeedback360ResponseTagPoolStats()

    assert.equal(stats.categoryCount >= 8, true)
    assert.equal(stats.positiveTagCount >= stats.categoryCount * 10, true)
    assert.equal(stats.improvementTagCount >= stats.categoryCount * 10, true)

    for (const category of FEEDBACK_360_RESPONSE_TAG_CATEGORIES) {
      assert.equal(category.positiveTags.length >= 10, true, `${category.category} positive tags`)
      assert.equal(category.improvementTags.length >= 10, true, `${category.category} improvement tags`)

      for (const tag of [...category.positiveTags, ...category.improvementTags]) {
        assert.equal(tag.label.startsWith('#'), false, `${tag.label} should not render as a rigid hashtag`)
        assert.match(tag.label, /요$/, `${tag.label} should end with a soft Korean sentence ending`)
      }
    }
  })

  await run('feedback 360 response screen exposes PPT parity copy and safety language', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const header = read('src/components/evaluation/feedback360/MultiRaterCycleHeader.tsx')
    const tagPool = read('src/components/evaluation/feedback360/feedback360-response-tag-pool.ts')
    const combined = `${workspace}\n${header}\n${tagPool}`

    for (const text of [
      '360 다면평가',
      '함께 일한 동료',
      '해시태그',
      '긍정 태그',
      '보완 태그',
      '팀워크',
      '소통',
      '책임감',
      '존중',
      '긍정적 태도',
      '선택한 태그',
      '태그 제출 반영',
      FEEDBACK_360_TAG_SUMMARY_HEADING,
      '구체적 사례',
      '제출 상태',
      '공식 평가 점수나 등급을 자동 산정하지 않습니다',
      '비정기 다면평가',
    ]) {
      assert.equal(combined.includes(text), true, `missing ${text}`)
    }
  })

  await run('feedback 360 response screen keeps official scoring and grade write controls absent', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')

    for (const forbidden of [
      '자동 등급 반영',
      'AI 점수 산정',
      '공식 점수 반영',
      'Evaluation.totalScore 저장',
      'Evaluation.gradeId 저장',
    ]) {
      assert.equal(workspace.includes(forbidden), false, `${forbidden} should not be rendered`)
    }

    assert.equal(workspace.includes('disabled={submitBusy || distributionLimitExceeded}'), true)
    assert.equal(workspace.includes('onClick={handleSubmitResponse}'), true)
  })

  await run('feedback 360 selected tags are merged into existing submit comment payload explicitly', () => {
    const positiveTag = FEEDBACK_360_RESPONSE_TAG_CATEGORIES[0].positiveTags[0]
    const improvementTag = FEEDBACK_360_RESPONSE_TAG_CATEGORIES[0].improvementTags[0]
    const selectedTags = [
      { ...positiveTag, category: FEEDBACK_360_RESPONSE_TAG_CATEGORIES[0].category },
      { ...improvementTag, category: FEEDBACK_360_RESPONSE_TAG_CATEGORIES[0].category },
    ]

    const summary = buildFeedback360TagSummaryText(selectedTags)
    assert.equal(summary.includes(FEEDBACK_360_TAG_SUMMARY_HEADING), true)
    assert.equal(summary.includes(positiveTag.label), true)
    assert.equal(summary.includes(improvementTag.label), true)

    const merged = buildFeedback360OverallCommentForSubmit('구체적인 협업 사례를 확인했어요.', selectedTags)
    assert.equal(merged.startsWith(FEEDBACK_360_TAG_SUMMARY_HEADING), true)
    assert.equal(merged.includes('구체적인 협업 사례를 확인했어요.'), true)

    const parsed = parseFeedback360TagSummaryFromComment(merged)
    assert.equal(parsed.comment, '구체적인 협업 사례를 확인했어요.')
    assert.deepEqual(parsed.selectedTags[FEEDBACK_360_RESPONSE_TAG_CATEGORIES[0].id].positive, [positiveTag.id])
    assert.deepEqual(parsed.selectedTags[FEEDBACK_360_RESPONSE_TAG_CATEGORIES[0].id].improvement, [
      improvementTag.id,
    ])
  })

  await run('feedback 360 submit payload uses merged overallComment without schema or API expansion', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const apiRoute = read('src/app/api/feedback/route.ts')
    const validations = read('src/lib/validations.ts')
    const schema = read('prisma/schema.prisma')

    assert.equal(workspace.includes('overallComment: overallCommentForSubmit || undefined'), true)
    assert.equal(workspace.includes('선택한 태그는 새 입력 항목이 아니라 기존 다면평가 제출 데이터의 종합 의견'), true)
    assert.equal(apiRoute.includes('selectedTags'), false)
    assert.equal(validations.includes('selectedTags'), false)
    assert.equal(schema.includes('selectedTags'), false)
    assert.equal(schema.includes('hashtags'), false)
  })

  await run('feedback 360 selected tag summary supports show more and inline submit feedback', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')

    for (const text of [
      'selectedTagPreviewLimit = 10',
      'visibleSelectedResponseTagLabels',
      '외 N개 더보기',
      '외 ${hiddenSelectedTagCount}개 더보기',
      '카테고리별 선택 현황',
      '선택 제한 없음',
      '필수 항목입니다. 이 항목을 입력해 주세요.',
      '필수 항목을 확인해 주세요.',
      '응답이 제출되었습니다.',
      '다음 대상자 작성',
      '응답 목록으로 돌아가기',
      '이번 분기 다면평가 응답을 모두 완료했습니다.',
    ]) {
      assert.equal(workspace.includes(text), true, `missing ${text}`)
    }

    assert.equal(workspace.includes('selectedResponseTagLabels.slice(0, 14)'), false)
    assert.equal(workspace.includes('overallComment: overallCommentForSubmit || undefined'), true)
  })

  await run('feedback 360 result report separates selected tag summary into positive and improvement chips', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const resultsPpt = read('src/components/evaluation/feedback360/ppt/Feedback360ResultsPpt.tsx')
    const source = `${workspace}\n${resultsPpt}`

    for (const text of [
      'positiveTopTags',
      'improvementTopTags',
      '강점 Top 3',
      '보완 Top 3',
      'border-emerald-200 bg-emerald-50 text-emerald-700',
      'border-amber-200 bg-amber-50 text-amber-700',
      '긴 {FEEDBACK_360_TAG_SUMMARY_HEADING} 문장은 기본 노출하지 않고',
      '원문 보기',
      'whitespace-pre-wrap',
      '태그 클러스터 / 키워드 영역',
      '카테고리별 bar chart',
    ]) {
      assert.equal(source.includes(text), true, `missing result tag visual ${text}`)
    }
  })

  await run('feedback 360 navigation label stays mapped to /evaluation/360', () => {
    const item = flattenNavigationItems(NAV_ITEMS).find((navItem) => navItem.href === '/evaluation/360')

    assert.equal(item?.label, '360 다면평가')
    assert.equal(item?.menuKey, 'FEEDBACK_360')
  })

  console.log('Feedback 360 response tag tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
