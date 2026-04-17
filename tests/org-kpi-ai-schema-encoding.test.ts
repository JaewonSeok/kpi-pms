import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'
process.env.AI_FEATURE_ENABLED = 'false'

function run(name: string, fn: () => void | Promise<void>) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`)
    })
    .catch((error) => {
      console.error(`FAIL ${name}`)
      console.error(error)
      process.exitCode = 1
    })
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function extractSchemaBlock(source: string, schemaName: string) {
  const pattern = new RegExp(`const ${schemaName} = \\{[\\s\\S]*?\\n\\} satisfies JsonRecord`)
  return source.match(pattern)?.[0] ?? ''
}

void (async () => {
  const { AIRequestType } = await import('@prisma/client')
  const { buildFallbackResult } = await import('../src/lib/ai-assist')

  const aiAssistSource = read('src/lib/ai-assist.ts')
  const routeSource = read('src/app/api/kpi/org/ai/route.ts')
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  await run('org_kpi_alignment schema satisfies strict required/property parity', () => {
    const schema = extractSchemaBlock(aiAssistSource, 'ORG_KPI_ALIGNMENT_SCHEMA')

    assert.equal(
      schema.includes(
        "required: [\n    'recommendedParentId',\n    'recommendedParentTitle',\n    'riskLevel',\n    'rationale',\n    'suggestedLinks',\n  ]",
      ),
      true,
    )
    assert.equal(schema.includes("recommendedParentId: { type: ['string', 'null'] }"), true)
    assert.equal(schema.includes("recommendedParentTitle: { type: ['string', 'null'] }"), true)
  })

  await run('org_kpi_draft schema satisfies strict required/property parity for fallback-free structured output', () => {
    const schema = extractSchemaBlock(aiAssistSource, 'ORG_KPI_DRAFT_SCHEMA')

    assert.equal(schema.includes("'targetValueT'"), true)
    assert.equal(schema.includes("'targetValueE'"), true)
    assert.equal(schema.includes("'targetValueS'"), true)
    assert.equal(schema.includes("'linkedParentKpiId'"), true)
    assert.equal(
      schema.includes(
        "required: [\n          'recommendedTitle',\n          'recommendedDefinition',\n          'category',\n          'formula',",
      ),
      true,
    )
    assert.equal(schema.includes("linkedParentKpiId: { type: ['string', 'null'] }"), true)
  })

  await run('org KPI fallback result keeps readable strings and does not leak placeholder cards', () => {
    const alignment = buildFallbackResult(
      AIRequestType.KPI_ASSIST,
      {
        recommendedParentId: 'parent-1',
        recommendedParentTitle: '상위 KPI',
      },
      'OrgKpiAlignment',
    ) as Record<string, unknown>

    assert.equal(alignment.recommendedParentId, 'parent-1')
    assert.equal(alignment.recommendedParentTitle, '상위 KPI')
    assert.equal(typeof alignment.rationale, 'string')
    assert.equal(Array.isArray(alignment.suggestedLinks), true)

    const draft = buildFallbackResult(
      AIRequestType.KPI_ASSIST,
      {
        orgKpiName: '채용 리드타임 개선',
        kpiType: 'QUANTITATIVE',
      },
      'OrgKpiDraft',
    ) as Record<string, unknown>

    assert.equal(typeof draft.definition, 'string')
    assert.equal(typeof draft.linkageReason, 'string')
    assert.equal(String(draft.definition).length > 10, true)
    assert.equal(String(draft.linkageReason).length > 10, true)
    assert.equal(String(draft.definition).includes('Parent KPI'), false)
    assert.equal(String(draft.linkageReason).includes('execution outcome'), false)
    assert.equal(Array.isArray(draft.reviewPoints), true)
  })

  await run('org KPI AI route masks raw schema/provider errors with Korean fallback message', () => {
    assert.equal(routeSource.includes('ORG_KPI_AI_PUBLIC_ERROR_MESSAGE'), true)
    assert.equal(routeSource.includes("error.message.includes('response_format')"), true)
    assert.equal(routeSource.includes("error.message.includes('json_schema')"), true)
    assert.equal(routeSource.includes("error.message.includes('recommendedParentId')"), true)
    assert.equal(routeSource.includes('toPublicOrgKpiFallbackReason'), true)
  })

  await run('org KPI client sanitizes fallback rendering instead of exposing raw schema errors', () => {
    assert.equal(clientSource.includes('ORG_KPI_AI_PREVIEW_ERROR_MESSAGE'), true)
    assert.equal(clientSource.includes('function toOrgKpiAiPreviewErrorMessage('), true)
    assert.equal(clientSource.includes("data.source === 'ai' ? null : toOrgKpiAiPreviewErrorMessage(data.fallbackReason)"), true)
    assert.equal(clientSource.includes("lower.includes('response_format')"), true)
    assert.equal(clientSource.includes('toOrgKpiAiPreviewErrorMessage(error.message)'), true)
  })

  await run('org KPI AI server emits typed schema and fallback logs for exact failure-step tracing', () => {
    assert.equal(aiAssistSource.includes('ORG_KPI_AI_SCHEMA_VALIDATE_START'), true)
    assert.equal(aiAssistSource.includes('ORG_KPI_AI_SCHEMA_VALIDATE_FAILED'), true)
    assert.equal(aiAssistSource.includes('ORG_KPI_AI_PROVIDER_PARSE_FAILED'), true)
    assert.equal(aiAssistSource.includes('ORG_KPI_AI_FALLBACK_USED'), true)
    assert.equal(aiAssistSource.includes('AI_SCHEMA_VALIDATION_ERROR'), true)
  })
})()
