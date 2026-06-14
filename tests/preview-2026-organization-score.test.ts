import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import {
  calculateOrganizationPerformanceFromIntake2026,
  DIVISION_HEAD_DIVISION_WEIGHT,
  DIVISION_HEAD_PERSONAL_WEIGHT,
  type PreviewIntakeInput2026,
} from '../src/lib/preview-2026-organization-score'
import { DEFAULT_ORGANIZATION_WEIGHTS_2026 } from '../src/lib/policy-2026-organization-weights'
import { calculateAbsoluteGrade2026 } from '../src/server/evaluation-grade-2026'
import { EVALUATION_POLICY_2026_VERSION } from '../src/lib/evaluation-policy-2026'
import type { OrganizationWeights2026 } from '../src/lib/validations'

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
  // ════════════════════════════════════════════════════════════════════
  // 페르소나 5종 검증 — A1 설계서 §4.2 표의 점수가 정확히 그 등급으로 산정
  // ════════════════════════════════════════════════════════════════════

  await run('#1 가상_본부장 (DIVISION_HEAD · NON_SALES): 본부124 / 개인122 → 122.6 SUPER', () => {
    const result = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'DIVISION_HEAD',
      parentScore: 124,
      personalScore: 122,
    })
    assert.equal(result.finalScore, 122.6, 'finalScore = 124×0.30 + 122×0.70 = 37.2 + 85.4')
    assert.equal(result.organizationScore, 37.2)
    assert.equal(result.personalScore, 85.4)
    assert.equal(result.breakdown.roleGroup, 'DIVISION_HEAD')
    assert.equal(result.breakdown.divisionScoreWeighted, 37.2)
    assert.equal(result.breakdown.appliedWeights.division, 0.3)
    assert.equal(result.breakdown.appliedWeights.personal, 0.7)
    assert.equal(result.breakdown.teamScoreWeighted, undefined)
    assert.equal(result.breakdown.parentScoreWeighted, undefined)

    const grade = calculateAbsoluteGrade2026({
      score: result.finalScore,
      roleGroup: 'DIVISION_HEAD',
    })
    assert.equal(grade.ok, true)
    if (grade.ok) {
      assert.equal(grade.value.finalGrade.code, 'SUPER')
      assert.equal(grade.value.thresholdGroup, 'DIVISION_HEAD')
    }
  })

  await run('#2 가상_팀장영업 (TEAM_SECTION_LEADER_SALES): 팀108 / 실106 / 개인104 → 105.0 OUTSTANDING', () => {
    const result = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'TEAM_SECTION_LEADER',
      teamScore: 108,
      parentScore: 106,
      personalScore: 104,
      parentLevel: 'SECTION',
    })
    assert.equal(result.finalScore, 105.0, 'finalScore = 108×0.20 + 106×0.10 + 104×0.70 = 21.6 + 10.6 + 72.8')
    assert.equal(result.organizationScore, 32.2)
    assert.equal(result.personalScore, 72.8)
    assert.equal(result.breakdown.teamScoreWeighted, 21.6)
    assert.equal(result.breakdown.parentScoreWeighted, 10.6)

    const grade = calculateAbsoluteGrade2026({
      score: result.finalScore,
      roleGroup: 'TEAM_SECTION_LEADER',
      salesGroup: 'SALES',
    })
    assert.equal(grade.ok, true)
    if (grade.ok) {
      assert.equal(grade.value.finalGrade.code, 'OUTSTANDING')
      assert.equal(grade.value.thresholdGroup, 'TEAM_SECTION_LEADER_SALES')
    }
  })

  await run('#3 가상_팀장비영업 (TEAM_SECTION_LEADER_NON_SALES): 팀112 / 실110 / 개인110 → 110.4 EXCELLENT', () => {
    const result = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'TEAM_SECTION_LEADER',
      teamScore: 112,
      parentScore: 110,
      personalScore: 110,
      parentLevel: 'SECTION',
    })
    assert.equal(result.finalScore, 110.4, 'finalScore = 112×0.20 + 110×0.10 + 110×0.70 = 22.4 + 11.0 + 77.0')
    assert.equal(result.organizationScore, 33.4)
    assert.equal(result.personalScore, 77.0)

    const grade = calculateAbsoluteGrade2026({
      score: result.finalScore,
      roleGroup: 'TEAM_SECTION_LEADER',
      salesGroup: 'NON_SALES',
    })
    assert.equal(grade.ok, true)
    if (grade.ok) {
      assert.equal(grade.value.finalGrade.code, 'EXCELLENT')
      assert.equal(grade.value.thresholdGroup, 'TEAM_SECTION_LEADER_NON_SALES')
    }
  })

  await run('#4 가상_팀원비영업 (TEAM_MEMBER_NON_SALES): 팀80 / 실82 / 개인80 → 80.2 GOOD', () => {
    const result = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'TEAM_MEMBER',
      teamScore: 80,
      parentScore: 82,
      personalScore: 80,
      parentLevel: 'SECTION',
    })
    assert.equal(result.finalScore, 80.2, 'finalScore = 80×0.20 + 82×0.10 + 80×0.70 = 16.0 + 8.2 + 56.0')
    assert.equal(result.organizationScore, 24.2)
    assert.equal(result.personalScore, 56.0)

    const grade = calculateAbsoluteGrade2026({
      score: result.finalScore,
      roleGroup: 'TEAM_MEMBER',
      salesGroup: 'NON_SALES',
    })
    assert.equal(grade.ok, true)
    if (grade.ok) {
      assert.equal(grade.value.finalGrade.code, 'GOOD')
      assert.equal(grade.value.thresholdGroup, 'TEAM_MEMBER_NON_SALES')
    }
  })

  await run(
    '#5 가상_본부직속팀원영업 (TEAM_MEMBER_SALES · parentLevel=DIVISION): 팀88 / 본부85 / 개인85 → 85.6 NEED_IMPROVEMENT',
    () => {
      const result = calculateOrganizationPerformanceFromIntake2026({
        roleGroup: 'TEAM_MEMBER',
        teamScore: 88,
        parentScore: 85,
        personalScore: 85,
        parentLevel: 'DIVISION',
      })
      assert.equal(result.finalScore, 85.6, 'finalScore = 88×0.20 + 85×0.10 + 85×0.70 = 17.6 + 8.5 + 59.5')
      assert.equal(result.organizationScore, 26.1)
      assert.equal(result.personalScore, 59.5)

      const grade = calculateAbsoluteGrade2026({
        score: result.finalScore,
        roleGroup: 'TEAM_MEMBER',
        salesGroup: 'SALES',
      })
      assert.equal(grade.ok, true)
      if (grade.ok) {
        assert.equal(grade.value.finalGrade.code, 'NEED_IMPROVEMENT')
        assert.equal(grade.value.thresholdGroup, 'TEAM_MEMBER_SALES')
      }
    }
  )

  // ════════════════════════════════════════════════════════════════════
  // Edge cases
  // ════════════════════════════════════════════════════════════════════

  await run('edge: 개인 점수 0 → personalScore 0, finalScore는 조직 점수만', () => {
    const result = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'TEAM_MEMBER',
      teamScore: 100,
      parentScore: 100,
      personalScore: 0,
      parentLevel: 'SECTION',
    })
    assert.equal(result.personalScore, 0)
    assert.equal(result.organizationScore, 30.0) // 100×0.20 + 100×0.10
    assert.equal(result.finalScore, 30.0)
  })

  await run('edge: DIVISION_HEAD 분기 격리 — teamScore·parentLevel·weights 무시', () => {
    const result = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'DIVISION_HEAD',
      teamScore: 999, // 무시
      parentScore: 100,
      personalScore: 100,
      parentLevel: 'SECTION', // 무시
      weights: {
        withSection: { division: 0.05, section: 0.1, team: 0.15 },
        withoutSection: { division: 0.15, team: 0.15 },
        personal: 0.7,
      }, // 무시 — 본부장은 코드 상수만
    })
    // 본부 100 × 0.30 + 개인 100 × 0.70 = 30 + 70 = 100
    assert.equal(result.finalScore, 100.0)
    assert.equal(result.breakdown.appliedWeights.division, 0.3)
    assert.equal(result.breakdown.appliedWeights.personal, 0.7)
    assert.equal(result.breakdown.appliedWeights.team, undefined)
    assert.equal(result.breakdown.appliedWeights.parent, undefined)
    assert.equal(result.breakdown.teamScoreWeighted, undefined)
    assert.equal(result.breakdown.parentScoreWeighted, undefined)
  })

  await run(
    'edge: DEFAULT 가중치에서 parentLevel=SECTION vs DIVISION 동일 결과 (보정 키 영향 0)',
    () => {
      const base: PreviewIntakeInput2026 = {
        roleGroup: 'TEAM_MEMBER',
        teamScore: 90,
        parentScore: 90,
        personalScore: 90,
        parentLevel: 'SECTION',
      }
      const r1 = calculateOrganizationPerformanceFromIntake2026(base)
      const r2 = calculateOrganizationPerformanceFromIntake2026({ ...base, parentLevel: 'DIVISION' })
      assert.equal(r1.finalScore, r2.finalScore)
      assert.equal(r1.organizationScore, r2.organizationScore)
      assert.equal(r1.breakdown.appliedWeights.team, r2.breakdown.appliedWeights.team)
      assert.equal(r1.breakdown.appliedWeights.parent, r2.breakdown.appliedWeights.parent)
    }
  )

  await run('edge: parentLevel null/undefined → withSection fallback (SECTION과 동일)', () => {
    const resultNull = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'TEAM_MEMBER',
      teamScore: 80,
      parentScore: 82,
      personalScore: 80,
      parentLevel: null,
    })
    const resultUndef = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'TEAM_MEMBER',
      teamScore: 80,
      parentScore: 82,
      personalScore: 80,
      // parentLevel 미전달
    })
    // #4와 동일 결과
    assert.equal(resultNull.finalScore, 80.2)
    assert.equal(resultUndef.finalScore, 80.2)
  })

  await run('edge: 커스텀 가중치 + parentLevel=DIVISION → withoutSection 적용 검증', () => {
    const customWeights: OrganizationWeights2026 = {
      withSection: { division: 0.0, section: 0.15, team: 0.15 }, // sum 0.30
      withoutSection: { division: 0.05, team: 0.25 }, // sum 0.30
      personal: 0.7,
    }
    const result = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'TEAM_MEMBER',
      teamScore: 100,
      parentScore: 100,
      personalScore: 100,
      parentLevel: 'DIVISION',
      weights: customWeights,
    })
    // withoutSection 적용: team=0.25, parent(division)=0.05, personal=0.70
    // 100×0.25 + 100×0.05 + 100×0.70 = 25 + 5 + 70 = 100
    assert.equal(result.finalScore, 100.0)
    assert.equal(result.breakdown.appliedWeights.team, 0.25)
    assert.equal(result.breakdown.appliedWeights.parent, 0.05)
    assert.equal(result.breakdown.teamScoreWeighted, 25.0)
    assert.equal(result.breakdown.parentScoreWeighted, 5.0)
  })

  await run('edge: 커스텀 가중치 + parentLevel=SECTION → withSection 적용 검증', () => {
    const customWeights: OrganizationWeights2026 = {
      withSection: { division: 0.0, section: 0.15, team: 0.15 },
      withoutSection: { division: 0.05, team: 0.25 },
      personal: 0.7,
    }
    const result = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'TEAM_MEMBER',
      teamScore: 100,
      parentScore: 100,
      personalScore: 100,
      parentLevel: 'SECTION',
      weights: customWeights,
    })
    // withSection 적용: team=0.15, parent(section)=0.15, personal=0.70
    // 100×0.15 + 100×0.15 + 100×0.70 = 15 + 15 + 70 = 100
    assert.equal(result.finalScore, 100.0)
    assert.equal(result.breakdown.appliedWeights.team, 0.15)
    assert.equal(result.breakdown.appliedWeights.parent, 0.15)
    assert.equal(result.breakdown.teamScoreWeighted, 15.0)
    assert.equal(result.breakdown.parentScoreWeighted, 15.0)
  })

  await run(
    'edge: #5 TEAM_MEMBER_SALES를 110.0까지 올리면 calculateAbsoluteGrade2026이 AMBIGUOUS_THRESHOLD_MATCH 반환',
    () => {
      // 팀=110, 본부=110, 개인=110 → 22.0 + 11.0 + 77.0 = 110.0
      const result = calculateOrganizationPerformanceFromIntake2026({
        roleGroup: 'TEAM_MEMBER',
        teamScore: 110,
        parentScore: 110,
        personalScore: 110,
        parentLevel: 'DIVISION',
      })
      assert.equal(result.finalScore, 110.0)

      const grade = calculateAbsoluteGrade2026({
        score: result.finalScore,
        roleGroup: 'TEAM_MEMBER',
        salesGroup: 'SALES',
        // teamMemberSalesThresholdDecision 미전달 → SUPER(≥110)·OUTSTANDING(≥110) 중첩 → fail
      })
      assert.equal(grade.ok, false)
      if (!grade.ok) {
        assert.ok(
          grade.errors.some((e) => e.code === 'AMBIGUOUS_THRESHOLD_MATCH'),
          'AMBIGUOUS_THRESHOLD_MATCH 에러 코드 포함'
        )
      }
    }
  )

  await run(
    'edge: #5 110.0 + teamMemberSalesThresholdDecision=SUPER_PRIORITY → SUPER 단일 매칭',
    () => {
      const grade = calculateAbsoluteGrade2026({
        score: 110.0,
        roleGroup: 'TEAM_MEMBER',
        salesGroup: 'SALES',
        teamMemberSalesThresholdDecision: 'SUPER_PRIORITY',
      })
      assert.equal(grade.ok, true)
      if (grade.ok) {
        assert.equal(grade.value.finalGrade.code, 'SUPER')
      }
    }
  )

  // ════════════════════════════════════════════════════════════════════
  // 정합성 sanity
  // ════════════════════════════════════════════════════════════════════

  await run('★ formulaVersion 이 EVALUATION_POLICY_2026_VERSION 과 일치', () => {
    const result = calculateOrganizationPerformanceFromIntake2026({
      roleGroup: 'TEAM_MEMBER',
      teamScore: 80,
      parentScore: 82,
      personalScore: 80,
      parentLevel: 'SECTION',
    })
    assert.equal(result.formulaVersion, EVALUATION_POLICY_2026_VERSION)
  })

  await run('★ DIVISION_HEAD 상수 sanity (0.30 + 0.70 = 1.0)', () => {
    assert.equal(DIVISION_HEAD_DIVISION_WEIGHT, 0.3)
    assert.equal(DIVISION_HEAD_PERSONAL_WEIGHT, 0.7)
    assert.equal(DIVISION_HEAD_DIVISION_WEIGHT + DIVISION_HEAD_PERSONAL_WEIGHT, 1.0)
  })

  await run('★ DEFAULT 가중치가 결정 (1) "팀×0.20 + 직속상위×0.10 + 개인×0.70"과 일치', () => {
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withSection.team, 0.2)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withSection.section, 0.1)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withSection.division, 0.0)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withoutSection.team, 0.2)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withoutSection.division, 0.1)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.personal, 0.7)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
