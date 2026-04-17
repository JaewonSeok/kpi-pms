import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  buildOrgKpiAiRecommendationSourceLabel,
  buildOrgKpiFormFromAiRecommendation,
} from '../src/lib/org-kpi-ai-recommendation-draft'
import { KpiAiPreviewPanel } from '../src/components/kpi/KpiAiPreviewPanel'

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
  const orgClientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
  const previewPanelSource = read('src/components/kpi/KpiAiPreviewPanel.tsx')

  await run('selected AI recommendation is converted into org KPI modal form defaults', () => {
    const seed = buildOrgKpiFormFromAiRecommendation(
      {
        title: '채용 리드타임 준수율',
        category: 'AI 연계형 KPI',
        definition: '핵심 채용 포지션의 목표 리드타임 준수율을 관리합니다.',
        formula: '기한 내 완료 건수 / 전체 채용 건수 x 100',
        linkedParentKpiId: 'parent-1',
        linkedParentKpiTitle: '본부 채용 운영 효율 개선',
        linkageReason: '상위 본부 KPI의 실행 지표입니다.',
        metricSource: 'ATS 채용 운영 데이터',
        targetValueT: '92',
        targetValueE: '95',
        targetValueS: '98',
        targetText: 'T 92 / E 95 / S 98 %',
        unit: '%',
        weightSuggestion: '25',
        whyThisIsHighQuality: '측정 기준과 데이터 출처가 분명합니다.',
        controllabilityNote: '팀이 직접 운영 프로세스를 개선할 수 있습니다.',
        riskNote: '채용 시장 외부 변수에 따라 일부 변동성이 있습니다.',
        difficultyLevel: 'HIGH',
        alignmentScore: '94',
        qualityScore: '91',
        recommendedPriority: '2',
      },
      2026,
      'dept-hr',
    )

    assert.deepEqual(seed, {
      deptId: 'dept-hr',
      evalYear: '2026',
      parentOrgKpiId: 'parent-1',
      kpiType: 'QUANTITATIVE',
      kpiCategory: 'AI 연계형 KPI',
      kpiName: '채용 리드타임 준수율',
      tags: 'AI추천, 연계형KPI',
      definition: '핵심 채용 포지션의 목표 리드타임 준수율을 관리합니다.',
      formula: '기한 내 완료 건수 / 전체 채용 건수 x 100',
      targetValueT: '92',
      targetValueE: '95',
      targetValueS: '98',
      unit: '%',
      weight: '25',
      difficulty: 'HIGH',
    })
    assert.equal(buildOrgKpiAiRecommendationSourceLabel(1), 'AI 추천 2 기반 초안')
  })

  await run('preview panel renders recommendation-to-modal CTA and selected badge', () => {
    const html = renderToStaticMarkup(
      React.createElement(KpiAiPreviewPanel, {
        preview: {
          action: 'generate-draft',
          actionLabel: 'KPI 초안 생성',
          source: 'ai',
          result: {
            title: '대표 KPI',
            category: 'AI 연계형 KPI',
            definition: '대표 정의',
            formula: '대표 산식',
            targetValueSuggestion: '95',
            targetValueT: 90,
            targetValueE: 95,
            targetValueS: 100,
            unit: '%',
            weightSuggestion: 25,
            difficultySuggestion: 'HIGH',
            metricSource: 'ATS',
            linkedParentKpiId: 'parent-1',
            linkedParentKpiTitle: '본부 KPI',
            linkageReason: '상위 KPI 연결',
            whyThisIsHighQuality: '측정 가능',
            controllabilityNote: '통제 가능',
            riskNote: '외부 리스크',
            reviewPoints: ['정의 확인'],
            recommendations: [
              {
                recommendedTitle: '추천 KPI 1',
                recommendedDefinition: '추천 정의 1',
                category: 'AI 연계형 KPI',
                formula: '산식 1',
                metricSource: '데이터 1',
                targetT: 90,
                targetE: 95,
                targetS: 100,
                unit: '%',
                weightSuggestion: 25,
                difficultyLevel: 'HIGH',
                linkedParentKpiId: 'parent-1',
                linkedParentKpiTitle: '본부 KPI',
                linkageReason: '상위 KPI 연결',
                whyThisIsHighQuality: '측정 가능',
                controllabilityNote: '통제 가능',
                riskNote: '외부 리스크',
                alignmentScore: 95,
                qualityScore: 92,
                recommendedPriority: 1,
              },
            ],
          },
        },
        comparisons: [],
        emptyTitle: 'empty',
        emptyDescription: 'empty',
        onSelectRecommendation: () => undefined,
        selectedRecommendationIndex: 0,
        recommendationActionLabel: '이 추천안으로 작성',
      }),
    )

    assert.equal(html.includes('이 추천안으로 작성') || html.includes('다시 이 추천안으로 작성'), true)
    assert.equal(html.includes('선택됨'), true)
  })

  await run('org KPI client opens editor from AI recommendation and keeps preview state on modal close', () => {
    assert.equal(orgClientSource.includes('function openAiPreviewRecommendationEditor('), true)
    assert.equal(orgClientSource.includes('buildOrgKpiFormFromAiRecommendation('), true)
    assert.equal(orgClientSource.includes('setSelectedAiRecommendationIndex(index)'), true)
    assert.equal(orgClientSource.includes('setEditorDraftSourceLabel(buildOrgKpiAiRecommendationSourceLabel(index))'), true)
    assert.equal(orgClientSource.includes('onSelectRecommendation='), true)
    assert.equal(orgClientSource.includes('selectedRecommendationIndex={aiAction === \'generate-draft\' ? selectedAiRecommendationIndex : null}'), true)
    assert.equal(orgClientSource.includes('draftSourceLabel={editorDraftSourceLabel}'), true)
    assert.equal(orgClientSource.includes('function closeEditorModal()'), true)
    assert.equal(orgClientSource.includes('onClose={closeEditorModal}'), true)

    const closeHandlerMatch = orgClientSource.match(/function closeEditorModal\(\)\s*\{([\s\S]*?)\n  \}/)
    assert.ok(closeHandlerMatch)
    assert.equal(closeHandlerMatch?.[1].includes('setAiPreview(null)'), false)
    assert.equal(closeHandlerMatch?.[1].includes('setSelectedAiRecommendationIndex(null)'), false)
  })

  await run('generate-draft apply keeps AI preview alive by opening the primary recommendation instead of clearing preview immediately', () => {
    assert.equal(orgClientSource.includes('const primaryRecommendation = extractKpiAiPreviewRecommendations(aiPreview.result)[0]'), true)
    assert.equal(orgClientSource.includes('openAiPreviewRecommendationEditor(primaryRecommendation, 0)'), true)
  })

  await run('preview panel source contains per-recommendation write CTA wiring', () => {
    assert.equal(previewPanelSource.includes('onSelectRecommendation?: (item: KpiAiPreviewRecommendation, index: number) => void'), true)
    assert.equal(previewPanelSource.includes('recommendationActionLabel?: string'), true)
    assert.equal(previewPanelSource.includes('selectedRecommendationIndex === index'), true)
  })
})()
