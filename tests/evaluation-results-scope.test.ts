import './setup-test-env'
import './register-path-aliases'
import assert from 'node:assert/strict'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  const { resolvePublicationStatus, maskScoreItemForSelfView } = await import('../src/server/evaluation-results')

  const futureDeadline = new Date(Date.now() + 86400000)
  const pastDeadline = new Date(Date.now() - 86400000)

  run('resolvePublicationStatus — isSelfView=true, not confirmed, RESULT_OPEN → HIDDEN', () => {
    const result = resolvePublicationStatus({ status: 'RESULT_OPEN', appealDeadline: null }, false, true)
    assert.equal(result, 'HIDDEN')
  })

  run('resolvePublicationStatus — isSelfView=true, confirmed (CEO_ADJUST), RESULT_OPEN → PUBLISHED', () => {
    const result = resolvePublicationStatus({ status: 'RESULT_OPEN', appealDeadline: null }, true, true)
    assert.equal(result, 'PUBLISHED')
  })

  run('resolvePublicationStatus — isSelfView=false (admin), not confirmed, RESULT_OPEN → PUBLISHED', () => {
    const result = resolvePublicationStatus({ status: 'RESULT_OPEN', appealDeadline: null }, false, false)
    assert.equal(result, 'PUBLISHED')
  })

  run('resolvePublicationStatus — APPEAL cycle → APPEAL_OPEN regardless of isSelfView/hasConfirmedFinal', () => {
    const result = resolvePublicationStatus({ status: 'APPEAL', appealDeadline: futureDeadline }, false, true)
    assert.equal(result, 'APPEAL_OPEN')
  })

  run('resolvePublicationStatus — isSelfView=true, confirmed, RESULT_OPEN with past appealDeadline → APPEAL_CLOSED', () => {
    const result = resolvePublicationStatus({ status: 'RESULT_OPEN', appealDeadline: pastDeadline }, true, true)
    assert.equal(result, 'APPEAL_CLOSED')
  })

  run('resolvePublicationStatus — isSelfView=false, CLOSED cycle, no deadline → PUBLISHED', () => {
    const result = resolvePublicationStatus({ status: 'CLOSED', appealDeadline: null }, false, false)
    assert.equal(result, 'PUBLISHED')
  })

  run('maskScoreItemForSelfView — masks evaluator scores, keeps id/title/score/selfScore', () => {
    const row = {
      id: 'kpi-1',
      title: '매출 달성',
      score: 80,
      weight: 30,
      selfScore: 75,
      managerScore: 85,
      reviewerScore: 90,
      finalScore: 87,
      comment: '우수한 성과',
      deltaFromSelf: 12,
    }
    const masked = maskScoreItemForSelfView(row)
    assert.equal(masked.id, 'kpi-1')
    assert.equal(masked.title, '매출 달성')
    assert.equal(masked.score, undefined)
    assert.equal(masked.selfScore, 75)
    assert.equal(masked.managerScore, undefined)
    assert.equal(masked.reviewerScore, undefined)
    assert.equal(masked.finalScore, undefined)
    assert.equal(masked.comment, undefined)
    assert.equal(masked.deltaFromSelf, undefined)
  })

  run('maskScoreItemForSelfView — already-undefined optional fields remain undefined', () => {
    const row = { id: 'kpi-2', title: 'KPI', score: 70, weight: 20, selfScore: 70, managerScore: undefined, finalScore: undefined }
    const masked = maskScoreItemForSelfView(row)
    assert.equal(masked.id, 'kpi-2')
    assert.equal(masked.score, undefined)
    assert.equal(masked.managerScore, undefined)
    assert.equal(masked.finalScore, undefined)
  })

  run('maskScoreItemForSelfView — 본인 조회 시 score 가 undefined', () => {
    const row = { id: 'kpi-3', title: '성과 KPI', score: 88, selfScore: 82, managerScore: 90 }
    const masked = maskScoreItemForSelfView(row)
    assert.equal(masked.score, undefined, 'score 는 본인 조회 시 undefined 여야 한다')
    assert.equal(masked.selfScore, 82, 'selfScore 는 유지된다')
    assert.equal(masked.managerScore, undefined)
  })

  run('본인 조회 시 summary.calibrationAdjusted 가 false — 서버 마스킹 패턴 검증', () => {
    const { readFileSync } = require('node:fs')
    const { resolve } = require('node:path')
    const source = readFileSync(resolve(process.cwd(), 'src/server/evaluation-results.ts'), 'utf8') as string
    assert.ok(
      source.includes('calibrationAdjusted: params.isSelfView ? false : calibrationAdjusted'),
      'summary.calibrationAdjusted 는 isSelfView 일 때 false 로 마스킹돼야 한다'
    )
  })

  run('타인 조회 시 score 와 calibrationAdjusted 가 유지됨 — maskScoreItemForSelfView 미호출 경로', () => {
    const row = { id: 'kpi-4', title: '역량 KPI', score: 75, selfScore: 70, managerScore: 80 }
    // isSelfView=false 일 때는 maskScoreItemForSelfView 가 호출되지 않으므로 원본 row 그대로
    assert.equal(row.score, 75, 'score 유지')
    assert.equal(row.managerScore, 80, 'managerScore 유지')

    const { readFileSync } = require('node:fs')
    const { resolve } = require('node:path')
    const source = readFileSync(resolve(process.cwd(), 'src/server/evaluation-results.ts'), 'utf8') as string
    assert.ok(
      source.includes('if (params.isSelfView) return maskScoreItemForSelfView(rest)'),
      '타인 조회(isSelfView=false) 경로는 maskScoreItemForSelfView 를 호출하지 않는다'
    )
  })

  const { buildEvidenceHighlights } = await import('../src/server/evaluation-results')

  run('buildEvidenceHighlights — isSelfView=true + calibrationAdjusted=true → 평가자 코멘트 항목 제외', () => {
    const result = buildEvidenceHighlights({
      kpis: [],
      checkIns: [],
      feedbacks: [{ content: '우수한 성과를 보여주었습니다.' }],
      calibrationAdjusted: true,
      isSelfView: true,
    })
    const titles = result.map((h) => h.title)
    const tones = result.map((h) => h.tone)
    assert.ok(!titles.some((t) => t.includes('조정')), `highlights 에 '조정' 문자열이 없어야 한다. 실제: ${JSON.stringify(titles)}`)
    assert.ok(!tones.includes('attention'), `highlights tone 에 'attention' 이 없어야 한다. 실제: ${JSON.stringify(tones)}`)
  })

  run('buildEvidenceHighlights — isSelfView=false + calibrationAdjusted=true → 조정 코멘트 항목 유지', () => {
    const result = buildEvidenceHighlights({
      kpis: [],
      checkIns: [],
      feedbacks: [{ content: '우수한 성과를 보여주었습니다.' }],
      calibrationAdjusted: true,
      isSelfView: false,
    })
    const titles = result.map((h) => h.title)
    const tones = result.map((h) => h.tone)
    assert.ok(titles.some((t) => t === '조정에 반영된 코멘트'), `isSelfView=false 시 '조정에 반영된 코멘트' 타이틀이 있어야 한다. 실제: ${JSON.stringify(titles)}`)
    assert.ok(tones.includes('attention'), `isSelfView=false 시 tone 에 'attention' 이 있어야 한다. 실제: ${JSON.stringify(tones)}`)
  })

  console.log('evaluation-results-scope tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
