import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'
import {
  validatePersonalKpiWeightCapItem2026,
  validatePersonalKpiWeightAggregate2026,
  validatePersonalKpiWeightCapForPersistence2026,
  type PersonalKpiWeightCapInput2026,
  type WeightRuleOverride2026,
} from '../src/server/kpi-alignment-policy-2026'

const ENFORCED_RULE: WeightRuleOverride2026 = {
  enforced: true,
  totalSum: 100,
  cycleYear: 2026,
}

const DORMANT_RULE: WeightRuleOverride2026 = {
  enforced: false,
  totalSum: 100,
  cycleYear: 2026,
}

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function item(overrides: Partial<PersonalKpiWeightCapInput2026> = {}): PersonalKpiWeightCapInput2026 {
  return { id: overrides.id ?? 'pk-x', ...overrides }
}

async function main() {
  // ────────────────────────────────────────────
  // 정책 상수 sanity check
  // ────────────────────────────────────────────
  await run('정책 상수: ORG_GOAL 항목 cap 10, 합계 cap 50', () => {
    const cap = EVALUATION_POLICY_2026.categories.ORG_GOAL.weightCap as {
      perItem?: number
      sumMax?: number
    }
    assert.equal(cap?.perItem, 10)
    assert.equal(cap?.sumMax, 50)
  })

  await run('정책 상수: PROJECT_T 항목 cap 10, 합계 cap 없음', () => {
    const cap = EVALUATION_POLICY_2026.categories.PROJECT_T.weightCap as {
      perItem?: number
      sumMax?: number
    }
    assert.equal(cap?.perItem, 10)
    assert.equal(cap?.sumMax, undefined)
  })

  await run('정책 상수: PROJECT_K 항목 cap 5', () => {
    const cap = EVALUATION_POLICY_2026.categories.PROJECT_K.weightCap as { perItem?: number }
    assert.equal(cap?.perItem, 5)
  })

  await run('정책 상수: DAILY_WORK 잔여 표식', () => {
    const cap = EVALUATION_POLICY_2026.categories.DAILY_WORK.weightCap as {
      isRemainder?: boolean
    }
    assert.equal(cap?.isRemainder, true)
  })

  await run('정책 상수: weightRule cutover flag dormant (현재 enforced=false)', () => {
    assert.equal(EVALUATION_POLICY_2026.weightRule.enforced, false)
    assert.equal(EVALUATION_POLICY_2026.weightRule.totalSum, 100)
    assert.equal(EVALUATION_POLICY_2026.weightRule.cycleYear, 2026)
  })

  // ────────────────────────────────────────────
  // cycleYear 게이트 — 2026이 아니면 검증 자체 skip
  // ────────────────────────────────────────────
  await run('cycleYear=2025: 모든 cap 검증 skip → 이슈 0', () => {
    const result = validatePersonalKpiWeightCapItem2026({
      item: item({ policyCategory: 'PROJECT_K', weight: 50 }),
      cycleYear: 2025,
    })
    assert.equal(result.issues.length, 0)

    const agg = validatePersonalKpiWeightAggregate2026({
      items: [item({ policyCategory: 'ORG_GOAL', weight: 200 })],
      cycleYear: 2025,
    })
    assert.equal(agg.issues.length, 0)
  })

  // ────────────────────────────────────────────
  // per-item cap 경계값 (cycleYear=2026)
  // ────────────────────────────────────────────
  await run('ORG_GOAL 항목 10%: 경계값 통과', () => {
    const r = validatePersonalKpiWeightCapItem2026({
      item: item({ policyCategory: 'ORG_GOAL', weight: 10 }),
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 0)
  })

  await run('ORG_GOAL 항목 11%: ITEM_CAP_EXCEEDED', () => {
    const r = validatePersonalKpiWeightCapItem2026({
      item: item({ policyCategory: 'ORG_GOAL', weight: 11 }),
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].code, 'WEIGHT_CATEGORY_ITEM_CAP_EXCEEDED')
  })

  await run('PROJECT_T 항목 10% 경계값 통과, 11% 거부', () => {
    assert.equal(
      validatePersonalKpiWeightCapItem2026({
        item: item({ policyCategory: 'PROJECT_T', weight: 10 }),
        cycleYear: 2026,
      }).issues.length,
      0,
    )
    assert.equal(
      validatePersonalKpiWeightCapItem2026({
        item: item({ policyCategory: 'PROJECT_T', weight: 11 }),
        cycleYear: 2026,
      }).issues.length,
      1,
    )
  })

  await run('PROJECT_K 항목 5% 경계값 통과, 6% 거부', () => {
    assert.equal(
      validatePersonalKpiWeightCapItem2026({
        item: item({ policyCategory: 'PROJECT_K', weight: 5 }),
        cycleYear: 2026,
      }).issues.length,
      0,
    )
    const r = validatePersonalKpiWeightCapItem2026({
      item: item({ policyCategory: 'PROJECT_K', weight: 6 }),
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].code, 'WEIGHT_CATEGORY_ITEM_CAP_EXCEEDED')
  })

  await run('DAILY_WORK 항목: 잔여 카테고리라 per-item cap 검증 skip', () => {
    const r = validatePersonalKpiWeightCapItem2026({
      item: item({ policyCategory: 'DAILY_WORK', weight: 80 }),
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 0)
  })

  await run('category=null/UNKNOWN: 검증 skip (per-item)', () => {
    assert.equal(
      validatePersonalKpiWeightCapItem2026({
        item: item({ policyCategory: null, weight: 50 }),
        cycleYear: 2026,
      }).issues.length,
      0,
    )
    assert.equal(
      validatePersonalKpiWeightCapItem2026({
        item: item({ policyCategory: 'UNKNOWN', weight: 50 }),
        cycleYear: 2026,
      }).issues.length,
      0,
    )
  })

  // ────────────────────────────────────────────
  // aggregate cap — ORG_GOAL 합계 + 전체 100% (cycleYear=2026)
  // ────────────────────────────────────────────
  await run('ORG_GOAL 합 50% 경계값 통과 (전체 100 OK)', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 25 }),
        item({ id: 'b', policyCategory: 'ORG_GOAL', weight: 25 }),
        item({ id: 'c', policyCategory: 'DAILY_WORK', weight: 50 }),
      ],
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 0)
  })

  await run('ORG_GOAL 합 51%: SUM_CAP_EXCEEDED', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 26 }),
        item({ id: 'b', policyCategory: 'ORG_GOAL', weight: 25 }),
        item({ id: 'c', policyCategory: 'DAILY_WORK', weight: 49 }),
      ],
      cycleYear: 2026,
    })
    assert.ok(r.issues.some((i) => i.code === 'WEIGHT_CATEGORY_SUM_CAP_EXCEEDED'))
  })

  await run('PROJECT_T/K 합 cap 없음: 합 60%여도 통과 (전체 100 맞으면)', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'PROJECT_T', weight: 10 }),
        item({ id: 'b', policyCategory: 'PROJECT_T', weight: 10 }),
        item({ id: 'c', policyCategory: 'PROJECT_K', weight: 5 }),
        item({ id: 'd', policyCategory: 'PROJECT_K', weight: 5 }),
        item({ id: 'e', policyCategory: 'ORG_GOAL', weight: 10 }),
        item({ id: 'f', policyCategory: 'DAILY_WORK', weight: 60 }),
      ],
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 0)
  })

  // ────────────────────────────────────────────
  // 전체 합 = 100% invariant
  // ────────────────────────────────────────────
  await run('전체 합 100%: 통과', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 30 }),
        item({ id: 'b', policyCategory: 'DAILY_WORK', weight: 70 }),
      ],
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 0)
  })

  await run('전체 합 99%: TOTAL_SUM_INVALID', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 30 }),
        item({ id: 'b', policyCategory: 'DAILY_WORK', weight: 69 }),
      ],
      cycleYear: 2026,
    })
    assert.ok(r.issues.some((i) => i.code === 'WEIGHT_TOTAL_SUM_INVALID'))
  })

  await run('전체 합 101%: TOTAL_SUM_INVALID', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 30 }),
        item({ id: 'b', policyCategory: 'DAILY_WORK', weight: 71 }),
      ],
      cycleYear: 2026,
    })
    assert.ok(r.issues.some((i) => i.code === 'WEIGHT_TOTAL_SUM_INVALID'))
  })

  // ────────────────────────────────────────────
  // Cutover severity — enforced=false이면 warning, true이면 blocker
  // 현재 정책 상수는 enforced=false이므로 발생하는 issue는 모두 warning.
  // ────────────────────────────────────────────
  await run('cutover off(현재): 위반 issue severity는 warning, diagnostic.canSubmit !== false', () => {
    const r = validatePersonalKpiWeightCapItem2026({
      item: item({ policyCategory: 'PROJECT_K', weight: 10 }),
      cycleYear: 2026,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].severity, 'warning')
    // diagnosticFromIssues가 blocker 없으면 canSubmit=null. severity='warning'.
    assert.notEqual(r.canSubmit, false)
    assert.equal(r.severity, 'warning')
  })

  await run('cutover off(현재): 다중 위반 + total invalid 조합도 모두 warning', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 30 }), // ORG_GOAL item > 10
        item({ id: 'b', policyCategory: 'ORG_GOAL', weight: 30 }), // ORG_GOAL 합 60 > 50
        item({ id: 'c', policyCategory: 'PROJECT_K', weight: 50 }), // 합 110 ≠ 100
      ],
      cycleYear: 2026,
    })
    assert.ok(r.issues.length >= 2)
    assert.ok(r.issues.every((i) => i.severity === 'warning'))
    assert.notEqual(r.canSubmit, false)
  })

  // ────────────────────────────────────────────
  // 메시지 한국어 보존
  // ────────────────────────────────────────────
  await run('에러 메시지: 한국어 + 카테고리 라벨 + 수치 포함', () => {
    const r = validatePersonalKpiWeightCapItem2026({
      item: item({ policyCategory: 'PROJECT_K', weight: 7 }),
      cycleYear: 2026,
    })
    assert.match(r.issues[0].message, /프로젝트 K/)
    assert.match(r.issues[0].message, /5%/)
    assert.match(r.issues[0].message, /7%/)
  })

  // ────────────────────────────────────────────
  // rule override — dormant vs enforced (정책 상수 안 건드리고 인자 주입)
  // ────────────────────────────────────────────
  await run('dormant override(enforced=false): perItem 초과 → warning, canSubmit !== false', () => {
    const r = validatePersonalKpiWeightCapItem2026({
      item: item({ policyCategory: 'PROJECT_K', weight: 7 }),
      cycleYear: 2026,
      rule: DORMANT_RULE,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].severity, 'warning')
    assert.notEqual(r.canSubmit, false)
  })

  await run('enforced override(enforced=true): perItem 초과 → blocker, canSubmit === false', () => {
    const r = validatePersonalKpiWeightCapItem2026({
      item: item({ policyCategory: 'PROJECT_K', weight: 7 }),
      cycleYear: 2026,
      rule: ENFORCED_RULE,
    })
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].severity, 'blocker')
    assert.equal(r.canSubmit, false)
  })

  await run('enforced override: ORG_GOAL sumMax 51% → blocker', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 26 }),
        item({ id: 'b', policyCategory: 'ORG_GOAL', weight: 25 }),
        item({ id: 'c', policyCategory: 'DAILY_WORK', weight: 49 }),
      ],
      cycleYear: 2026,
      rule: ENFORCED_RULE,
    })
    const sumCapIssue = r.issues.find((i) => i.code === 'WEIGHT_CATEGORY_SUM_CAP_EXCEEDED')
    assert.ok(sumCapIssue)
    assert.equal(sumCapIssue?.severity, 'blocker')
    assert.equal(r.canSubmit, false)
  })

  await run('enforced override: 합 99% (총합 부족) → WEIGHT_TOTAL_SUM_INVALID blocker', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'PROJECT_T', weight: 50 }),
        item({ id: 'b', policyCategory: 'DAILY_WORK', weight: 49 }),
      ],
      cycleYear: 2026,
      rule: ENFORCED_RULE,
    })
    const totalIssue = r.issues.find((i) => i.code === 'WEIGHT_TOTAL_SUM_INVALID')
    assert.ok(totalIssue)
    assert.equal(totalIssue?.severity, 'blocker')
    assert.equal(r.canSubmit, false)
  })

  await run('dormant override: 합 99% → warning, canSubmit 통과 (cutover 전 차단 X)', () => {
    const r = validatePersonalKpiWeightAggregate2026({
      items: [
        item({ id: 'a', policyCategory: 'PROJECT_T', weight: 50 }),
        item({ id: 'b', policyCategory: 'DAILY_WORK', weight: 49 }),
      ],
      cycleYear: 2026,
      rule: DORMANT_RULE,
    })
    const totalIssue = r.issues.find((i) => i.code === 'WEIGHT_TOTAL_SUM_INVALID')
    assert.ok(totalIssue)
    assert.equal(totalIssue?.severity, 'warning')
    assert.notEqual(r.canSubmit, false)
  })

  // ────────────────────────────────────────────
  // persistence helper — POST/PATCH 라우트 wiring 단위 검증
  // ────────────────────────────────────────────
  await run('persistence helper: 정상 케이스 (issues 0, 합 100)', () => {
    const r = validatePersonalKpiWeightCapForPersistence2026({
      existingItems: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 10 }),
        item({ id: 'b', policyCategory: 'PROJECT_T', weight: 10 }),
        item({ id: 'c', policyCategory: 'DAILY_WORK', weight: 75 }),
      ],
      newOrChangedItem: item({ id: 'new', policyCategory: 'PROJECT_K', weight: 5 }),
      cycleYear: 2026,
      rule: ENFORCED_RULE,
    })
    assert.equal(r.issues.length, 0)
    assert.notEqual(r.canSubmit, false)
  })

  await run('persistence helper: 신규 KPI category=null → 신규 perItem skip, aggregate(sum/total)엔 포함', () => {
    const r = validatePersonalKpiWeightCapForPersistence2026({
      existingItems: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 30 }),
        item({ id: 'b', policyCategory: 'ORG_GOAL', weight: 30 }),  // ORG_GOAL 합 60 > sumMax 50
      ],
      newOrChangedItem: item({ id: 'new', policyCategory: null, weight: 40 }), // 합 100
      cycleYear: 2026,
      rule: ENFORCED_RULE,
    })
    // 신규 NULL → 신규 자체의 perItem 검사 skip (helper의 itemDiagnostic은 newOrChangedItem만 봄)
    const itemCapIssues = r.issues.filter((i) => i.code === 'WEIGHT_CATEGORY_ITEM_CAP_EXCEEDED')
    assert.equal(itemCapIssues.length, 0)
    // aggregate는 existingItems + newOrChangedItem 합산 → ORG_GOAL sumMax 위반 잡힘
    const sumIssue = r.issues.find((i) => i.code === 'WEIGHT_CATEGORY_SUM_CAP_EXCEEDED')
    assert.ok(sumIssue, 'aggregate가 existing ORG_GOAL 합 60% 잡아야 함')
    assert.equal(sumIssue?.severity, 'blocker')
    // 합 = 100 → TOTAL 위반 없음
    assert.equal(r.issues.find((i) => i.code === 'WEIGHT_TOTAL_SUM_INVALID'), undefined)
    assert.equal(r.canSubmit, false) // sumMax blocker 때문
  })

  await run('persistence helper: dormant default(rule 미주입) → 모든 issue warning, canSubmit 통과', () => {
    const r = validatePersonalKpiWeightCapForPersistence2026({
      existingItems: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 30 }),
        item({ id: 'b', policyCategory: 'ORG_GOAL', weight: 30 }), // ORG_GOAL 합 60 > 50
      ],
      newOrChangedItem: item({ id: 'new', policyCategory: 'PROJECT_K', weight: 7 }), // perItem 5 cap
      cycleYear: 2026,
      // rule 미주입 → EVALUATION_POLICY_2026.weightRule (현재 enforced=false dormant)
    })
    assert.ok(r.issues.length >= 2)
    assert.ok(r.issues.every((i) => i.severity === 'warning'))
    assert.notEqual(r.canSubmit, false)
  })

  await run('persistence helper: cycleYear=2025 → 모든 검증 skip', () => {
    const r = validatePersonalKpiWeightCapForPersistence2026({
      existingItems: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 999 }),
      ],
      newOrChangedItem: item({ id: 'new', policyCategory: 'PROJECT_K', weight: 999 }),
      cycleYear: 2025,
      rule: { enforced: true, totalSum: 100, cycleYear: 2026 },
    })
    assert.equal(r.issues.length, 0)
  })

  await run('persistence helper: existingItems + newOrChangedItem 합산 검증', () => {
    // existingItems만 보면 sumMax/total 통과, newOrChangedItem 더해서 위반 만들기
    const r = validatePersonalKpiWeightCapForPersistence2026({
      existingItems: [
        item({ id: 'a', policyCategory: 'ORG_GOAL', weight: 40 }), // perItem 10 cap 위반은 별개
      ],
      newOrChangedItem: item({ id: 'new', policyCategory: 'ORG_GOAL', weight: 20 }), // 합 60 > 50
      cycleYear: 2026,
      rule: ENFORCED_RULE,
    })
    const sumIssue = r.issues.find((i) => i.code === 'WEIGHT_CATEGORY_SUM_CAP_EXCEEDED')
    assert.ok(sumIssue, 'aggregate가 existingItems + newOrChangedItem 합쳐 검증')
    assert.equal(sumIssue?.severity, 'blocker')
  })

  await run('persistence helper: dormant default 정책 상수 sanity (enforced=false 확인)', () => {
    // 정책 상수가 현재 dormant인지 sanity. 이 케이스가 fail하면 cutover가 일어났다는 신호.
    assert.equal(EVALUATION_POLICY_2026.weightRule.enforced, false)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
