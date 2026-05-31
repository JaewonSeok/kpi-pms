import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

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

void (async () => {
  const { AIRequestType } = await import('@prisma/client')
  const { buildFallbackResult } = await import('../src/lib/ai-assist')
  const { KpiAiPreviewPanel } = await import('../src/components/kpi/KpiAiPreviewPanel')

  const previewPanelSource = read('src/components/kpi/KpiAiPreviewPanel.tsx')
  const orgClientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
  const workspaceSource = read('src/components/kpi/OrgKpiTeamAiWorkspace.tsx')
  const aiAssistSource = read('src/lib/ai-assist.ts')

  await run('fallback preview renders guidance instead of fake recommendation cards', () => {
    const html = renderToStaticMarkup(
      React.createElement(KpiAiPreviewPanel, {
        preview: {
          action: 'generate-draft',
          actionLabel: 'AI draft',
          source: 'fallback',
          fallbackReason: 'AI fallback message',
          result: {
            recommendations: [
              {
                recommendedTitle: 'Parent KPI 1 execution outcome',
                recommendedDefinition: 'execution outcome ...',
                formula: 'Actual / Target x 100',
                linkedParentKpiTitle: 'Parent KPI 1',
                linkageReason: 'temporary fallback text',
                metricSource: 'team operational result data',
                whyThisIsHighQuality: 'temporary score',
                controllabilityNote: 'temporary controllability note',
                riskNote: 'temporary risk note',
              },
            ],
          },
        },
        emptyTitle: 'empty',
        emptyDescription: 'empty',
        onRetry: () => undefined,
        retryLabel: 'retry',
        onApprove: () => undefined,
        onReject: () => undefined,
        approveLabel: 'approve',
        rejectLabel: 'reject',
      }),
    )

    assert.equal(html.length > 0, true)
    assert.equal(html.includes('Parent KPI 1 execution outcome'), false)
    assert.equal(html.includes('execution outcome ...'), false)
    assert.equal(html.includes('temporary fallback text'), false)
    assert.equal(html.includes('team operational result data'), false)
    assert.equal(html.includes('approve'), false)
    assert.equal(html.includes('reject'), false)
  })

  await run('org KPI draft fallback result is minimal and no longer contains fake recommendation cards', () => {
    const fallback = buildFallbackResult(
      AIRequestType.KPI_ASSIST,
      {
        teamDepartment: { name: '인사팀' },
        sourceOrgKpis: [{ id: 'parent-1', title: '채용 리드타임 개선', formula: '실적 / 목표 x 100' }],
      },
      'OrgKpiDraft',
    ) as Record<string, unknown>

    assert.equal(Array.isArray(fallback.recommendations), false)
    assert.equal(String(fallback.metricSource ?? '').includes('operational result data'), false)
    assert.equal(String(fallback.title ?? '').includes('Parent KPI'), false)
    assert.equal(fallback.linkedParentKpiTitle, '채용 리드타임 개선')
  })

  await run('org KPI fallback path wires retry handling and state-mode logging', () => {
    // KpiAiPreviewPanel: 비-AI 소스(=fallback) 분기 + FallbackStatePanel 사용 + onRetry prop 노출
    assert.equal(previewPanelSource.includes("if (props.preview.source !== 'ai')"), true)
    assert.equal(previewPanelSource.includes('<FallbackStatePanel'), true)
    assert.equal(previewPanelSource.includes('onRetry?: () => void'), true)
    // OrgKpiTeamAiWorkspace로 result-mode 로깅이 통합됨 (이전엔 client에 분산)
    // 모든 결과 모드 enum이 워크스페이스에서 정의되고 로그 호출도 모두 여기.
    assert.equal(workspaceSource.includes("'ORG_KPI_AI_RESULT_MODE_NORMAL'"), true)
    assert.equal(workspaceSource.includes("'ORG_KPI_AI_RESULT_MODE_TRUE_FALLBACK'"), true)
    assert.equal(workspaceSource.includes('ORG_KPI_AI_RESULT_MODE_BUSINESS_PLAN_EMPTY'), true)
    assert.equal(workspaceSource.includes('ORG_KPI_AI_RESULT_MODE_RECOMMENDATION_EMPTY'), true)
    assert.equal(workspaceSource.includes('ORG_KPI_AI_RESULT_MODE_REVIEW_EMPTY'), true)
    // 워크스페이스는 runtime fallback 재시도 핸들러를 prop으로 받아 위임
    assert.equal(workspaceSource.includes('onRetryRuntimeFallback: () => void'), true)
  })

  await run('english placeholder fallback strings are removed from the org KPI fallback generator', () => {
    assert.equal(aiAssistSource.includes('Parent KPI ${index + 1}'), false)
    assert.equal(aiAssistSource.includes('operational result data'), false)
    assert.equal(aiAssistSource.includes('Strategic execution'), false)
  })
})()
