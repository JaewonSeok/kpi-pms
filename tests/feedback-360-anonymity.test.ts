import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildGroupedResponses } from '@/server/feedback-360'

// 한 건이 실패해도 나머지 케이스 결과를 함께 보도록 끝까지 돌고, 실패가 있으면 exit 1 로 끝낸다.
function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

type Visibility = 'FULL' | 'ANONYMOUS' | 'PRIVATE'

const FEEDBACK_ID = 'feedback-peer-1'
const GIVER_NAME = '김평가'

function buildFor(visibility: Visibility, thresholdMet: boolean, isAnonymous = true) {
  const params = {
    feedbacks: [
      {
        id: FEEDBACK_ID,
        relationship: 'PEER',
        giver: { empName: GIVER_NAME },
        responses: [
          {
            questionId: 'q-1',
            ratingValue: 4,
            textValue: '회의 전에 자료를 미리 공유해 결정이 빨랐습니다.',
            question: { category: '협업', questionText: '협업 방식은 어떠했나요?' },
          },
        ],
      },
    ],
    thresholdMet,
    isAnonymous,
    visibilitySettings: { PEER: visibility } as Record<string, Visibility>,
  }
  return buildGroupedResponses(params)
}

function answersOf(groups: ReturnType<typeof buildGroupedResponses>) {
  return groups.flatMap((group) => group.answers).filter((answer) => answer.feedbackId === FEEDBACK_ID)
}

function countOccurrences(source: string, needle: string) {
  return source.split(needle).length - 1
}

const feedback360Source = readFileSync(path.resolve(process.cwd(), 'src/server/feedback-360.ts'), 'utf8')

// threshold 미달이면 실명도 익명도 아닌 비공개다 — 응답 자체를 결과에서 뺀다.
// "익명 2명" 은 누가 썼는지 추론할 수 있어 보호가 약하다.

run('① FULL · thresholdMet true → 실명 라벨', () => {
  const answers = answersOf(buildFor('FULL', true))
  assert.equal(answers.length, 1)
  assert.equal(answers[0].authorLabel, `PEER · ${GIVER_NAME}`)
})

run('② FULL · thresholdMet false → 응답 제외', () => {
  const answers = answersOf(buildFor('FULL', false))
  assert.equal(answers.length, 0)
})

run('③ ANONYMOUS · thresholdMet true → 익명 라벨', () => {
  const answers = answersOf(buildFor('ANONYMOUS', true))
  assert.equal(answers.length, 1)
  assert.equal(answers[0].authorLabel, 'PEER · 익명')
  assert.equal(answers[0].authorLabel.includes(GIVER_NAME), false)
})

run('④ ANONYMOUS · thresholdMet false → 응답 제외', () => {
  const answers = answersOf(buildFor('ANONYMOUS', false))
  assert.equal(answers.length, 0)
})

run('⑤ PRIVATE · thresholdMet 무관 → 응답 제외', () => {
  assert.equal(answersOf(buildFor('PRIVATE', true)).length, 0)
  assert.equal(answersOf(buildFor('PRIVATE', false)).length, 0)
})

// 응답 화면의 priorScores 는 export 되지 않은 로더 안에 있어 소스 텍스트로 단언한다.
run('⑧ 응답 화면 priorScores 가 groupedResponses 의 라벨 Map 을 따라간다', () => {
  assert.equal(feedback360Source.includes('authorLabelByFeedbackId.get(item.id)'), true)
  assert.equal(feedback360Source.includes('if (!authorLabel) return []'), true)
})

// 0회로 단언하면 buildGroupedResponses 의 FULL 라벨까지 지워도 통과하므로 정확히 1회다.
run('⑨ 실명 라벨은 buildGroupedResponses 의 FULL 라벨 한 곳에만 있다', () => {
  assert.equal(countOccurrences(feedback360Source, 'giver.empName}'), 1)
})

// 비익명 라운드(온보딩: minRaters 1 · isAnonymous false)는 기준과 무관하게 실명이다.
run('⑩ isAnonymous false · ANONYMOUS · thresholdMet false → 실명', () => {
  const answers = answersOf(buildFor('ANONYMOUS', false, false))
  assert.equal(answers.length, 1)
  assert.equal(answers[0].authorLabel, `PEER · ${GIVER_NAME}`)
})

run('⑪ isAnonymous true · ANONYMOUS · thresholdMet false → 응답 제외', () => {
  const answers = answersOf(buildFor('ANONYMOUS', false, true))
  assert.equal(answers.length, 0)
})

// PRIVATE 는 비익명 라운드에서도 공개하지 않는다.
run('⑫ isAnonymous false · PRIVATE · thresholdMet 무관 → 응답 제외', () => {
  assert.equal(answersOf(buildFor('PRIVATE', true, false)).length, 0)
  assert.equal(answersOf(buildFor('PRIVATE', false, false)).length, 0)
})

console.log('Feedback 360 anonymity tests completed')
