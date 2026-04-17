import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'
process.env.OPENAI_INPUT_COST_PER_1M = '0.5'
process.env.OPENAI_OUTPUT_COST_PER_1M = '1.5'
process.env.AI_FEATURE_ENABLED = 'false'

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

function extractSchemaBlock(source: string, schemaName: string) {
  const pattern = new RegExp(`const ${schemaName} = \\{[\\s\\S]*?\\n\\} satisfies JsonRecord`)
  return source.match(pattern)?.[0] ?? ''
}

function extractSchemaObject<T = Record<string, unknown>>(source: string, schemaName: string): T {
  const block = extractSchemaBlock(source, schemaName)
  if (!block) {
    throw new Error(`Schema block not found: ${schemaName}`)
  }

  const literal = block
    .replace(new RegExp(`^const ${schemaName} = `), '')
    .replace(/\s+satisfies JsonRecord$/, '')

  return Function(`return (${literal})`)() as T
}

function assertStrictSchemaRequiredParity(schema: Record<string, unknown>, path: string[] = []) {
  const properties =
    schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, unknown>)
      : null

  if (properties) {
    const required = Array.isArray(schema.required) ? schema.required.filter((value) => typeof value === 'string') : []
    assert.deepEqual(
      [...required].sort(),
      [...Object.keys(properties)].sort(),
      `required/property mismatch at ${path.join('.') || '<root>'}`,
    )

    for (const [key, value] of Object.entries(properties)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        assertStrictSchemaRequiredParity(value as Record<string, unknown>, [...path, 'properties', key])
      }
    }
  }

  const items =
    schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)
      ? (schema.items as Record<string, unknown>)
      : null

  if (items) {
    assertStrictSchemaRequiredParity(items, [...path, 'items'])
  }
}

async function main() {
  const { AIRequestType } = await import('@prisma/client')
  const {
    buildFallbackResult,
    estimateAiCostUsd,
    isAiFeatureEnabled,
    sanitizeAiPayload,
  } = await import('../src/lib/ai-assist')

  run('PII sanitization removes direct identifiers and redacts free text', () => {
    const sanitized = sanitizeAiPayload({
      employeeName: '홍길동',
      email: 'user@company.com',
      empId: 'EMP-2026-001',
      summary: '문의자는 EMP-2026-001이며 연락처는 010-1234-5678 입니다.',
      nested: {
        evaluatorId: 'abc',
        note: 'manager@company.com 으로 회신',
      },
    })

    assert.equal('employeeName' in sanitized, false)
    assert.equal('email' in sanitized, false)
    assert.equal('empId' in sanitized, false)
    assert.equal(
      sanitized.summary,
      '문의자는 [redacted-employee-id]이며 연락처는 [redacted-phone] 입니다.'
    )
    assert.deepEqual(sanitized.nested, { note: '[redacted-email] 으로 회신' })
  })

  run('fallback KPI suggestion returns structured fields', () => {
    const fallback = buildFallbackResult(AIRequestType.KPI_ASSIST, {
      kpiType: 'QUANTITATIVE',
      orgKpiName: '서비스 안정성 향상',
    })

    assert.equal(typeof fallback.kpiName, 'string')
    assert.equal(typeof fallback.definition, 'string')
    assert.equal(typeof fallback.formula, 'string')
    assert.equal(Array.isArray(fallback.smartChecks), true)
  })

  run('fallback growth plan keeps actionable sections', () => {
    const fallback = buildFallbackResult(AIRequestType.GROWTH_PLAN, {
      focusArea: '리뷰 품질',
      gradeName: 'B+',
    })

    assert.equal(fallback.focusArea, '리뷰 품질')
    assert.equal(Array.isArray(fallback.recommendedActions), true)
    assert.equal(Array.isArray(fallback.supportNeeded), true)
    assert.equal(typeof fallback.milestone, 'string')
  })

  run('cost estimation uses configurable token rates', () => {
    const cost = estimateAiCostUsd({ inputTokens: 1000, outputTokens: 500 })
    assert.equal(cost, 0.00125)
  })

  run('AI feature flag can disable remote calls cleanly', () => {
    assert.equal(isAiFeatureEnabled(), false)
  })

  run('structured output schemas keep nullable optional fields in required arrays for strict json_schema', () => {
    const source = read('src/lib/ai-assist.ts')
    const personalDraftSchema = extractSchemaBlock(source, 'PERSONAL_KPI_DRAFT_SCHEMA')
    const personalDuplicateSchema = extractSchemaBlock(source, 'PERSONAL_KPI_DUPLICATE_SCHEMA')
    const orgDuplicateSchema = extractSchemaBlock(source, 'ORG_KPI_DUPLICATE_SCHEMA')
    const orgDraftSchemaObject = extractSchemaObject(source, 'ORG_KPI_DRAFT_SCHEMA')
    const orgAlignmentSchemaObject = extractSchemaObject(source, 'ORG_KPI_ALIGNMENT_SCHEMA')

    assert.equal(personalDraftSchema.includes("'formula'"), true)
    assert.equal(personalDraftSchema.includes("formula: { type: ['string', 'null'] }"), true)
    assert.equal(personalDuplicateSchema.includes("required: ['id', 'title', 'overlapLevel', 'similarityReason']"), true)
    assert.equal(personalDuplicateSchema.includes("id: { type: ['string', 'null'] }"), true)
    assert.equal(orgDuplicateSchema.includes("required: ['id', 'title', 'overlapLevel', 'similarityReason']"), true)
    assert.equal(orgDuplicateSchema.includes("id: { type: ['string', 'null'] }"), true)
    assertStrictSchemaRequiredParity(orgDraftSchemaObject)
    assertStrictSchemaRequiredParity(orgAlignmentSchemaObject)
  })

  console.log('AI assistant tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
