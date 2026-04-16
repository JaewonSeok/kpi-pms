import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'
process.env.OPENAI_INPUT_COST_PER_1M = '0.5'
process.env.OPENAI_OUTPUT_COST_PER_1M = '1.5'
process.env.AI_FEATURE_ENABLED = 'false'

import {
  BulkOrgKpiRowSchema,
  BusinessPlanDocumentSchema,
  CreateOrgKpiSchema,
  TeamKpiRecommendationDecisionSchema,
  UpdateOrgKpiSchema,
} from '../src/lib/validations'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
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

function repeatText(seed: string, targetLength: number) {
  return seed.repeat(Math.ceil(targetLength / seed.length)).slice(0, targetLength)
}

async function main() {
  const { sanitizeAiPayload } = await import('../src/lib/ai-assist')
  const longDefinition = repeatText('This is a long KPI definition. ', 6_200)
  const longFormula = repeatText('Metric formula with measurable detail. ', 5_800)
  const longSummary = repeatText('Business plan summary paragraph. ', 8_500)
  const longBody = repeatText('Business plan body paragraph with details. ', 35_000)

  await run('org KPI create and update schemas accept long definition and formula text beyond 500 chars', () => {
    const createParsed = CreateOrgKpiSchema.safeParse({
      deptId: 'dept-hr',
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiCategory: 'People',
      kpiName: 'Hiring pipeline conversion',
      definition: longDefinition,
      formula: longFormula,
      targetValueT: 90,
      targetValueE: 100,
      targetValueS: 110,
      weight: 20,
      difficulty: 'MEDIUM',
    })

    assert.equal(createParsed.success, true)

    const updateParsed = UpdateOrgKpiSchema.safeParse({
      definition: longDefinition,
      formula: longFormula,
      targetValueT: 90,
      targetValueE: 100,
      targetValueS: 110,
    })

    assert.equal(updateParsed.success, true)
  })

  await run('team KPI adopt draft and bulk org KPI rows accept long text beyond 500 chars', () => {
    const decisionParsed = TeamKpiRecommendationDecisionSchema.safeParse({
      decision: 'ADOPT_EDITED',
      draft: {
        kpiType: 'QUANTITATIVE',
        kpiCategory: 'People',
        kpiName: 'Retention quality index',
        definition: longDefinition,
        formula: longFormula,
        targetValueT: 90,
        targetValueE: 100,
        targetValueS: 110,
        weight: 20,
        difficulty: 'HIGH',
      },
    })

    assert.equal(decisionParsed.success, true)

    const bulkParsed = BulkOrgKpiRowSchema.safeParse({
      deptId: 'dept-hr',
      evalYear: 2026,
      kpiCategory: 'People',
      kpiName: 'Retention quality index',
      definition: longDefinition,
      formula: longFormula,
      targetValue: 100,
      weight: 20,
    })

    assert.equal(bulkParsed.success, true)
  })

  await run('business plan schema accepts practical long-form text and returns Korean guidance instead of raw Zod text', () => {
    const parsed = BusinessPlanDocumentSchema.safeParse({
      deptId: 'dept-hr',
      evalYear: 2026,
      title: '2026 HR Strategic Business Plan',
      sourceType: 'TEXT',
      summaryText: longSummary,
      bodyText: longBody,
    })

    assert.equal(parsed.success, true)

    const tooLarge = BusinessPlanDocumentSchema.safeParse({
      deptId: 'dept-hr',
      evalYear: 2026,
      title: '2026 HR Strategic Business Plan',
      sourceType: 'TEXT',
      summaryText: longSummary,
      bodyText: repeatText('A', 100_001),
    })

    assert.equal(tooLarge.success, false)
    assert.equal(tooLarge.error?.issues[0]?.message.includes('Too big'), false)
  })

  await run('AI payload sanitization preserves long business-plan context safely with head/tail truncation', () => {
    const startMarker = 'START-CONTEXT'
    const endMarker = 'END-CONTEXT'
    const payload = sanitizeAiPayload({
      bodyText: `${startMarker}${repeatText(' body-text ', 25_000)}${endMarker}`,
      summaryText: repeatText('summary ', 12_000),
      rationale: repeatText('rationale ', 9_000),
    })

    const sanitizedBody = String(payload.bodyText ?? '')
    const sanitizedSummary = String(payload.summaryText ?? '')

    assert.equal(sanitizedBody.includes(startMarker), true)
    assert.equal(sanitizedBody.includes(endMarker), true)
    assert.equal(sanitizedBody.includes('[truncated '), true)
    assert.equal(sanitizedBody.length <= 16_000, true)
    assert.equal(sanitizedSummary.length <= 10_000, true)
    assert.equal(String(payload.rationale ?? '').length <= 8_000, true)
  })

  await run('relevant schema storage fields stay on unrestricted Prisma String columns', () => {
    const schema = read('prisma/schema.prisma')

    assert.equal(/definition\s+String\?/m.test(schema), true)
    assert.equal(/formula\s+String\?/m.test(schema), true)
    assert.equal(/summaryText\s+String\?/m.test(schema), true)
    assert.equal(/bodyText\s+String/m.test(schema), true)
    assert.equal(schema.includes('@db.VarChar(500)'), false)
  })

  await run('long-text UI fields no longer use a 500-char maxLength and are resize-friendly', () => {
    const workspaceSource = read('src/components/kpi/OrgKpiTeamAiWorkspace.tsx')
    const formSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(workspaceSource.includes('maxLength={500}'), false)
    assert.equal(formSource.includes('maxLength={500}'), false)
    assert.equal(workspaceSource.includes('resize-y'), true)
    assert.equal(formSource.includes('resize-y'), true)
  })
}

void main()
