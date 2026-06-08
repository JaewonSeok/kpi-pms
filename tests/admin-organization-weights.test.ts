import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { OrganizationWeightsSchema, type OrganizationWeights2026 } from '../src/lib/validations'
import {
  DEFAULT_ORGANIZATION_WEIGHTS_2026,
  resolveOrganizationWeights2026,
  writePolicy2026OrganizationWeightsToConfig,
} from '../src/lib/policy-2026-organization-weights'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const VALID_DEFAULT: OrganizationWeights2026 = {
  withSection: { division: 0.0, section: 0.1, team: 0.2 },
  withoutSection: { division: 0.1, team: 0.2 },
  personal: 0.7,
}

const VALID_CUSTOM: OrganizationWeights2026 = {
  withSection: { division: 0.05, section: 0.1, team: 0.15 },
  withoutSection: { division: 0.15, team: 0.15 },
  personal: 0.7,
}

async function main() {
  // ────────────────────────────────────────────
  // Zod schema — 합=0.30 & personal=0.70 통과
  // ────────────────────────────────────────────

  await run('schema: default 값(withSection 0+0.1+0.2, withoutSection 0.1+0.2, personal 0.7) 통과', () => {
    const r = OrganizationWeightsSchema.safeParse(VALID_DEFAULT)
    assert.equal(r.success, true)
  })

  await run('schema: custom 분배(0.05+0.1+0.15, 0.15+0.15, personal 0.7) 통과', () => {
    const r = OrganizationWeightsSchema.safeParse(VALID_CUSTOM)
    assert.equal(r.success, true)
  })

  await run('schema: 부동소수점 허용 오차(0.0999+0.1001+0.1 ≈ 0.30) 통과', () => {
    const r = OrganizationWeightsSchema.safeParse({
      withSection: { division: 0.0999, section: 0.1001, team: 0.1 },
      withoutSection: { division: 0.1, team: 0.2 },
      personal: 0.7,
    })
    assert.equal(r.success, true)
  })

  // ────────────────────────────────────────────
  // Zod schema — refine fail
  // ────────────────────────────────────────────

  await run('schema: withSection 합 0.30 아님 → fail', () => {
    const r = OrganizationWeightsSchema.safeParse({
      ...VALID_DEFAULT,
      withSection: { division: 0.1, section: 0.1, team: 0.2 }, // sum 0.40
    })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.ok(r.error.issues.some((iss) => iss.path.includes('withSection')))
    }
  })

  await run('schema: withoutSection 합 0.30 아님 → fail', () => {
    const r = OrganizationWeightsSchema.safeParse({
      ...VALID_DEFAULT,
      withoutSection: { division: 0.0, team: 0.2 }, // sum 0.20
    })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.ok(r.error.issues.some((iss) => iss.path.includes('withoutSection')))
    }
  })

  await run('schema: personal 0.70 아님 → fail (30:70 고정 위반)', () => {
    const r = OrganizationWeightsSchema.safeParse({
      ...VALID_DEFAULT,
      personal: 0.6,
    })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.ok(r.error.issues.some((iss) => iss.path.includes('personal')))
    }
  })

  await run('schema: personal 0.80 → fail', () => {
    const r = OrganizationWeightsSchema.safeParse({
      ...VALID_DEFAULT,
      personal: 0.8,
    })
    assert.equal(r.success, false)
  })

  // ────────────────────────────────────────────
  // Zod schema — 범위 (음수, 1 초과)
  // ────────────────────────────────────────────

  await run('schema: 음수 가중치 → fail', () => {
    const r = OrganizationWeightsSchema.safeParse({
      ...VALID_DEFAULT,
      withSection: { division: -0.1, section: 0.2, team: 0.2 },
    })
    assert.equal(r.success, false)
  })

  await run('schema: 1 초과 → fail', () => {
    const r = OrganizationWeightsSchema.safeParse({
      ...VALID_DEFAULT,
      personal: 1.5,
    })
    assert.equal(r.success, false)
  })

  await run('schema: 필수 필드 누락(withSection.section) → fail', () => {
    const r = OrganizationWeightsSchema.safeParse({
      withSection: { division: 0.0, team: 0.2 }, // section 누락
      withoutSection: { division: 0.1, team: 0.2 },
      personal: 0.7,
    })
    assert.equal(r.success, false)
  })

  await run('schema: 잘못된 타입(string) → fail', () => {
    const r = OrganizationWeightsSchema.safeParse({
      ...VALID_DEFAULT,
      personal: '0.7' as unknown as number,
    })
    assert.equal(r.success, false)
  })

  // ────────────────────────────────────────────
  // resolver — fallback 동작
  // ────────────────────────────────────────────

  await run('resolver: cycleConfig null → DEFAULT', () => {
    const result = resolveOrganizationWeights2026(null)
    assert.deepEqual(result, DEFAULT_ORGANIZATION_WEIGHTS_2026)
  })

  await run('resolver: cycleConfig undefined → DEFAULT', () => {
    const result = resolveOrganizationWeights2026(undefined)
    assert.deepEqual(result, DEFAULT_ORGANIZATION_WEIGHTS_2026)
  })

  await run('resolver: cycleConfig {} (키 없음) → DEFAULT', () => {
    const result = resolveOrganizationWeights2026({})
    assert.deepEqual(result, DEFAULT_ORGANIZATION_WEIGHTS_2026)
  })

  await run('resolver: cycleConfig에 다른 키만 있음(milestones 등) → DEFAULT', () => {
    const result = resolveOrganizationWeights2026({
      milestones: { step1: 'done' },
      policy2026PreviewMappings: { salesGroupsByDivisionId: {} },
    })
    assert.deepEqual(result, DEFAULT_ORGANIZATION_WEIGHTS_2026)
  })

  await run('resolver: 잘못된 값(합 0.40) → DEFAULT (Zod refine 실패 fallback)', () => {
    const result = resolveOrganizationWeights2026({
      policy2026OrganizationWeights: {
        withSection: { division: 0.1, section: 0.1, team: 0.2 },
        withoutSection: { division: 0.1, team: 0.2 },
        personal: 0.7,
      },
    })
    assert.deepEqual(result, DEFAULT_ORGANIZATION_WEIGHTS_2026)
  })

  await run('resolver: 유효한 custom 값 → 그 값 그대로 반환', () => {
    const result = resolveOrganizationWeights2026({
      policy2026OrganizationWeights: VALID_CUSTOM,
    })
    assert.deepEqual(result, VALID_CUSTOM)
  })

  await run('resolver: 비객체(string) → DEFAULT', () => {
    const result = resolveOrganizationWeights2026('not a record')
    assert.deepEqual(result, DEFAULT_ORGANIZATION_WEIGHTS_2026)
  })

  await run('resolver: 배열 → DEFAULT (isRecord가 array 거부)', () => {
    const result = resolveOrganizationWeights2026([1, 2, 3])
    assert.deepEqual(result, DEFAULT_ORGANIZATION_WEIGHTS_2026)
  })

  // ────────────────────────────────────────────
  // writer — merge 보존 (★ 핵심)
  // ────────────────────────────────────────────

  await run('writer: 기존 config null → policy2026OrganizationWeights 키만 있는 새 config', () => {
    const result = writePolicy2026OrganizationWeightsToConfig(null, VALID_DEFAULT)
    assert.deepEqual(result, { policy2026OrganizationWeights: VALID_DEFAULT })
  })

  await run('writer: 기존 config의 다른 키들(milestones, policy2026PreviewMappings) 보존', () => {
    const existingConfig = {
      milestones: { kpiSetup: 'done', selfEval: 'pending' },
      policy2026PreviewMappings: {
        salesGroupsByDivisionId: { 'div-1': { salesGroup: 'SALES' } },
        teamMemberSalesThresholdDecision: { decision: 'SUPER_PRIORITY' },
      },
      policy2026OfficialReadinessEnabled: true,
    }
    const result = writePolicy2026OrganizationWeightsToConfig(existingConfig, VALID_CUSTOM)

    // 기존 키 모두 보존되어야
    assert.deepEqual(result.milestones, existingConfig.milestones)
    assert.deepEqual(result.policy2026PreviewMappings, existingConfig.policy2026PreviewMappings)
    assert.equal(result.policy2026OfficialReadinessEnabled, true)
    // 신규 키 갱신
    assert.deepEqual(result.policy2026OrganizationWeights, VALID_CUSTOM)
  })

  await run('writer: 기존 policy2026OrganizationWeights 값 → 새 값으로 덮어쓰기', () => {
    const existingConfig = {
      policy2026OrganizationWeights: VALID_DEFAULT,
      milestones: { step1: 'done' },
    }
    const result = writePolicy2026OrganizationWeightsToConfig(existingConfig, VALID_CUSTOM)
    assert.deepEqual(result.policy2026OrganizationWeights, VALID_CUSTOM)
    assert.deepEqual(result.milestones, { step1: 'done' })
  })

  await run('writer: 기존 config가 string(잘못된 형태) → 무시하고 신규 키만', () => {
    const result = writePolicy2026OrganizationWeightsToConfig(
      'this is not an object',
      VALID_DEFAULT,
    )
    assert.deepEqual(result, { policy2026OrganizationWeights: VALID_DEFAULT })
  })

  await run('writer: 기존 config가 array → 무시하고 신규 키만 (Record 아님)', () => {
    const result = writePolicy2026OrganizationWeightsToConfig([1, 2], VALID_DEFAULT)
    assert.deepEqual(result, { policy2026OrganizationWeights: VALID_DEFAULT })
  })

  // ────────────────────────────────────────────
  // Default 정합성 sanity
  // ────────────────────────────────────────────

  await run('★ DEFAULT 자체가 OrganizationWeightsSchema를 통과 (정합성 sanity)', () => {
    const r = OrganizationWeightsSchema.safeParse(DEFAULT_ORGANIZATION_WEIGHTS_2026)
    assert.equal(r.success, true)
  })

  await run('★ DEFAULT 값 sanity (사용자 명시 — 정확한 분배)', () => {
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withSection.division, 0.0)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withSection.section, 0.1)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withSection.team, 0.2)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withoutSection.division, 0.1)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.withoutSection.team, 0.2)
    assert.equal(DEFAULT_ORGANIZATION_WEIGHTS_2026.personal, 0.7)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
