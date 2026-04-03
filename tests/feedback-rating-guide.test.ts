import assert from 'node:assert/strict'
import './register-path-aliases'
import {
  annotateFeedbackRatingScaleEntries,
  buildFeedbackRatingScaleEntries,
  calculateFeedbackRatingRecommendedCount,
  parseFeedbackRatingGuideSettings,
  resolveFeedbackRatingGuideRule,
} from '../src/lib/feedback-rating-guide'

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
  await run('rating guide parser defaults to the first rating question and keeps descending order', () => {
    const parsed = parseFeedbackRatingGuideSettings(
      {
        distributionMode: 'HEADCOUNT',
        scaleEntries: [
          { value: 3, label: 'C', description: '', headcountLimit: 2, isNonEvaluative: false },
          { value: 5, label: 'A', description: '', headcountLimit: 1, isNonEvaluative: false },
          { value: 4, label: 'B', description: '', headcountLimit: 3, isNonEvaluative: false },
        ],
      },
      [
        { id: 'q-1', questionText: '등급', scaleMin: 3, scaleMax: 5 },
      ]
    )

    assert.equal(parsed.distributionQuestionId, 'q-1')
    assert.deepEqual(
      parsed.scaleEntries.map((entry) => entry.value),
      [5, 4, 3]
    )
  })

  await run('rating scale annotation marks highest and lowest evaluative grades while excluding non-evaluative grades', () => {
    const annotated = annotateFeedbackRatingScaleEntries([
      { value: 5, label: 'S', description: '', targetRatio: 10, headcountLimit: 1, isNonEvaluative: false },
      { value: 4, label: 'A', description: '', targetRatio: 30, headcountLimit: 2, isNonEvaluative: false },
      { value: 3, label: 'N/A', description: '', targetRatio: null, headcountLimit: null, isNonEvaluative: true },
      { value: 2, label: 'C', description: '', targetRatio: 20, headcountLimit: 1, isNonEvaluative: false },
    ])

    assert.equal(annotated[0].isHighest, true)
    assert.equal(annotated[1].isHighest, false)
    assert.equal(annotated[2].isLowest, false)
    assert.equal(annotated[3].isLowest, true)
  })

  await run('rating guide resolves the most specific HR attribute rule for the review target', () => {
    const matched = resolveFeedbackRatingGuideRule({
      rules: [
        {
          id: 'rule-1',
          label: '기본',
          headline: '기본 가이드',
          guidance: '기본 설명',
          filters: {
            departmentKeyword: '플랫폼',
          },
          gradeDescriptions: {},
        },
        {
          id: 'rule-2',
          label: '팀장 전용',
          headline: '리더 가이드',
          guidance: '리더 설명',
          filters: {
            departmentKeyword: '플랫폼',
            position: '팀장',
            teamNameKeyword: '코어',
          },
          gradeDescriptions: {},
        },
      ],
      target: {
        departmentName: '플랫폼실',
        position: '팀장',
        teamName: '코어플랫폼팀',
      },
    })

    assert.equal(matched?.id, 'rule-2')
  })

  await run('recommended count uses ratio with minimum one person when scope is non-zero', () => {
    assert.equal(calculateFeedbackRatingRecommendedCount(10, 1), 1)
    assert.equal(calculateFeedbackRatingRecommendedCount(30, 10), 3)
    assert.equal(calculateFeedbackRatingRecommendedCount(null, 10), null)
  })

  await run('scale entry builder keeps existing labels and limits when scale changes', () => {
    const entries = buildFeedbackRatingScaleEntries({
      scaleMin: 1,
      scaleMax: 3,
      existingEntries: [
        { value: 3, label: 'A', description: '최상', targetRatio: 20, headcountLimit: 1, isNonEvaluative: false },
        { value: 2, label: 'B', description: '중간', targetRatio: 50, headcountLimit: 2, isNonEvaluative: false },
      ],
    })

    assert.deepEqual(entries.map((entry) => entry.label), ['A', 'B', '1'])
    assert.equal(entries[0].headcountLimit, 1)
    assert.equal(entries[1].targetRatio, 50)
  })

  console.log('Feedback rating guide tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
