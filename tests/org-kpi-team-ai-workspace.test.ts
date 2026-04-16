import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Difficulty } from '@prisma/client'
import {
  buildDualTrackTeamRecommendationPayload,
  rankTeamRecommendationItems,
  sanitizeAndRankTeamRecommendationItem,
} from '../src/lib/org-kpi-team-ai-recommendation'

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

const serverSource = read('src/server/org-kpi-team-ai.ts')
const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
const workspaceSource = read('src/components/kpi/OrgKpiTeamAiWorkspace.tsx')
const aiAssistSource = read('src/lib/ai-assist.ts')

void (async () => {
  await run('dual-track recommendation payload keeps linked parent KPI first and includes both job descriptions', () => {
    const payload = buildDualTrackTeamRecommendationPayload({
      teamDepartment: { id: 'team-1', name: '인사팀', organizationName: 'RSUPPORT' },
      planningDepartment: { id: 'div-1', name: '경영지원본부', organizationName: 'RSUPPORT' },
      evalYear: 2026,
      businessPlan: {
        title: '2026 본부 사업계획',
        summaryText: '채용 경쟁력과 조직 건강성을 강화한다.',
        bodyText: '핵심 인재 확보와 리드타임 단축, 정착률 개선을 함께 추진한다.',
      },
      divisionJobDescription: {
        title: '경영지원본부 직무기술서',
        summaryText: '인사 전략, 운영 표준, 조직 건강성 관리',
        bodyText: '본부 차원에서 인사 운영 체계와 채용/정착 프로세스를 설계한다.',
      },
      teamJobDescription: {
        title: '인사팀 직무기술서',
        summaryText: '채용 운영, 온보딩, 인력 데이터 관리',
        bodyText: '채용 운영과 온보딩 실행, 인력 운영 지표 관리를 책임진다.',
      },
      sourceOrgKpis: [
        {
          id: 'parent-2',
          kpiName: '채용 운영 효율 개선',
          kpiCategory: '인재 확보',
          definition: '채용 운영 효율을 높인다.',
          formula: '리드타임 / 목표 x 100',
          targetValueText: 'T 90 / E 100 / S 110',
          weight: 25,
          difficulty: Difficulty.MEDIUM,
        },
        {
          id: 'parent-1',
          kpiName: '핵심 인재 확보율 개선',
          kpiCategory: '인재 확보',
          definition: '핵심 인재 확보율을 높인다.',
          formula: '채용 완료 인원 / 목표 인원 x 100',
          targetValueText: 'T 92 / E 95 / S 98',
          weight: 30,
          difficulty: Difficulty.HIGH,
        },
      ],
      existingTeamKpis: [],
      preferredParentOrgKpiId: 'parent-1',
    })

    assert.equal(payload.linkedParentOrgKpis[0]?.id, 'parent-1')
    assert.equal(payload.divisionJobDescription.title, '경영지원본부 직무기술서')
    assert.equal(payload.teamJobDescription.title, '인사팀 직무기술서')
    assert.equal(payload.alignedRecommendationRules.length >= 4, true)
    assert.equal(payload.independentRecommendationRules.length >= 4, true)
    assert.equal(payload.trendGuidance.length >= 2, true)
  })

  await run('independent recommendation sanitizer preserves job-description evidence and type metadata', () => {
    const item = sanitizeAndRankTeamRecommendationItem({
      item: {
        recommendationType: 'TEAM_INDEPENDENT',
        recommendedTitle: '인사팀 채용 리드타임 단축률',
        recommendedDefinition: '채용 오픈부터 오퍼 수락까지 걸리는 시간을 관리한다.',
        formula: '기준 리드타임 - 실제 리드타임',
        metricSource: 'ATS 채용 운영 데이터',
        targetT: 10,
        targetE: 15,
        targetS: 20,
        unit: '일',
        difficultyLevel: 'HIGH',
        recommendationReason: '팀 고유 운영 KPI가 필요하다.',
        whyThisIsHighQuality: '측정 기준과 데이터 출처가 분명하다.',
        jobDescriptionEvidence: '채용 운영과 채용 데이터 관리를 담당한다.',
        trendRationale: '운영 생산성과 후보자 경험 개선이 중요하다.',
        whyThisFitsTeamRole: '인사팀이 직접 통제 가능한 운영 지표다.',
        controllabilityNote: '팀이 프로세스와 SLA를 직접 조정할 수 있다.',
        riskNote: '채용 시장 수요 급변 시 외생 변수 영향이 있다.',
        alignmentScore: 84,
        qualityScore: 91,
        difficultyScore: 78,
        recommendedPriority: 2,
      },
      sourceOrgKpis: [],
      existingTeamKpis: [],
      rank: 2,
      recommendationType: 'TEAM_INDEPENDENT',
    })

    assert.equal(item.recommendationType, 'TEAM_INDEPENDENT')
    assert.equal(item.basedOnJobDescription, true)
    assert.equal(item.jobDescriptionEvidence?.includes('채용 운영'), true)
    assert.equal(item.whyThisFitsTeamRole?.includes('직접 통제'), true)
    assert.equal(item.difficultyScore, 78)

    const ranked = rankTeamRecommendationItems([
      { ...item, title: '독립형 B', recommendationType: 'TEAM_INDEPENDENT', alignmentScore: 88, qualityScore: 88, recommendedPriority: 2 },
      {
        ...item,
        title: '연계형 A',
        recommendationType: 'ALIGNED_WITH_DIVISION_KPI',
        sourceOrgKpiId: 'parent-1',
        sourceOrgKpiTitle: '핵심 인재 확보율 개선',
        alignmentScore: 95,
        qualityScore: 94,
        recommendedPriority: 1,
      },
    ])

    assert.equal(ranked[0]?.title, '연계형 A')
    assert.equal(ranked[0]?.rank, 1)
  })

  await run('job description route exists and server source persists dual-track recommendation and review metadata', () => {
    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/api/kpi/org/job-description/route.ts')), true)
    assert.equal(serverSource.includes('saveJobDescriptionDocument'), true)
    assert.equal(serverSource.includes('divisionJobDescription'), true)
    assert.equal(serverSource.includes('teamJobDescription'), true)
    assert.equal(serverSource.includes('recommendationType'), true)
    assert.equal(serverSource.includes('reviewType'), true)
    assert.equal(serverSource.includes('linkedParentCoverage'), true)
    assert.equal(serverSource.includes('independentKpiCoverage'), true)
  })

  await run('management client wires workspace save, recommend, adopt, and review flows', () => {
    assert.equal(clientSource.includes('OrgKpiTeamAiWorkspace'), true)
    assert.equal(clientSource.includes('/api/kpi/org/job-description'), true)
    assert.equal(clientSource.includes('/api/kpi/org/team-ai/recommend'), true)
    assert.equal(clientSource.includes('/api/kpi/org/team-ai/review'), true)
    assert.equal(clientSource.includes('/api/kpi/org/team-ai/recommendations/${pendingRecommendationDecision.itemId}/decision'), true)
    assert.equal(clientSource.includes('pendingRecommendationDecision'), true)
    assert.equal(clientSource.includes('buildFormFromTeamRecommendation'), true)
  })

  await run('workspace renders separated aligned and independent recommendation sections with review area', () => {
    assert.equal(workspaceSource.includes('연계형 팀 KPI 추천'), true)
    assert.equal(workspaceSource.includes('독립형 팀 KPI 추천'), true)
    assert.equal(workspaceSource.includes('AI 재검토 결과'), true)
    assert.equal(workspaceSource.includes('본부 직무기술서'), true)
    assert.equal(workspaceSource.includes('팀 직무기술서'), true)
    assert.equal(workspaceSource.includes('그대로 채택'), true)
    assert.equal(workspaceSource.includes('참고 신규 작성'), true)
  })

  await run('AI schemas and prompts require aligned and independent outputs plus review coverage fields', () => {
    assert.equal(aiAssistSource.includes('alignedRecommendations'), true)
    assert.equal(aiAssistSource.includes('independentRecommendations'), true)
    assert.equal(aiAssistSource.includes('TEAM_INDEPENDENT'), true)
    assert.equal(aiAssistSource.includes('ALIGNED_WITH_DIVISION_KPI'), true)
    assert.equal(aiAssistSource.includes('linkedParentCoverage'), true)
    assert.equal(aiAssistSource.includes('independentKpiCoverage'), true)
    assert.equal(aiAssistSource.includes('division and team job descriptions'), true)
  })
})()
