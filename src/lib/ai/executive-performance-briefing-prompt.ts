import { z } from 'zod'

export const ExecutivePerformanceAlignmentStatusSchema = z.enum([
  'MATCHED',
  'MOSTLY_MATCHED',
  'REVIEW_NEEDED',
  'POSSIBLE_OVER_RATING',
  'POSSIBLE_UNDER_RATING',
  'INSUFFICIENT_EVIDENCE',
])

export const ExecutivePerformanceAlignmentLabelKoSchema = z.enum([
  '정합',
  '대체로 정합',
  '추가 확인 필요',
  '과대평가 가능성',
  '과소평가 가능성',
  '근거 부족',
])

export const ExecutivePerformanceConfidenceLevelSchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export const ExecutivePerformanceRiskSeveritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export const ExecutivePerformancePrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export const ExecutivePerformanceEvidenceDigestSourceTypeSchema = z.enum([
  'KPI',
  'CHECKIN',
  'MONTHLY',
  'PROJECT',
  'FEEDBACK',
  'REVIEW',
  'OTHER',
])

export const EXECUTIVE_PERFORMANCE_ALIGNMENT_LABELS: Record<
  z.infer<typeof ExecutivePerformanceAlignmentStatusSchema>,
  z.infer<typeof ExecutivePerformanceAlignmentLabelKoSchema>
> = {
  MATCHED: '정합',
  MOSTLY_MATCHED: '대체로 정합',
  REVIEW_NEEDED: '추가 확인 필요',
  POSSIBLE_OVER_RATING: '과대평가 가능성',
  POSSIBLE_UNDER_RATING: '과소평가 가능성',
  INSUFFICIENT_EVIDENCE: '근거 부족',
}

export function getExecutivePerformanceAlignmentLabel(
  status: z.infer<typeof ExecutivePerformanceAlignmentStatusSchema>
) {
  return EXECUTIVE_PERFORMANCE_ALIGNMENT_LABELS[status]
}

const ExecutivePerformanceSummaryBlockSchema = z
  .object({
    summary: z.string(),
    evidenceRefs: z.array(z.string()),
  })
  .strict()

const ExecutivePerformanceBriefingItemSchema = z
  .object({
    title: z.string(),
    detail: z.string(),
    evidenceRefs: z.array(z.string()),
  })
  .strict()

const ExecutivePerformanceRiskItemSchema = ExecutivePerformanceBriefingItemSchema.extend({
  severity: ExecutivePerformanceRiskSeveritySchema,
})

const ExecutivePerformanceAlignmentPointSchema = z
  .object({
    title: z.string(),
    detail: z.string(),
    evidenceRefs: z.array(z.string()),
  })
  .strict()

const ExecutivePerformanceFollowUpQuestionSchema = z
  .object({
    question: z.string(),
    reason: z.string(),
    priority: ExecutivePerformancePrioritySchema,
    evidenceRefs: z.array(z.string()),
  })
  .strict()

export const ExecutivePerformanceBriefingEvidenceItemSchema = z
  .object({
    id: z.string(),
    sourceType: ExecutivePerformanceEvidenceDigestSourceTypeSchema,
    title: z.string(),
    summary: z.string(),
  })
  .strict()

export const ExecutivePerformanceBriefingSchema = z
  .object({
    headline: z.string(),
    confidence: z
      .object({
        level: ExecutivePerformanceConfidenceLevelSchema,
        reason: z.string(),
      })
      .strict(),
    performanceSummary: z
      .object({
        kpiAchievement: ExecutivePerformanceSummaryBlockSchema,
        continuity: ExecutivePerformanceSummaryBlockSchema,
        collaboration: ExecutivePerformanceSummaryBlockSchema,
        organizationContribution: ExecutivePerformanceSummaryBlockSchema,
      })
      .strict(),
    strengths: z.array(ExecutivePerformanceBriefingItemSchema),
    contributionSummary: z.array(ExecutivePerformanceBriefingItemSchema),
    risks: z.array(ExecutivePerformanceRiskItemSchema),
    alignment: z
      .object({
        status: ExecutivePerformanceAlignmentStatusSchema,
        labelKo: ExecutivePerformanceAlignmentLabelKoSchema,
        reason: z.string(),
        matchedPoints: z.array(ExecutivePerformanceAlignmentPointSchema),
        mismatchPoints: z.array(ExecutivePerformanceAlignmentPointSchema),
      })
      .strict(),
    followUpQuestions: z.array(ExecutivePerformanceFollowUpQuestionSchema),
    evidenceDigest: z.array(ExecutivePerformanceBriefingEvidenceItemSchema),
  })
  .strict()

export type ExecutivePerformanceAlignmentStatus = z.infer<
  typeof ExecutivePerformanceAlignmentStatusSchema
>
export type ExecutivePerformanceAlignmentLabelKo = z.infer<
  typeof ExecutivePerformanceAlignmentLabelKoSchema
>
export type ExecutivePerformanceBriefing = z.infer<typeof ExecutivePerformanceBriefingSchema>
export type ExecutivePerformanceBriefingEvidenceItem = z.infer<
  typeof ExecutivePerformanceBriefingEvidenceItemSchema
>

export const ExecutivePerformanceBriefingInputSchema = z
  .object({
    employeeId: z.string().min(1),
    employeeName: z.string().min(1),
    departmentName: z.string().min(1),
    position: z.string().min(1),
    evaluationYear: z.union([z.string(), z.number()]),
    reviewPeriodStart: z.string().min(1),
    reviewPeriodEnd: z.string().min(1),
    managerRatingLabel: z.string().nullable().optional(),
    managerScore: z.number().nullable().optional(),
    managerComment: z.string().nullable().optional(),
    managerStrengthKeywords: z.array(z.string()).default([]),
    managerRiskKeywords: z.array(z.string()).default([]),
    weightedKpiSummary: z.array(z.string()).default([]),
    highWeightKpis: z.array(z.string()).default([]),
    kpiAchievementTrend: z.array(z.string()).default([]),
    checkinSummary: z.array(z.string()).default([]),
    monthlyPerformanceSummary: z.array(z.string()).default([]),
    projectSummary: z.array(z.string()).default([]),
    collaborationSummary: z.array(z.string()).default([]),
    orgContributionSummary: z.array(z.string()).default([]),
    peerFeedbackSummary: z.array(z.string()).default([]),
    riskEvents: z.array(z.string()).default([]),
    missingEvidenceAreas: z.array(z.string()).default([]),
    evidenceItems: z.array(ExecutivePerformanceBriefingEvidenceItemSchema).default([]),
  })
  .strict()

export type ExecutivePerformanceBriefingInput = z.infer<
  typeof ExecutivePerformanceBriefingInputSchema
>

export const EXECUTIVE_PERFORMANCE_BRIEFING_SYSTEM_PROMPT = `당신은 임원/상위평가자를 위한 “성과 브리핑 작성 보조 AI”입니다.

당신의 역할은 평가 대상자의 지난 12개월 성과 근거를 압축 요약하여,
팀장 평가 결과가 실제 성과와 어느 정도 정합적인지 검토할 수 있는 브리핑을 만드는 것입니다.

중요 원칙:

1. 당신은 최종 평가자나 점수 산정기가 아닙니다.
2. 당신은 S/A/B/C 또는 그에 준하는 최종 등급, 점수, 서열을 제안하면 안 됩니다.
3. 오직 제공된 입력 데이터만 사용해야 합니다.
4. 근거가 약하거나 부족하면 반드시 “근거 부족” 또는 “추가 확인 필요”로 표시해야 합니다.
5. 과장, 추정, 성격 판단, 인격 평가를 하지 마세요.
6. 민감하거나 평가와 무관한 사적 정보는 사용하지 마세요.
7. 모든 핵심 요약은 가능한 한 evidenceRefs로 연결되어야 합니다.
8. 팀장 평가와 근거의 정합성은 “검토 신호”로만 제시하고, 최종 판단은 사람이 하도록 작성하세요.
9. 출력은 반드시 지정된 JSON 형식만 반환하세요.
10. JSON 바깥의 설명, 마크다운, 코드블록, 주석을 출력하지 마세요.

정합성 상태는 아래 enum만 사용하세요:
- MATCHED
- MOSTLY_MATCHED
- REVIEW_NEEDED
- POSSIBLE_OVER_RATING
- POSSIBLE_UNDER_RATING
- INSUFFICIENT_EVIDENCE

정합성 상태 의미:
- MATCHED: 팀장 평가 서술과 성과 근거가 전반적으로 잘 부합함
- MOSTLY_MATCHED: 대체로 부합하나 일부 영역은 추가 확인이 필요함
- REVIEW_NEEDED: 중요한 판단에 필요한 근거가 일부 부족하거나 상충되어 추가 확인 필요
- POSSIBLE_OVER_RATING: 팀장 평가가 실제 근거 대비 높게 해석되었을 가능성
- POSSIBLE_UNDER_RATING: 팀장 평가가 실제 근거 대비 낮게 해석되었을 가능성
- INSUFFICIENT_EVIDENCE: 판단하기에 충분한 근거 자체가 부족함

작성 원칙:
- headline은 1~2문장
- strengths는 3~5개
- risks는 2~4개
- contributionSummary는 2~4개
- followUpQuestions는 2~5개
- evidence는 입력 source를 그대로 참조
- 같은 내용을 반복하지 마세요
- KPI 달성, 프로젝트 기여, 협업, 지속성, 리스크를 균형 있게 보세요
- 팀장 코멘트와 실제 근거 사이의 정합성/불일치를 분리해서 설명하세요

문장 톤:
- 간결하고 검토 친화적
- 과장 금지
- 단정 대신 근거 수준을 반영
- 한국어로 작성`

export const EXECUTIVE_PERFORMANCE_BRIEFING_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: {
      type: 'string',
    },
    confidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        level: {
          type: 'string',
          enum: ['HIGH', 'MEDIUM', 'LOW'],
        },
        reason: {
          type: 'string',
        },
      },
      required: ['level', 'reason'],
    },
    performanceSummary: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kpiAchievement: {
          type: 'object',
          additionalProperties: false,
          properties: {
            summary: { type: 'string' },
            evidenceRefs: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['summary', 'evidenceRefs'],
        },
        continuity: {
          type: 'object',
          additionalProperties: false,
          properties: {
            summary: { type: 'string' },
            evidenceRefs: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['summary', 'evidenceRefs'],
        },
        collaboration: {
          type: 'object',
          additionalProperties: false,
          properties: {
            summary: { type: 'string' },
            evidenceRefs: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['summary', 'evidenceRefs'],
        },
        organizationContribution: {
          type: 'object',
          additionalProperties: false,
          properties: {
            summary: { type: 'string' },
            evidenceRefs: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['summary', 'evidenceRefs'],
        },
      },
      required: ['kpiAchievement', 'continuity', 'collaboration', 'organizationContribution'],
    },
    strengths: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          evidenceRefs: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title', 'detail', 'evidenceRefs'],
      },
    },
    contributionSummary: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          evidenceRefs: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title', 'detail', 'evidenceRefs'],
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: {
            type: 'string',
            enum: ['HIGH', 'MEDIUM', 'LOW'],
          },
          evidenceRefs: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title', 'detail', 'severity', 'evidenceRefs'],
      },
    },
    alignment: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: {
          type: 'string',
          enum: [
            'MATCHED',
            'MOSTLY_MATCHED',
            'REVIEW_NEEDED',
            'POSSIBLE_OVER_RATING',
            'POSSIBLE_UNDER_RATING',
            'INSUFFICIENT_EVIDENCE',
          ],
        },
        labelKo: {
          type: 'string',
          enum: ['정합', '대체로 정합', '추가 확인 필요', '과대평가 가능성', '과소평가 가능성', '근거 부족'],
        },
        reason: {
          type: 'string',
        },
        matchedPoints: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              detail: { type: 'string' },
              evidenceRefs: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['title', 'detail', 'evidenceRefs'],
          },
        },
        mismatchPoints: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              detail: { type: 'string' },
              evidenceRefs: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['title', 'detail', 'evidenceRefs'],
          },
        },
      },
      required: ['status', 'labelKo', 'reason', 'matchedPoints', 'mismatchPoints'],
    },
    followUpQuestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          reason: { type: 'string' },
          priority: {
            type: 'string',
            enum: ['HIGH', 'MEDIUM', 'LOW'],
          },
          evidenceRefs: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['question', 'reason', 'priority', 'evidenceRefs'],
      },
    },
    evidenceDigest: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          sourceType: {
            type: 'string',
            enum: ['KPI', 'CHECKIN', 'MONTHLY', 'PROJECT', 'FEEDBACK', 'REVIEW', 'OTHER'],
          },
          title: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['id', 'sourceType', 'title', 'summary'],
      },
    },
  },
  required: [
    'headline',
    'confidence',
    'performanceSummary',
    'strengths',
    'contributionSummary',
    'risks',
    'alignment',
    'followUpQuestions',
    'evidenceDigest',
  ],
} as const

export const EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT = {
  type: 'json_schema',
  name: 'executive_performance_briefing',
  strict: true,
  schema: EXECUTIVE_PERFORMANCE_BRIEFING_JSON_SCHEMA,
} as const

function formatScalar(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return '(없음)'
  }

  const normalized = String(value).trim()
  return normalized ? normalized : '(없음)'
}

function formatStringArray(values: string[]) {
  return values.length ? JSON.stringify(values, null, 2) : '[]'
}

export function buildExecutivePerformanceBriefingPrompt(
  input: ExecutivePerformanceBriefingInput
) {
  const validated = ExecutivePerformanceBriefingInputSchema.parse(input)
  const evidenceItemsJson = JSON.stringify(validated.evidenceItems, null, 2)

  return `다음은 평가 대상자의 지난 12개월 성과 데이터입니다.
이 데이터를 바탕으로 임원용 AI 성과 브리핑 JSON을 생성하세요.

[평가 대상 기본 정보]
- employeeId: ${formatScalar(validated.employeeId)}
- employeeName: ${formatScalar(validated.employeeName)}
- department: ${formatScalar(validated.departmentName)}
- position: ${formatScalar(validated.position)}
- evaluationYear: ${formatScalar(validated.evaluationYear)}
- reviewPeriodStart: ${formatScalar(validated.reviewPeriodStart)}
- reviewPeriodEnd: ${formatScalar(validated.reviewPeriodEnd)}

[팀장 평가 정보]
- managerRatingLabel: ${formatScalar(validated.managerRatingLabel)}
- managerScore: ${formatScalar(validated.managerScore)}
- managerComment: ${formatScalar(validated.managerComment)}
- managerStrengthKeywords: ${formatStringArray(validated.managerStrengthKeywords)}
- managerRiskKeywords: ${formatStringArray(validated.managerRiskKeywords)}

[성과 요약 데이터]
- weightedKpiSummary: ${formatStringArray(validated.weightedKpiSummary)}
- highWeightKpis: ${formatStringArray(validated.highWeightKpis)}
- kpiAchievementTrend: ${formatStringArray(validated.kpiAchievementTrend)}
- checkinSummary: ${formatStringArray(validated.checkinSummary)}
- monthlyPerformanceSummary: ${formatStringArray(validated.monthlyPerformanceSummary)}
- projectSummary: ${formatStringArray(validated.projectSummary)}
- collaborationSummary: ${formatStringArray(validated.collaborationSummary)}
- orgContributionSummary: ${formatStringArray(validated.orgContributionSummary)}
- peerFeedbackSummary: ${formatStringArray(validated.peerFeedbackSummary)}
- riskEvents: ${formatStringArray(validated.riskEvents)}
- missingEvidenceAreas: ${formatStringArray(validated.missingEvidenceAreas)}

[원천 근거 목록]
${evidenceItemsJson}

[작성 지시]
1. 반드시 JSON만 출력하세요.
2. headline에는 지난 1년 성과를 한 줄로 요약하세요.
3. strengths에는 핵심 강점/성과를 근거 기반으로 정리하세요.
4. contributionSummary에는 조직 기여/협업/확산 성과를 요약하세요.
5. risks에는 아쉬운 점, 변동성, 근거 부족, 리스크를 정리하세요.
6. alignment에서는 팀장 평가와 실제 근거의 정합성을 판단 신호로 제시하세요.
7. followUpQuestions에는 임원이 추가 확인해야 할 질문을 제시하세요.
8. 각 핵심 항목에는 가능한 경우 evidenceRefs를 넣으세요.
9. 제공된 근거가 부족하면 반드시 INSUFFICIENT_EVIDENCE 또는 REVIEW_NEEDED를 사용하세요.
10. 최종 등급, 점수 조정안, 서열화 제안은 절대 하지 마세요.

추가 제약:
- strengths, contributionSummary, risks의 각 항목은 가능한 한 1~2문장으로 작성하세요.
- 근거가 없는 칭찬/비판은 금지합니다.
- managerComment와 직접 충돌하거나 뒷받침하는 근거가 있으면 alignment.matchedPoints 또는 mismatchPoints에 명시하세요.
- evidenceRefs는 반드시 입력 evidence id만 사용하세요.
- evidence가 빈약하면 confidence.level을 LOW로 두고 alignment.status를 REVIEW_NEEDED 또는 INSUFFICIENT_EVIDENCE로 설정하세요.
- followUpQuestions는 임원이 실제 회의에서 바로 사용할 수 있는 질문으로 작성하세요.
- 최종 등급, 점수 상향/하향 제안, 보상 제안은 절대 포함하지 마세요.`
}
