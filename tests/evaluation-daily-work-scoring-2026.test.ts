import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'
import {
  shouldApplyDailyWorkScoringRule2026,
  validateDailyWorkScore2026,
  type DailyWorkScoringRuleOverride2026,
  type EvaluationStageForDailyWorkRule2026,
} from '../src/server/kpi-alignment-policy-2026'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

// rule.active=true 시뮬레이션용 주입 객체 — 정책 상수는 손대지 않음.
const ACTIVE_RULE: DailyWorkScoringRuleOverride2026 = {
  active: true,
  maxScore: 80,
  allowedStages: ['FIRST', 'SECOND', 'FINAL'],
  cycleYear: 2026,
}

async function main() {
  // ────────────────────────────────────────────
  // 정책 상수 sanity
  // ────────────────────────────────────────────
  await run('정책 상수: dailyWorkScoringRule dormant (active=false), maxScore=80', () => {
    const rule = EVALUATION_POLICY_2026.dailyWorkScoringRule
    assert.equal(rule.active, false)
    assert.equal(rule.maxScore, 80)
    assert.equal(rule.cycleYear, 2026)
    // allowedStages는 정확히 FIRST/SECOND/FINAL 3개. SELF/CEO_ADJUST 명시 제외 (자기평가 종료 후만).
    const stages = [...rule.allowedStages] as readonly string[]
    assert.deepEqual([...stages].sort(), ['FINAL', 'FIRST', 'SECOND'])
    assert.equal(stages.length, 3)
    assert.equal(stages.includes('SELF'), false)
    assert.equal(stages.includes('CEO_ADJUST'), false)
  })

  // ────────────────────────────────────────────
  // shouldApplyDailyWorkScoringRule2026 — 게이트
  // ────────────────────────────────────────────
  await run('shouldApply: dormant(active=false) → 모든 stage에서 false', () => {
    for (const stage of ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'] as const) {
      assert.equal(
        shouldApplyDailyWorkScoringRule2026({ cycleYear: 2026, evalStage: stage }),
        false,
        `dormant인데 stage=${stage}에서 true 반환`,
      )
    }
  })

  await run('shouldApply: 주입 active + cycleYear=2026 + FIRST/SECOND/FINAL → true', () => {
    for (const stage of ['FIRST', 'SECOND', 'FINAL'] as const) {
      assert.equal(
        shouldApplyDailyWorkScoringRule2026({ cycleYear: 2026, evalStage: stage, rule: ACTIVE_RULE }),
        true,
        `stage=${stage}에서 true 기대`,
      )
    }
  })

  await run('shouldApply: 주입 active + 2026 + SELF/CEO_ADJUST → false', () => {
    for (const stage of ['SELF', 'CEO_ADJUST'] as const) {
      assert.equal(
        shouldApplyDailyWorkScoringRule2026({ cycleYear: 2026, evalStage: stage, rule: ACTIVE_RULE }),
        false,
        `stage=${stage}는 차단되어야 함`,
      )
    }
  })

  await run('shouldApply: 주입 active + cycleYear=2025 → false (비2026 skip)', () => {
    assert.equal(
      shouldApplyDailyWorkScoringRule2026({ cycleYear: 2025, evalStage: 'FIRST', rule: ACTIVE_RULE }),
      false,
    )
  })

  // ────────────────────────────────────────────
  // validateDailyWorkScore2026 — cycleYear/category skip
  // ────────────────────────────────────────────
  await run('validate: cycleYear=2025 → 모든 이슈 skip', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 95, // 80 초과지만 skip
      evalStage: 'SELF', // SELF지만 skip
      cycleYear: 2025,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 0)
    assert.equal(r.severity, 'info')
  })

  await run('validate: category=ORG_GOAL → DAILY_WORK 전용이라 skip', () => {
    const r = validateDailyWorkScore2026({
      category: 'ORG_GOAL',
      score: 95,
      evalStage: 'SELF',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 0)
  })

  await run('validate: category=null → skip', () => {
    const r = validateDailyWorkScore2026({
      category: null,
      score: 95,
      evalStage: 'FIRST',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 0)
  })

  await run('validate: category=UNKNOWN → skip', () => {
    const r = validateDailyWorkScore2026({
      category: 'UNKNOWN',
      score: 95,
      evalStage: 'FIRST',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 0)
  })

  // ────────────────────────────────────────────
  // 점수 cap — 경계값
  // ────────────────────────────────────────────
  await run('validate: DAILY_WORK 점수 80 (경계값) + FIRST → 통과', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 80,
      evalStage: 'FIRST',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 0)
  })

  await run('validate: DAILY_WORK 점수 81 + FIRST → SCORE_CAP_EXCEEDED', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 81,
      evalStage: 'FIRST',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].code, 'DAILY_WORK_SCORE_CAP_EXCEEDED')
    assert.equal(r.issues[0].severity, 'blocker') // active rule
  })

  await run('validate: DAILY_WORK 점수 100 + FIRST → SCORE_CAP_EXCEEDED', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 100,
      evalStage: 'FIRST',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].code, 'DAILY_WORK_SCORE_CAP_EXCEEDED')
  })

  await run('validate: score=null → cap 검증 skip (입력 미완)', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: null,
      evalStage: 'FIRST',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    // score 없어도 stage는 FIRST라 통과
    assert.equal(r.issues.length, 0)
  })

  // ────────────────────────────────────────────
  // stage gate
  // ────────────────────────────────────────────
  await run('validate: DAILY_WORK + 점수 50 + SELF → STAGE_NOT_ALLOWED', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 50,
      evalStage: 'SELF',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].code, 'DAILY_WORK_STAGE_NOT_ALLOWED')
    assert.equal(r.issues[0].severity, 'blocker')
  })

  await run('validate: DAILY_WORK + 점수 50 + CEO_ADJUST → STAGE_NOT_ALLOWED', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 50,
      evalStage: 'CEO_ADJUST',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].code, 'DAILY_WORK_STAGE_NOT_ALLOWED')
  })

  await run('validate: DAILY_WORK + 점수 50 + FIRST/SECOND/FINAL → 통과', () => {
    for (const stage of ['FIRST', 'SECOND', 'FINAL'] as const) {
      const r = validateDailyWorkScore2026({
        category: 'DAILY_WORK',
        score: 50,
        evalStage: stage,
        cycleYear: 2026,
        rule: ACTIVE_RULE,
      })
      assert.equal(r.issues.length, 0, `stage=${stage}에서 통과해야 함`)
    }
  })

  // ────────────────────────────────────────────
  // 복합 위반 — cap + stage 둘 다
  // ────────────────────────────────────────────
  await run('validate: DAILY_WORK + 점수 81 + SELF → cap + stage 2 blocker', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 81,
      evalStage: 'SELF',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(r.issues.length, 2)
    assert.ok(r.issues.some((i) => i.code === 'DAILY_WORK_SCORE_CAP_EXCEEDED'))
    assert.ok(r.issues.some((i) => i.code === 'DAILY_WORK_STAGE_NOT_ALLOWED'))
    assert.ok(r.issues.every((i) => i.severity === 'blocker'))
    assert.equal(r.canSubmit, false) // blocker 있으면 canSubmit=false
  })

  // ────────────────────────────────────────────
  // ★ dormant off 영향 0 — rule.active=false면 모든 위반이 warning + canSubmit !== false
  // ────────────────────────────────────────────
  await run('dormant(현재 정책): DAILY_WORK + 점수 95 + SELF → 2 warning, canSubmit !== false', () => {
    // 정책 상수의 dailyWorkScoringRule.active=false 그대로 사용 (rule 미주입)
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 95,
      evalStage: 'SELF',
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 2)
    assert.ok(r.issues.every((i) => i.severity === 'warning'))
    assert.notEqual(r.canSubmit, false) // warning만이면 null
    assert.equal(r.severity, 'warning')
  })

  await run('dormant: DAILY_WORK + 점수 81 → 1 warning만 (cap 위반만)', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 81,
      evalStage: 'FIRST', // stage는 통과
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].code, 'DAILY_WORK_SCORE_CAP_EXCEEDED')
    assert.equal(r.issues[0].severity, 'warning')
    assert.notEqual(r.canSubmit, false)
  })

  // ────────────────────────────────────────────
  // 메시지 한국어 + 수치 포함
  // ────────────────────────────────────────────
  await run('에러 메시지: 한국어 + 80/현재점수 포함', () => {
    const r = validateDailyWorkScore2026({
      category: 'DAILY_WORK',
      score: 90,
      evalStage: 'FIRST',
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.match(r.issues[0].message, /일상업무/)
    assert.match(r.issues[0].message, /80/)
    assert.match(r.issues[0].message, /90/)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
