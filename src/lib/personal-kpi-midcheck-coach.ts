import { z } from 'zod'
import type { MonthlyAttachmentItem } from './monthly-attachments'
import { MonthlyAttachmentsSchema, MonthlyEvidenceCommentSchema } from './validations'

export const PERSONAL_KPI_MIDCHECK_STATUS_VALUES = [
  'on_track',
  'watch',
  'risk',
  'insufficient_data',
] as const

export type PersonalKpiMidcheckStatus = (typeof PERSONAL_KPI_MIDCHECK_STATUS_VALUES)[number]

export const PERSONAL_KPI_MIDCHECK_STATUS_LABELS: Record<PersonalKpiMidcheckStatus, string> = {
  on_track: '순항',
  watch: '주의',
  risk: '리스크',
  insufficient_data: '정보 부족',
}

const MidcheckActionSchema = z
  .object({
    title: z.string(),
    reason: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    due_hint: z.string(),
  })
  .strict()

const MidcheckEvidenceFeedbackSchema = z
  .object({
    sufficiency: z.enum(['sufficient', 'partial', 'insufficient']),
    cited_evidence: z.array(z.string()),
    missing_items: z.array(z.string()),
  })
  .strict()

export const PersonalKpiMidcheckCoachResultSchema = z
  .object({
    status: z.enum(PERSONAL_KPI_MIDCHECK_STATUS_VALUES),
    headline: z.string(),
    summary: z.string(),
    strengths: z.array(z.string()),
    gaps: z.array(z.string()),
    risk_signals: z.array(z.string()),
    next_actions: z.array(MidcheckActionSchema),
    coaching_questions: z.array(z.string()),
    employee_update_draft: z.string(),
    manager_share_draft: z.string(),
    evidence_feedback: MidcheckEvidenceFeedbackSchema,
    disclaimer: z.string(),
  })
  .strict()

export type PersonalKpiMidcheckCoachResult = z.infer<typeof PersonalKpiMidcheckCoachResultSchema>

export const PersonalKpiMidcheckCoachRequestSchema = z
  .object({
    yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM 형식으로 입력해 주세요.'),
    evidenceComment: MonthlyEvidenceCommentSchema,
    attachments: MonthlyAttachmentsSchema.transform((value) => value ?? []),
  })
  .strict()

export type PersonalKpiMidcheckCoachRequest = z.infer<typeof PersonalKpiMidcheckCoachRequestSchema>

export type PersonalKpiMidcheckCoachInput = {
  kpi: {
    id: string
    title: string
    departmentName: string
    status?: string
    definition?: string
    formula?: string
    targetValue?: number | string
    unit?: string
    orgKpiTitle?: string | null
    reviewComment?: string
    monthlyAchievementRate?: number
    riskFlags?: string[]
  }
  yearMonth: string
  evidenceComment?: string
  attachments: MonthlyAttachmentItem[]
  recentMonthlyRecords: Array<{
    month: string
    achievementRate?: number
    activities?: string | null
    obstacles?: string | null
    evidenceComment?: string | null
  }>
}

export const PERSONAL_KPI_MIDCHECK_COACH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'status',
    'headline',
    'summary',
    'strengths',
    'gaps',
    'risk_signals',
    'next_actions',
    'coaching_questions',
    'employee_update_draft',
    'manager_share_draft',
    'evidence_feedback',
    'disclaimer',
  ],
  properties: {
    status: {
      type: 'string',
      enum: [...PERSONAL_KPI_MIDCHECK_STATUS_VALUES],
    },
    headline: { type: 'string' },
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
    },
    risk_signals: {
      type: 'array',
      items: { type: 'string' },
    },
    next_actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'reason', 'priority', 'due_hint'],
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          due_hint: { type: 'string' },
        },
      },
    },
    coaching_questions: {
      type: 'array',
      items: { type: 'string' },
    },
    employee_update_draft: { type: 'string' },
    manager_share_draft: { type: 'string' },
    evidence_feedback: {
      type: 'object',
      additionalProperties: false,
      required: ['sufficiency', 'cited_evidence', 'missing_items'],
      properties: {
        sufficiency: {
          type: 'string',
          enum: ['sufficient', 'partial', 'insufficient'],
        },
        cited_evidence: {
          type: 'array',
          items: { type: 'string' },
        },
        missing_items: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    disclaimer: { type: 'string' },
  },
} as const

export function getPersonalKpiMidcheckStatusLabel(status: PersonalKpiMidcheckStatus) {
  return PERSONAL_KPI_MIDCHECK_STATUS_LABELS[status]
}

export function applyCoachDraftToEvidenceComment(currentValue: string, draft: string) {
  const trimmedCurrent = currentValue.trim()
  const trimmedDraft = draft.trim()

  if (!trimmedDraft) {
    return trimmedCurrent
  }

  if (!trimmedCurrent) {
    return trimmedDraft
  }

  if (trimmedCurrent.includes(trimmedDraft)) {
    return trimmedCurrent
  }

  return `${trimmedCurrent}\n\n[AI 제안]\n${trimmedDraft}`
}

export function normalizePersonalKpiMidcheckCoachInput(input: PersonalKpiMidcheckCoachInput) {
  return {
    kpi: {
      title: input.kpi.title,
      department_name: input.kpi.departmentName,
      status: input.kpi.status ?? null,
      definition: input.kpi.definition ?? null,
      formula: input.kpi.formula ?? null,
      target_value: input.kpi.targetValue ?? null,
      unit: input.kpi.unit ?? null,
      linked_org_kpi: input.kpi.orgKpiTitle ?? null,
      review_comment: input.kpi.reviewComment ?? null,
      latest_achievement_rate: input.kpi.monthlyAchievementRate ?? null,
      risk_flags: input.kpi.riskFlags ?? [],
    },
    evidence: {
      year_month: input.yearMonth,
      evidence_comment: input.evidenceComment ?? null,
      attachments: input.attachments.map((attachment) => ({
        type: attachment.type,
        name: attachment.name,
        kind: attachment.kind,
        comment: attachment.comment ?? null,
        uploaded_at: attachment.uploadedAt ?? null,
        uploaded_by: attachment.uploadedBy ?? null,
        size_label: attachment.type === 'FILE' ? attachment.sizeLabel ?? null : null,
        url: attachment.type === 'LINK' ? attachment.url ?? null : null,
      })),
      recent_monthly_records: input.recentMonthlyRecords.map((record) => ({
        month: record.month,
        achievement_rate: record.achievementRate ?? null,
        activities: record.activities ?? null,
        obstacles: record.obstacles ?? null,
        evidence_comment: record.evidenceComment ?? null,
      })),
    },
  }
}

export function buildPersonalKpiMidcheckCoachFallbackResult(
  input: PersonalKpiMidcheckCoachInput,
  fallbackReason?: string | null
): PersonalKpiMidcheckCoachResult {
  const attachmentReferences = input.attachments
    .slice(0, 5)
    .map((attachment) =>
      attachment.type === 'LINK'
        ? `${attachment.name}${attachment.comment ? ` · ${attachment.comment}` : ''}`
        : `${attachment.name}${attachment.comment ? ` · ${attachment.comment}` : ''}`
    )

  const monthlyHighlights = input.recentMonthlyRecords
    .slice(0, 3)
    .flatMap((record) => {
      const parts = [
        typeof record.achievementRate === 'number' ? `${record.month} 달성률 ${Math.round(record.achievementRate)}%` : null,
        record.activities?.trim() ? `${record.month} 활동: ${record.activities.trim()}` : null,
        record.obstacles?.trim() ? `${record.month} 이슈: ${record.obstacles.trim()}` : null,
      ]
      return parts.filter((item): item is string => Boolean(item))
    })

  const citedEvidence = [...attachmentReferences, ...monthlyHighlights].slice(0, 6)
  const hasDirectEvidence =
    citedEvidence.length > 0 || (input.evidenceComment?.trim().length ?? 0) > 0
  const latestRate = input.kpi.monthlyAchievementRate
  const hasRiskFlags = (input.kpi.riskFlags?.length ?? 0) > 0

  const status: PersonalKpiMidcheckStatus = !hasDirectEvidence
    ? 'insufficient_data'
    : hasRiskFlags || (typeof latestRate === 'number' && latestRate < 60)
      ? 'risk'
      : typeof latestRate === 'number' && latestRate < 85
        ? 'watch'
        : 'on_track'

  const sufficiency =
    !hasDirectEvidence ? 'insufficient' : citedEvidence.length < 2 ? 'partial' : 'sufficient'

  const missingItems =
    sufficiency === 'sufficient'
      ? []
      : [
          '최근 진행 결과를 보여주는 핵심 증빙',
          '현재 달성 수준을 설명하는 간단 코멘트',
          '다음 점검 전까지 확인할 실행 계획',
        ]

  const summaryByStatus: Record<PersonalKpiMidcheckStatus, string> = {
    on_track: '현재 입력된 KPI와 최근 증빙을 보면 전반적인 흐름은 안정적으로 보입니다. 다만 다음 점검 전까지 핵심 근거를 더 정리하면 대화 품질이 좋아집니다.',
    watch: '일부 진행 신호는 확인되지만 성과 흐름과 증빙 설명이 충분히 연결되지는 않았습니다. 다음 점검 전까지 핵심 근거와 우선순위를 더 선명하게 정리해 주세요.',
    risk: '리스크 신호 또는 낮은 실행 흐름이 보입니다. 목표 자체를 조정할 문제인지, 실행 지원이 필요한 문제인지 구분해서 점검하는 것이 좋습니다.',
    insufficient_data: '입력된 정보만으로는 현재 상태를 충분히 판단하기 어렵습니다. 우선 최근 진행 근거와 간단한 설명을 보강한 뒤 다시 점검해 주세요.',
  }

  const disclaimer = fallbackReason
    ? 'AI 코칭을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    : sufficiency === 'insufficient'
      ? '증빙 자료가 부족하여 보완이 필요한 항목 위주로 안내합니다.'
      : '입력된 정보가 충분하지 않아 일반적인 가이드 중심으로 제안했습니다.'

  return {
    status,
    headline:
      status === 'on_track'
        ? '현재 흐름은 안정적입니다.'
        : status === 'watch'
          ? '중간 점검에서 우선순위 재확인이 필요합니다.'
          : status === 'risk'
            ? '목표 조정 또는 실행 지원 점검이 필요합니다.'
            : '판단에 필요한 증빙이 더 필요합니다.',
    summary: summaryByStatus[status],
    strengths:
      status === 'insufficient_data'
        ? ['현재 KPI 기본 정보는 정리되어 있습니다.']
        : [
            input.kpi.orgKpiTitle ? `상위 목표 연결: ${input.kpi.orgKpiTitle}` : '현재 KPI 기준 정보가 정리되어 있습니다.',
            ...(typeof latestRate === 'number' ? [`최근 달성 흐름: ${Math.round(latestRate)}%`] : []),
          ].slice(0, 3),
    gaps: missingItems.slice(0, 3),
    risk_signals: [
      ...(input.kpi.riskFlags ?? []),
      ...(status === 'risk' ? ['성과 흐름과 증빙 설명을 함께 점검할 필요가 있습니다.'] : []),
      ...(status === 'insufficient_data' ? ['현재 입력 정보만으로는 중간 점검 판단이 어렵습니다.'] : []),
    ].slice(0, 4),
    next_actions: [
      {
        title: '핵심 증빙 정리',
        reason: '중간 점검 대화는 최근 실행 근거가 정리되어 있을수록 정확해집니다.',
        priority: 'high',
        due_hint: '다음 1:1 전',
      },
      {
        title: '목표 유효성 재확인',
        reason: '현재 목표가 여전히 우선순위와 맞는지 확인해야 실행 문제와 목표 문제를 구분할 수 있습니다.',
        priority: status === 'risk' ? 'high' : 'medium',
        due_hint: '이번 주',
      },
      {
        title: '다음 액션 합의',
        reason: '점검 이후 바로 실행할 후속 조치가 명확해야 중간 점검이 기록으로 끝나지 않습니다.',
        priority: 'medium',
        due_hint: '중간 점검 직후',
      },
    ],
    coaching_questions: [
      '이 목표가 지금도 가장 중요한 우선순위와 맞나요?',
      '현재 증빙만으로 설명되지 않는 진행 상황이 있다면 무엇인가요?',
      '다음 점검 전까지 꼭 확인해야 할 실행 장애물은 무엇인가요?',
    ],
    employee_update_draft: [
      `${input.kpi.title} 관련 최근 진행 상황을 기준으로 현재 흐름을 점검했습니다.`,
      input.evidenceComment?.trim() ? input.evidenceComment.trim() : '현재 입력된 증빙은 핵심 근거 중심으로 정리할 필요가 있습니다.',
      '다음 점검 전까지 핵심 증빙과 후속 액션을 보강하겠습니다.',
    ]
      .filter(Boolean)
      .join(' '),
    manager_share_draft: [
      `${input.kpi.title} 중간 점검용 공유 문안입니다.`,
      status === 'risk'
        ? '목표 조정 필요 여부와 실행 지원 필요 여부를 함께 확인하고자 합니다.'
        : status === 'insufficient_data'
          ? '판단 근거가 부족해 최근 증빙 보강이 먼저 필요합니다.'
          : '현재 흐름과 다음 액션을 함께 점검하고자 합니다.',
      citedEvidence.length ? `주요 근거: ${citedEvidence.join(' / ')}` : '주요 근거는 추가 보강이 필요합니다.',
    ].join(' '),
    evidence_feedback: {
      sufficiency,
      cited_evidence: citedEvidence,
      missing_items: missingItems,
    },
    disclaimer,
  }
}
