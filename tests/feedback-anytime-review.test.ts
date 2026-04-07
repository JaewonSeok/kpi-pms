import assert from 'node:assert/strict'
import './register-path-aliases'
import {
  buildAnytimeReviewDefaultQuestions,
  buildFeedbackAnytimeRoundName,
  parseFeedbackAnytimeDocumentSettings,
  resolveAnytimeFeedbackRelationship,
} from '../src/lib/feedback-anytime-review'

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
  await run('anytime review settings parser falls back to active lifecycle and trims pip fields', () => {
    const parsed = parseFeedbackAnytimeDocumentSettings({
      reason: '  프로젝트 종료 후 회고  ',
      projectName: '  Search Revamp  ',
      lifecycleState: 'CLOSED',
      pip: {
        goals: ['  Improve quality  ', '', 'Document follow-up'],
        expectedBehaviors: ['  Share weekly updates  '],
        checkpoints: [{ label: '  Week 2 check  ', note: '  confirm progress  ' }, { label: '' }],
        midReview: '  Mid review note  ',
        endJudgement: '  Final judgement note  ',
      },
    })

    assert.equal(parsed.reason, '프로젝트 종료 후 회고')
    assert.equal(parsed.projectName, 'Search Revamp')
    assert.equal(parsed.lifecycleState, 'CLOSED')
    assert.deepEqual(parsed.pip?.goals, ['Improve quality', 'Document follow-up'])
    assert.deepEqual(parsed.pip?.expectedBehaviors, ['Share weekly updates'])
    assert.equal(parsed.pip?.checkpoints.length, 1)
    assert.equal(parsed.pip?.checkpoints[0]?.label, 'Week 2 check')
    assert.equal(parsed.pip?.midReview, 'Mid review note')
    assert.equal(parsed.pip?.endJudgement, 'Final judgement note')
  })

  await run('anytime review name builder appends target only for mass create', () => {
    assert.equal(
      buildFeedbackAnytimeRoundName({
        baseName: '프로젝트 종료 리뷰',
        targetName: '홍길동',
        isMassCreate: false,
      }),
      '프로젝트 종료 리뷰'
    )
    assert.equal(
      buildFeedbackAnytimeRoundName({
        baseName: '프로젝트 종료 리뷰',
        targetName: '홍길동',
        isMassCreate: true,
      }),
      '프로젝트 종료 리뷰 · 홍길동'
    )
  })

  await run('anytime feedback relationship resolves self supervisor and peer correctly', () => {
    assert.equal(
      resolveAnytimeFeedbackRelationship({
        reviewerId: 'emp-1',
        targetId: 'emp-1',
      }),
      'SELF'
    )
    assert.equal(
      resolveAnytimeFeedbackRelationship({
        reviewerId: 'leader-1',
        targetId: 'emp-1',
        teamLeaderId: 'leader-1',
      }),
      'SUPERVISOR'
    )
    assert.equal(
      resolveAnytimeFeedbackRelationship({
        reviewerId: 'peer-1',
        targetId: 'emp-1',
        teamLeaderId: 'leader-1',
      }),
      'PEER'
    )
  })

  await run('pip anytime review blueprint includes rating and follow-up questions', () => {
    const questions = buildAnytimeReviewDefaultQuestions('PIP')

    assert.equal(questions.length, 4)
    assert.equal(questions[0]?.questionType, 'RATING_SCALE')
    assert.equal(questions[1]?.sortOrder, 2)
    assert.equal(questions[2]?.sortOrder, 3)
    assert.equal(questions[3]?.sortOrder, 4)
  })

  console.log('Feedback anytime review tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
