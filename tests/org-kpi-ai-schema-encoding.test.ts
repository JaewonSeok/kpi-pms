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

  await run('org KPI fallback result keeps Korean text readable for alignment and draft output', () => {
    const alignment = buildFallbackResult(
      AIRequestType.KPI_ASSIST,
      {
        recommendedParentId: 'parent-1',
        recommendedParentTitle: '인재 확보율 개선',
      },
      'OrgKpiAlignment',
    ) as Record<string, unknown>

    assert.equal(alignment.recommendedParentId, 'parent-1')
    assert.equal(alignment.recommendedParentTitle, '인재 확보율 개선')
    assert.equal(
      alignment.rationale,
      '조직 트리와 KPI 카테고리 기준으로 가장 자연스러운 상위 연계 후보를 정리했습니다.',
    )
    assert.deepEqual(alignment.suggestedLinks, [
      '상위 전략 KPI와의 관계를 정의 문장에 함께 적어 주세요.',
      '개인 KPI로 이어질 표현은 월간 실적 기준으로 다시 풀어 써 주세요.',
    ])

    const draft = buildFallbackResult(
      AIRequestType.KPI_ASSIST,
      {
        orgKpiName: '채용 리드타임 개선',
        kpiType: 'QUANTITATIVE',
      },
      'OrgKpiDraft',
    ) as Record<string, unknown>

    assert.equal(typeof draft.definition, 'string')
    assert.equal(String(draft.definition).includes('직접 통제 가능한 결과 지표와 선행 지표로 풀어낸 팀 KPI 초안입니다.'), true)
    assert.equal(String(draft.linkageReason).includes('직접 실행 가능한 KPI로 풀어 상위 KPI에 측정 가능하게 기여하도록 설계했습니다.'), true)
    assert.equal(Array.isArray(draft.reviewPoints), true)
  })

  await run('org KPI AI route masks raw schema/provider errors with Korean fallback message', () => {
    assert.equal(routeSource.includes('ORG_KPI_AI_PUBLIC_ERROR_MESSAGE'), true)
    assert.equal(
      routeSource.includes(
        'AI 결과 형식을 불러오는 중 문제가 발생해 기본 결과로 표시했습니다. 잠시 후 다시 시도해 주세요.',
      ),
      true,
    )
    assert.equal(routeSource.includes("error.message.includes('response_format')"), true)
    assert.equal(routeSource.includes("error.message.includes('json_schema')"), true)
    assert.equal(routeSource.includes("error.message.includes('recommendedParentId')"), true)
    assert.equal(routeSource.includes('toPublicOrgKpiFallbackReason'), true)
  })

  await run('org KPI client sanitizes fallback rendering instead of exposing raw schema errors', () => {
    assert.equal(clientSource.includes('ORG_KPI_AI_PREVIEW_ERROR_MESSAGE'), true)
    assert.equal(clientSource.includes('function toOrgKpiAiPreviewErrorMessage('), true)
    assert.equal(clientSource.includes('data.source === \'ai\' ? null : toOrgKpiAiPreviewErrorMessage(data.fallbackReason)'), true)
    assert.equal(clientSource.includes("lower.includes('response_format')"), true)
    assert.equal(clientSource.includes('toOrgKpiAiPreviewErrorMessage(error.message)'), true)
  })
})()
