import type {
  SystemRole,
  WordCloud360CycleStatus,
  WordCloudAssignmentStatus,
  WordCloudEvaluatorGroup,
  WordCloudKeywordCategory,
  WordCloudKeywordPolarity,
  WordCloudKeywordSourceType,
} from '@prisma/client'
import type { Session } from 'next-auth'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { AppError } from '@/lib/utils'
import {
  aggregateWordCloudResponses,
  buildSuggestedWordCloudAssignments,
  DEFAULT_WORD_CLOUD_KEYWORDS,
  validateWordCloudSelections,
  WORD_CLOUD_CATEGORY_LABELS,
  WORD_CLOUD_GROUP_LABELS,
  WORD_CLOUD_POLARITY_LABELS,
  type WordCloudAssignmentDraft,
} from '@/lib/word-cloud-360'

type AuthenticatedSession = Session & {
  user: NonNullable<Session['user']> & {
    id: string
    role: SystemRole
  }
}

export type WordCloud360PageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type AggregateKeywordView = {
  keywordId: string
  keyword: string
  category: WordCloudKeywordCategory
  count: number
  weight: number
}

type KeywordOption = {
  keywordId: string
  keyword: string
  category: WordCloudKeywordCategory
  warningFlag: boolean
}

export type WordCloud360PageData = {
  state: WordCloud360PageState
  message?: string
  alerts?: Array<{
    title: string
    description: string
  }>
  currentUser?: {
    id: string
    name: string
    role: SystemRole
    department: string
  }
  permissions?: {
    canManage: boolean
    canEvaluate: boolean
    canViewOwnResult: boolean
  }
  availableCycles: Array<{
    id: string
    name: string
    year?: number
    status: WordCloud360CycleStatus
  }>
  availableEvalCycles?: Array<{
    id: string
    name: string
    year: number
  }>
  selectedCycleId?: string
  summary?: {
    targetCount: number
    assignmentCount: number
    submittedResponseCount: number
    published: boolean
    positiveSelectionLimit: number
    negativeSelectionLimit: number
    privacyThreshold: number
  }
  evaluatorView?: {
    enabledGroups: WordCloudEvaluatorGroup[]
    positiveSelectionLimit: number
    negativeSelectionLimit: number
    keywordPool: {
      positive: KeywordOption[]
      negative: KeywordOption[]
    }
    assignments: Array<{
      assignmentId: string
      evaluateeId: string
      evaluateeName: string
      department: string
      evaluatorGroup: WordCloudEvaluatorGroup
      status: WordCloudAssignmentStatus
      responseStatus?: 'DRAFT' | 'SUBMITTED'
      selectedPositiveKeywordIds: string[]
      selectedNegativeKeywordIds: string[]
      submittedAt?: string
    }>
  }
  evaluateeView?: {
    resultVisible: boolean
    hiddenReason?: string
    availableGroups: Array<'ALL' | WordCloudEvaluatorGroup>
    selectedGroup?: 'ALL' | WordCloudEvaluatorGroup
    responseCount: number
    positiveSelectionCount: number
    negativeSelectionCount: number
    positiveCloud: AggregateKeywordView[]
    negativeCloud: AggregateKeywordView[]
    positiveTopKeywords: AggregateKeywordView[]
    negativeTopKeywords: AggregateKeywordView[]
    categorySummary: Array<{
      polarity: WordCloudKeywordPolarity
      category: WordCloudKeywordCategory
      label: string
      count: number
    }>
    evaluatorGroupSummary: Array<{
      evaluatorGroup: WordCloudEvaluatorGroup
      label: string
      responseCount: number
    }>
  }
  adminView?: {
    cycle?: {
      id: string
      cycleName: string
      status: WordCloud360CycleStatus
      startDate?: string
      endDate?: string
      positiveSelectionLimit: number
      negativeSelectionLimit: number
      resultPrivacyThreshold: number
      evaluatorGroups: WordCloudEvaluatorGroup[]
      publishedAt?: string
      notes?: string
      evalCycleId?: string
    }
    keywordPool: Array<{
      keywordId: string
      keyword: string
      polarity: WordCloudKeywordPolarity
      polarityLabel: string
      category: WordCloudKeywordCategory
      categoryLabel: string
      sourceType: WordCloudKeywordSourceType
      active: boolean
      displayOrder: number
      warningFlag: boolean
      note?: string
    }>
    employees: Array<{
      id: string
      employeeNumber: string
      name: string
      department: string
      managerId?: string | null
      status: string
    }>
    assignments: Array<{
      assignmentId: string
      evaluatorId: string
      evaluatorName: string
      evaluateeId: string
      evaluateeName: string
      department: string
      evaluatorGroup: WordCloudEvaluatorGroup
      status: WordCloudAssignmentStatus
      submittedAt?: string
    }>
    progress: {
      targetCount: number
      assignmentCount: number
      submittedCount: number
      draftCount: number
      pendingCount: number
    }
    results: Array<{
      evaluateeId: string
      evaluateeName: string
      department: string
      responseCount: number
      thresholdMet: boolean
      positiveTopKeywords: AggregateKeywordView[]
      negativeTopKeywords: AggregateKeywordView[]
    }>
  }
}

type SectionAlert = NonNullable<WordCloud360PageData['alerts']>[number]

function toIso(value?: Date | null) {
  return value ? value.toISOString() : undefined
}

function mapCloudItems(items: Array<{ keywordId: string; keyword: string; category: WordCloudKeywordCategory; count: number; weight: number }>) {
  return items.map((item) => ({
    keywordId: item.keywordId,
    keyword: item.keyword,
    category: item.category,
    count: item.count,
    weight: item.weight,
  }))
}

async function getActor(session: AuthenticatedSession) {
  const actor = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      department: {
        include: {
          organization: true,
        },
      },
    },
  })

  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 로그인 사용자의 직원 정보를 찾을 수 없습니다.')
  }

  return actor
}

async function loadWordCloudSection<T>(params: {
  title: string
  alerts: SectionAlert[]
  fallback: T
  loader: () => Promise<T>
}) {
  try {
    return await params.loader()
  } catch (error) {
    params.alerts.push({
      title: params.title,
      description: error instanceof Error ? error.message : `${params.title} 데이터를 불러오지 못했습니다.`,
    })
    return params.fallback
  }
}

async function ensureCycleAccess(params: { cycleId: string; actorId: string }) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }

  const cycle = await prisma.wordCloud360Cycle.findUnique({
    where: { id: params.cycleId },
  })
  if (!cycle || cycle.orgId !== actor.department.orgId) {
    throw new AppError(404, 'CYCLE_NOT_FOUND', '다면평가 주기를 찾을 수 없습니다.')
  }

  return { actor, cycle }
}

async function buildAdminView(params: {
  actorOrgId: string
  selectedCycle: Awaited<ReturnType<typeof prisma.wordCloud360Cycle.findMany>>[number] | null
  alerts: SectionAlert[]
}) {
  const keywordPool = await loadWordCloudSection({
    title: '키워드 풀',
    alerts: params.alerts,
    fallback: [] as NonNullable<WordCloud360PageData['adminView']>['keywordPool'],
    loader: async () => {
      const keywords = await prisma.wordCloud360Keyword.findMany({
        where: { orgId: params.actorOrgId },
        orderBy: [{ polarity: 'asc' }, { displayOrder: 'asc' }, { keyword: 'asc' }],
      })

      return keywords.map((keyword) => ({
        keywordId: keyword.id,
        keyword: keyword.keyword,
        polarity: keyword.polarity,
        polarityLabel: WORD_CLOUD_POLARITY_LABELS[keyword.polarity],
        category: keyword.category,
        categoryLabel: WORD_CLOUD_CATEGORY_LABELS[keyword.category],
        sourceType: keyword.sourceType,
        active: keyword.active,
        displayOrder: keyword.displayOrder,
        warningFlag: keyword.warningFlag,
        note: keyword.note ?? undefined,
      }))
    },
  })

  const employees = await loadWordCloudSection({
    title: '직원 편성',
    alerts: params.alerts,
    fallback: [] as NonNullable<WordCloud360PageData['adminView']>['employees'],
    loader: async () => {
      const members = await prisma.employee.findMany({
        where: {
          department: {
            orgId: params.actorOrgId,
          },
        },
        include: {
          department: true,
        },
        orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
      })

      return members.map((employee) => ({
        id: employee.id,
        employeeNumber: employee.empId,
        name: employee.empName,
        department: employee.department.deptName,
        managerId: employee.managerId,
        status: employee.status,
      }))
    },
  })

  if (!params.selectedCycle) {
    return {
      keywordPool,
      employees,
      assignments: [],
      progress: {
        targetCount: 0,
        assignmentCount: 0,
        submittedCount: 0,
        draftCount: 0,
        pendingCount: 0,
      },
      results: [],
    } satisfies NonNullable<WordCloud360PageData['adminView']>
  }

  const selectedCycle = params.selectedCycle

  const assignments = await loadWordCloudSection({
    title: '평가자 편성',
    alerts: params.alerts,
    fallback: [] as NonNullable<WordCloud360PageData['adminView']>['assignments'],
    loader: async () => {
      const records = await prisma.wordCloud360Assignment.findMany({
        where: { cycleId: selectedCycle.id },
        include: {
          evaluator: { include: { department: true } },
          evaluatee: { include: { department: true } },
          response: true,
        },
        orderBy: [{ evaluatee: { empName: 'asc' } }, { evaluatorGroup: 'asc' }, { evaluator: { empName: 'asc' } }],
      })

      return records.map((record) => ({
        assignmentId: record.id,
        evaluatorId: record.evaluatorId,
        evaluatorName: record.evaluator.empName,
        evaluateeId: record.evaluateeId,
        evaluateeName: record.evaluatee.empName,
        department: record.evaluatee.department.deptName,
        evaluatorGroup: record.evaluatorGroup,
        status: record.status,
        submittedAt: toIso(record.submittedAt),
      }))
    },
  })

  const results = await loadWordCloudSection({
    title: '결과 집계',
    alerts: params.alerts,
    fallback: [] as NonNullable<WordCloud360PageData['adminView']>['results'],
    loader: async () => {
      const responses = await prisma.wordCloud360Response.findMany({
        where: {
          cycleId: selectedCycle.id,
          status: 'SUBMITTED',
        },
        include: {
          evaluatee: {
            include: {
              department: true,
            },
          },
          items: true,
        },
      })

      const grouped = new Map<string, typeof responses>()
      for (const response of responses) {
        const bucket = grouped.get(response.evaluateeId) ?? []
        bucket.push(response)
        grouped.set(response.evaluateeId, bucket)
      }

      return Array.from(grouped.entries()).map(([evaluateeId, employeeResponses]) => {
        const evaluatee = employeeResponses[0]?.evaluatee
        const aggregated = aggregateWordCloudResponses({
          responses: employeeResponses.map((response) => ({
            status: response.status,
            evaluatorGroup: response.items[0]?.evaluatorGroup ?? 'PEER',
            items: response.items.map((item) => ({
              keywordId: item.keywordId,
              keywordTextSnapshot: item.keywordTextSnapshot,
              polarity: item.polarity,
              category: item.category,
              evaluatorGroup: item.evaluatorGroup,
            })),
          })),
          minimumResponses: selectedCycle.resultPrivacyThreshold,
        })

        return {
          evaluateeId,
          evaluateeName: evaluatee?.empName ?? '미지정',
          department: evaluatee?.department.deptName ?? '-',
          responseCount: aggregated.responseCount,
          thresholdMet: aggregated.thresholdMet,
          positiveTopKeywords: mapCloudItems(aggregated.positiveKeywords.slice(0, 10)),
          negativeTopKeywords: mapCloudItems(aggregated.negativeKeywords.slice(0, 10)),
        }
      })
    },
  })

  const responseStatusCounts = assignments.reduce(
    (accumulator, assignment) => {
      if (assignment.status === 'SUBMITTED') accumulator.submittedCount += 1
      else if (assignment.status === 'IN_PROGRESS') accumulator.draftCount += 1
      else accumulator.pendingCount += 1
      return accumulator
    },
    {
      submittedCount: 0,
      draftCount: 0,
      pendingCount: 0,
    }
  )

  return {
    cycle: {
      id: selectedCycle.id,
      cycleName: selectedCycle.cycleName,
      status: selectedCycle.status,
      startDate: toIso(selectedCycle.startDate),
      endDate: toIso(selectedCycle.endDate),
      positiveSelectionLimit: selectedCycle.positiveSelectionLimit,
      negativeSelectionLimit: selectedCycle.negativeSelectionLimit,
      resultPrivacyThreshold: selectedCycle.resultPrivacyThreshold,
      evaluatorGroups: Array.isArray(selectedCycle.evaluatorGroups)
        ? (selectedCycle.evaluatorGroups as WordCloudEvaluatorGroup[])
        : ['MANAGER', 'PEER', 'SUBORDINATE'],
      publishedAt: toIso(selectedCycle.publishedAt),
      notes: selectedCycle.notes ?? undefined,
      evalCycleId: selectedCycle.evalCycleId ?? undefined,
    },
    keywordPool,
    employees,
    assignments,
    progress: {
      targetCount: new Set(assignments.map((assignment) => assignment.evaluateeId)).size,
      assignmentCount: assignments.length,
      submittedCount: responseStatusCounts.submittedCount,
      draftCount: responseStatusCounts.draftCount,
      pendingCount: responseStatusCounts.pendingCount,
    },
    results,
  } satisfies NonNullable<WordCloud360PageData['adminView']>
}

export async function getWordCloud360PageData(params: {
  session: AuthenticatedSession
  cycleId?: string
  evaluatorGroup?: 'ALL' | WordCloudEvaluatorGroup
}): Promise<WordCloud360PageData> {
  try {
    const actor = await getActor(params.session)
    const canManage = actor.role === 'ROLE_ADMIN'
    const alerts: SectionAlert[] = []

    const availableCyclesRaw = await prisma.wordCloud360Cycle.findMany({
      where: { orgId: actor.department.orgId },
      include: {
        evalCycle: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    const availableCycles = availableCyclesRaw.map((cycle) => ({
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalCycle?.evalYear,
      status: cycle.status,
    }))

    const selectedCycle =
      availableCyclesRaw.find((cycle) => cycle.id === params.cycleId) ??
      availableCyclesRaw[0] ??
      null

    const availableEvalCycles = canManage
      ? await loadWordCloudSection({
          title: '평가 주기',
          alerts,
          fallback: [] as NonNullable<WordCloud360PageData['availableEvalCycles']>,
          loader: async () => {
            const evalCycles = await prisma.evalCycle.findMany({
              where: { orgId: actor.department.orgId },
              orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
            })

            return evalCycles.map((cycle) => ({
              id: cycle.id,
              name: cycle.cycleName,
              year: cycle.evalYear,
            }))
          },
        })
      : undefined

    const keywordPool = await loadWordCloudSection({
      title: '키워드 로딩',
      alerts,
      fallback: { positive: [] as KeywordOption[], negative: [] as KeywordOption[] },
      loader: async () => {
        const keywords = await prisma.wordCloud360Keyword.findMany({
          where: {
            orgId: actor.department.orgId,
            active: true,
          },
          orderBy: [{ displayOrder: 'asc' }, { keyword: 'asc' }],
        })

        return {
          positive: keywords
            .filter((keyword) => keyword.polarity === 'POSITIVE')
            .map((keyword) => ({
              keywordId: keyword.id,
              keyword: keyword.keyword,
              category: keyword.category,
              warningFlag: keyword.warningFlag,
            })),
          negative: keywords
            .filter((keyword) => keyword.polarity === 'NEGATIVE')
            .map((keyword) => ({
              keywordId: keyword.id,
              keyword: keyword.keyword,
              category: keyword.category,
              warningFlag: keyword.warningFlag,
            })),
        }
      },
    })

    if (!selectedCycle) {
      if (canManage) {
        const adminView = await buildAdminView({
          actorOrgId: actor.department.orgId,
          selectedCycle: null,
          alerts,
        })
        return {
          state: 'ready',
          message: '아직 워드클라우드형 다면평가 주기가 없습니다. 운영 개요에서 주기를 먼저 등록해 주세요.',
          alerts,
          currentUser: {
            id: actor.id,
            name: actor.empName,
            role: actor.role,
            department: actor.department.deptName,
          },
          permissions: {
            canManage,
            canEvaluate: false,
            canViewOwnResult: true,
          },
          availableCycles,
          availableEvalCycles,
          adminView,
        }
      }

      return {
        state: 'empty',
        message: '현재 진행 중인 워드클라우드형 다면평가 주기가 없습니다.',
        alerts,
        currentUser: {
          id: actor.id,
          name: actor.empName,
          role: actor.role,
          department: actor.department.deptName,
        },
        permissions: {
          canManage,
          canEvaluate: false,
          canViewOwnResult: true,
        },
        availableCycles,
      }
    }

    const cycleGroups: WordCloudEvaluatorGroup[] = Array.isArray(selectedCycle.evaluatorGroups)
      ? (selectedCycle.evaluatorGroups as WordCloudEvaluatorGroup[])
      : ['MANAGER', 'PEER', 'SUBORDINATE']

    const evaluatorAssignments = await loadWordCloudSection({
      title: '평가자 응답',
      alerts,
      fallback: [] as NonNullable<WordCloud360PageData['evaluatorView']>['assignments'],
      loader: async () => {
        const assignments = await prisma.wordCloud360Assignment.findMany({
          where: {
            cycleId: selectedCycle.id,
            evaluatorId: actor.id,
          },
          include: {
            evaluatee: {
              include: {
                department: true,
              },
            },
            response: {
              include: {
                items: true,
              },
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
        })

        return assignments.map((assignment) => ({
          assignmentId: assignment.id,
          evaluateeId: assignment.evaluateeId,
          evaluateeName: assignment.evaluatee.empName,
          department: assignment.evaluatee.department.deptName,
          evaluatorGroup: assignment.evaluatorGroup,
          status: assignment.status,
          responseStatus: assignment.response?.status,
          selectedPositiveKeywordIds:
            assignment.response?.items.filter((item) => item.polarity === 'POSITIVE').map((item) => item.keywordId) ?? [],
          selectedNegativeKeywordIds:
            assignment.response?.items.filter((item) => item.polarity === 'NEGATIVE').map((item) => item.keywordId) ?? [],
          submittedAt: toIso(assignment.response?.submittedAt ?? assignment.submittedAt),
        }))
      },
    })

    const evaluateeView = await loadWordCloudSection({
      title: '피평가 결과',
      alerts,
      fallback: {
        resultVisible: false,
        hiddenReason: '결과를 준비 중입니다.',
        availableGroups: ['ALL'] as Array<'ALL' | WordCloudEvaluatorGroup>,
        selectedGroup: params.evaluatorGroup ?? 'ALL',
        responseCount: 0,
        positiveSelectionCount: 0,
        negativeSelectionCount: 0,
        positiveCloud: [],
        negativeCloud: [],
        positiveTopKeywords: [],
        negativeTopKeywords: [],
        categorySummary: [],
        evaluatorGroupSummary: [],
      } satisfies NonNullable<WordCloud360PageData['evaluateeView']>,
      loader: async () => {
        const responses = await prisma.wordCloud360Response.findMany({
          where: {
            cycleId: selectedCycle.id,
            evaluateeId: actor.id,
            status: 'SUBMITTED',
          },
          include: {
            items: true,
          },
        })

        const aggregated = aggregateWordCloudResponses({
          responses: responses.map((response) => ({
            status: response.status,
            evaluatorGroup: response.items[0]?.evaluatorGroup ?? 'PEER',
            items: response.items.map((item) => ({
              keywordId: item.keywordId,
              keywordTextSnapshot: item.keywordTextSnapshot,
              polarity: item.polarity,
              category: item.category,
              evaluatorGroup: item.evaluatorGroup,
            })),
          })),
          minimumResponses: selectedCycle.resultPrivacyThreshold,
          selectedGroup: params.evaluatorGroup ?? 'ALL',
        })

        const published = selectedCycle.status === 'PUBLISHED'
        const resultVisible = published && aggregated.thresholdMet

        return {
          resultVisible,
          hiddenReason: !published
            ? '결과가 아직 공개되지 않았습니다.'
            : aggregated.thresholdMet
              ? undefined
              : `응답 수가 공개 기준(${selectedCycle.resultPrivacyThreshold}명)보다 적어 결과를 숨깁니다.`,
          availableGroups: ['ALL', ...cycleGroups] as Array<'ALL' | WordCloudEvaluatorGroup>,
          selectedGroup: params.evaluatorGroup ?? 'ALL',
          responseCount: aggregated.responseCount,
          positiveSelectionCount: aggregated.positiveSelectionCount,
          negativeSelectionCount: aggregated.negativeSelectionCount,
          positiveCloud: mapCloudItems(aggregated.positiveKeywords.slice(0, 30)),
          negativeCloud: mapCloudItems(aggregated.negativeKeywords.slice(0, 30)),
          positiveTopKeywords: mapCloudItems(aggregated.positiveKeywords.slice(0, 10)),
          negativeTopKeywords: mapCloudItems(aggregated.negativeKeywords.slice(0, 10)),
          categorySummary: aggregated.categorySummary.map((item) => ({
            polarity: item.polarity,
            category: item.category,
            label: `${WORD_CLOUD_POLARITY_LABELS[item.polarity]} / ${WORD_CLOUD_CATEGORY_LABELS[item.category]}`,
            count: item.count,
          })),
          evaluatorGroupSummary: aggregated.evaluatorGroupSummary.map((item) => ({
            evaluatorGroup: item.evaluatorGroup,
            label: WORD_CLOUD_GROUP_LABELS[item.evaluatorGroup],
            responseCount: item.responseCount,
          })),
        }
      },
    })

    const adminView = canManage
      ? await buildAdminView({
          actorOrgId: actor.department.orgId,
          selectedCycle,
          alerts,
        })
      : undefined

    const assignmentCount = adminView?.progress.assignmentCount ?? evaluatorAssignments.length
    const submittedResponseCount =
      adminView?.progress.submittedCount ?? evaluatorAssignments.filter((item) => item.status === 'SUBMITTED').length
    const targetCount = adminView?.progress.targetCount ?? new Set(evaluatorAssignments.map((item) => item.evaluateeId)).size

    return {
      state: 'ready',
      alerts,
      currentUser: {
        id: actor.id,
        name: actor.empName,
        role: actor.role,
        department: actor.department.deptName,
      },
      permissions: {
        canManage,
        canEvaluate: evaluatorAssignments.length > 0,
        canViewOwnResult: true,
      },
      availableCycles,
      availableEvalCycles,
      selectedCycleId: selectedCycle.id,
      summary: {
        targetCount,
        assignmentCount,
        submittedResponseCount,
        published: selectedCycle.status === 'PUBLISHED',
        positiveSelectionLimit: selectedCycle.positiveSelectionLimit,
        negativeSelectionLimit: selectedCycle.negativeSelectionLimit,
        privacyThreshold: selectedCycle.resultPrivacyThreshold,
      },
      evaluatorView: {
        enabledGroups: cycleGroups,
        positiveSelectionLimit: selectedCycle.positiveSelectionLimit,
        negativeSelectionLimit: selectedCycle.negativeSelectionLimit,
        keywordPool,
        assignments: evaluatorAssignments,
      },
      evaluateeView,
      adminView,
    }
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 403) {
      return {
        state: 'permission-denied',
        message: error.message,
        availableCycles: [],
      }
    }

    console.error('Word cloud 360 page load failed:', error)
    return {
      state: 'error',
      message: '워드클라우드형 다면평가 화면을 준비하는 중 오류가 발생했습니다.',
      availableCycles: [],
    }
  }
}

export async function upsertWordCloud360Cycle(params: {
  actorId: string
  input: {
    cycleId?: string
    evalCycleId?: string
    cycleName: string
    startDate?: string
    endDate?: string
    positiveSelectionLimit: number
    negativeSelectionLimit: number
    resultPrivacyThreshold: number
    evaluatorGroups: WordCloudEvaluatorGroup[]
    notes?: string
    status: WordCloud360CycleStatus
  }
}) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }

  let evalCycleOrgId = actor.department.orgId
  if (params.input.evalCycleId) {
    const evalCycle = await prisma.evalCycle.findUnique({
      where: { id: params.input.evalCycleId },
    })
    if (!evalCycle || evalCycle.orgId !== actor.department.orgId) {
      throw new AppError(400, 'INVALID_EVAL_CYCLE', '연결할 PMS 평가 주기를 찾을 수 없습니다.')
    }
    evalCycleOrgId = evalCycle.orgId
  }

  const data = {
    orgId: evalCycleOrgId,
    evalCycleId: params.input.evalCycleId ?? null,
    cycleName: params.input.cycleName,
    startDate: params.input.startDate ? new Date(params.input.startDate) : null,
    endDate: params.input.endDate ? new Date(params.input.endDate) : null,
    positiveSelectionLimit: params.input.positiveSelectionLimit,
    negativeSelectionLimit: params.input.negativeSelectionLimit,
    resultPrivacyThreshold: params.input.resultPrivacyThreshold,
    evaluatorGroups: params.input.evaluatorGroups,
    notes: params.input.notes ?? null,
    status: params.input.status,
    publishedAt: params.input.status === 'PUBLISHED' ? new Date() : null,
    updatedById: params.actorId,
  }

  const cycle = params.input.cycleId
    ? await prisma.wordCloud360Cycle.update({
        where: { id: params.input.cycleId },
        data,
      })
    : await prisma.wordCloud360Cycle.create({
        data: {
          ...data,
          createdById: params.actorId,
        },
      })

  await createAuditLog({
    userId: params.actorId,
    action: params.input.cycleId ? 'UPDATE_WORD_CLOUD_360_CYCLE' : 'CREATE_WORD_CLOUD_360_CYCLE',
    entityType: 'WORD_CLOUD_360_CYCLE',
    entityId: cycle.id,
    newValue: {
      cycleName: cycle.cycleName,
      status: cycle.status,
    },
  })

  return cycle
}

export async function upsertWordCloud360Keyword(params: {
  actorId: string
  input: {
    keywordId?: string
    keyword: string
    polarity: WordCloudKeywordPolarity
    category: WordCloudKeywordCategory
    sourceType: WordCloudKeywordSourceType
    active: boolean
    displayOrder: number
    note?: string
    warningFlag: boolean
  }
}) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }

  const keyword = params.input.keywordId
    ? await prisma.wordCloud360Keyword.update({
        where: { id: params.input.keywordId },
        data: {
          keyword: params.input.keyword,
          polarity: params.input.polarity,
          category: params.input.category,
          sourceType: params.input.sourceType,
          active: params.input.active,
          displayOrder: params.input.displayOrder,
          note: params.input.note ?? null,
          warningFlag: params.input.warningFlag,
        },
      })
    : await prisma.wordCloud360Keyword.create({
        data: {
          orgId: actor.department.orgId,
          keyword: params.input.keyword,
          polarity: params.input.polarity,
          category: params.input.category,
          sourceType: params.input.sourceType,
          active: params.input.active,
          displayOrder: params.input.displayOrder,
          note: params.input.note ?? null,
          warningFlag: params.input.warningFlag,
        },
      })

  await createAuditLog({
    userId: params.actorId,
    action: params.input.keywordId ? 'UPDATE_WORD_CLOUD_360_KEYWORD' : 'CREATE_WORD_CLOUD_360_KEYWORD',
    entityType: 'WORD_CLOUD_360_KEYWORD',
    entityId: keyword.id,
    newValue: {
      keyword: keyword.keyword,
      polarity: keyword.polarity,
      active: keyword.active,
    },
  })

  return keyword
}

export async function seedDefaultWordCloudKeywords(params: { actorId: string }) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }

  const result = await prisma.wordCloud360Keyword.createMany({
    data: DEFAULT_WORD_CLOUD_KEYWORDS.map((keyword) => ({
      orgId: actor.department.orgId,
      keyword: keyword.keyword,
      polarity: keyword.polarity,
      category: keyword.category,
      sourceType: keyword.sourceType,
      active: true,
      displayOrder: keyword.displayOrder,
      note: keyword.note ?? null,
      warningFlag: keyword.warningFlag ?? false,
    })),
    skipDuplicates: true,
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'SEED_WORD_CLOUD_360_KEYWORDS',
    entityType: 'WORD_CLOUD_360_KEYWORD',
    newValue: {
      insertedCount: result.count,
    },
  })

  return result
}

export async function saveWordCloud360Assignments(params: {
  actorId: string
  cycleId: string
  assignments: Array<WordCloudAssignmentDraft>
}) {
  await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })

  const uniqueAssignments = Array.from(
    new Map(
      params.assignments.map((assignment) => [
        `${assignment.cycleId}:${assignment.evaluatorId}:${assignment.evaluateeId}:${assignment.evaluatorGroup}`,
        assignment,
      ])
    ).values()
  )

  await prisma.$transaction(
    uniqueAssignments.map((assignment) =>
      prisma.wordCloud360Assignment.upsert({
        where: {
          cycleId_evaluatorId_evaluateeId_evaluatorGroup: {
            cycleId: assignment.cycleId,
            evaluatorId: assignment.evaluatorId,
            evaluateeId: assignment.evaluateeId,
            evaluatorGroup: assignment.evaluatorGroup,
          },
        },
        update: {
          evaluatorGroup: assignment.evaluatorGroup,
        },
        create: assignment,
      })
    )
  )

  await createAuditLog({
    userId: params.actorId,
    action: 'UPSERT_WORD_CLOUD_360_ASSIGNMENTS',
    entityType: 'WORD_CLOUD_360_ASSIGNMENT',
    entityId: params.cycleId,
    newValue: {
      count: uniqueAssignments.length,
    },
  })

  return { count: uniqueAssignments.length }
}

export async function autoAssignWordCloud360Participants(params: {
  actorId: string
  cycleId: string
  includeSelf: boolean
  peerLimit: number
  subordinateLimit: number
}) {
  const { actor, cycle } = await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })

  const employees = await prisma.employee.findMany({
    where: {
      department: {
        orgId: actor.department.orgId,
      },
      status: {
        in: ['ACTIVE', 'ON_LEAVE'],
      },
    },
    select: {
      id: true,
      deptId: true,
      managerId: true,
      status: true,
    },
    orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
  })

  const suggestions = buildSuggestedWordCloudAssignments({
    cycleId: cycle.id,
    employees,
    includeSelf: params.includeSelf,
    peerLimit: params.peerLimit,
    subordinateLimit: params.subordinateLimit,
  })

  return saveWordCloud360Assignments({
    actorId: params.actorId,
    cycleId: params.cycleId,
    assignments: suggestions,
  })
}

export async function deleteWordCloud360Assignment(params: { actorId: string; assignmentId: string }) {
  const assignment = await prisma.wordCloud360Assignment.findUnique({
    where: { id: params.assignmentId },
  })
  if (!assignment) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '삭제할 편성 정보를 찾을 수 없습니다.')
  }

  await ensureCycleAccess({ cycleId: assignment.cycleId, actorId: params.actorId })
  await prisma.wordCloud360Assignment.delete({
    where: { id: params.assignmentId },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'DELETE_WORD_CLOUD_360_ASSIGNMENT',
    entityType: 'WORD_CLOUD_360_ASSIGNMENT',
    entityId: params.assignmentId,
  })
}

export async function saveWordCloud360Response(params: {
  actorId: string
  input: {
    assignmentId: string
    positiveKeywordIds: string[]
    negativeKeywordIds: string[]
    submitFinal: boolean
  }
}) {
  const assignment = await prisma.wordCloud360Assignment.findUnique({
    where: { id: params.input.assignmentId },
    include: {
      cycle: true,
      response: {
        include: {
          items: true,
        },
      },
    },
  })

  if (!assignment) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '응답 대상 편성을 찾을 수 없습니다.')
  }
  if (assignment.evaluatorId !== params.actorId) {
    throw new AppError(403, 'FORBIDDEN', '본인에게 배정된 평가만 작성할 수 있습니다.')
  }
  if (assignment.cycle.status !== 'OPEN') {
    throw new AppError(409, 'CYCLE_CLOSED', '현재 주기는 응답 작성 기간이 아닙니다.')
  }
  if (assignment.response?.status === 'SUBMITTED') {
    throw new AppError(409, 'ALREADY_SUBMITTED', '이미 제출된 응답은 수정할 수 없습니다.')
  }

  if (params.input.submitFinal) {
    const validation = validateWordCloudSelections({
      positiveKeywordIds: params.input.positiveKeywordIds,
      negativeKeywordIds: params.input.negativeKeywordIds,
      positiveLimit: assignment.cycle.positiveSelectionLimit,
      negativeLimit: assignment.cycle.negativeSelectionLimit,
    })

    if (!validation.isValid) {
      throw new AppError(400, 'INVALID_SELECTION', validation.errors[0] ?? '키워드 선택 규칙이 맞지 않습니다.')
    }
  }

  const selectedKeywordIds = [...params.input.positiveKeywordIds, ...params.input.negativeKeywordIds]
  const keywords = await prisma.wordCloud360Keyword.findMany({
    where: {
      id: { in: selectedKeywordIds },
      orgId: assignment.cycle.orgId,
      active: true,
    },
  })

  if (keywords.length !== selectedKeywordIds.length) {
    throw new AppError(400, 'KEYWORD_NOT_FOUND', '선택한 키워드 중 사용할 수 없는 항목이 있습니다.')
  }

  const positiveIds = new Set(params.input.positiveKeywordIds)
  const negativeIds = new Set(params.input.negativeKeywordIds)
  for (const keyword of keywords) {
    if (positiveIds.has(keyword.id) && keyword.polarity !== 'POSITIVE') {
      throw new AppError(400, 'INVALID_POLARITY', '긍정 영역에는 긍정 키워드만 선택할 수 있습니다.')
    }
    if (negativeIds.has(keyword.id) && keyword.polarity !== 'NEGATIVE') {
      throw new AppError(400, 'INVALID_POLARITY', '부정 영역에는 부정 키워드만 선택할 수 있습니다.')
    }
  }

  const saved = await prisma.$transaction(async (tx) => {
    const response =
      assignment.response ??
      (await tx.wordCloud360Response.create({
        data: {
          assignmentId: assignment.id,
          cycleId: assignment.cycleId,
          evaluatorId: assignment.evaluatorId,
          evaluateeId: assignment.evaluateeId,
          status: 'DRAFT',
        },
      }))

    await tx.wordCloud360ResponseItem.deleteMany({
      where: { responseId: response.id },
    })

    if (keywords.length) {
      await tx.wordCloud360ResponseItem.createMany({
        data: keywords.map((keyword) => ({
          responseId: response.id,
          keywordId: keyword.id,
          polarity: keyword.polarity,
          category: keyword.category,
          keywordTextSnapshot: keyword.keyword,
          evaluatorGroup: assignment.evaluatorGroup,
        })),
      })
    }

    const updatedResponse = await tx.wordCloud360Response.update({
      where: { id: response.id },
      data: {
        status: params.input.submitFinal ? 'SUBMITTED' : 'DRAFT',
        submittedAt: params.input.submitFinal ? new Date() : null,
      },
    })

    await tx.wordCloud360Assignment.update({
      where: { id: assignment.id },
      data: {
        status: params.input.submitFinal ? 'SUBMITTED' : 'IN_PROGRESS',
        draftSavedAt: params.input.submitFinal ? assignment.draftSavedAt : new Date(),
        submittedAt: params.input.submitFinal ? new Date() : null,
      },
    })

    return updatedResponse
  })

  await createAuditLog({
    userId: params.actorId,
    action: params.input.submitFinal ? 'SUBMIT_WORD_CLOUD_360_RESPONSE' : 'SAVE_WORD_CLOUD_360_RESPONSE_DRAFT',
    entityType: 'WORD_CLOUD_360_RESPONSE',
    entityId: saved.id,
    newValue: {
      positiveCount: params.input.positiveKeywordIds.length,
      negativeCount: params.input.negativeKeywordIds.length,
      status: saved.status,
    },
  })

  return saved
}

export async function publishWordCloud360Results(params: {
  actorId: string
  cycleId: string
  publish: boolean
}) {
  const { cycle } = await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })

  const updated = await prisma.wordCloud360Cycle.update({
    where: { id: cycle.id },
    data: {
      status: params.publish ? 'PUBLISHED' : 'CLOSED',
      publishedAt: params.publish ? new Date() : null,
      updatedById: params.actorId,
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: params.publish ? 'PUBLISH_WORD_CLOUD_360_RESULTS' : 'UNPUBLISH_WORD_CLOUD_360_RESULTS',
    entityType: 'WORD_CLOUD_360_CYCLE',
    entityId: cycle.id,
    newValue: {
      status: updated.status,
    },
  })

  return updated
}

export async function exportWordCloud360Results(params: {
  actorId: string
  cycleId: string
  format: 'csv' | 'xlsx'
}) {
  const { cycle } = await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })

  const responses = await prisma.wordCloud360Response.findMany({
    where: {
      cycleId: cycle.id,
      status: 'SUBMITTED',
    },
    include: {
      evaluatee: {
        include: {
          department: true,
        },
      },
      items: true,
    },
  })

  const grouped = new Map<string, typeof responses>()
  for (const response of responses) {
    const bucket = grouped.get(response.evaluateeId) ?? []
    bucket.push(response)
    grouped.set(response.evaluateeId, bucket)
  }

  const rows = Array.from(grouped.values()).flatMap((employeeResponses) => {
    const evaluatee = employeeResponses[0]?.evaluatee
    const aggregated = aggregateWordCloudResponses({
      responses: employeeResponses.map((response) => ({
        status: response.status,
        evaluatorGroup: response.items[0]?.evaluatorGroup ?? 'PEER',
        items: response.items.map((item) => ({
          keywordId: item.keywordId,
          keywordTextSnapshot: item.keywordTextSnapshot,
          polarity: item.polarity,
          category: item.category,
          evaluatorGroup: item.evaluatorGroup,
        })),
      })),
      minimumResponses: cycle.resultPrivacyThreshold,
    })

    return [...aggregated.positiveKeywords.slice(0, 10), ...aggregated.negativeKeywords.slice(0, 10)].map((item) => ({
      cycleName: cycle.cycleName,
      employeeNumber: evaluatee?.empId ?? '',
      employeeName: evaluatee?.empName ?? '',
      department: evaluatee?.department.deptName ?? '',
      responseCount: aggregated.responseCount,
      thresholdMet: aggregated.thresholdMet ? 'Y' : 'N',
      polarity: WORD_CLOUD_POLARITY_LABELS[item.polarity],
      keyword: item.keyword,
      category: WORD_CLOUD_CATEGORY_LABELS[item.category],
      count: item.count,
    }))
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'WordCloud360')

  if (params.format === 'csv') {
    return {
      body: Buffer.from(XLSX.utils.sheet_to_csv(worksheet), 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      fileName: `word-cloud-360-${cycle.cycleName}.csv`,
    }
  }

  return {
    body: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: `word-cloud-360-${cycle.cycleName}.xlsx`,
  }
}
