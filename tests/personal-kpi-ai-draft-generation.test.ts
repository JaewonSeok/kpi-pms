import 'dotenv/config'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AIRequestStatus } from '@prisma/client'
import './register-path-aliases'
import { AppError } from '../src/lib/utils'
import {
  buildPersonalKpiDraftFallbackResult,
  normalizePersonalKpiDraftResult,
} from '../src/lib/personal-kpi-ai-draft'
import {
  generatePersonalKpiDraft,
  loadPersonalKpiDraftContext,
  type PersonalKpiAiParams,
} from '../src/server/ai/personal-kpi'
import { KpiAiPreviewPanel } from '../src/components/kpi/KpiAiPreviewPanel'

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

function makeActor(overrides?: Partial<NonNullable<PersonalKpiAiParams['actor']>>) {
  return {
    id: 'leader-1',
    role: 'ROLE_TEAM_LEADER' as const,
    deptId: 'dept-team',
    accessibleDepartmentIds: ['dept-team'],
    ...overrides,
  }
}

function makeParams(overrides?: Partial<PersonalKpiAiParams>): PersonalKpiAiParams {
  return {
    requesterId: 'leader-1',
    actor: makeActor(),
    payload: {
      selectedYear: 2026,
      selectedCycleId: 'cycle-2026',
      employeeId: 'employee-1',
      linkedOrgKpiId: 'org-team-1',
      currentDraft: {
        title: '고객 문의 응답 고도화',
        definition: '고객 문의 응답 품질과 속도를 함께 개선합니다.',
        formula: '기한 내 처리 건수 / 전체 처리 건수 x 100',
        targetValue: 95,
        unit: '%',
        weight: 20,
        difficulty: 'MEDIUM',
      },
    },
    ...overrides,
  }
}

function makeRecommendation(params: {
  title: string
  angle: string
  definition?: string
  formula?: string
  priority?: number
  alignmentSummary?: string
}) {
  return {
    recommendedTitle: params.title,
    recommendedDefinition:
      params.definition ?? `${params.angle} 관점에서 고객 문의 응답 흐름을 개선하는 개인 KPI 초안입니다.`,
    category: '운영 실행',
    formula: params.formula ?? '기한 내 처리 건수 / 전체 처리 건수 x 100',
    metricSource: '월간 운영 실적과 응대 로그 기준',
    targetT: 92,
    targetE: 95,
    targetS: 98,
    targetValueSuggestion: 'T 92% / E 95% / S 98%',
    unit: '%',
    weightSuggestion: 20,
    difficultyLevel: 'MEDIUM',
    linkedParentKpiId: 'org-team-1',
    linkedParentKpiTitle: '고객 문의 응답 체계 고도화',
    linkageReason: '팀 KPI의 실행 책임을 개인 단위 응답 운영으로 구체화합니다.',
    whyThisIsHighQuality: '개인이 직접 통제할 수 있고 측정 주기가 명확합니다.',
    controllabilityNote: '개인의 대응 속도와 후속 조치 품질을 직접 관리할 수 있습니다.',
    riskNote: '티켓 분류 기준이 흔들리면 월간 비교가 어려워질 수 있습니다.',
    alignmentScore: 93,
    qualityScore: 91,
    recommendedPriority: params.priority ?? 1,
    draftAngleLabel: params.angle,
    whyThisOption: `${params.angle} 관점에서 팀 KPI를 개인 실행 항목으로 풀어낸 초안입니다.`,
    alignmentSummary:
      params.alignmentSummary ?? '본부 KPI 방향을 팀 KPI 실행 흐름으로 연결한 뒤 개인 기여 범위로 구체화했습니다.',
    primaryLinkedOrgKpiId: 'org-team-1',
    primaryLinkedOrgKpiTitle: '고객 문의 응답 체계 고도화',
    secondaryLinkedOrgKpiId: 'org-div-1',
    secondaryLinkedOrgKpiTitle: '고객 경험 품질 고도화',
    divisionKpiId: 'org-div-1',
    divisionKpiTitle: '고객 경험 품질 고도화',
    teamKpiId: 'org-team-1',
    teamKpiTitle: '고객 문의 응답 체계 고도화',
  }
}

function makeDb() {
  const updates: Array<Record<string, unknown>> = []
  const orgMap = new Map([
    [
      'org-team-1',
      {
        id: 'org-team-1',
        kpiName: '고객 문의 응답 체계 고도화',
        kpiCategory: '서비스 운영',
        definition: '팀 차원의 문의 대응 체계를 정교화합니다.',
        formula: '기한 내 처리 건수 / 전체 처리 건수 x 100',
        targetValue: 95,
        targetValueT: 92,
        targetValueE: 95,
        targetValueS: 98,
        unit: '%',
        weight: 30,
        difficulty: 'MEDIUM',
        deptId: 'dept-team',
        parentOrgKpiId: 'org-div-1',
        department: { deptName: '고객경험팀' },
      },
    ],
    [
      'org-div-1',
      {
        id: 'org-div-1',
        kpiName: '고객 경험 품질 고도화',
        kpiCategory: '전사 운영',
        definition: '본부 차원의 고객 경험 품질을 높입니다.',
        formula: '고객 만족 점수',
        targetValue: 90,
        targetValueT: 88,
        targetValueE: 90,
        targetValueS: 93,
        unit: '점',
        weight: 40,
        difficulty: 'HIGH',
        deptId: 'dept-div',
        parentOrgKpiId: null,
        department: { deptName: '고객지원본부' },
      },
    ],
  ])

  return {
    updates,
    personalKpi: {
      findUnique: async () => null,
      findMany: async () => [
        {
          id: 'existing-1',
          kpiName: '고객 문의 처리율 개선',
          definition: '기존 개인 KPI',
          formula: '기한 내 처리 건수 / 전체 처리 건수 x 100',
          weight: 20,
          status: 'DRAFT',
          linkedOrgKpiId: 'org-team-1',
          linkedOrgKpi: {
            kpiName: '고객 문의 응답 체계 고도화',
          },
        },
      ],
    },
    employee: {
      findUnique: async () => ({
        id: 'employee-1',
        empName: '홍길동',
        role: 'ROLE_MEMBER',
        position: 'MEMBER',
        jobTitle: '고객경험 매니저',
        teamName: '고객경험팀',
        deptId: 'dept-team',
        department: {
          deptName: '고객경험팀',
        },
      }),
    },
    orgKpi: {
      findUnique: async ({ where }: { where: { id: string } }) => orgMap.get(where.id) ?? null,
    },
    monthlyRecord: {
      findMany: async () => [
        {
          id: 'mr-1',
          yearMonth: '2026-04',
          achievementRate: 83,
          activities: '문의 응답 프로세스 점검',
          obstacles: '부서 간 이관 지연',
          evidenceComment: '응답 SLA 보완 필요',
          personalKpi: {
            kpiName: '고객 문의 처리율 개선',
          },
        },
      ],
    },
    businessPlanDocument: {
      findFirst: async () => ({
        title: '2026 고객 경험 실행 계획',
        summaryText: '고객 접점 응답 속도와 품질을 동시에 높이는 것이 핵심입니다.',
        bodyText: '본부와 팀이 함께 응답 체계와 재발 방지 프로세스를 정비합니다.',
      }),
    },
    jobDescriptionDocument: {
      findFirst: async ({ where }: { where: { scope: 'DIVISION' | 'TEAM' } }) =>
        where.scope === 'DIVISION'
          ? {
              title: '고객지원본부 직무기술서',
              summaryText: '고객 경험 체계를 설계하고 운영 기준을 관리합니다.',
              bodyText: '전사 대응 원칙과 고객 경험 품질 기준을 정합니다.',
            }
          : {
              title: '고객경험팀 직무기술서',
              summaryText: '문의 응답과 후속 조치 품질을 안정적으로 운영합니다.',
              bodyText: '응대 흐름 개선과 협업 정렬이 주요 책임입니다.',
            },
    },
    teamKpiRecommendationSet: {
      findFirst: async () => ({
        items: [
          {
            title: 'VOC 처리 리드타임 단축',
            sourceOrgKpiTitle: '고객 문의 응답 체계 고도화',
            linkageExplanation: '팀 KPI의 실행 우선순위를 개인 단위 운영으로 연결합니다.',
            recommendationReason: '문의 응답 속도 개선이 팀 KPI 달성에 직접 연결됩니다.',
            recommendationType: 'ALIGNED_WITH_DIVISION_KPI',
            whyThisIsHighQuality: '명확한 측정 기준과 운영 범위를 갖습니다.',
          },
        ],
      }),
    },
    aiRequestLog: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data)
        return { id: `ai-log-${updates.length}` }
      },
    },
  }
}

function makeNestedCascadeDb() {
  const baseDb = makeDb()
  const orgMap = new Map([
    [
      'org-exec-1',
      {
        id: 'org-exec-1',
        kpiName: 'VOC Escalation Backlog Control',
        kpiCategory: 'Execution',
        definition: 'Reduce escalation backlog with direct execution coverage.',
        formula: 'resolved escalations / total escalations x 100',
        targetValue: 94,
        targetValueT: 90,
        targetValueE: 94,
        targetValueS: 97,
        unit: '%',
        weight: 20,
        difficulty: 'MEDIUM',
        deptId: 'dept-exec',
        parentOrgKpiId: 'org-team-1',
        department: { deptName: 'VOC Response Pod' },
      },
    ],
    [
      'org-team-1',
      {
        id: 'org-team-1',
        kpiName: 'Customer Inquiry Response System',
        kpiCategory: 'Service',
        definition: 'Improve team-level response workflow quality.',
        formula: 'on-time inquiries / total inquiries x 100',
        targetValue: 95,
        targetValueT: 92,
        targetValueE: 95,
        targetValueS: 98,
        unit: '%',
        weight: 30,
        difficulty: 'MEDIUM',
        deptId: 'dept-team',
        parentOrgKpiId: 'org-div-1',
        department: { deptName: 'Customer Experience Team' },
      },
    ],
    [
      'org-div-1',
      {
        id: 'org-div-1',
        kpiName: 'Customer Experience Quality',
        kpiCategory: 'Strategy',
        definition: 'Raise the division-level customer experience standard.',
        formula: 'customer satisfaction score',
        targetValue: 90,
        targetValueT: 88,
        targetValueE: 90,
        targetValueS: 93,
        unit: '점',
        weight: 40,
        difficulty: 'HIGH',
        deptId: 'dept-div',
        parentOrgKpiId: null,
        department: { deptName: 'Customer Support HQ' },
      },
    ],
  ])

  return {
    ...baseDb,
    employee: {
      findUnique: async () => ({
        id: 'employee-1',
        empName: 'Member One',
        role: 'ROLE_MEMBER',
        position: 'MEMBER',
        jobTitle: 'Customer Experience Specialist',
        teamName: 'Customer Experience Team',
        deptId: 'dept-team',
        department: {
          deptName: 'Customer Experience Team',
        },
      }),
    },
    orgKpi: {
      findUnique: async ({ where }: { where: { id: string } }) => orgMap.get(where.id) ?? null,
    },
  }
}

void (async () => {
  await run('personal KPI draft context includes both division KPI and team KPI when cascade exists', async () => {
    const db = makeDb()
    const context = await loadPersonalKpiDraftContext(makeParams(), db as never)
    const cascade = context.payload.orgCascade as {
      divisionGoal: { title: string }
      teamGoal: { title: string }
      pathLabels: string[]
    }
    const businessContext = context.payload.businessContext as {
      businessPlanSummaryText: string
      teamJobDescriptionSummaryText: string
    }
    const teamRecommendationContext = context.payload.teamRecommendationContext as {
      items: Array<{ title: string }>
    }

    assert.equal(cascade.divisionGoal.title, '고객 경험 품질 고도화')
    assert.equal(cascade.teamGoal.title, '고객 문의 응답 체계 고도화')
    assert.deepEqual(cascade.pathLabels, ['고객지원본부 · 고객 경험 품질 고도화', '고객경험팀 · 고객 문의 응답 체계 고도화'])
    assert.equal(businessContext.businessPlanSummaryText.includes('고객 접점 응답 속도'), true)
    assert.equal(businessContext.teamJobDescriptionSummaryText.includes('응답과 후속 조치 품질'), true)
    assert.equal(teamRecommendationContext.items.length, 1)
  })

  await run('personal KPI draft context resolves the team KPI from the employee department when the linked KPI is deeper than the team node', async () => {
    const db = makeNestedCascadeDb()
    const params = makeParams({
      payload: {
        ...makeParams().payload,
        linkedOrgKpiId: 'org-exec-1',
      },
    })
    const context = await loadPersonalKpiDraftContext(params, db as never)
    const cascade = context.payload.orgCascade as {
      linkedGoal: { title: string }
      divisionGoal: { title: string }
      teamGoal: { title: string }
      pathLabels: string[]
    }

    assert.equal(cascade.linkedGoal.title, 'VOC Escalation Backlog Control')
    assert.equal(cascade.teamGoal.title, 'Customer Inquiry Response System')
    assert.equal(cascade.divisionGoal.title, 'Customer Experience Quality')
    assert.deepEqual(cascade.pathLabels, [
      'Customer Support HQ · Customer Experience Quality',
      'Customer Experience Team · Customer Inquiry Response System',
      'VOC Response Pod · VOC Escalation Backlog Control',
    ])
  })

  await run('personal KPI draft context rejects out-of-scope employee access', async () => {
    const db = makeDb()

    await assert.rejects(
      () =>
        loadPersonalKpiDraftContext(
          makeParams({
            actor: makeActor({
              deptId: 'dept-other',
              accessibleDepartmentIds: ['dept-other'],
            }),
          }),
          db as never,
        ),
      (error: unknown) => error instanceof AppError && error.statusCode === 403,
    )
  })

  await run('generatePersonalKpiDraft returns multiple distinct options and filters collisions', async () => {
    const db = makeDb()
    const response = await generatePersonalKpiDraft(makeParams(), {
      db: db as never,
      executeAiAssist: async () => ({
        requestLogId: 'ai-log-1',
        source: 'ai' as const,
        fallbackReason: null,
        result: {
          recommendations: [
            makeRecommendation({
              title: '고객 문의 처리율 개선',
              angle: '운영 실행형',
              priority: 1,
            }),
            makeRecommendation({
              title: 'VOC 처리 프로세스 개선율',
              angle: '프로세스 개선형',
              formula: '개선 완료 프로세스 건수 / 전체 개선 대상 건수 x 100',
              priority: 2,
            }),
            makeRecommendation({
              title: 'VOC 처리 프로세스 개선률',
              angle: '프로세스 개선형',
              formula: '개선 완료 프로세스 건수 / 전체 개선 대상 건수 x 100',
              priority: 3,
            }),
            makeRecommendation({
              title: '유관부서 SLA 준수율',
              angle: '협업/정렬형',
              formula: '기한 내 협업 완료 건수 / 전체 협업 요청 건수 x 100',
              priority: 4,
            }),
            makeRecommendation({
              title: '반복 문의 예방 자동화율',
              angle: '자동화/효율화형',
              formula: '자동화 적용 반복 문의 유형 수 / 전체 반복 문의 유형 수 x 100',
              priority: 5,
            }),
          ],
        },
      }),
    })

    assert.equal(response.source, 'ai')
    assert.equal(response.result.recommendations.length >= 3, true)
    assert.equal(response.result.recommendations.length <= 5, true)
    assert.equal(new Set(response.result.recommendations.map((item) => item.draftAngleLabel)).size, response.result.recommendations.length)
    assert.equal(response.result.recommendations.some((item) => item.recommendedTitle === '고객 문의 처리율 개선'), false)
    assert.equal(response.result.recommendations.filter((item) => item.draftAngleLabel === '프로세스 개선형').length, 1)
    assert.equal(response.result.divisionKpiTitle, '고객 경험 품질 고도화')
    assert.equal(response.result.teamKpiTitle, '고객 문의 응답 체계 고도화')
    assert.equal(db.updates.length, 1)
    assert.equal(db.updates[0]?.requestStatus, AIRequestStatus.SUCCESS)
  })

  await run('generatePersonalKpiDraft degrades gracefully when upstream AI already fell back', async () => {
    const db = makeDb()
    const response = await generatePersonalKpiDraft(makeParams(), {
      db: db as never,
      executeAiAssist: async () => ({
        requestLogId: 'ai-log-2',
        source: 'fallback' as const,
        fallbackReason: 'provider down',
        result: {
          recommendations: [],
        },
      }),
    })

    assert.equal(response.source, 'fallback')
    assert.equal(response.result.recommendations.length >= 3, true)
    assert.equal(db.updates.length, 1)
    assert.equal(db.updates[0]?.requestStatus, AIRequestStatus.FALLBACK)
  })

  await run('malformed AI recommendation payload is normalized into safe distinct fallback options', () => {
    const db = makeDb()
    return loadPersonalKpiDraftContext(makeParams(), db as never).then((context) => {
      const result = normalizePersonalKpiDraftResult({
        rawResult: {
          recommendations: [
            {
              recommendedTitle: '',
              draftAngleLabel: '',
            },
          ],
        },
        payload: context.payload,
      })

      assert.equal(result.recommendations.length >= 3, true)
      assert.equal(new Set(result.recommendations.map((item) => item.draftAngleLabel)).size, result.recommendations.length)
    })
  })

  await run('normalization removes semantically duplicated options even when angle labels differ', async () => {
    const db = makeDb()
    const context = await loadPersonalKpiDraftContext(makeParams(), db as never)
    const result = normalizePersonalKpiDraftResult({
      rawResult: {
        recommendations: [
          makeRecommendation({
            title: 'Inbound SLA Coverage',
            angle: '운영 실행형',
            definition: 'Handle inbound inquiries within agreed SLA and stabilize response execution.',
            formula: 'on-time inquiries / total inquiries x 100',
          }),
          makeRecommendation({
            title: 'Inquiry SLA Quality Stability',
            angle: '리스크 관리형',
            definition: 'Stabilize inbound inquiry handling quality within agreed SLA and reduce execution drift.',
            formula: 'on-time inquiries / total inquiries x 100',
          }),
          makeRecommendation({
            title: 'VOC Workflow Improvement Rate',
            angle: '프로세스 개선형',
            definition: 'Improve the VOC response workflow and close recurring bottlenecks.',
            formula: 'completed workflow improvements / planned workflow improvements x 100',
          }),
          makeRecommendation({
            title: 'Cross-team Escalation Alignment',
            angle: '협업/정렬형',
            definition: 'Improve cross-team escalation handoff and action alignment.',
            formula: 'closed escalations with aligned owner / total escalations x 100',
          }),
        ],
      },
      payload: context.payload,
    })

    assert.equal(
      result.recommendations.filter((item) => item.formula === 'on-time inquiries / total inquiries x 100').length,
      1
    )
    assert.equal(new Set(result.recommendations.map((item) => item.draftAngleLabel)).size, result.recommendations.length)
    assert.equal(result.recommendations.length >= 3, true)
    assert.equal(result.recommendations.length <= 5, true)
  })

  await run('fallback builder always returns 3 to 5 diverse personal KPI draft angles', async () => {
    const db = makeDb()
    const context = await loadPersonalKpiDraftContext(makeParams(), db as never)
    const result = buildPersonalKpiDraftFallbackResult(context.payload)

    assert.equal(result.recommendations.length >= 3, true)
    assert.equal(result.recommendations.length <= 5, true)
    assert.equal(new Set(result.recommendations.map((item) => item.draftAngleLabel)).size, result.recommendations.length)
  })

  await run('preview panel renders cascade-aware personal KPI recommendation cards', async () => {
    const db = makeDb()
    const context = await loadPersonalKpiDraftContext(makeParams(), db as never)
    const previewResult = buildPersonalKpiDraftFallbackResult(context.payload)
    const html = renderToStaticMarkup(
      React.createElement(KpiAiPreviewPanel, {
        preview: {
          action: 'generate-draft',
          actionLabel: 'AI 초안 생성',
          source: 'ai',
          fallbackReason: null,
          result: previewResult as unknown as Record<string, unknown>,
        },
        emptyTitle: 'empty',
        emptyDescription: 'empty',
        onApprove: () => undefined,
        onReject: () => undefined,
        onSelectRecommendation: () => undefined,
        selectedRecommendationIndex: 0,
        recommendationActionLabel: '이 초안 적용',
        isRecommendationDraftOpen: false,
      }),
    )

    assert.equal(html.includes('초안 유형'), true)
    assert.equal(html.includes('정렬 기준'), true)
    assert.equal(html.includes('추천 이유'), true)
    assert.equal(html.includes('연계 조직 KPI'), true)
    assert.equal(html.includes('본부 KPI'), true)
    assert.equal(html.includes('팀 KPI'), true)
    assert.equal(html.includes('이 초안 적용'), true)
  })
})()
