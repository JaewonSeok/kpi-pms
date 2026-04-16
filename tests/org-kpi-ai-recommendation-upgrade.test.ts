import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { Difficulty } from '@prisma/client'
import {
  buildStrategicTeamRecommendationPayload,
  rankTeamRecommendationItems,
  sanitizeAndRankTeamRecommendationItem,
} from '../src/lib/org-kpi-team-ai-recommendation'
import { buildKpiAiPreviewDescriptor } from '../src/lib/kpi-ai-preview'

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

const repoRoot = process.cwd()
const orgClientSource = fs.readFileSync(
  path.join(repoRoot, 'src/components/kpi/OrgKpiManagementClient.tsx'),
  'utf8',
)
const aiAssistSource = fs.readFileSync(path.join(repoRoot, 'src/lib/ai-assist.ts'), 'utf8')
const previewPanelSource = fs.readFileSync(
  path.join(repoRoot, 'src/components/kpi/KpiAiPreviewPanel.tsx'),
  'utf8',
)

void (async () => {
  await run('preferred parent KPI is ranked first in strategic payload', () => {
    const payload = buildStrategicTeamRecommendationPayload({
      teamDepartment: { id: 'team-1', name: '인사팀', organizationName: 'RSUPPORT' },
      planningDepartment: { id: 'div-1', name: '경영지원본부', organizationName: 'RSUPPORT' },
      evalYear: 2026,
      businessPlan: {
        title: '2026 본부 계획',
        summaryText: '인재 확보와 운영 효율을 함께 개선',
        bodyText: '채용 리드타임과 핵심 인재 유지율을 동시에 관리한다.',
      },
      currentDraft: {
        title: '',
        category: '',
        definition: '',
        formula: '',
        unit: '%',
        weight: null,
        difficulty: 'MEDIUM',
      },
      sourceOrgKpis: [
        {
          id: 'parent-2',
          kpiName: '운영 생산성 향상',
          kpiCategory: '효율',
          definition: '업무 효율 개선',
          formula: '실적 / 목표 x 100',
          targetValueText: 'T 90 / E 100 / S 110',
          weight: 20,
          difficulty: Difficulty.MEDIUM,
        },
        {
          id: 'parent-1',
          kpiName: '핵심 인재 유지율 개선',
          kpiCategory: '인재',
          definition: '핵심 인재 유지율 제고',
          formula: '유지 인원 / 대상 인원 x 100',
          targetValueText: 'T 92 / E 95 / S 97',
          weight: 30,
          difficulty: Difficulty.HIGH,
        },
      ],
      existingTeamKpis: [],
      preferredParentOrgKpiId: 'parent-1',
    })

    assert.equal(payload.linkedParentOrgKpis[0]?.id, 'parent-1')
    assert.equal(payload.sourceOrgKpis[0]?.priorityTier, 'PRIMARY')
    assert.equal(payload.sourceOrgKpis[0]?.priorityReason.length > 0, true)
    assert.equal(payload.qualityGuardrails.length >= 3, true)
  })

  await run('sanitizer preserves linkage fields and computes quality ranking', () => {
    const item = sanitizeAndRankTeamRecommendationItem({
      item: {
        recommendedTitle: '인사팀 핵심 인재 유지율',
        recommendedDefinition: '핵심 인재 유지율을 직접 관리하는 팀 KPI',
        formula: '유지 인원 / 대상 인원 x 100',
        metricSource: 'HRIS 유지율 리포트',
        targetT: 92,
        targetE: 95,
        targetS: 97,
        unit: '%',
        difficultyLevel: 'HIGH',
        linkedParentKpiId: 'parent-1',
        linkedParentKpiTitle: '핵심 인재 유지율 개선',
        linkageReason: '본부 KPI 달성에 직접 기여한다.',
        whyThisIsHighQuality: '측정 가능성과 도전성이 높다.',
        controllabilityNote: '팀이 직접 제도와 운영을 조정할 수 있다.',
        riskNote: '시장 채용경쟁 심화 시 달성 난도가 오른다.',
      },
      sourceOrgKpis: [
        {
          id: 'parent-1',
          kpiName: '핵심 인재 유지율 개선',
          kpiCategory: '인재',
          definition: '핵심 인재 유지율 제고',
          formula: '유지 인원 / 대상 인원 x 100',
          targetValueText: 'T 92 / E 95 / S 97',
          weight: 30,
          difficulty: Difficulty.HIGH,
        },
      ],
      existingTeamKpis: [],
      rank: 1,
    })

    assert.equal(item.sourceOrgKpiId, 'parent-1')
    assert.equal(item.linkageExplanation.length > 0, true)
    assert.equal((item.alignmentScore ?? 0) > 0, true)
    assert.equal((item.qualityScore ?? 0) > 0, true)

    const ranked = rankTeamRecommendationItems([
      { ...item, title: 'B안', recommendedPriority: 2, alignmentScore: 80, qualityScore: 80 },
      { ...item, title: 'A안', recommendedPriority: 1, alignmentScore: 90, qualityScore: 88 },
    ])

    assert.equal(ranked[0]?.title, 'A안')
    assert.equal(ranked[0]?.rank, 1)
  })

  await run('org draft preview renders structured recommendation cards instead of raw JSON', () => {
    const descriptor = buildKpiAiPreviewDescriptor({
      action: 'generate-draft',
      source: 'ai',
      result: {
        title: '인사팀 핵심 인재 유지율',
        definition: '핵심 인재 유지율을 직접 관리하는 팀 KPI',
        formula: '유지 인원 / 대상 인원 x 100',
        targetValueT: 92,
        targetValueE: 95,
        targetValueS: 97,
        unit: '%',
        recommendations: [
          {
            recommendedTitle: '인사팀 핵심 인재 유지율',
            recommendedDefinition: '핵심 인재 유지율을 직접 관리하는 팀 KPI',
            formula: '유지 인원 / 대상 인원 x 100',
            metricSource: 'HRIS 유지율 리포트',
            targetT: 92,
            targetE: 95,
            targetS: 97,
            unit: '%',
            difficultyLevel: 'HIGH',
            linkedParentKpiTitle: '핵심 인재 유지율 개선',
            linkageReason: '본부 KPI 달성에 직접 기여한다.',
            whyThisIsHighQuality: '측정 가능성과 도전성이 높다.',
            controllabilityNote: '팀이 직접 제도와 운영을 조정할 수 있다.',
            riskNote: '시장 채용경쟁 심화 시 달성 난도가 오른다.',
            alignmentScore: 92,
            qualityScore: 90,
            recommendedPriority: 1,
          },
        ],
      },
    })

    assert.equal(descriptor.sections.some((section) => section.kind === 'recommendations'), true)
  })

  await run('org KPI draft payload injects strategic team recommendation context first', () => {
    assert.equal(orgClientSource.includes('buildStrategicTeamRecommendationPayload'), true)
    assert.equal(orgClientSource.includes('existingTeamKpis'), true)
    assert.equal(orgClientSource.includes('preferredParentOrgKpiId'), true)
    assert.equal(orgClientSource.includes("action !== 'generate-draft' || !pageData.teamAi?.businessPlan"), true)
  })

  await run('AI schema and prompt demand ranked high-quality linked parent KPI recommendations', () => {
    assert.equal(aiAssistSource.includes('Return exactly 3 to 5 ranked draft options'), true)
    assert.equal(aiAssistSource.includes('linkedParentKpiTitle'), true)
    assert.equal(aiAssistSource.includes('whyThisIsHighQuality'), true)
    assert.equal(aiAssistSource.includes('controllabilityNote'), true)
    assert.equal(aiAssistSource.includes('alignmentScore'), true)
    assert.equal(aiAssistSource.includes('qualityScore'), true)
  })

  await run('preview panel exposes recommendation cards with linkage and score details', () => {
    assert.equal(previewPanelSource.includes("case 'recommendations':"), true)
    assert.equal(previewPanelSource.includes('연결된 본부 KPI'), true)
    assert.equal(previewPanelSource.includes('추천 품질 점수'), true)
    assert.equal(previewPanelSource.includes('상위 KPI 정렬도'), true)
  })
})()
