/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'

const moduleLoader = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string
}

const originalResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const {
  getPerformanceDesignPageData,
} = require('../src/server/admin/performance-design') as typeof import('../src/server/admin/performance-design')
const {
  parsePerformanceDesignConfig,
  repairPerformanceDesignPersistedConfig,
} = require('../src/lib/performance-design') as typeof import('../src/lib/performance-design')
const { UpdatePerformanceDesignSchema } = require('../src/lib/validations') as typeof import('../src/lib/validations')

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function makeSession(role: string = 'ROLE_ADMIN') {
  return {
    user: {
      id: role === 'ROLE_ADMIN' ? 'admin-1' : 'member-1',
      email: role === 'ROLE_ADMIN' ? 'admin@rsupport.com' : 'member@rsupport.com',
      role,
    },
  }
}

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function assertNoBrokenKorean(source: string) {
  for (const token of ['?좉퇋', '議곗쭅', '媛쒖씤', '?깃낵', '?됯?', '鍮꾧', '쨌', '珥덉븞', '怨듭쑀']) {
    assert.equal(source.includes(token), false, `unexpected mojibake token: ${token}`)
  }
  assert.equal(source.includes('�'), false, 'replacement character should not exist')
}

async function main() {
  await run('performance design loader returns readable Korean copy and summary data', async () => {
    const data = await getPerformanceDesignPageData(
      makeSession(),
      { cycleId: 'cycle-2026' },
      {
        loadCycles: async () => [
          {
            id: 'cycle-2026',
            orgId: 'org-1',
            evalYear: 2026,
            cycleName: '2026 상반기',
            performanceDesignConfig: {
              collaborationCases: [
                {
                  id: 'case-1',
                  departmentId: 'dept-management',
                  title: '협업 BP 사례',
                  summary: '공동 프로젝트 성과 정리',
                  impact: '부서 간 프로세스 개선',
                  collaborationPartners: ['사업지원팀'],
                  evidenceNotes: '회의록 첨부',
                  submittedBy: 'leader-1',
                  status: 'SUBMITTED',
                  evaluation: {
                    impactScore: 4,
                    executionScore: 5,
                    collaborationScore: 5,
                    spreadScore: 4,
                    comment: '확산 가치가 높음',
                  },
                  highlighted: true,
                },
              ],
            },
            organization: { name: 'RSUPPORT' },
          },
          {
            id: 'cycle-2027',
            orgId: 'org-1',
            evalYear: 2027,
            cycleName: '2027 상반기',
            performanceDesignConfig: null,
            organization: { name: 'RSUPPORT' },
          },
        ],
        loadDepartments: async () => [
          { id: 'dept-management', deptName: '경영관리팀' },
          { id: 'dept-support', deptName: '사업지원팀' },
        ],
        loadOrgKpis: async () => [
          {
            id: 'org-kpi-1',
            deptId: 'dept-management',
            evalYear: 2026,
            kpiType: 'QUANTITATIVE',
            kpiName: '예산 집행 절감',
            definition: '연간 예산 절감 목표 달성',
            formula: '절감액 / 계획 예산',
            targetValue: 100,
            unit: '%',
            weight: 35,
            department: { deptName: '경영관리팀' },
          },
          {
            id: 'org-kpi-2',
            deptId: 'dept-support',
            evalYear: 2026,
            kpiType: 'QUALITATIVE',
            kpiName: '현장 지원 만족도 개선',
            definition: '내부 고객 만족도 향상',
            formula: null,
            targetValue: null,
            unit: null,
            weight: 20,
            department: { deptName: '사업지원팀' },
          },
        ],
        loadPersonalKpis: async () => [
          {
            id: 'pk-1',
            employeeId: 'emp-1',
            evalYear: 2026,
            kpiType: 'QUANTITATIVE',
            kpiName: '예산 집행 정확도',
            definition: '예산 대비 집행 오차 최소화',
            formula: '1 - 오차율',
            targetValue: 95,
            unit: '%',
            weight: 20,
            linkedOrgKpiId: 'org-kpi-1',
            employee: {
              empName: '관리자',
              deptId: 'dept-management',
              department: { deptName: '경영관리팀' },
            },
          },
          {
            id: 'pk-2',
            employeeId: 'emp-2',
            evalYear: 2026,
            kpiType: 'QUALITATIVE',
            kpiName: '지원 정책 운영',
            definition: '현장 지원 프로세스 개선 주도',
            formula: null,
            targetValue: null,
            unit: null,
            weight: 20,
            linkedOrgKpiId: 'org-kpi-2',
            employee: {
              empName: '지원담당자',
              deptId: 'dept-support',
              department: { deptName: '사업지원팀' },
            },
          },
        ],
        loadEvaluations: async () => [
          {
            items: [
              { personalKpiId: 'pk-1', quantScore: 98, qualScore: null, weightedScore: 98 },
              { personalKpiId: 'pk-2', quantScore: null, qualScore: 96, weightedScore: 96 },
            ],
          },
          {
            items: [
              { personalKpiId: 'pk-1', quantScore: 99, qualScore: null, weightedScore: 99 },
              { personalKpiId: 'pk-2', quantScore: null, qualScore: 97, weightedScore: 97 },
            ],
          },
        ],
      }
    )

    assert.equal(data.state, 'ready')
    assert.equal(data.selectedCycleId, 'cycle-2026')
    assert.equal(data.selectedCycleName, '2026년 · 2026 상반기')
    assert.equal(data.cycleOptions[0]?.label, '2026년 · RSUPPORT · 2026 상반기')
    assert.equal(data.nextCycleId, 'cycle-2027')
    assert.equal(data.evaluationGroups.length >= 4, true)
    assert.equal(data.indicators.length >= 4, true)
    assert.equal(data.indicators.some((indicator) => indicator.sourceLabel === '조직 KPI'), true)
    assert.equal(data.indicators.some((indicator) => indicator.sourceLabel === '개인 KPI'), true)
    assert.equal(data.indicators.some((indicator) => indicator.ownerLabel?.includes('조직 KPI')), true)
    assert.equal(data.indicators.some((indicator) => indicator.ownerLabel?.includes('개인 KPI')), true)
    assert.equal(data.indicators.every((indicator) => indicator.matrixScore >= 0), true)
    assert.equal(data.nonQuantitativeTemplateBindings.length >= data.evaluationGroups.length, true)
    assert.equal(data.collaborationCases[0]?.title, '협업 BP 사례')
    assert.equal(data.healthFindings.length >= 1, true)
    assert.equal(data.summary.indicatorCount, data.indicators.length)
  })

  await run('performance design returns empty state when no cycle exists', async () => {
    const data = await getPerformanceDesignPageData(makeSession(), {}, {
      loadCycles: async () => [],
      loadDepartments: async () => [{ id: 'dept-1', deptName: '경영관리팀' }],
      loadOrgKpis: async () => [],
      loadPersonalKpis: async () => [],
      loadEvaluations: async () => [],
    })

    assert.equal(data.state, 'empty')
    assert.equal(data.message, '성과 설계를 적용할 평가 사이클이 없습니다. 먼저 평가 사이클을 생성해 주세요.')
    assert.equal(data.cycleOptions.length, 0)
    assert.equal(data.evaluationGroups.length > 0, true)
    assert.equal(data.summary.indicatorCount, 0)
    assert.equal(data.departments.length, 1)
  })

  await run('performance design blocks non-admin access safely', async () => {
    const data = await getPerformanceDesignPageData(makeSession('ROLE_MEMBER'))

    assert.equal(data.state, 'permission-denied')
    assert.equal(data.message, '관리자 권한이 필요합니다.')
    assert.equal(data.cycleOptions.length, 0)
    assert.equal(data.indicators.length, 0)
  })

  await run('performance design schema accepts Korean payloads', () => {
    const parsed = UpdatePerformanceDesignSchema.safeParse({
      config: {
        evaluationGroups: [
          {
            id: 'group-management',
            name: '경영관리군',
            description: '관리 직무 조직 비교군',
            quantitativeWeight: 60,
            qualitativeWeight: 40,
            comparisonMode: 'WITHIN_GROUP',
            comparisonTargetLabel: '군 내 비교',
            departmentIds: ['dept-management'],
          },
        ],
        indicatorDesigns: [
          {
            key: 'MANUAL:indicator-1',
            source: 'MANUAL',
            name: '신규 전략 KPI',
            metricType: 'QUANTITATIVE',
            departmentId: 'dept-management',
            departmentName: '경영관리팀',
            ownerLabel: '관리자',
            evaluationGroupId: 'group-management',
            strategicAlignmentScore: 5,
            jobRepresentativenessScore: 4,
            smartDiagnosis: {
              specific: 4,
              measurable: 4,
              achievable: 4,
              relevant: 5,
              timeBound: 4,
              total: 21,
              note: 'SMART 진단 통과',
            },
            selectionStatus: 'KEEP',
            lifecycleAction: 'KEEP',
            departmentComment: '유지 의견',
            managerComment: '차년도도 유지',
            evidenceTemplate: '실적, 증빙, 개선 계획',
            pageLimit: 4,
            rolloverHistory: [],
          },
        ],
        selectionMatrix: {
          strategicWeight: 30,
          jobWeight: 30,
          smartWeight: 40,
          keepThreshold: 80,
          holdThreshold: 65,
          improveThreshold: 45,
        },
        nonQuantitativeTemplate: {
          name: 'PDCA 템플릿',
          guidance: 'PDCA 순서대로 기술',
          reportFormat: '실적 개요 > PDCA > 차년도 보완',
          pageLimit: 5,
          sections: [
            {
              id: 'section-plan',
              title: 'Plan',
              focusPoint: '목표 배경',
              checklist: ['목표와 기준 명시'],
            },
          ],
          allowInternalEvidence: true,
          evidenceGuide: ['회의록', '실적 보고서'],
        },
        nonQuantitativeTemplateBindings: [
          {
            id: 'binding-1',
            evaluationGroupId: 'group-management',
            pageMin: 1,
            pageMax: 2,
            guidanceOverride: 'guide override',
            reportFormatOverride: 'format override',
            evidenceGuideOverride: ['evidence-1'],
          },
        ],
        milestones: [
          {
            id: 'milestone-goal',
            key: 'GOAL_FINALIZED',
            label: '목표 확정',
            ownerRole: 'MANAGER',
            startAt: '2026-01-03T00:00:00.000Z',
            endAt: '2026-01-10T00:00:00.000Z',
            description: '조직 KPI 목표 확정',
          },
        ],
        collaborationCases: [
          {
            id: 'case-1',
            departmentId: 'dept-management',
            title: '협업 BP 사례',
            summary: '공동 프로젝트',
            impact: '프로세스 개선',
            collaborationPartners: ['사업지원팀'],
            evidenceNotes: '회의록 첨부',
            submittedBy: 'leader-1',
            status: 'DRAFT',
            evaluation: {
              impactScore: 4,
              executionScore: 4,
              collaborationScore: 5,
              spreadScore: 4,
              comment: '우수 사례',
            },
            highlighted: false,
          },
        ],
        environmentAdjustment: {
          enabled: true,
          effortGuide: '노력도 가이드',
          targetAdjustmentGuide: '목표 조정 가이드',
          fallbackIndicators: ['대체지표 A'],
        },
      },
    })

    assert.equal(parsed.success, true)
  })

  await run('performance design repairs known mojibake values from saved config', () => {
    const repairedPersisted = repairPerformanceDesignPersistedConfig({
      indicatorDesigns: [
        {
          key: 'MANUAL:indicator-1',
          source: 'MANUAL',
          name: '?좉퇋 吏???꾨낫',
          metricType: 'QUANTITATIVE',
          strategicAlignmentScore: 3,
          jobRepresentativenessScore: 3,
          selectionStatus: 'NEW',
          lifecycleAction: 'NEW',
          ownerLabel: '관리자 議곗쭅 KPI',
          departmentComment: '',
          managerComment: '',
          evidenceTemplate: '吏???뺤쓽, ?쒖텧 洹쇨굅, ?댁쁺 由ъ뒪?? 媛쒖꽑 諛⑹븞',
          pageLimit: 5,
          rolloverHistory: [],
        },
      ],
      nonQuantitativeTemplate: {
        name: 'PDCA 기반 비계량 평가 템플릿',
        guidance: '정성 성과는 계획-실행-점검-개선의 흐름을 기준으로 작성합니다.',
        reportFormat: '실적 개요 → PDCA 서술 → 증빙 첨부',
        pageLimit: 5,
        sections: [
          {
            id: 'section-1',
            title: '?좉퇋 ?됯? ??ぉ',
            focusPoint: '핵심 관찰 내용',
            checklist: ['항목 1'],
          },
        ],
        allowInternalEvidence: true,
        evidenceGuide: ['회의록'],
      },
      collaborationCases: [
        {
          id: 'case-1',
          departmentId: 'dept-1',
          title: '?곗닔 ?묒뾽?щ?',
          summary: '협업 요약',
          impact: '성과 영향',
          collaborationPartners: ['지원팀'],
          evidenceNotes: '첨부',
          submittedBy: 'leader-1',
          status: 'DRAFT',
          evaluation: {
            impactScore: 3,
            executionScore: 3,
            collaborationScore: 3,
            spreadScore: 3,
            comment: '',
          },
          highlighted: false,
        },
      ],
    })

    const repaired = parsePerformanceDesignConfig({
      indicatorDesigns: [
        {
          key: 'MANUAL:indicator-1',
          source: 'MANUAL',
          name: '?좉퇋 吏???꾨낫',
          metricType: 'QUANTITATIVE',
          strategicAlignmentScore: 3,
          jobRepresentativenessScore: 3,
          selectionStatus: 'NEW',
          lifecycleAction: 'NEW',
          ownerLabel: '관리자 議곗쭅 KPI',
          departmentComment: '',
          managerComment: '',
          evidenceTemplate: '吏???뺤쓽, ?쒖텧 洹쇨굅, ?댁쁺 由ъ뒪?? 媛쒖꽑 諛⑹븞',
          pageLimit: 5,
          rolloverHistory: [],
        },
      ],
      nonQuantitativeTemplate: {
        name: 'PDCA 기반 비계량 평가 템플릿',
        guidance: '정성 성과는 계획-실행-점검-개선의 흐름을 기준으로 작성합니다.',
        reportFormat: '실적 개요 → PDCA 서술 → 증빙 첨부',
        pageLimit: 5,
        sections: [
          {
            id: 'section-1',
            title: '?좉퇋 ?됯? ??ぉ',
            focusPoint: '핵심 관찰 내용',
            checklist: ['항목 1'],
          },
        ],
        allowInternalEvidence: true,
        evidenceGuide: ['회의록'],
      },
      collaborationCases: [
        {
          id: 'case-1',
          departmentId: 'dept-1',
          title: '?곗닔 ?묒뾽?щ?',
          summary: '협업 요약',
          impact: '성과 영향',
          collaborationPartners: ['지원팀'],
          evidenceNotes: '첨부',
          submittedBy: 'leader-1',
          status: 'DRAFT',
          evaluation: {
            impactScore: 3,
            executionScore: 3,
            collaborationScore: 3,
            spreadScore: 3,
            comment: '',
          },
          highlighted: false,
        },
      ],
    })

    assert.equal(repairedPersisted.indicatorDesigns[0]?.name, '신규 지표 후보')
    assert.equal(repairedPersisted.indicatorDesigns[0]?.ownerLabel, '관리자 조직 KPI')
    assert.equal(repairedPersisted.indicatorDesigns[0]?.evidenceTemplate, '지표 정의, 제출 근거, 운영 리스크, 개선 방안')
    assert.equal(repairedPersisted.nonQuantitativeTemplate.sections[0]?.title, '신규 평가 항목')
    assert.equal(repairedPersisted.collaborationCases[0]?.title, '협업 BP 사례')
    assert.equal(repaired.indicatorDesigns[0]?.name, '신규 지표 후보')
    assert.equal(repaired.indicatorDesigns[0]?.ownerLabel, '관리자 조직 KPI')
    assert.equal(repaired.indicatorDesigns[0]?.evidenceTemplate, '지표 정의, 제출 근거, 운영 리스크, 개선 방안')
    assert.equal(repaired.nonQuantitativeTemplate.sections[0]?.title, '신규 평가 항목')
    assert.equal(repaired.collaborationCases[0]?.title, '협업 BP 사례')
    assert.equal(repaired.indicatorDesigns[0]?.smartDiagnosis?.note ?? '현행 KPI로 유지 권장', '현행 KPI로 유지 권장')
  })

  await run('performance design client and server sources keep readable Korean and save normalization wiring', () => {
    const clientSource = read('src/components/admin/PerformanceDesignClient.tsx')
    const serverSource = read('src/server/admin/performance-design.ts')
    const routeSource = read('src/app/api/admin/performance-design/[cycleId]/route.ts')
    const repairScriptSource = read('scripts/repair-performance-design-korean.ts')
    const navigationSource = read('src/lib/navigation.ts')
    const permissionsSource = read('src/lib/auth/permissions.ts')

    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/(main)/admin/performance-design/page.tsx')), true)
    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/api/admin/performance-design/[cycleId]/route.ts')), true)
    assert.equal(
      existsSync(path.resolve(process.cwd(), 'src/app/api/admin/performance-design/[cycleId]/rollover/route.ts')),
      true
    )

    assert.equal(clientSource.includes('성과 설계'), true)
    assert.equal(
      clientSource.includes('평가군, KPI Pool, SMART 진단, 비계량 지표, 협업 BP 사례, 건강도 이상 징후를 설계합니다.'),
      true
    )
    assert.equal(clientSource.includes('평가군 설정'), true)
    assert.equal(clientSource.includes('KPI Pool / SMART 진단 및 우선순위 설계'), true)
    assert.equal(clientSource.includes('지표명, 부서, 담당자로 검색'), true)
    assert.equal(clientSource.includes('설계 저장'), true)
    assert.equal(clientSource.includes('평가군을 선택해 주세요'), true)
    assert.equal(clientSource.includes('비교 기준을 선택해 주세요'), true)
    assert.equal(clientSource.includes('비계량 평가 항목 추가'), true)
    assert.equal(serverSource.includes('일부 설계 정보를 불러오지 못해 기본값으로 표시합니다.'), true)
    assert.equal(serverSource.includes('조직 KPI'), true)
    assert.equal(serverSource.includes('개인 KPI'), true)
    assert.equal(serverSource.includes('2026년') || serverSource.includes('년 ·'), true)
    assert.equal(routeSource.includes('repairPerformanceDesignPersistedConfig(validated.data.config)'), true)
    assert.equal(repairScriptSource.includes('repairPerformanceDesignPersistedConfig(cycle.performanceDesignConfig)'), true)
    assert.equal(navigationSource.includes('/admin/performance-design'), true)
    assert.equal(permissionsSource.includes('/api/admin/performance-design'), true)

    assertNoBrokenKorean(clientSource)
    assertNoBrokenKorean(serverSource)
  })

  console.log('Performance design tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
