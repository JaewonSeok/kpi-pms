/* eslint-disable @typescript-eslint/no-require-imports */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'

const moduleLoader = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string
}

const originalResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const {
  buildStatisticsStageFlow,
  parseStatisticsPeriod,
  pickEffectiveEvaluationOutcome,
  summarizeStatisticsAiAlignment,
} = require('../src/server/statistics-helpers') as typeof import('../src/server/statistics-helpers')

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

run('invalid statistics period falls back to 12m', () => {
  assert.equal(parseStatisticsPeriod(undefined), '12m')
  assert.equal(parseStatisticsPeriod('unexpected'), '12m')
  assert.equal(parseStatisticsPeriod('6m'), '6m')
})

run('stage flow includes optional second stage only when present and stops without final approver', () => {
  assert.deepEqual(
    buildStatisticsStageFlow({
      hasFirst: true,
      hasSecond: true,
      hasFinal: true,
      hasCeo: true,
    }),
    ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']
  )

  assert.deepEqual(
    buildStatisticsStageFlow({
      hasFirst: true,
      hasSecond: false,
      hasFinal: true,
      hasCeo: true,
    }),
    ['SELF', 'FIRST', 'FINAL', 'CEO_ADJUST']
  )

  assert.deepEqual(
    buildStatisticsStageFlow({
      hasFirst: true,
      hasSecond: true,
      hasFinal: false,
      hasCeo: true,
    }),
    ['SELF', 'FIRST', 'SECOND']
  )
})

run('effective evaluation precedence prefers CEO adjust and ignores non-submitted stages', () => {
  const picked = pickEffectiveEvaluationOutcome([
    { evalStage: 'FINAL', status: 'SUBMITTED', id: 'final' },
    { evalStage: 'CEO_ADJUST', status: 'IN_PROGRESS', id: 'ceo-draft' },
    { evalStage: 'CEO_ADJUST', status: 'CONFIRMED', id: 'ceo-final' },
    { evalStage: 'SECOND', status: 'SUBMITTED', id: 'second' },
  ])

  assert.equal(picked?.id, 'ceo-final')
})

run('ai alignment summary counts warnings on the actual coverage denominator', () => {
  const summary = summarizeStatisticsAiAlignment([
    'MATCHED',
    'MOSTLY_MATCHED',
    'REVIEW_NEEDED',
    'POSSIBLE_OVER_RATING',
    'INSUFFICIENT_EVIDENCE',
  ])

  assert.equal(summary.totalCount, 5)
  assert.equal(summary.warningCount, 3)
  assert.equal(summary.counts.MATCHED, 1)
  assert.equal(summary.counts.POSSIBLE_OVER_RATING, 1)
})

run('statistics dashboard source includes the approved executive sections and filters', () => {
  const source = read('src/components/statistics/ExecutiveStatisticsDashboardClient.tsx')

  for (const text of [
    '경영 한눈 보기',
    '성과평가 운영 현황',
    '성과 수준 및 분포',
    'KPI 실행력',
    '조직 건강 / 리스크',
    '핵심인재 / 준비도(프록시)',
    '공정성 / 보정 필요 신호',
    '평가 주기',
    '기간',
    '조직',
    '직위',
  ]) {
    assert.equal(source.includes(text), true, `${text} should be present in the statistics dashboard UI`)
  }
})

console.log('Statistics page tests completed')
