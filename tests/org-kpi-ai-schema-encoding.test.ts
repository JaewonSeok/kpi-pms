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
  // CRLF -> LF 정규화: 어서션 리터럴이 \n만 쓰므로 Windows 체크아웃에서도 매치되도록 통일.
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n')
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

    // 필수 필드 — 포맷/들여쓰기 무관하게 키 목록 자체로 검증 (refactor에 강건)
    // 필드명 변경: recommendedTitle/Definition → title/definition (linkage 필드는 별도로 retain)
    for (const key of [
      'title',
      'category',
      'definition',
      'formula',
      'targetValueT',
      'targetValueE',
      'targetValueS',
      'linkedParentKpiId',
      'linkedParentKpiTitle',
      'linkageReason',
    ]) {
      assert.equal(schema.includes(`'${key}'`), true, `schema missing required key '${key}'`)
    }
    // linkedParentKpiId만 nullable (없으면 alignment 추천 자체가 없는 경우);
    // linkedParentKpiTitle은 string 필수 (id 있으면 title도 함께)
    assert.equal(schema.includes("linkedParentKpiId: { type: ['string', 'null'] }"), true)
    assert.equal(schema.includes("linkedParentKpiTitle: { type: 'string' }"), true)
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

  // 'org KPI client sanitizes fallback rendering...' 테스트는 제거됨.
  // sanitization은 라우트(`/api/kpi/org/ai/route.ts`)로 이관 (d6ef019)되었고,
  // fae26b0에서 클라 측 sanitization 식별자가 일괄 삭제되어 invariant가 없다.
  // 라우트 측 책임은 바로 위 테스트 "org KPI AI route masks raw schema/provider errors..."가 검증.

  await run('org KPI AI server emits typed schema and fallback logs for exact failure-step tracing', () => {
    assert.equal(aiAssistSource.includes('ORG_KPI_AI_SCHEMA_VALIDATE_START'), true)
    assert.equal(aiAssistSource.includes('ORG_KPI_AI_SCHEMA_VALIDATE_FAILED'), true)
    assert.equal(aiAssistSource.includes('ORG_KPI_AI_PROVIDER_PARSE_FAILED'), true)
    assert.equal(aiAssistSource.includes('ORG_KPI_AI_FALLBACK_USED'), true)
    assert.equal(aiAssistSource.includes('AI_SCHEMA_VALIDATION_ERROR'), true)
  })
})()
