import { z } from 'zod'

export const CHECKIN_AI_FEEDBACK_STATUS_VALUES = [
  'good',
  'watch',
  'risk',
  'insufficient_data',
] as const

export const CHECKIN_AI_FEEDBACK_STATUS_LABELS: Record<CheckinAiFeedbackStatus, string> = {
  good: '안정',
  watch: '주의',
  risk: '리스크',
  insufficient_data: '정보 부족',
}

export const CHECKIN_AI_FEEDBACK_PRIORITY_LABELS: Record<CheckinAiFeedbackPriority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
}

const CheckinNextActionSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    reason: z.string().trim().min(1).max(500),
    priority: z.enum(['high', 'medium', 'low']),
    owner_hint: z.string().trim().min(1).max(120),
    due_hint: z.string().trim().min(1).max(120),
  })
  .strict()

export const CheckinAiFeedbackResultSchema = z
  .object({
    status: z.enum(CHECKIN_AI_FEEDBACK_STATUS_VALUES),
    headline: z.string().trim().min(1).max(180),
    summary: z.string().trim().min(1).max(1400),
    strengths: z.array(z.string().trim().min(1).max(360)).max(6),
    concerns: z.array(z.string().trim().min(1).max(360)).max(6),
    recommended_questions: z.array(z.string().trim().min(1).max(360)).max(8),
    next_actions: z.array(CheckinNextActionSchema).max(6),
    feedback_draft: z.string().trim().min(1).max(2200),
    coaching_tone_tip: z.string().trim().min(1).max(600),
    evidence_gaps: z.array(z.string().trim().min(1).max(360)).max(6),
    disclaimer: z.string().trim().min(1).max(600),
  })
  .strict()

export const CheckinAiFeedbackRequestSchema = z
  .object({
    employeeId: z.string().trim().min(1, '피드백 대상 구성원을 선택해 주세요.'),
  })
  .strict()

export type CheckinAiFeedbackStatus = (typeof CHECKIN_AI_FEEDBACK_STATUS_VALUES)[number]
export type CheckinAiFeedbackPriority = 'high' | 'medium' | 'low'
export type CheckinAiFeedbackRequest = z.infer<typeof CheckinAiFeedbackRequestSchema>
export type CheckinAiFeedbackResult = z.infer<typeof CheckinAiFeedbackResultSchema>

export type CheckinAiFeedbackContext = {
  employee: {
    departmentName: string
    position?: string | null
    roleLabel?: string | null
  }
  kpis: Array<{
    title: string
    status?: string | null
    weight?: number | null
    type?: string | null
    targetValue?: number | string | null
    linkedOrgKpiTitle?: string | null
    latestAchievementRate?: number | null
    riskFlags: string[]
  }>
  monthlyRecords: Array<{
    month: string
    kpiTitle?: string | null
    achievementRate?: number | null
    activities?: string | null
    obstacles?: string | null
    efforts?: string | null
    evidenceComment?: string | null
    submitted: boolean
  }>
  checkins: Array<{
    date: string
    type: string
    status: string
    agendaTopics: string[]
    ownerNotes?: string | null
    managerNotes?: string | null
    summary?: string | null
    energyLevel?: number | null
    satisfactionLevel?: number | null
    blockerCount?: number | null
    actionItems: Array<{
      title: string
      priority: 'LOW' | 'MEDIUM' | 'HIGH'
      completed: boolean
      dueDate?: string | null
    }>
    kpiDiscussed: Array<{
      progress?: string | null
      concern?: string | null
      support?: string | null
    }>
  }>
  feedbacks: Array<{
    date: string
    relationship?: string | null
    comment?: string | null
  }>
  openActions: Array<{
    title: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    dueDate?: string | null
    overdue: boolean
    sourceDate?: string | null
  }>
  generatedAt?: string
}

export type CheckinAiFeedbackResponse = {
  requestLogId: string
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: CheckinAiFeedbackResult
}

export const CHECKIN_AI_FEEDBACK_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'status',
    'headline',
    'summary',
    'strengths',
    'concerns',
    'recommended_questions',
    'next_actions',
    'feedback_draft',
    'coaching_tone_tip',
    'evidence_gaps',
    'disclaimer',
  ],
  properties: {
    status: {
      type: 'string',
      enum: [...CHECKIN_AI_FEEDBACK_STATUS_VALUES],
    },
    headline: { type: 'string' },
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    concerns: {
      type: 'array',
      items: { type: 'string' },
    },
    recommended_questions: {
      type: 'array',
      items: { type: 'string' },
    },
    next_actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'reason', 'priority', 'owner_hint', 'due_hint'],
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          owner_hint: { type: 'string' },
          due_hint: { type: 'string' },
        },
      },
    },
    feedback_draft: { type: 'string' },
    coaching_tone_tip: { type: 'string' },
    evidence_gaps: {
      type: 'array',
      items: { type: 'string' },
    },
    disclaimer: { type: 'string' },
  },
} as const

function clipText(value: string | null | undefined, limit = 700) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed
}

function normalizeRate(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null
}

export function normalizeCheckinAiFeedbackInput(context: CheckinAiFeedbackContext) {
  return {
    purpose: 'leader_checkin_coaching',
    target_profile: {
      department_name: clipText(context.employee.departmentName, 160),
      position: clipText(context.employee.position ?? null, 80),
      role_label: clipText(context.employee.roleLabel ?? null, 80),
    },
    kpis: context.kpis.slice(0, 8).map((kpi) => ({
      title: clipText(kpi.title, 220),
      status: kpi.status ?? null,
      weight: typeof kpi.weight === 'number' ? kpi.weight : null,
      kpi_type: kpi.type ?? null,
      target_value: kpi.targetValue ?? null,
      linked_org_kpi: clipText(kpi.linkedOrgKpiTitle ?? null, 220),
      latest_achievement_rate: normalizeRate(kpi.latestAchievementRate),
      risk_flags: kpi.riskFlags.slice(0, 5).map((item) => clipText(item, 220)).filter(Boolean),
    })),
    recent_monthly_records: context.monthlyRecords.slice(0, 10).map((record) => ({
      month: record.month,
      kpi_title: clipText(record.kpiTitle ?? null, 220),
      achievement_rate: normalizeRate(record.achievementRate),
      activities: clipText(record.activities),
      obstacles: clipText(record.obstacles),
      efforts: clipText(record.efforts),
      evidence_comment: clipText(record.evidenceComment),
      submitted: record.submitted,
    })),
    recent_checkins: context.checkins.slice(0, 8).map((checkin) => ({
      date: checkin.date,
      type: checkin.type,
      status: checkin.status,
      agenda_topics: checkin.agendaTopics.slice(0, 6).map((item) => clipText(item, 180)).filter(Boolean),
      owner_notes: clipText(checkin.ownerNotes),
      manager_notes: clipText(checkin.managerNotes),
      key_takeaways: clipText(checkin.summary),
      energy_level: checkin.energyLevel ?? null,
      satisfaction_level: checkin.satisfactionLevel ?? null,
      blocker_count: checkin.blockerCount ?? null,
      action_items: checkin.actionItems.slice(0, 8).map((item) => ({
        title: clipText(item.title, 220),
        priority: item.priority,
        completed: item.completed,
        due_date: item.dueDate ?? null,
      })),
      kpi_discussions: checkin.kpiDiscussed.slice(0, 6).map((item) => ({
        progress: clipText(item.progress, 260),
        concern: clipText(item.concern, 260),
        support: clipText(item.support, 260),
      })),
    })),
    submitted_feedback: context.feedbacks.slice(0, 5).map((feedback) => ({
      date: feedback.date,
      relationship: feedback.relationship ?? null,
      comment: clipText(feedback.comment, 700),
    })),
    open_actions: context.openActions.slice(0, 8).map((action) => ({
      title: clipText(action.title, 220),
      priority: action.priority,
      due_date: action.dueDate ?? null,
      overdue: action.overdue,
      source_date: action.sourceDate ?? null,
    })),
    evidence_counts: {
      kpis: context.kpis.length,
      monthly_records: context.monthlyRecords.length,
      checkins: context.checkins.length,
      submitted_feedbacks: context.feedbacks.length,
      open_actions: context.openActions.length,
    },
    generated_at: context.generatedAt ?? new Date().toISOString(),
  }
}

function isOverdueDate(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  date.setHours(23, 59, 59, 999)
  return date.getTime() < Date.now()
}

function compactUnique(values: Array<string | null | undefined>, limit: number) {
  const result: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed || result.includes(trimmed)) continue
    result.push(trimmed)
    if (result.length >= limit) break
  }
  return result
}

export function buildCheckinAiFeedbackFallbackResult(
  context: CheckinAiFeedbackContext,
  fallbackReason?: string | null
): CheckinAiFeedbackResult {
  const hasAnyEvidence =
    context.kpis.length > 0 ||
    context.monthlyRecords.length > 0 ||
    context.checkins.length > 0 ||
    context.feedbacks.length > 0 ||
    context.openActions.length > 0

  const lowRateRecords = context.monthlyRecords.filter(
    (record) => typeof record.achievementRate === 'number' && record.achievementRate < 80
  )
  const obstacleRecords = context.monthlyRecords.filter((record) => Boolean(record.obstacles?.trim()))
  const overdueActions = context.openActions.filter((action) => action.overdue || isOverdueDate(action.dueDate))
  const blockedCheckins = context.checkins.filter(
    (checkin) =>
      (typeof checkin.blockerCount === 'number' && checkin.blockerCount > 0) ||
      (typeof checkin.satisfactionLevel === 'number' && checkin.satisfactionLevel <= 2)
  )

  const evidenceGaps = compactUnique(
    [
      context.kpis.length ? null : '현재 개인 KPI 정보가 없습니다.',
      context.monthlyRecords.length ? null : '최근 월간 실적 기록이 없습니다.',
      context.checkins.length ? null : '최근 체크인 기록이 없습니다.',
      context.feedbacks.length ? null : '최근 제출된 피드백 코멘트가 없습니다.',
      context.openActions.length ? null : '미완료 액션아이템 정보가 없습니다.',
    ],
    6
  )

  const riskSignals = compactUnique(
    [
      ...lowRateRecords.map((record) =>
        `${record.month} ${record.kpiTitle ?? 'KPI'} 달성률이 ${Math.round(record.achievementRate ?? 0)}%로 낮습니다.`
      ),
      ...obstacleRecords.map((record) => `${record.month} 실적에 장애 요인이 기록되어 있습니다.`),
      overdueActions.length ? `기한이 지난 미완료 액션이 ${overdueActions.length}건 있습니다.` : null,
      blockedCheckins.length ? '최근 체크인에서 blocker 또는 낮은 만족도 신호가 확인됩니다.' : null,
      ...context.kpis.flatMap((kpi) => kpi.riskFlags),
    ],
    6
  )

  const status: CheckinAiFeedbackStatus = !hasAnyEvidence
    ? 'insufficient_data'
    : riskSignals.length >= 3 || overdueActions.length >= 2
      ? 'risk'
      : riskSignals.length > 0 || evidenceGaps.length >= 3
        ? 'watch'
        : 'good'

  const primaryKpi = context.kpis[0]
  const latestMonthly = context.monthlyRecords[0]
  const strengths = compactUnique(
    [
      context.kpis.length ? `개인 KPI ${context.kpis.length}건을 기준으로 체크인 대화를 준비할 수 있습니다.` : null,
      primaryKpi?.linkedOrgKpiTitle ? `상위 목표와 연결된 KPI가 확인됩니다: ${primaryKpi.linkedOrgKpiTitle}` : null,
      typeof latestMonthly?.achievementRate === 'number'
        ? `최근 월간 실적 달성률은 ${Math.round(latestMonthly.achievementRate)}%로 기록되어 있습니다.`
        : null,
      context.checkins.length ? `최근 체크인 기록 ${context.checkins.length}건으로 대화 흐름을 이어갈 수 있습니다.` : null,
      context.feedbacks.length ? '최근 제출된 피드백 코멘트를 대화 참고자료로 활용할 수 있습니다.' : null,
    ],
    4
  )

  const concerns = riskSignals.length
    ? riskSignals.slice(0, 5)
    : evidenceGaps.length
      ? evidenceGaps.slice(0, 5)
      : ['현재 자료 기준으로 큰 위험 신호는 두드러지지 않지만, 다음 액션 합의는 필요합니다.']

  const recommendedQuestions = compactUnique(
    [
      primaryKpi ? `${primaryKpi.title} 목표에서 이번 체크인 전에 가장 달라진 점은 무엇인가요?` : null,
      latestMonthly?.obstacles ? '최근 기록된 장애 요인은 아직 남아 있나요, 아니면 해소되었나요?' : null,
      lowRateRecords[0] ? `${lowRateRecords[0].kpiTitle ?? '달성률이 낮은 KPI'}의 보완을 위해 리더 지원이 필요한 부분은 무엇인가요?` : null,
      overdueActions.length ? '미완료 액션이 지연된 원인은 우선순위 문제인가요, 리소스 문제인가요?' : null,
      context.feedbacks.length ? '최근 피드백 중 이번 체크인에서 직접 다뤄야 할 내용은 무엇인가요?' : null,
      '다음 체크인 전까지 완료했다고 볼 수 있는 구체적인 결과물은 무엇인가요?',
      '현재 업무 에너지와 협업 상황을 1에서 5로 보면 어디에 가깝고, 이유는 무엇인가요?',
    ],
    6
  )

  type CheckinNextAction = CheckinAiFeedbackResult['next_actions'][number]
  const nextActionCandidates: Array<CheckinNextAction | null> = [
    overdueActions.length
      ? {
          title: '미완료 액션 재정렬',
          reason: '지연된 실행 항목은 체크인에서 원인과 지원 범위를 먼저 정리해야 합니다.',
          priority: 'high' as const,
          owner_hint: '리더와 팀원이 함께',
          due_hint: '이번 체크인 중',
        }
      : null,
    obstacleRecords.length
      ? {
          title: '장애 요인 지원안 합의',
          reason: '월간 실적에 기록된 장애 요인을 다음 실행 계획과 직접 연결해야 합니다.',
          priority: status === 'risk' ? ('high' as const) : ('medium' as const),
          owner_hint: '리더',
          due_hint: '다음 1주 이내',
        }
      : null,
    lowRateRecords.length
      ? {
          title: '낮은 달성률 KPI 보완 계획',
          reason: '낮은 달성률은 목표 조정 문제인지 실행 지원 문제인지 구분해야 합니다.',
          priority: status === 'risk' ? ('high' as const) : ('medium' as const),
          owner_hint: '팀원',
          due_hint: '다음 체크인 전',
        }
      : null,
    {
      title: '다음 체크인 기준 합의',
      reason: '피드백이 실제 실행으로 이어지려면 다음에 확인할 기준이 명확해야 합니다.',
      priority: 'medium' as const,
      owner_hint: '리더와 팀원이 함께',
      due_hint: '체크인 종료 전',
    },
  ]
  const nextActions = nextActionCandidates.filter((item): item is CheckinNextAction => item !== null)

  const headlineByStatus: Record<CheckinAiFeedbackStatus, string> = {
    good: '현재 흐름은 비교적 안정적입니다.',
    watch: '체크인에서 우선순위와 지원 범위를 확인해야 합니다.',
    risk: '지연 또는 실행 리스크를 구체적으로 다뤄야 합니다.',
    insufficient_data: '판단에 필요한 체크인 근거가 부족합니다.',
  }

  const summaryByStatus: Record<CheckinAiFeedbackStatus, string> = {
    good:
      '확인 가능한 KPI, 월간 실적, 체크인 기록을 기준으로 보면 즉시 큰 위험 신호는 두드러지지 않습니다. 이번 체크인에서는 현재 흐름을 인정하되 다음 확인 기준을 명확히 합의하는 것이 좋습니다.',
    watch:
      '일부 데이터에서 주의가 필요한 신호가 확인됩니다. 이번 체크인에서는 목표 자체의 문제인지, 실행 지원 또는 우선순위 정리가 필요한 문제인지 구분해 주세요.',
    risk:
      '낮은 달성률, 장애 요인, 지연 액션 등 실행 리스크가 확인됩니다. 평가식 판단보다 원인 분리, 지원 범위, 다음 액션의 due date 합의에 집중하는 것이 좋습니다.',
    insufficient_data:
      '현재 확보된 KPI, 월간 실적, 체크인 기록만으로는 팀원의 상태를 충분히 진단하기 어렵습니다. 일반적인 코칭 질문으로 대화를 시작하고, 다음 체크인 전까지 핵심 근거를 보강해 주세요.',
  }

  return {
    status,
    headline: headlineByStatus[status],
    summary: summaryByStatus[status],
    strengths: strengths.length ? strengths : ['현재 체크인 대화를 시작할 기본 대상 정보는 확인되었습니다.'],
    concerns,
    recommended_questions: recommendedQuestions,
    next_actions: nextActions.slice(0, 5),
    feedback_draft: [
      primaryKpi
        ? `${primaryKpi.title} 목표를 중심으로 최근 흐름을 함께 점검하고 싶습니다.`
        : '이번 체크인에서는 현재 업무 우선순위와 필요한 지원을 먼저 확인하고 싶습니다.',
      status === 'risk'
        ? '현재 자료에서 실행 리스크가 보여서, 원인을 함께 나누고 바로 조정할 액션을 합의하겠습니다.'
        : status === 'watch'
          ? '일부 주의 신호가 있어 목표 진행 방식과 지원 필요 여부를 구체적으로 확인하겠습니다.'
          : status === 'insufficient_data'
            ? '아직 판단 근거가 충분하지 않으니 최근 진행 상황과 막힌 부분을 편하게 공유해 주세요.'
            : '좋은 흐름은 유지하면서 다음 체크인 전까지 확인할 기준을 더 선명하게 맞추겠습니다.',
      '이 문안은 초안이며, 실제 대화에서는 팀원의 설명을 듣고 조정해 주세요.',
    ].join(' '),
    coaching_tone_tip:
      status === 'risk'
        ? '문제를 단정하기보다 “무엇이 막고 있는지”와 “어떤 지원이 필요한지”를 분리해서 묻는 톤이 좋습니다.'
        : status === 'insufficient_data'
          ? '자료 부족을 지적하기보다 대화에서 근거를 함께 채우는 톤으로 시작하세요.'
          : '인정과 확인을 먼저 하고, 마지막에 다음 액션의 기준과 시점을 함께 합의하세요.',
    evidence_gaps: evidenceGaps,
    disclaimer: fallbackReason
      ? 'AI 피드백을 생성하지 못해 현재 데이터 기반의 기본 가이드를 표시합니다. 공식 평가나 확정 피드백이 아닙니다.'
      : status === 'insufficient_data'
        ? '선택한 팀원의 데이터가 부족하여 일반적인 코칭 질문 위주로 제안합니다. 공식 평가나 확정 피드백이 아닙니다.'
        : '이 결과는 리더의 체크인 준비를 돕는 초안이며, 공식 평가나 확정 피드백이 아닙니다.',
  }
}

export function getCheckinAiFeedbackStatusLabel(status: CheckinAiFeedbackStatus) {
  return CHECKIN_AI_FEEDBACK_STATUS_LABELS[status]
}
