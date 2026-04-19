import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  buildOrgKpiAiRecommendationDraftStatusLabel,
  buildOrgKpiAiRecommendationOptionLabel,
  buildOrgKpiAiRecommendationSourceLabel,
  buildOrgKpiFormFromAiRecommendation,
  isOrgKpiAiRecommendationDraftDirty,
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
    assert.equal(buildOrgKpiAiRecommendationSourceLabel(1), 'AI 추천안 2 기반 초안')
  })

  await run('recommendation option labels and dirty status labels use the requested Korean copy', () => {
    assert.equal(buildOrgKpiAiRecommendationOptionLabel(0), 'AI 추천안 1')
    assert.equal(buildOrgKpiAiRecommendationOptionLabel(2), 'AI 추천안 3')
    assert.equal(buildOrgKpiAiRecommendationDraftStatusLabel(1, false), 'AI 추천안 2 기반 초안')
    assert.equal(buildOrgKpiAiRecommendationDraftStatusLabel(1, true), 'AI 추천안 기반 초안 · 수정됨')

    assert.equal(
      isOrgKpiAiRecommendationDraftDirty(
        {
          deptId: 'dept-hr',
          evalYear: '2026',
          parentOrgKpiId: 'parent-1',
          kpiType: 'QUANTITATIVE',
          kpiCategory: 'AI 연계형 KPI',
          kpiName: '채용 리드타임 준수율',
          tags: 'AI추천, 연계형KPI',
          definition: '정의',
          formula: '산식',
          targetValueT: '90',
          targetValueE: '95',
          targetValueS: '100',
          unit: '%',
          weight: '20',
          difficulty: 'HIGH',
        },
        {
          deptId: 'dept-hr',
          evalYear: '2026',
          parentOrgKpiId: 'parent-1',
          kpiType: 'QUANTITATIVE',
          kpiCategory: 'AI 연계형 KPI',
          kpiName: '채용 리드타임 준수율',
          tags: 'AI추천, 연계형KPI',
          definition: '정의',
          formula: '산식',
          targetValueT: '90',
          targetValueE: '95',
          targetValueS: '100',
          unit: '%',
          weight: '20',
          difficulty: 'HIGH',
        },
      ),
      false,
    )
    assert.equal(
      isOrgKpiAiRecommendationDraftDirty(
        {
          deptId: 'dept-hr',
          evalYear: '2026',
          parentOrgKpiId: 'parent-1',
          kpiType: 'QUANTITATIVE',
          kpiCategory: 'AI 연계형 KPI',
          kpiName: '수정된 KPI명',
          tags: 'AI추천, 연계형KPI',
          definition: '정의',
          formula: '산식',
          targetValueT: '90',
          targetValueE: '95',
          targetValueS: '100',
          unit: '%',
          weight: '20',
          difficulty: 'HIGH',
        },
        {
          deptId: 'dept-hr',
          evalYear: '2026',
          parentOrgKpiId: 'parent-1',
          kpiType: 'QUANTITATIVE',
          kpiCategory: 'AI 연계형 KPI',
          kpiName: '채용 리드타임 준수율',
          tags: 'AI추천, 연계형KPI',
          definition: '정의',
          formula: '산식',
          targetValueT: '90',
          targetValueE: '95',
          targetValueS: '100',
          unit: '%',
          weight: '20',
          difficulty: 'HIGH',
        },
      ),
      true,
    )
  })

  await run('preview panel renders the requested recommendation CTA copy for initial, selected, and refill states', () => {
    const baseProps = {
      preview: {
        action: 'generate-draft',
        actionLabel: 'KPI 초안 생성',
        source: 'ai' as const,
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
            {
              recommendedTitle: '추천 KPI 2',
              recommendedDefinition: '추천 정의 2',
              category: 'AI 연계형 KPI',
              formula: '산식 2',
              metricSource: '데이터 2',
              targetT: 88,
              targetE: 92,
              targetS: 97,
              unit: '%',
              weightSuggestion: 20,
              difficultyLevel: 'MEDIUM',
              linkedParentKpiId: 'parent-2',
              linkedParentKpiTitle: '본부 KPI 2',
              linkageReason: '상위 KPI 연결 2',
              whyThisIsHighQuality: '측정 가능 2',
              controllabilityNote: '통제 가능 2',
              riskNote: '외부 리스크 2',
              alignmentScore: 90,
              qualityScore: 88,
              recommendedPriority: 2,
            },
          ],
        },
      },
      comparisons: [],
      emptyTitle: 'empty',
      emptyDescription: 'empty',
      onSelectRecommendation: () => undefined,
      recommendationActionLabel: '이 추천안으로 작성',
    }

    const initialHtml = renderToStaticMarkup(
      React.createElement(KpiAiPreviewPanel, {
        ...baseProps,
      }),
    )
    const selectedOpenHtml = renderToStaticMarkup(
      React.createElement(KpiAiPreviewPanel, {
        ...baseProps,
        selectedRecommendationIndex: 0,
        isRecommendationDraftOpen: true,
      }),
    )
    const selectedClosedHtml = renderToStaticMarkup(
      React.createElement(KpiAiPreviewPanel, {
        ...baseProps,
        selectedRecommendationIndex: 0,
        isRecommendationDraftOpen: false,
      }),
    )

    assert.equal(initialHtml.includes('이 추천안으로 작성'), true)
    assert.equal(selectedOpenHtml.includes('현재 초안에 반영됨'), true)
    assert.equal(selectedClosedHtml.includes('이 추천안으로 다시 채우기'), true)
    assert.equal(selectedOpenHtml.includes('선택됨'), true)
  })

  await run('org KPI client renders dropdown-driven recommendation switching and keeps preview state on modal close', () => {
    assert.equal(orgClientSource.includes('function handleAiRecommendationSelection(index: number)'), true)
    assert.equal(orgClientSource.includes('function requestCloseEditorModal()'), true)
    assert.equal(orgClientSource.includes('추천안 선택'), true)
    assert.equal(orgClientSource.includes('추천안을 선택해 주세요'), true)
    assert.equal(orgClientSource.includes('AI 추천안 중 하나를 선택해 초안에 반영한 뒤 필요한 내용을 수정해 저장하세요.'), true)
    assert.equal(orgClientSource.includes('다른 추천안으로 변경하시겠습니까?'), true)
    assert.equal(orgClientSource.includes('현재 수정 중인 내용이 있습니다. 다른 추천안을 선택하면 지금 입력한 내용이 새 추천안으로 덮어써집니다.'), true)
    assert.equal(orgClientSource.includes('저장하지 않은 변경 사항은 복구할 수 없습니다.'), true)
    assert.equal(orgClientSource.includes('작성 중인 초안을 닫으시겠습니까?'), true)
    assert.equal(orgClientSource.includes('현재 팝업의 입력 내용은 닫히지만, AI 추천 결과는 화면에 그대로 유지됩니다.'), true)
    assert.equal(orgClientSource.includes('다시 열어서 같은 추천안 또는 다른 추천안을 선택할 수 있습니다.'), true)
    assert.equal(orgClientSource.includes('AI 추천 결과가 유지되고 있습니다.'), true)
    assert.equal(orgClientSource.includes('팝업을 닫아도 추천안은 사라지지 않습니다. 원하는 추천안을 다시 선택해 초안으로 불러올 수 있습니다.'), true)
    assert.equal(orgClientSource.includes('setPendingAiRecommendationIndex(index)'), true)
    assert.equal(orgClientSource.includes('setShowRecommendationSwitchConfirm(true)'), true)
    assert.equal(orgClientSource.includes('setShowEditorCloseConfirm(true)'), true)
    assert.equal(orgClientSource.includes('setShowAiRecommendationRetainedNotice(true)'), true)
    assert.equal(orgClientSource.includes('recommendationOptions={canUseAiRecommendationDraftOptions ? aiPreviewRecommendations : []}'), true)
    assert.equal(orgClientSource.includes('draftSourceLabel={editorRecommendationStatusLabel}'), true)
    assert.equal(orgClientSource.includes('onClose={requestCloseEditorModal}'), true)

    const closeHandlerMatch = orgClientSource.match(/function closeEditorModal\(\)\s*\{([\s\S]*?)\n  \}/)
    assert.ok(closeHandlerMatch)
    assert.equal(closeHandlerMatch?.[1].includes('setAiPreview(null)'), false)
    assert.equal(closeHandlerMatch?.[1].includes('setSelectedAiRecommendationIndex(null)'), false)
  })

  await run('success and error copy for recommendation apply and save paths use the requested Korean text', () => {
    assert.equal(orgClientSource.includes('AI 추천안 ${index + 1}을 초안에 반영했습니다.'), true)
    assert.equal(orgClientSource.includes('조직 KPI를 저장했습니다.'), true)
    assert.equal(orgClientSource.includes('조직 KPI를 수정했습니다.'), true)
    assert.equal(orgClientSource.includes('조직 KPI 저장 중 문제가 발생했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.'), true)
    assert.equal(orgClientSource.includes('선택할 수 있는 AI 추천안이 없습니다. 먼저 추천을 생성해 주세요.'), true)
  })

  await run('generate-draft apply keeps AI preview alive by opening the primary recommendation instead of clearing preview immediately', () => {
    assert.equal(orgClientSource.includes('const primaryRecommendation = extractKpiAiPreviewRecommendations(aiPreview.result)[0]'), true)
    assert.equal(orgClientSource.includes('openAiPreviewRecommendationEditor(primaryRecommendation, 0)'), true)
  })

  await run('preview panel source contains per-recommendation write CTA wiring', () => {
    assert.equal(previewPanelSource.includes('onSelectRecommendation?: (item: KpiAiPreviewRecommendation, index: number) => void'), true)
    assert.equal(previewPanelSource.includes('recommendationActionLabel?: string'), true)
    assert.equal(previewPanelSource.includes('selectedRecommendationIndex === index'), true)
    assert.equal(previewPanelSource.includes('현재 초안에 반영됨'), true)
    assert.equal(previewPanelSource.includes('이 추천안으로 다시 채우기'), true)
  })
})()
