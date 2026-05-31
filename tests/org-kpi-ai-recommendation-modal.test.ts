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

  await run('org KPI client no longer mounts the dropdown-driven recommendation switching modal directly', () => {
    // org KPI 클라엔 AI 드롭다운 모달 없음 — fae26b0("ai 탭 삭제")의 의도 제거, 재부착 방지.
    // 추천 → 폼 변환 contract는 lib(`org-kpi-ai-recommendation-draft`)의 helper로 보존되며
    // 본 파일 상단의 buildOrgKpiFormFromAiRecommendation 등 PASS 케이스가 검증한다.
    // (Personal KPI는 별도 컴포넌트로 분리 — 본 invariant는 org client에만 적용.)
    assert.equal(orgClientSource.includes('handleAiRecommendationSelection'), false)
    assert.equal(orgClientSource.includes('setShowRecommendationSwitchConfirm'), false)
    assert.equal(orgClientSource.includes('setShowEditorCloseConfirm'), false)
    assert.equal(orgClientSource.includes('setPendingAiRecommendationIndex'), false)
    assert.equal(orgClientSource.includes('recommendationOptions={canUseAiRecommendationDraftOptions'), false)
  })

  // 이하 두 테스트는 제거됨 (pure absent, invariant 없음):
  // - 'client no longer carries the inline recommendation apply/save Korean copy'
  // - 'client no longer auto-opens the primary recommendation editor on generate-draft'
  // 드롭다운 모달 부재가 이미 위 invariant로 보장되므로 부수 식별자의 absent 어서션은
  // 회귀 가드 가치가 낮다.

  await run('preview panel source contains per-recommendation write CTA wiring', () => {
    assert.equal(previewPanelSource.includes('onSelectRecommendation?: (item: KpiAiPreviewRecommendation, index: number) => void'), true)
    assert.equal(previewPanelSource.includes('recommendationActionLabel?: string'), true)
    assert.equal(previewPanelSource.includes('selectedRecommendationIndex === index'), true)
    assert.equal(previewPanelSource.includes('현재 초안에 반영됨'), true)
    assert.equal(previewPanelSource.includes('이 추천안으로 다시 채우기'), true)
  })
})()
