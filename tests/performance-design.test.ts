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

async function main() {
  await run('performance design loader builds groups, KPI pool, matrix recommendations, and health findings', async () => {
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
                  title: '협업 우수 사례',
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
            formula: '절감액 / 계획 절감액',
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
            definition: '내부 고객 관점의 지원 만족도 개선',
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
            definition: '현장 지원 프로세스 개선 활동',
            formula: null,
            targetValue: null,
            unit: null,
            weight: 20,
            linkedOrgKpiId: 'org-kpi-2',
            employee: {
              empName: '지원담당',
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
    assert.equal(data.cycleOptions.length, 2)
    assert.equal(data.nextCycleId, 'cycle-2027')
    assert.equal(data.evaluationGroups.length >= 4, true)
    assert.equal(data.indicators.length >= 4, true)
    assert.equal(data.indicators.some((indicator) => indicator.sourceLabel === '조직 KPI'), true)
    assert.equal(data.indicators.some((indicator) => indicator.sourceLabel === '개인 KPI'), true)
    assert.equal(data.indicators.every((indicator) => indicator.matrixScore >= 0), true)
    assert.equal(data.selectionMatrix.smartWeight > 0, true)
    assert.equal(data.nonQuantitativeTemplateBindings.length >= data.evaluationGroups.length, true)
    assert.equal(data.indicators.some((indicator) => indicator.autoRecommendation.length > 0), true)
    assert.equal(data.indicators.some((indicator) => indicator.nonQuantTemplateRange !== ''), true)
    assert.equal(data.collaborationCases.length, 1)
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
    assert.equal(data.cycleOptions.length, 0)
    assert.equal(data.evaluationGroups.length > 0, true)
    assert.equal(data.summary.indicatorCount, 0)
    assert.equal(data.departments.length, 1)
  })

  await run('performance design blocks non-admin access safely', async () => {
    const data = await getPerformanceDesignPageData(makeSession('ROLE_MEMBER'))

    assert.equal(data.state, 'permission-denied')
    assert.equal(data.cycleOptions.length, 0)
    assert.equal(data.indicators.length, 0)
  })

  await run('performance design schema accepts matrix and template binding payloads', () => {
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
            managerComment: '차년도 유지',
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
            title: '협업 우수 사례',
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
              comment: '우수',
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

  await run('performance design page, routes, permissions, and client sections are wired', () => {
    const clientSource = read('src/components/admin/PerformanceDesignClient.tsx')
    const navigationSource = read('src/lib/navigation.ts')
    const permissionsSource = read('src/lib/auth/permissions.ts')

    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/(main)/admin/performance-design/page.tsx')), true)
    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/api/admin/performance-design/[cycleId]/route.ts')), true)
    assert.equal(
      existsSync(path.resolve(process.cwd(), 'src/app/api/admin/performance-design/[cycleId]/rollover/route.ts')),
      true
    )
    assert.equal(navigationSource.includes('/admin/performance-design'), true)
    assert.equal(permissionsSource.includes('/api/admin/performance-design'), true)
    assert.equal(clientSource.includes('updateSelectionMatrix('), true)
    assert.equal(clientSource.includes('nonQuantitativeTemplateBindings.find('), true)
    assert.equal(clientSource.includes('Matrix '), true)
    assert.equal(clientSource.includes('draft.evaluationGroups.map'), true)
    assert.equal(clientSource.includes('buildIndicatorInsight('), true)
    assert.equal(clientSource.includes('selectedRolloverKeys'), true)
    assert.equal(clientSource.includes('draft.nonQuantitativeTemplate.sections.map'), true)
    assert.equal(clientSource.includes('draft.collaborationCases.map'), true)
    assert.equal(clientSource.includes('data.healthFindings.map'), true)
    assert.equal(clientSource.includes('draft.environmentAdjustment.enabled'), true)
  })

  console.log('Performance design tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
