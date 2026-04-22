import { z } from 'zod'
import { reviewEmailHtmlToText } from './review-email-editor'
import { CALIBRATION_DISCUSSION_STATUS_OPTIONS } from './calibration-workspace'
import {
  CALIBRATION_DECISION_POLICY_OPTIONS,
  CALIBRATION_MEMO_COMMENT_POLICY_OPTIONS,
  CALIBRATION_REFERENCE_DISTRIBUTION_USE_OPTIONS,
  CALIBRATION_REFERENCE_DISTRIBUTION_VISIBILITY_OPTIONS,
  CALIBRATION_SCOPE_MODE_OPTIONS,
  CALIBRATION_SESSION_TYPE_OPTIONS,
  CALIBRATION_VISIBLE_COLUMN_OPTIONS,
} from './calibration-session-setup'

// ============================================
// 議곗쭅??愿??
// ============================================

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1, '조직명을 입력해 주세요.').max(100),
  fiscalYear: z.number().int().min(2020).max(2100),
})

// ============================================
// ?깃툒 ?ㅼ젙 愿??
// ============================================

export const GradeSettingSchema = z.object({
  gradeOrder: z.number().int().min(1),
  gradeName: z.string().min(1).max(5, '?깃툒紐낆? 5???대궡'),
  baseScore: z.number().int().min(0).max(100),
  minScore: z.number().int().min(0).max(100),
  maxScore: z.number().int().min(0).max(100),
  levelName: z.string().min(1).max(20),
  description: z.string().max(200).optional(),
  targetDistRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().default(true),
}).refine(data => data.minScore <= data.maxScore, {
  message: '최소 점수는 최대 점수보다 작거나 같아야 합니다.',
  path: ['minScore'],
})

export const UpdateGradeSettingsSchema = z.object({
  evalYear: z.number().int().min(2020).max(2100),
  grades: z.array(GradeSettingSchema).min(2).max(10),
})

// ============================================
// KPI 愿??
// ============================================

const OrgKpiTargetValueSchema = {
  targetValueT: z.number().min(0, 'T 紐⑺몴媛믪? 0 ?댁긽?댁뼱???⑸땲??'),
  targetValueE: z.number().min(0, 'E 紐⑺몴媛믪? 0 ?댁긽?댁뼱???⑸땲??'),
  targetValueS: z.number().min(0, 'S 紐⑺몴媛믪? 0 ?댁긽?댁뼱???⑸땲??'),
}

function hasCompleteOrgKpiTargetValues(data: {
  targetValueT?: number
  targetValueE?: number
  targetValueS?: number
}) {
  return (
    data.targetValueT !== undefined &&
    data.targetValueE !== undefined &&
    data.targetValueS !== undefined
  )
}

function isOrderedOrgKpiTargetValues(data: {
  targetValueT?: number
  targetValueE?: number
  targetValueS?: number
}) {
  if (!hasCompleteOrgKpiTargetValues(data)) {
    return true
  }

  const { targetValueT, targetValueE, targetValueS } = data as {
    targetValueT: number
    targetValueE: number
    targetValueS: number
  }

  return targetValueT <= targetValueE && targetValueE <= targetValueS
}

const ORG_KPI_LONG_TEXT_MAX = 50_000
const BUSINESS_PLAN_SUMMARY_MAX = 20_000
const BUSINESS_PLAN_BODY_MAX = 100_000
const JOB_DESCRIPTION_SUMMARY_MAX = 20_000
const JOB_DESCRIPTION_BODY_MAX = 100_000

const orgKpiLongTextSchema = (label: string) =>
  z
    .string()
    .max(ORG_KPI_LONG_TEXT_MAX, `${label}???덈Т 源곷땲?? ${ORG_KPI_LONG_TEXT_MAX.toLocaleString()}???대궡濡??낅젰??二쇱꽭??`)

const businessPlanLongTextSchema = (label: string, max: number) =>
  z.string().max(max, `${label}???덈Т 源곷땲?? ${max.toLocaleString()}???대궡濡??낅젰??二쇱꽭??`)

const jobDescriptionLongTextSchema = (label: string, max: number) =>
  z.string().max(max, `${label}???덈Т 源곷땲?? ${max.toLocaleString()}???대궡濡??낅젰??二쇱꽭??`)

export const CreateOrgKpiSchema = z.object({
  deptId: z.string().min(1),
  evalYear: z.number().int().min(2020).max(2100),
  kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']),
  kpiCategory: z.string().min(1).max(50),
  kpiName: z.string().min(1).max(100),
  definition: orgKpiLongTextSchema('KPI ?뺤쓽').optional(),
  formula: orgKpiLongTextSchema('KPI ?곗떇').optional(),
  ...OrgKpiTargetValueSchema,
  unit: z.string().max(20).optional(),
  weight: z.number().min(0).max(100),
  difficulty: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  parentOrgKpiId: z.string().nullable().optional(),
}).refine(isOrderedOrgKpiTargetValues, {
  message: '紐⑺몴媛믪? T <= E <= S ?쒖꽌?ъ빞 ?⑸땲??',
  path: ['targetValueT'],
})

export const UpdateOrgKpiSchema = z.object({
  deptId: z.string().min(1).optional(),
  evalYear: z.number().int().min(2020).max(2100).optional(),
  kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']).optional(),
  kpiCategory: z.string().min(1).max(50).optional(),
  kpiName: z.string().min(1).max(100).optional(),
  definition: orgKpiLongTextSchema('KPI ?뺤쓽').optional(),
  formula: orgKpiLongTextSchema('KPI ?곗떇').optional(),
  targetValueT: OrgKpiTargetValueSchema.targetValueT.optional(),
  targetValueE: OrgKpiTargetValueSchema.targetValueE.optional(),
  targetValueS: OrgKpiTargetValueSchema.targetValueS.optional(),
  unit: z.string().max(20).optional(),
  weight: z.number().min(0).max(100).optional(),
  difficulty: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'ARCHIVED']).optional(),
  parentOrgKpiId: z.string().nullable().optional(),
})
  .refine(
    (data) => {
      const providedCount = [data.targetValueT, data.targetValueE, data.targetValueS].filter(
        (value) => value !== undefined
      ).length
      return providedCount === 0 || providedCount === 3
    },
    {
      message: 'T / E / S 紐⑺몴媛믪쓣 紐⑤몢 ?낅젰??二쇱꽭??',
      path: ['targetValueT'],
    }
  )
  .refine(isOrderedOrgKpiTargetValues, {
    message: '紐⑺몴媛믪? T <= E <= S ?쒖꽌?ъ빞 ?⑸땲??',
    path: ['targetValueT'],
  })

export const DeleteOrgKpiSchema = z
  .object({
    confirmDelete: z.boolean(),
  })
  .refine((data) => data.confirmDelete, {
    message: '??젣 ?뺤씤???꾩슂?⑸땲??',
    path: ['confirmDelete'],
  })

export const CloneOrgKpiSchema = z.object({
  targetDeptId: z.string().min(1),
  targetEvalYear: z.number().int().min(2020).max(2100),
  targetCycleId: z.string().min(1).optional(),
  includeProgress: z.boolean().default(false),
  includeCheckins: z.boolean().default(false),
})

export const CreatePersonalKpiSchema = z.object({
  employeeId: z.string().min(1),
  evalYear: z.number().int().min(2020).max(2100),
  kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']),
  kpiName: z.string().min(1).max(100),
  definition: z.string().max(500).optional(),
  formula: z.string().max(500).optional(),
  targetValue: z.number().optional(),
  unit: z.string().max(20).optional(),
  weight: z.number().min(0).max(100),
  difficulty: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  linkedOrgKpiId: z.string().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
})

export const UpdatePersonalKpiSchema = z.object({
  employeeId: z.string().min(1).optional(),
  evalYear: z.number().int().min(2020).max(2100).optional(),
  kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']).optional(),
  kpiName: z.string().min(1).max(100).optional(),
  definition: z.string().max(500).optional(),
  formula: z.string().max(500).optional(),
  targetValue: z.number().nullable().optional(),
  unit: z.string().max(20).optional(),
  weight: z.number().min(0).max(100).optional(),
  difficulty: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  linkedOrgKpiId: z.string().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'ARCHIVED']).optional(),
})

export const DeletePersonalKpiSchema = z
  .object({
    confirmDelete: z.boolean(),
  })
  .refine((data) => data.confirmDelete, {
    message: '??젣 ?뺤씤???꾩슂?⑸땲??',
    path: ['confirmDelete'],
  })

export const ClonePersonalKpiSchema = z.object({
  targetEmployeeId: z.string().min(1).optional(),
  assignToSelf: z.boolean().default(false),
  targetEvalYear: z.number().int().min(2020).max(2100),
  targetCycleId: z.string().min(1).optional(),
  includeProgress: z.boolean().default(false),
  includeCheckins: z.boolean().default(false),
})

export const BulkPersonalKpiEditSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(100),
    employeeId: z.string().min(1).optional(),
    linkedOrgKpiId: z.string().nullable().optional(),
    difficulty: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  })
  .refine(
    (data) =>
      data.employeeId !== undefined ||
      data.linkedOrgKpiId !== undefined ||
      data.difficulty !== undefined ||
      data.tags !== undefined,
    {
      message: '?쇨큵 ?섏젙????ぉ???섎굹 ?댁긽 ?좏깮??二쇱꽭??',
      path: ['ids'],
    }
  )

export const BulkOrgKpiEditSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(100),
    deptId: z.string().min(1).optional(),
    kpiCategory: z.string().min(1).max(50).optional(),
    parentOrgKpiId: z.string().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  })
  .refine(
    (data) =>
      data.deptId !== undefined ||
      data.kpiCategory !== undefined ||
      data.parentOrgKpiId !== undefined ||
      data.tags !== undefined,
    {
      message: '?쇨큵 ?섏젙????ぉ???섎굹 ?댁긽 ?좏깮??二쇱꽭??',
      path: ['ids'],
    }
  )

export const GoalExportSchema = z.object({
  mode: z.enum(['goal', 'employee']),
  year: z.coerce.number().int().min(2020).max(2100),
  departmentId: z.string().min(1).optional(),
})

export const PersonalKpiWorkflowActionSchema = z.object({
  action: z.enum(['SAVE_DRAFT', 'SUBMIT', 'START_REVIEW', 'APPROVE', 'REJECT', 'LOCK', 'REOPEN']),
  note: z.string().max(1000).optional(),
})

export const PersonalKpiAiActionSchema = z.object({
  action: z.enum([
    'generate-draft',
    'improve-wording',
    'smart-check',
    'suggest-weight',
    'suggest-org-alignment',
    'detect-duplicates',
    'summarize-review-risks',
    'draft-monthly-comment',
  ]),
  sourceId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
})

// ============================================
// ?붾퀎 ?ㅼ쟻 愿??
// ============================================

export const MonthlyRecordSchema = z.object({
  personalKpiId: z.string().min(1),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM 형식으로 입력해 주세요.'),
  actualValue: z.number().optional(),
  activities: z.string().max(1000).optional(),
  obstacles: z.string().max(500).optional(),
  efforts: z.string().max(500).optional(),
  attachments: z.array(z.object({
    id: z.string().max(100),
    name: z.string().min(1).max(200),
    kind: z.enum(['KPI', 'OUTPUT', 'REPORT', 'OTHER']).default('OTHER'),
    uploadedAt: z.string().optional(),
    uploadedBy: z.string().max(100).optional(),
    sizeLabel: z.string().max(30).optional(),
    dataUrl: z.string().max(2_000_000).optional(),
  })).optional(),
  isDraft: z.boolean().default(true),
})

export const UpdateMonthlyRecordSchema = z.object({
  actualValue: z.number().nullable().optional(),
  activities: z.string().max(1000).optional(),
  obstacles: z.string().max(500).optional(),
  efforts: z.string().max(500).optional(),
  attachments: z.array(z.object({
    id: z.string().max(100),
    name: z.string().min(1).max(200),
    kind: z.enum(['KPI', 'OUTPUT', 'REPORT', 'OTHER']).default('OTHER'),
    uploadedAt: z.string().optional(),
    uploadedBy: z.string().max(100).optional(),
    sizeLabel: z.string().max(30).optional(),
    dataUrl: z.string().max(2_000_000).optional(),
  })).optional(),
  isDraft: z.boolean().optional(),
})

export const MonthlyRecordWorkflowActionSchema = z.object({
  action: z.enum(['SUBMIT', 'REVIEW', 'REQUEST_UPDATE', 'LOCK', 'UNLOCK']),
  comment: z.string().max(1000).optional(),
})

export const MonthlyRecordAiActionSchema = z.object({
  action: z.enum([
    'generate-summary',
    'explain-risk',
    'generate-review',
    'summarize-evidence',
    'generate-retrospective',
    'suggest-checkin-agenda',
    'summarize-evaluation-evidence',
  ]),
  sourceId: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
})

// ============================================
// ?됯? 愿??
// ============================================

const EvaluationStageCommentSchema = z.string().trim().max(2000)
const EvaluationGuidanceSchema = z.string().trim().max(1500)

export const SubmitEvaluationSchema = z.object({
  comment: z.string().min(50, '종합 의견은 최소 50자 이상 입력해 주세요.').max(2000),
  strengthComment: z.string().trim().min(10, '강점 요약은 최소 10자 이상 입력해 주세요.').max(2000),
  improvementComment: z
    .string()
    .trim()
    .min(10, '보완 포인트는 최소 10자 이상 입력해 주세요.')
    .max(2000),
  nextStepGuidance: EvaluationGuidanceSchema.optional(),
  gradeId: z.string().optional(),
  items: z.array(z.object({
    personalKpiId: z.string(),
    quantScore: z.number().min(0).max(100).optional(),
    planScore: z.number().min(0).max(100).optional(),
    doScore: z.number().min(0).max(100).optional(),
    checkScore: z.number().min(0).max(100).optional(),
    actScore: z.number().min(0).max(100).optional(),
    itemComment: z.string().max(500).optional(),
  })),
})

export const SaveEvaluationDraftSchema = z.object({
  comment: EvaluationStageCommentSchema.optional(),
  strengthComment: EvaluationStageCommentSchema.optional(),
  improvementComment: EvaluationStageCommentSchema.optional(),
  nextStepGuidance: EvaluationGuidanceSchema.optional(),
  gradeId: z.string().nullable().optional(),
  items: z.array(z.object({
    personalKpiId: z.string(),
    quantScore: z.number().min(0).max(100).nullable().optional(),
    planScore: z.number().min(0).max(100).nullable().optional(),
    doScore: z.number().min(0).max(100).nullable().optional(),
    checkScore: z.number().min(0).max(100).nullable().optional(),
    actScore: z.number().min(0).max(100).nullable().optional(),
    itemComment: z.string().max(500).optional(),
  })).default([]),
})

export const RejectEvaluationSchema = z.object({
  rejectionReason: z.string().min(10, '반려 사유는 최소 10자 이상 입력해 주세요.').max(500),
})

export const CeoAdjustSchema = z.object({
  targetId: z.string(),
  gradeId: z.string().min(1, '등급을 선택해 주세요.'),
  adjustReason: z.string().min(30, '조정 사유는 최소 30자 이상 입력해 주세요.').max(500),
})

// ============================================
// ?ㅻ㈃?됯? 愿??
// ============================================

export const CreateFeedbackRoundSchema = z.object({
  evalCycleId: z.string().min(1),
  roundName: z.string().min(1).max(100),
  roundType: z.enum(['PEER', 'UPWARD', 'CROSS_DEPT', 'FULL_360', 'ANYTIME']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isAnonymous: z.boolean().default(true),
  minRaters: z.number().int().min(1).max(10).default(3),
  maxRaters: z.number().int().min(1).max(20).default(8),
  weightInFinal: z.number().min(0).max(100).default(0),
  folderId: z.string().nullable().optional(),
  selectionSettings: z.lazy(() => FeedbackSelectionSettingsSchema).optional(),
  visibilitySettings: z
    .object({
      SELF: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('FULL'),
      SUPERVISOR: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('FULL'),
      PEER: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('ANONYMOUS'),
      SUBORDINATE: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('ANONYMOUS'),
      CROSS_TEAM_PEER: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('ANONYMOUS'),
      CROSS_DEPT: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('ANONYMOUS'),
    })
    .optional(),
})

export const SubmitFeedbackSchema = z.object({
  roundId: z.string().min(1),
  receiverId: z.string().min(1),
  relationship: z.enum(['SELF', 'SUPERVISOR', 'PEER', 'CROSS_TEAM_PEER', 'SUBORDINATE', 'CROSS_DEPT']),
  overallComment: z.string().max(1000).optional(),
  responses: z.array(z.object({
    questionId: z.string(),
    ratingValue: z.number().int().min(1).max(5).optional(),
    textValue: z.string().max(500).optional(),
  })),
})

export const FeedbackNominationReviewerSchema = z.object({
  employeeId: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  relationship: z.enum(['SELF', 'SUPERVISOR', 'PEER', 'SUBORDINATE', 'CROSS_TEAM_PEER', 'CROSS_DEPT']),
})

export const FeedbackNominationDraftSchema = z.object({
  roundId: z.string().min(1).max(100),
  targetId: z.string().min(1).max(100),
  reviewers: z.array(FeedbackNominationReviewerSchema).min(1).max(20),
})

export const FeedbackFolderSchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200).optional(),
  color: z.string().trim().max(20).optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
})

export const UpwardReviewTemplateQuestionSchema = z.object({
  templateId: z.string().min(1),
  questionId: z.string().optional(),
  category: z.string().trim().max(50).optional(),
  questionText: z.string().trim().min(1, '吏덈Ц ?댁슜???낅젰??二쇱꽭??').max(500),
  description: z.string().trim().max(500).optional(),
  questionType: z.enum(['TEXT', 'RATING_SCALE', 'MULTIPLE_CHOICE']),
  scaleMin: z.number().int().min(1).max(5).optional(),
  scaleMax: z.number().int().min(1).max(10).optional(),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().default(true),
  choiceOptions: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
})

export const UpwardReviewTemplateSchema = z.object({
  templateId: z.string().optional(),
  name: z.string().trim().min(1, '?쒗뵆由??대쫫???낅젰??二쇱꽭??').max(100),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().default(true),
  defaultMinResponses: z.number().int().min(1).max(10).default(3),
  defaultTargetTypes: z
    .array(z.enum(['TEAM_LEADER', 'SECTION_CHIEF', 'DIVISION_HEAD', 'PM', 'CUSTOM']))
    .min(1, '理쒖냼 ??媛??댁긽???됯? ????좏삎???좏깮??二쇱꽭??'),
})

export const UpwardReviewRoundSchema = z.object({
  roundId: z.string().optional(),
  evalCycleId: z.string().min(1, '?됯? 二쇨린瑜??좏깮??二쇱꽭??'),
  roundName: z.string().trim().min(1, '?쇱슫?쒕챸???낅젰??二쇱꽭??').max(100),
  templateId: z.string().min(1, '吏덈Ц ?쒗뵆由우쓣 ?좏깮??二쇱꽭??'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  minRaters: z.number().int().min(1).max(10).default(3),
  targetTypes: z
    .array(z.enum(['TEAM_LEADER', 'SECTION_CHIEF', 'DIVISION_HEAD', 'PM', 'CUSTOM']))
    .min(1, '理쒖냼 ??媛??댁긽???됯? ????좏삎???좏깮??二쇱꽭??'),
  resultViewerMode: z.enum(['TARGET_ONLY', 'TARGET_AND_PRIMARY_MANAGER']).default('TARGET_ONLY'),
  rawResponsePolicy: z.enum(['ADMIN_ONLY', 'REVIEW_ADMIN_CONTENT']).default('ADMIN_ONLY'),
})

export const UpwardReviewAssignmentSchema = z.object({
  roundId: z.string().min(1),
  evaluatorId: z.string().min(1, '?됯??먮? ?좏깮??二쇱꽭??'),
  evaluateeId: z.string().min(1, '?쇳룊媛?먮? ?좏깮??二쇱꽭??'),
  relationship: z.enum(['SUBORDINATE', 'PEER', 'CROSS_DEPT']).default('SUBORDINATE'),
})

export const UpwardReviewSuggestionSchema = z.object({
  roundId: z.string().min(1),
  evaluateeId: z.string().min(1, '異붿쿇???앹꽦???쇳룊媛?먮? ?좏깮??二쇱꽭??').optional(),
})

export const UpwardReviewResponseSchema = z.object({
  overallComment: z.string().max(1000, '怨듯넻 ?섍껄? 1000???대궡濡??낅젰??二쇱꽭??').optional(),
  responses: z.array(
    z.object({
      questionId: z.string().min(1, '臾명빆 ?뺣낫媛 ?щ컮瑜댁? ?딆뒿?덈떎.'),
      ratingValue: z
        .number()
        .int('泥숇룄???묐떟? ?뺤닔濡??낅젰??二쇱꽭??')
        .min(1, '泥숇룄???묐떟? 1???댁긽?댁뼱???⑸땲??')
        .max(10, '泥숇룄???묐떟???덉슜 踰붿쐞瑜?珥덇낵?덉뒿?덈떎.')
        .nullable()
        .optional(),
      textValue: z.string().max(4000, '?쒖닠???묐떟? 4000???대궡濡??낅젰??二쇱꽭??').nullable().optional(),
    })
  ).max(200, '?묐떟 臾명빆 ?섍? ?덈Т 留롮뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??'),
})

export const UpwardReviewResultReleaseSchema = z.object({
  roundId: z.string().min(1),
  released: z.boolean(),
})

export const UpwardReviewRoundWorkflowSchema = z.object({
  roundId: z.string().min(1),
  action: z.enum(['START', 'CLOSE', 'REOPEN']),
})

export const FeedbackRoundFolderAssignSchema = z.object({
  roundId: z.string().min(1),
  folderId: z.string().nullable(),
})

const EmptyStringToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) {
      return undefined
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed === '' ? undefined : trimmed
    }
    return value
  }, schema.optional())

export const FeedbackAdminReviewScopeSchema = z.enum([
  'NONE',
  'ALL_REVIEWS_MANAGE',
  'ALL_REVIEWS_MANAGE_AND_CONTENT',
  'COLLABORATOR_REVIEWS_MANAGE',
  'COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT',
])

export const FeedbackAdminGroupSchema = z.object({
  id: z.string().min(1).optional(),
  groupName: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).optional().or(z.literal('')),
  reviewScope: FeedbackAdminReviewScopeSchema,
  memberIds: z.array(z.string().min(1)).max(50),
})

export const FeedbackManagerEffectivenessSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  targetScope: z.enum(['ALL', 'MANAGERS_ONLY']).default('MANAGERS_ONLY'),
  reviewerCombination: z
    .object({
      self: z.boolean().default(true),
      supervisor: z.boolean().default(true),
      peer: z.boolean().default(false),
      subordinate: z.boolean().default(true),
    })
    .default({
      self: true,
      supervisor: true,
      peer: false,
      subordinate: true,
    }),
  competencyLabels: z.array(z.string().trim().min(1).max(40)).max(10).default([
    '코칭',
    '피드백',
    '기대치 설정',
    '의사결정',
    '팀 운영',
    '성장 지원',
  ]),
})

export const FeedbackSelectionSettingsSchema = z.object({
  requireLeaderApproval: z.boolean().default(false),
  allowPreferredPeers: z.boolean().default(false),
  excludeLeaderFromPeerSelection: z.boolean().default(false),
  excludeDirectReportsFromPeerSelection: z.boolean().default(false),
  managerEffectiveness: FeedbackManagerEffectivenessSettingsSchema.default({
    enabled: false,
    targetScope: 'MANAGERS_ONLY',
    reviewerCombination: {
      self: true,
      supervisor: true,
      peer: false,
      subordinate: true,
    },
    competencyLabels: ['코칭', '피드백', '기대치 설정', '의사결정', '팀 운영', '성장 지원'],
  }),
  skillArchitecture: z
    .object({
      enabled: z.boolean().default(false),
      roleProfiles: z
        .array(
          z.object({
            id: z.string().min(1).max(100),
            label: z.string().trim().min(1).max(80),
            jobFamily: z.string().trim().min(1).max(80),
            level: z.string().trim().min(1).max(80),
            guideText: z.string().trim().min(10).max(4000),
            expectedCompetencies: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
            nextLevelExpectations: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
            goalLibrary: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
            filters: z
              .object({
                departmentKeyword: EmptyStringToUndefined(z.string().max(100)).optional(),
                roleKeyword: EmptyStringToUndefined(z.string().max(100)).optional(),
                position: EmptyStringToUndefined(z.string().max(40)).optional(),
                jobTitleKeyword: EmptyStringToUndefined(z.string().max(100)).optional(),
                teamNameKeyword: EmptyStringToUndefined(z.string().max(100)).optional(),
              })
              .default({}),
          })
        )
        .max(50)
        .default([]),
    })
    .default({
      enabled: false,
      roleProfiles: [],
    }),
  aiCopilot: z
    .object({
      enabled: z.boolean().default(false),
      allowManagerView: z.boolean().default(true),
      allowSelfView: z.boolean().default(true),
      includeGoals: z.boolean().default(true),
      includeCheckins: z.boolean().default(true),
      includeFeedback: z.boolean().default(true),
      includeResults: z.boolean().default(true),
      disclaimer: z
        .string()
        .trim()
        .min(10)
        .max(1000)
        .default(
          'AI 肄뷀뙆?쇰읉? 理쒓렐 由щ럭, 紐⑺몴, 1:1, ?쇰뱶諛깆쓣 諛뷀깢?쇰줈 ?깆옣 ?ъ씤?몄? 肄붿묶 珥덉븞???쒖븞?섎뒗 蹂댁“ 湲곕뒫?낅땲?? 理쒖쥌 ?먮떒怨??쒖슜 寃곗젙? 由щ뜑? HR???섑뻾?⑸땲??'
        ),
    })
    .default({
      enabled: false,
      allowManagerView: true,
      allowSelfView: true,
      includeGoals: true,
      includeCheckins: true,
      includeFeedback: true,
      includeResults: true,
      disclaimer:
        'AI 肄뷀뙆?쇰읉? 理쒓렐 由щ럭, 紐⑺몴, 1:1, ?쇰뱶諛깆쓣 諛뷀깢?쇰줈 ?깆옣 ?ъ씤?몄? 肄붿묶 珥덉븞???쒖븞?섎뒗 蹂댁“ 湲곕뒫?낅땲?? 理쒖쥌 ?먮떒怨??쒖슜 寃곗젙? 由щ뜑? HR???섑뻾?⑸땲??',
    }),
})

export const FeedbackRatingGuideScaleEntrySchema = z.object({
  value: z.number().int().min(0).max(20),
  label: z.string().trim().min(1).max(40),
  description: z.string().trim().max(500).default(''),
  targetRatio: z.number().min(0).max(100).nullable().optional(),
  headcountLimit: z.number().int().min(0).max(999).nullable().optional(),
  isNonEvaluative: z.boolean().default(false),
})

export const FeedbackRatingGuideRuleSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(60),
  headline: z.string().trim().min(1).max(200),
  guidance: z.string().trim().min(1).max(2000),
  filters: z
    .object({
      departmentKeyword: EmptyStringToUndefined(z.string().max(100)).optional(),
      roleKeyword: EmptyStringToUndefined(z.string().max(100)).optional(),
      position: EmptyStringToUndefined(z.string().max(40)).optional(),
      jobTitleKeyword: EmptyStringToUndefined(z.string().max(100)).optional(),
      teamNameKeyword: EmptyStringToUndefined(z.string().max(100)).optional(),
    })
    .default({}),
  gradeDescriptions: z.record(z.string(), z.string().trim().max(500)).default({}),
})

export const FeedbackRatingGuideSettingsSchema = z
  .object({
    distributionQuestionId: z.string().min(1).optional(),
    distributionMode: z.enum(['NONE', 'RATIO', 'HEADCOUNT']).default('NONE'),
    distributionScope: z.enum(['EVALUATOR', 'DEPARTMENT']).default('EVALUATOR'),
    scaleEntries: z.array(FeedbackRatingGuideScaleEntrySchema).max(10).default([]),
    guideRules: z.array(FeedbackRatingGuideRuleSchema).max(20).default([]),
  })
  .superRefine((data, ctx) => {
    const values = data.scaleEntries.map((entry) => entry.value)
    if (new Set(values).size !== values.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scaleEntries'],
        message: '?깃툒 媛믪? 以묐났 ?놁씠 ??踰덉뵫留??ㅼ젙?????덉뒿?덈떎.',
      })
    }

    if (data.distributionMode !== 'NONE' && !data.distributionQuestionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['distributionQuestionId'],
        message: '諛곕텇 ?뺤콉???곸슜???깃툒 吏덈Ц???좏깮??二쇱꽭??',
      })
    }
  })

export const FeedbackRoundSettingsSchema = z.object({
  folderId: z.string().nullable().optional(),
  collaboratorIds: z.array(z.string().min(1)).max(50).optional(),
  selectionSettings: FeedbackSelectionSettingsSchema.optional(),
  visibilitySettings: z
    .object({
      SELF: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('FULL'),
      SUPERVISOR: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('FULL'),
      PEER: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('ANONYMOUS'),
      SUBORDINATE: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('ANONYMOUS'),
      CROSS_TEAM_PEER: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('ANONYMOUS'),
      CROSS_DEPT: z.enum(['FULL', 'ANONYMOUS', 'PRIVATE']).default('ANONYMOUS'),
    })
    .optional(),
  resultPresentationSettings: z
    .object({
      REVIEWEE: z.object({
        showLeaderComment: z.boolean().default(true),
        showLeaderScore: z.boolean().default(false),
        showExecutiveComment: z.boolean().default(false),
        showExecutiveScore: z.boolean().default(false),
        showFinalScore: z.boolean().default(true),
        showFinalComment: z.boolean().default(true),
      }),
      LEADER: z.object({
        showLeaderComment: z.boolean().default(true),
        showLeaderScore: z.boolean().default(true),
        showExecutiveComment: z.boolean().default(false),
        showExecutiveScore: z.boolean().default(false),
        showFinalScore: z.boolean().default(true),
        showFinalComment: z.boolean().default(true),
      }),
      EXECUTIVE: z.object({
        showLeaderComment: z.boolean().default(true),
        showLeaderScore: z.boolean().default(true),
        showExecutiveComment: z.boolean().default(true),
        showExecutiveScore: z.boolean().default(true),
        showFinalScore: z.boolean().default(true),
        showFinalComment: z.boolean().default(true),
      }),
      })
      .optional(),
  reportAnalysisSettings: z
    .object({
      overview: z
        .object({
          companyMessage: z.string().trim().min(10).max(1200),
          purposeMessage: z.string().trim().min(10).max(1200),
          acceptanceGuide: z.string().trim().min(10).max(1200),
        })
        .optional(),
      menu: z
        .object({
          overview: z.object({ label: z.string().trim().min(1).max(40), visible: z.boolean() }),
          questionInsights: z.object({ label: z.string().trim().min(1).max(40), visible: z.boolean() }),
          relativeComparison: z.object({ label: z.string().trim().min(1).max(40), visible: z.boolean() }),
          selfAwareness: z.object({ label: z.string().trim().min(1).max(40), visible: z.boolean() }),
          reviewDetails: z.object({ label: z.string().trim().min(1).max(40), visible: z.boolean() }),
          questionScores: z.object({ label: z.string().trim().min(1).max(40), visible: z.boolean() }),
          objectiveAnswers: z.object({ label: z.string().trim().min(1).max(40), visible: z.boolean() }),
          resultLink: z.object({ label: z.string().trim().min(1).max(40), visible: z.boolean() }),
        })
        .optional(),
      wording: z
        .object({
          strengthLabel: z.string().trim().min(1).max(40),
          improvementLabel: z.string().trim().min(1).max(40),
          selfAwarenessLabel: z.string().trim().min(1).max(40),
          selfHighLabel: z.string().trim().min(1).max(40),
          selfLowLabel: z.string().trim().min(1).max(40),
          balancedLabel: z.string().trim().min(1).max(40),
        })
        .optional(),
      strength: z.enum(['LIGHT', 'DEFAULT', 'STRONG']).optional(),
    })
    .optional(),
  ratingGuideSettings: FeedbackRatingGuideSettingsSchema.optional(),
  questions: z
    .array(
      z.object({
        id: z.string().min(1),
        questionText: z.string().trim().min(5).max(500),
      })
    )
    .max(50)
    .optional(),
})

export const FeedbackAnytimeDocumentKindSchema = z.enum([
  'ANYTIME',
  'PROJECT',
  'PIP',
  'ROLE_CHANGE',
  'PROBATION',
])

export const FeedbackAnytimePipCheckpointSchema = z.object({
  label: z.string().trim().min(1).max(200),
  dueDate: z.string().trim().max(40).optional(),
  note: z.string().trim().max(400).optional(),
})

export const FeedbackAnytimePipSchema = z.object({
  goals: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  expectedBehaviors: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  checkpoints: z.array(FeedbackAnytimePipCheckpointSchema).max(10).default([]),
  midReview: z.string().trim().max(1000).optional(),
  endJudgement: z.string().trim().max(1000).optional(),
})

export const CreateFeedbackAnytimeReviewSchema = z.object({
  evalCycleId: z.string().min(1),
  roundName: z.string().trim().min(2).max(120),
  documentKind: FeedbackAnytimeDocumentKindSchema,
  dueDate: z.string().datetime(),
  reviewerId: z.string().min(1),
  targetIds: z.array(z.string().min(1)).min(1).max(100),
  reason: z.string().trim().min(5).max(1000),
  templateRoundId: z.string().min(1).optional(),
  collaboratorIds: z.array(z.string().min(1)).max(50).optional(),
  folderId: z.string().nullable().optional(),
  projectName: z.string().trim().max(120).optional(),
  projectCode: z.string().trim().max(80).optional(),
  pip: FeedbackAnytimePipSchema.optional(),
})

export const FeedbackAnytimeBulkActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('change-due-date'),
    roundIds: z.array(z.string().min(1)).min(1).max(100),
    dueDate: z.string().datetime(),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal('transfer-reviewer'),
    roundIds: z.array(z.string().min(1)).min(1).max(100),
    reviewerId: z.string().min(1),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.enum(['cancel', 'close', 'reopen']),
    roundIds: z.array(z.string().min(1)).min(1).max(100),
    reason: z.string().trim().min(5).max(1000),
  }),
])

export const FeedbackRoundReminderSchema = z
  .object({
    action: z.enum(['send-review-reminder', 'send-peer-selection-reminder', 'send-result-share', 'test-send']),
    roundId: z.string().min(1),
    targetIds: z.array(z.string().min(1)).min(1).max(100),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(12000),
    shareAudience: z.enum(['REVIEWEE', 'LEADER', 'LEADER_AND_REVIEWEE']).optional().default('REVIEWEE'),
    testEmail: z.string().email().optional(),
  })
  .superRefine((data, ctx) => {
    if (!reviewEmailHtmlToText(data.body).trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: '蹂몃Ц????以??댁긽 ?낅젰??二쇱꽭??',
      })
    }

    if (data.action === 'test-send' && !data.testEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['testEmail'],
        message: '?뚯뒪??諛쒖넚???대찓??二쇱냼瑜??낅젰??二쇱꽭??',
      })
    }
  })

export const Feedback360AiActionSchema = z.object({
  action: z.enum([
    'recommend-reviewers',
    'summarize-themes',
    'detect-careless-reviews',
    'suggest-development-plan',
    'suggest-growth-copilot',
  ]),
  sourceId: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export const FeedbackNominationWorkflowSchema = z.object({
  targetId: z.string().min(1).max(100),
  action: z.enum(['submit', 'approve', 'reject', 'publish']),
  note: z.string().max(500).optional(),
})

export const Feedback360ReportGenerateSchema = z.object({
  targetId: z.string().min(1).max(100),
})

export const FeedbackResultViewReceiptSchema = z.object({
  targetId: z.string().min(1).max(100),
})

const DevelopmentPlanActionStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE'])

const DevelopmentPlanActionItemSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title: z.string().trim().min(1).max(500),
  status: DevelopmentPlanActionStatusSchema.default('NOT_STARTED'),
  note: z.string().trim().max(1000).optional(),
  dueDate: z.string().datetime().optional(),
})

const DevelopmentPlanLinkedEvidenceSchema = z.object({
  type: z.enum(['REVIEW', 'GOAL', 'CHECKIN', 'FEEDBACK', 'MANUAL']),
  label: z.string().trim().min(1).max(200),
  href: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(500).optional(),
})

export const DevelopmentPlanCreateSchema = z.object({
  employeeId: z.string().min(1).max(100),
  sourceType: z.enum(['FEEDBACK_360', 'EVALUATION', 'CHECKIN', 'MANUAL']).default('FEEDBACK_360'),
  sourceId: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  focusArea: z.string().min(1).max(200),
  actions: z.array(z.union([z.string().trim().min(1).max(500), DevelopmentPlanActionItemSchema])).min(1).max(10),
  recommendedCompetencies: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  managerSupport: z.array(z.string().min(1).max(500)).max(10).optional(),
  nextCheckinTopics: z.array(z.string().min(1).max(500)).max(10).optional(),
  linkedEvidence: z.array(DevelopmentPlanLinkedEvidenceSchema).max(20).optional(),
  note: z.string().max(1000).optional(),
  dueDate: z.string().datetime().optional(),
})

export const DevelopmentPlanUpdateSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(200).optional(),
    focusArea: z.string().min(1).max(200).optional(),
    actions: z
      .array(z.union([z.string().trim().min(1).max(500), DevelopmentPlanActionItemSchema]))
      .min(1)
      .max(10)
      .optional(),
    recommendedCompetencies: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    managerSupport: z.array(z.string().min(1).max(500)).max(10).optional(),
    nextCheckinTopics: z.array(z.string().min(1).max(500)).max(10).optional(),
    linkedEvidence: z.array(DevelopmentPlanLinkedEvidenceSchema).max(20).optional(),
    note: z.string().max(1000).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.focusArea !== undefined ||
      data.actions !== undefined ||
      data.recommendedCompetencies !== undefined ||
      data.managerSupport !== undefined ||
      data.nextCheckinTopics !== undefined ||
      data.linkedEvidence !== undefined ||
      data.note !== undefined ||
      data.dueDate !== undefined ||
      data.status !== undefined,
    {
      message: '?섏젙????ぉ???섎굹 ?댁긽 ?낅젰??二쇱꽭??',
      path: ['id'],
    }
  )

export const OnboardingReviewConditionSchema = z.discriminatedUnion('field', [
  z.object({
    id: z.string().min(1).max(100),
    field: z.literal('JOIN_DATE'),
    operator: z.enum(['ON_OR_AFTER', 'ON_OR_BEFORE', 'BETWEEN']),
    value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '?좎쭨 ?뺤떇???뺤씤??二쇱꽭??'),
    valueTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '?좎쭨 ?뺤떇???뺤씤??二쇱꽭??')
      .nullable()
      .optional(),
  }),
  z.object({
    id: z.string().min(1).max(100),
    field: z.literal('POSITION'),
    operator: z.literal('IN'),
    values: z
      .array(z.enum(['MEMBER', 'TEAM_LEADER', 'SECTION_CHIEF', 'DIV_HEAD', 'CEO']))
      .min(1, '吏곴뎔???섎굹 ?댁긽 ?좏깮??二쇱꽭??')
      .max(5),
  }),
])

export const OnboardingReviewWorkflowStepSchema = z.object({
  id: z.string().min(1).max(100),
  stepOrder: z.number().int().min(1).max(12),
  stepName: z.string().trim().min(1).max(50),
  triggerDaysAfterJoin: z.number().int().min(0).max(365),
  durationDays: z.number().int().min(1).max(180),
  reviewNameTemplate: z.string().trim().min(1).max(200),
  includeEmployeeNameInName: z.boolean().default(true),
  includeHireDateInName: z.boolean().default(false),
})

export const OnboardingReviewWorkflowSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    evalCycleId: z.string().min(1),
    workflowName: z.string().trim().min(1).max(100),
    isActive: z.boolean().default(true),
    scheduleHourKst: z.number().int().min(0).max(23).default(8),
    targetConditions: z.array(OnboardingReviewConditionSchema).min(1, '??곸옄 議곌굔???섎굹 ?댁긽 ?ㅼ젙??二쇱꽭??'),
    steps: z.array(OnboardingReviewWorkflowStepSchema).min(1, '?④퀎瑜??섎굹 ?댁긽 異붽???二쇱꽭??').max(10),
  })
  .superRefine((data, ctx) => {
    const stepIds = new Set<string>()
    const stepOrders = new Set<number>()

    data.steps.forEach((step, index) => {
      if (stepIds.has(step.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'id'],
          message: '?④퀎 ?앸퀎?먭? 以묐났?섏뿀?듬땲??',
        })
      }
      stepIds.add(step.id)

      if (stepOrders.has(step.stepOrder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'stepOrder'],
          message: '?④퀎 踰덊샇??以묐났?????놁뒿?덈떎.',
        })
      }
      stepOrders.add(step.stepOrder)
    })

    data.targetConditions.forEach((condition, index) => {
      if (condition.field === 'JOIN_DATE' && condition.operator === 'BETWEEN') {
        const end = condition.valueTo ?? condition.value
        if (end < condition.value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['targetConditions', index, 'valueTo'],
            message: '醫낅즺?쇱? ?쒖옉?쇰낫??鍮좊? ???놁뒿?덈떎.',
          })
        }
      }
    })
  })

export const OnboardingReviewWorkflowRunSchema = z.object({
  cycleId: z.string().min(1),
  workflowId: z.string().min(1).optional(),
})

// ============================================
// 泥댄겕??愿??
// ============================================

export const CreateCheckInSchema = z.object({
  ownerId: z.string().min(1),
  checkInType: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'AD_HOC', 'MIDYEAR_REVIEW', 'QUARTERLY']),
  scheduledDate: z.string().datetime(),
  agendaItems: z.array(z.object({
    topic: z.string().max(100),
    notes: z.string().max(500).optional(),
  })).optional(),
  ownerNotes: z.string().max(500).optional(),
})

const CheckInAgendaItemSchema = z.object({
  topic: z.string().min(1).max(100),
  notes: z.string().max(500).optional(),
})

const CheckInActionItemSchema = z.object({
  action: z.string().min(1).max(200),
  assignee: z.string().min(1).max(50),
  dueDate: z.string().optional(),
  completed: z.boolean().default(false),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
})

export const CompleteCheckInSchema = z.object({
  actualDate: z.string().datetime(),
  duration: z.number().int().min(1).max(480).optional(),
  keyTakeaways: z.string().max(1000).optional(),
  managerNotes: z.string().max(500).optional(),
  actionItems: z.array(CheckInActionItemSchema).optional(),
  nextCheckInDate: z.string().datetime().optional(),
  kpiDiscussed: z.array(z.object({
    kpiId: z.string(),
    progress: z.string().max(200).optional(),
    concern: z.string().max(200).optional(),
    support: z.string().max(200).optional(),
  })).optional(),
  energyLevel: z.number().int().min(1).max(5).optional(),
  satisfactionLevel: z.number().int().min(1).max(5).optional(),
  blockerCount: z.number().int().min(0).optional(),
})

export const UpdateCheckInSchema = z.object({
  scheduledDate: z.string().datetime().optional(),
  agendaItems: z.array(CheckInAgendaItemSchema).optional(),
  ownerNotes: z.string().max(500).optional(),
  managerNotes: z.string().max(500).optional(),
  keyTakeaways: z.string().max(1000).optional(),
  actionItems: z.array(CheckInActionItemSchema).optional(),
  nextCheckInDate: z.string().datetime().nullable().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).optional(),
})

// ============================================
// ?댁쓽?좎껌 愿??
// ============================================

export const AppealSchema = z.object({
  evaluationId: z.string().min(1),
  reason: z.string().min(20, '이의신청 사유는 최소 20자 이상 입력해 주세요.').max(1000),
})

// ============================================
// ?됯? 二쇨린 愿??
// ============================================

export const EvalCycleSchema = z.object({
  orgId: z.string().min(1),
  evalYear: z.number().int().min(2020).max(2100),
  cycleName: z.string().min(1).max(100),
  showQuestionWeight: z.boolean().default(true),
  showScoreSummary: z.boolean().default(true),
  goalEditMode: z.enum(['FULL', 'CHECKIN_ONLY']).default('FULL'),
  kpiSetupStart: z.string().datetime().optional(),
  kpiSetupEnd: z.string().datetime().optional(),
  selfEvalStart: z.string().datetime().optional(),
  selfEvalEnd: z.string().datetime().optional(),
  firstEvalStart: z.string().datetime().optional(),
  firstEvalEnd: z.string().datetime().optional(),
  secondEvalStart: z.string().datetime().optional(),
  secondEvalEnd: z.string().datetime().optional(),
  finalEvalStart: z.string().datetime().optional(),
  finalEvalEnd: z.string().datetime().optional(),
  ceoAdjustStart: z.string().datetime().optional(),
  ceoAdjustEnd: z.string().datetime().optional(),
  resultOpenStart: z.string().datetime().optional(),
  resultOpenEnd: z.string().datetime().optional(),
  appealDeadline: z.string().datetime().optional(),
})

export const UpdateEvalCycleSchema = z.object({
  orgId: z.string().min(1).optional(),
  evalYear: z.number().int().min(2020).max(2100).optional(),
  cycleName: z.string().min(1).max(100).optional(),
  showQuestionWeight: z.boolean().optional(),
  showScoreSummary: z.boolean().optional(),
  goalEditMode: z.enum(['FULL', 'CHECKIN_ONLY']).optional(),
  status: z
    .enum([
      'SETUP',
      'KPI_SETTING',
      'IN_PROGRESS',
      'SELF_EVAL',
      'FIRST_EVAL',
      'SECOND_EVAL',
      'FINAL_EVAL',
      'CEO_ADJUST',
      'RESULT_OPEN',
      'APPEAL',
      'CLOSED',
    ])
    .optional(),
  kpiSetupStart: z.string().datetime().optional(),
  kpiSetupEnd: z.string().datetime().optional(),
  selfEvalStart: z.string().datetime().optional(),
  selfEvalEnd: z.string().datetime().optional(),
  firstEvalStart: z.string().datetime().optional(),
  firstEvalEnd: z.string().datetime().optional(),
  secondEvalStart: z.string().datetime().optional(),
  secondEvalEnd: z.string().datetime().optional(),
  finalEvalStart: z.string().datetime().optional(),
  finalEvalEnd: z.string().datetime().optional(),
  ceoAdjustStart: z.string().datetime().optional(),
  ceoAdjustEnd: z.string().datetime().optional(),
  resultOpenStart: z.string().datetime().optional(),
  resultOpenEnd: z.string().datetime().optional(),
  appealDeadline: z.string().datetime().optional(),
})

const EvaluationGroupSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(60),
    description: z.string().max(300),
    quantitativeWeight: z.number().min(0).max(100),
    qualitativeWeight: z.number().min(0).max(100),
    comparisonMode: z.enum(['WITHIN_GROUP', 'SEPARATE_TRACK', 'CROSS_GROUP']),
    comparisonTargetLabel: z.string().max(120),
    departmentIds: z.array(z.string().min(1)).default([]),
  })
  .refine((value) => value.quantitativeWeight + value.qualitativeWeight === 100, {
    message: '怨꾨웾/鍮꾧퀎??鍮꾩쨷 ?⑷퀎??100?댁뼱???⑸땲??',
    path: ['qualitativeWeight'],
  })

const IndicatorSmartDiagnosisSchema = z.object({
  specific: z.number().min(1).max(5),
  measurable: z.number().min(1).max(5),
  achievable: z.number().min(1).max(5),
  relevant: z.number().min(1).max(5),
  timeBound: z.number().min(1).max(5),
  total: z.number().min(5).max(25),
  note: z.string().max(200),
})

const IndicatorRolloverHistoryItemSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['KEEP', 'HOLD', 'IMPROVE', 'DELETE', 'NEW']),
  comment: z.string().max(500),
  decidedBy: z.string().max(60),
  decidedAt: z.string().datetime(),
  targetCycleId: z.string().min(1).optional(),
  targetCycleName: z.string().max(100).optional(),
})

const PerformanceIndicatorDesignSchema = z.object({
  key: z.string().min(1),
  source: z.enum(['ORG_KPI', 'PERSONAL_KPI', 'MANUAL']),
  sourceId: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  metricType: z.enum(['QUANTITATIVE', 'QUALITATIVE', 'COLLABORATION']),
  departmentId: z.string().min(1).optional(),
  departmentName: z.string().max(80).optional(),
  ownerLabel: z.string().max(120).optional(),
  evaluationGroupId: z.string().min(1).optional(),
  strategicAlignmentScore: z.number().min(1).max(5),
  jobRepresentativenessScore: z.number().min(1).max(5),
  smartDiagnosis: IndicatorSmartDiagnosisSchema.optional(),
  selectionStatus: z.enum(['KEEP', 'HOLD', 'IMPROVE', 'DELETE', 'NEW']),
  lifecycleAction: z.enum(['KEEP', 'HOLD', 'IMPROVE', 'DELETE', 'NEW']),
  departmentComment: z.string().max(500),
  managerComment: z.string().max(500),
  evidenceTemplate: z.string().max(500),
  pageLimit: z.number().int().min(1).max(20),
  rolloverHistory: z.array(IndicatorRolloverHistoryItemSchema),
  carriedFromCycleId: z.string().min(1).optional(),
})

const NonQuantitativeTemplateSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
  focusPoint: z.string().max(500),
  checklist: z.array(z.string().min(1).max(160)).max(10),
})

const NonQuantitativeTemplateSchema = z.object({
  name: z.string().min(1).max(80),
  guidance: z.string().min(1).max(2000),
  reportFormat: z.string().min(1).max(300),
  pageLimit: z.number().int().min(1).max(20),
  sections: z.array(NonQuantitativeTemplateSectionSchema).min(1).max(8),
  allowInternalEvidence: z.boolean(),
  evidenceGuide: z.array(z.string().min(1).max(120)).max(10),
})

const PerformanceSelectionMatrixSchema = z
  .object({
    strategicWeight: z.number().int().min(0).max(100),
    jobWeight: z.number().int().min(0).max(100),
    smartWeight: z.number().int().min(0).max(100),
    keepThreshold: z.number().min(0).max(100),
    holdThreshold: z.number().min(0).max(100),
    improveThreshold: z.number().min(0).max(100),
  })
  .superRefine((data, ctx) => {
    if (data.strategicWeight + data.jobWeight + data.smartWeight !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['smartWeight'],
        message: '?좎젙 留ㅽ듃由?뒪 媛以묒튂 ?⑷퀎??100?댁뼱???⑸땲??',
      })
    }
    if (!(data.keepThreshold > data.holdThreshold && data.holdThreshold > data.improveThreshold)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keepThreshold'],
        message: '?좎젙 湲곗? ?먯닔???좎? > ?좊낫 > 蹂댁셿 ?쒖쑝濡??ㅼ젙??二쇱꽭??',
      })
    }
  })

const NonQuantitativeTemplateBindingSchema = z
  .object({
    id: z.string().min(1),
    evaluationGroupId: z.string().min(1),
    pageMin: z.number().int().min(1).max(20),
    pageMax: z.number().int().min(1).max(20),
    guidanceOverride: z.string().max(2000),
    reportFormatOverride: z.string().max(300),
    evidenceGuideOverride: z.array(z.string().min(1).max(120)).max(10),
  })
  .superRefine((data, ctx) => {
    if (data.pageMin > data.pageMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pageMax'],
        message: '鍮꾧퀎???묒꽦 遺꾨웾? 理쒖냼 ?섏씠吏媛 理쒕? ?섏씠吏蹂대떎 ?????놁뒿?덈떎.',
      })
    }
  })

const PerformanceMilestoneSchema = z.object({
  id: z.string().min(1),
  key: z.enum([
    'HANDBOOK_FINALIZED',
    'GOAL_FINALIZED',
    'MID_CHECK',
    'QUALITATIVE_SUBMISSION',
    'FINAL_EVALUATION',
    'RESULT_FINALIZED',
  ]),
  label: z.string().min(1).max(80),
  ownerRole: z.enum(['HR', 'MANAGER', 'DEPARTMENT']),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  description: z.string().max(300),
})

const CollaborationCaseEvaluationSchema = z.object({
  impactScore: z.number().min(0).max(5),
  executionScore: z.number().min(0).max(5),
  collaborationScore: z.number().min(0).max(5),
  spreadScore: z.number().min(0).max(5),
  comment: z.string().max(1000),
})

const CollaborationCaseSchema = z.object({
  id: z.string().min(1),
  departmentId: z.string().min(1),
  departmentName: z.string().max(80).optional(),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(1500),
  impact: z.string().min(1).max(1000),
  collaborationPartners: z.array(z.string().min(1).max(80)).max(10),
  evidenceNotes: z.string().max(1000),
  submittedBy: z.string().max(60),
  status: z.enum(['DRAFT', 'SUBMITTED', 'REVIEWED', 'SHARED']),
  evaluation: CollaborationCaseEvaluationSchema,
  highlighted: z.boolean(),
})

const EnvironmentAdjustmentConfigSchema = z.object({
  enabled: z.boolean(),
  effortGuide: z.string().max(800),
  targetAdjustmentGuide: z.string().max(800),
  fallbackIndicators: z.array(z.string().min(1).max(120)).max(20),
})

export const PerformanceDesignConfigSchema = z.object({
  evaluationGroups: z.array(EvaluationGroupSchema).min(1).max(12),
  indicatorDesigns: z.array(PerformanceIndicatorDesignSchema).max(400),
  selectionMatrix: PerformanceSelectionMatrixSchema,
  nonQuantitativeTemplate: NonQuantitativeTemplateSchema,
  nonQuantitativeTemplateBindings: z.array(NonQuantitativeTemplateBindingSchema).max(20),
  milestones: z.array(PerformanceMilestoneSchema).min(1).max(12),
  collaborationCases: z.array(CollaborationCaseSchema).max(80),
  environmentAdjustment: EnvironmentAdjustmentConfigSchema,
})

export const UpdatePerformanceDesignSchema = z.object({
  config: PerformanceDesignConfigSchema,
})

export const PerformanceDesignRolloverSchema = z.object({
  indicatorKeys: z.array(z.string().min(1)).min(1),
})

// ============================================
// Compensation
// ============================================

export const CompensationRuleSchema = z.object({
  gradeName: z.string().min(1).max(20),
  bonusRate: z.number().min(0).max(100),
  salaryIncreaseRate: z.number().min(0).max(100),
  description: z.string().max(200).optional(),
})

export const UpdateCompensationRulesSchema = z.object({
  changeReason: z.string().max(200).optional(),
  rules: z.array(CompensationRuleSchema).min(1),
})

export const CreateCompensationScenarioSchema = z.object({
  evalCycleId: z.string().min(1),
  scenarioName: z.string().min(1).max(100),
  budgetLimit: z.number().positive(),
  ruleSetId: z.string().optional(),
  cloneFromScenarioId: z.string().optional(),
})

export const UpdateCompensationScenarioSchema = z.object({
  scenarioName: z.string().min(1).max(100).optional(),
  budgetLimit: z.number().positive().optional(),
  ruleSetId: z.string().optional(),
})

export const CompensationWorkflowSchema = z.object({
  action: z.enum([
    'SUBMIT',
    'REVIEW_APPROVE',
    'FINAL_APPROVE',
    'PUBLISH',
    'REJECT',
    'LOCK',
    'RECALCULATE',
  ]),
  comment: z.string().min(3).max(500).optional(),
})

// ============================================
// AI Assist
// ============================================

export const AIAssistRequestSchema = z.object({
  requestType: z.enum([
    'KPI_ASSIST',
    'EVAL_COMMENT_DRAFT',
    'BIAS_ANALYSIS',
    'GROWTH_PLAN',
    'EVAL_PERFORMANCE_BRIEFING',
  ]),
  sourceType: z.string().max(100).optional(),
  sourceId: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()),
})

const EvaluationAssistItemSchema = z.object({
  personalKpiId: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  weight: z.number().min(0).max(100),
  quantScore: z.number().min(0).max(100).nullable().optional(),
  planScore: z.number().min(0).max(100).nullable().optional(),
  doScore: z.number().min(0).max(100).nullable().optional(),
  checkScore: z.number().min(0).max(100).nullable().optional(),
  actScore: z.number().min(0).max(100).nullable().optional(),
  itemComment: z.string().max(500).optional(),
})

export const EvaluationAIAssistRequestSchema = z.object({
  mode: z.enum(['draft', 'bias', 'growth']),
  evaluationId: z.string().min(1).max(100),
  draftComment: z.string().max(2000).optional().default(''),
  strengthComment: z.string().max(2000).optional().default(''),
  improvementComment: z.string().max(2000).optional().default(''),
  nextStepGuidance: z.string().max(1500).optional().default(''),
  growthMemo: z.string().max(4000).optional().default(''),
  draftGradeId: z.string().max(100).nullable().optional(),
  items: z.array(EvaluationAssistItemSchema).max(50).default([]),
})

export const EvaluationPerformanceBriefingRequestSchema = z.object({
  evaluationId: z.string().min(1).max(100),
})

export const EvaluationGuideActionSchema = z.object({
  action: z.enum(['view', 'confirm']),
})

export const OrgKpiAiActionSchema = z.object({
  action: z.enum([
    'generate-draft',
    'improve-wording',
    'smart-check',
    'detect-duplicates',
    'suggest-alignment',
    'summarize-risk',
    'draft-monthly-comment',
  ]),
  sourceId: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()),
})

export const BusinessPlanDocumentSchema = z.object({
  id: z.string().max(100).optional(),
  deptId: z.string().min(1),
  evalYear: z.number().int().min(2020).max(2100),
  evalCycleId: z.string().max(100).nullable().optional(),
  title: z.string().min(1, '?ъ뾽怨꾪쉷???쒕ぉ???낅젰??二쇱꽭??').max(150),
  sourceType: z.enum(['TEXT', 'SUMMARY']).default('TEXT'),
  summaryText: businessPlanLongTextSchema('사업계획서 요약', BUSINESS_PLAN_SUMMARY_MAX).optional(),
  bodyText: businessPlanLongTextSchema('사업계획서 본문', BUSINESS_PLAN_BODY_MAX).min(1, '?ъ뾽怨꾪쉷??蹂몃Ц???낅젰??二쇱꽭??'),
})

export const JobDescriptionDocumentSchema = z.object({
  id: z.string().max(100).optional(),
  deptId: z.string().min(1),
  scope: z.enum(['DIVISION', 'TEAM']),
  evalYear: z.number().int().min(2020).max(2100),
  evalCycleId: z.string().max(100).nullable().optional(),
  title: z.string().min(1, '직무기술서 제목을 입력해 주세요.').max(150),
  summaryText: jobDescriptionLongTextSchema('직무기술서 요약', JOB_DESCRIPTION_SUMMARY_MAX).optional(),
  bodyText: jobDescriptionLongTextSchema('직무기술서 본문', JOB_DESCRIPTION_BODY_MAX).min(
    1,
    '직무기술서 본문을 입력해 주세요.'
  ),
})

export const TeamKpiRecommendationRequestSchema = z.object({
  targetDeptId: z.string().min(1),
  evalYear: z.number().int().min(2020).max(2100),
  evalCycleId: z.string().max(100).nullable().optional(),
})

export const TeamKpiAdoptDraftSchema = z
  .object({
    kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']),
    kpiCategory: z.string().min(1).max(50),
    kpiName: z.string().min(1).max(100),
    definition: orgKpiLongTextSchema('팀 KPI 정의').optional(),
    formula: orgKpiLongTextSchema('팀 KPI 산식').optional(),
    ...OrgKpiTargetValueSchema,
    unit: z.string().max(20).optional(),
    weight: z.number().min(0).max(100),
    difficulty: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
    parentOrgKpiId: z.string().nullable().optional(),
  })
  .refine(isOrderedOrgKpiTargetValues, {
    message: '紐⑺몴媛믪? T <= E <= S ?쒖꽌?ъ빞 ?⑸땲??',
    path: ['targetValueT'],
  })

export const TeamKpiRecommendationDecisionSchema = z.object({
  decision: z.enum(['ADOPT_AS_IS', 'ADOPT_EDITED', 'DISMISSED', 'REFERENCED_NEW']),
  draft: TeamKpiAdoptDraftSchema.optional(),
})

export const TeamKpiReviewRequestSchema = z.object({
  targetDeptId: z.string().min(1),
  evalYear: z.number().int().min(2020).max(2100),
  evalCycleId: z.string().max(100).nullable().optional(),
  orgKpiIds: z.array(z.string().min(1)).min(1).max(20).optional(),
})

export const AIApprovalDecisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  approvedPayload: z.record(z.string(), z.unknown()).optional(),
  rejectionReason: z.string().min(3).max(500).optional(),
})

export const OrgKpiWorkflowActionSchema = z.object({
  action: z.enum(['SUBMIT', 'LOCK', 'REOPEN']),
  note: z.string().max(500).optional(),
})

export const BulkOrgKpiRowSchema = z.object({
  deptId: z.string().min(1),
  evalYear: z.number().int().min(2020).max(2100),
  kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']).default('QUANTITATIVE'),
  kpiCategory: z.string().min(1).max(50),
  kpiName: z.string().min(1).max(100),
  definition: orgKpiLongTextSchema('KPI 정의').optional(),
  formula: orgKpiLongTextSchema('KPI 산식').optional(),
  targetValue: z.number().nullable().optional(),
  unit: z.string().max(20).optional(),
  weight: z.number().min(0).max(100),
  difficulty: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
})

export const BulkOrgKpiUploadSchema = z.object({
  fileName: z.string().max(255).optional(),
  rows: z.array(BulkOrgKpiRowSchema).min(1).max(300),
})

// ============================================
// Notifications
// ============================================

export const NotificationTemplateSchema = z.object({
  code: z.string().min(3).max(100),
  name: z.string().min(1).max(100),
  type: z.enum([
    'KPI_DEADLINE',
    'GOAL_REMINDER',
    'CHECKPOINT_REMINDER',
    'EVALUATION_REMINDER',
    'CALIBRATION_REMINDER',
    'RESULT_CONFIRMATION_REMINDER',
    'MEETING_REMINDER',
    'MONTHLY_REMINDER',
    'EVAL_START',
    'EVAL_RECEIVED',
    'EVAL_REJECTED',
    'EVAL_COMPLETED',
    'RESULT_PUBLISHED',
    'CHECKIN_REMINDER',
    'CHECKIN_SCHEDULED',
    'FEEDBACK_REQUEST',
    'FEEDBACK_DEADLINE',
    'ACTION_ITEM_DUE',
    'SYSTEM',
  ]),
  channel: z.enum(['IN_APP', 'EMAIL']),
  subjectTemplate: z.string().min(1).max(200),
  bodyTemplate: z.string().min(1).max(5000),
  defaultLink: z.string().max(200).optional(),
  isActive: z.boolean().default(true),
  isDigestCompatible: z.boolean().default(true),
})

export const UpdateNotificationTemplatesSchema = z.object({
  templates: z.array(NotificationTemplateSchema).min(1),
})

export const NotificationPreferenceSchema = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  digestEnabled: z.boolean(),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().min(1).max(100),
  mutedTypes: z.array(z.string()).default([]),
})

export const NotificationCronSchema = z.object({
  mode: z.enum(['schedule', 'dispatch', 'all']).default('all'),
  reminderTypes: z.array(z.enum(['goal', 'checkpoint'])).max(2).optional(),
})

export const NotificationDeadLetterActionSchema = z.object({
  action: z.enum(['retry', 'archive']),
  ids: z.array(z.string().min(1)).min(1).max(100),
})

export const NotificationTemplateTestSendSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  type: NotificationTemplateSchema.shape.type,
  channel: NotificationTemplateSchema.shape.channel,
  subjectTemplate: z.string().min(1).max(200),
  bodyTemplate: z.string().min(1).max(5000),
  defaultLink: z.string().max(200).optional(),
  previewPayload: z.record(z.string(), z.unknown()).default({}),
})

export const NotificationOpsAiActionSchema = z.object({
  action: z.enum([
    'summarize-ops',
    'summarize-dead-letters',
    'validate-template-variables',
    'generate-ops-report',
  ]),
  sourceId: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export const AdminOpsAiActionSchema = z.object({
  action: z.enum([
    'summarize-ops-status',
    'summarize-incident-patterns',
    'generate-daily-report',
    'prioritize-risks',
  ]),
  sourceId: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
})

// ============================================
// Google account registration
// ============================================

const EmployeeDateSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: '?좎쭨 ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎.',
  })

const SortOrderSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }
    return Number(trimmed)
  }

  return value
}, z.number().int().min(0).max(9999).optional())

export const AdminEmployeeRoleSchema = z.enum([
  'ROLE_MEMBER',
  'ROLE_TEAM_LEADER',
  'ROLE_SECTION_CHIEF',
  'ROLE_DIV_HEAD',
  'ROLE_CEO',
  'ROLE_ADMIN',
])

export const AdminEmployeeStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED'])

export const RegisterGoogleAccountSchema = z.object({
  employeeId: z.string().min(1),
  gwsEmail: z.string().email().max(255),
})

export const AdminEmployeeRecordSchema = z
  .object({
    employeeNumber: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(100),
    gwsEmail: z.string().email().max(255),
    deptId: z.string().min(1),
    teamName: EmptyStringToUndefined(z.string().max(100)),
    jobTitle: EmptyStringToUndefined(z.string().max(100)),
    role: AdminEmployeeRoleSchema,
    employmentStatus: AdminEmployeeStatusSchema.default('ACTIVE'),
    managerEmployeeNumber: EmptyStringToUndefined(z.string().max(50)),
    joinDate: EmptyStringToUndefined(EmployeeDateSchema),
    resignationDate: EmptyStringToUndefined(EmployeeDateSchema),
    sortOrder: SortOrderSchema,
    notes: EmptyStringToUndefined(z.string().max(500)),
  })
  .superRefine((data, ctx) => {
    if (data.managerEmployeeNumber && data.managerEmployeeNumber === data.employeeNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['managerEmployeeNumber'],
        message: '蹂몄씤??愿由ъ옄濡?吏?뺥븷 ???놁뒿?덈떎.',
      })
    }

    if (data.employmentStatus === 'ACTIVE' && data.resignationDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resignationDate'],
        message: '?ъ쭅 ?곹깭媛 ACTIVE?대㈃ ?댁궗?쇱쓣 ?낅젰?????놁뒿?덈떎.',
      })
    }
  })

export const UpdateGoogleAccountEmployeeSchema = AdminEmployeeRecordSchema.extend({
  employeeId: z.string().min(1),
})

export const AdminEmployeeLifecycleActionSchema = z
  .object({
    employeeId: z.string().min(1),
    action: z.enum(['DEACTIVATE', 'RESIGN', 'REACTIVATE']),
    resignationDate: EmptyStringToUndefined(EmployeeDateSchema),
    note: EmptyStringToUndefined(z.string().max(500)),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'RESIGN' && !data.resignationDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resignationDate'],
        message: '?댁궗 泥섎━ ???댁궗?쇱쓣 ?낅젰??二쇱꽭??',
      })
    }
  })

export const DeleteGoogleAccountEmployeeSchema = z
  .object({
    employeeId: z.string().min(1, '??젣??吏곸썝???좏깮??二쇱꽭??'),
    confirmDelete: z.boolean(),
  })
  .refine((data) => data.confirmDelete, {
    message: '吏곸썝 ??젣 ?뺤씤???꾩슂?⑸땲??',
    path: ['confirmDelete'],
  })

export const CreateAdminEmployeeSchema = AdminEmployeeRecordSchema

export const AdminDepartmentRecordSchema = z.object({
  departmentId: z.string().min(1).optional(),
  deptCode: z.string().trim().min(1).max(50),
  deptName: z.string().trim().min(1).max(100),
  parentDeptId: EmptyStringToUndefined(z.string().min(1).max(191)).nullable().optional(),
  leaderEmployeeId: EmptyStringToUndefined(z.string().min(1).max(191)).nullable().optional(),
  excludeLeaderFromEvaluatorAutoAssign: z.boolean().default(false),
})

export const DeleteAdminDepartmentSchema = z
  .object({
    departmentId: z.string().min(1, '??젣??議곗쭅???좏깮??二쇱꽭??'),
    confirmDelete: z.boolean(),
  })
  .refine((data) => data.confirmDelete, {
    message: '議곗쭅 ??젣 ?뺤씤???꾩슂?⑸땲??',
    path: ['confirmDelete'],
  })

export const AdminEvaluatorAssignmentActionSchema = z.object({
  action: z.enum(['preview', 'apply']),
})

export const AdminPerformanceAssignmentActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('sync'),
    evalCycleId: z.string().min(1, '평가 주기를 선택해 주세요.'),
  }),
  z.object({
    action: z.literal('override'),
    evalCycleId: z.string().min(1, '평가 주기를 선택해 주세요.'),
    targetId: z.string().min(1, '대상자를 선택해 주세요.'),
    evalStage: z.enum(['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']),
    evaluatorId: z.string().min(1, '평가자를 선택해 주세요.'),
    note: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal('reset'),
    evalCycleId: z.string().min(1, '평가 주기를 선택해 주세요.'),
    targetId: z.string().min(1, '대상자를 선택해 주세요.'),
    evalStage: z.enum(['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']),
  }),
])

export const AdminMasterLoginSchema = z.object({
  targetEmployeeId: z.string().min(1, '????좎?瑜??좏깮??二쇱꽭??'),
  reason: z.string().trim().min(10, '留덉뒪??濡쒓렇???ъ쑀瑜?10???댁긽 ?낅젰??二쇱꽭??').max(500),
})

export const AdminMasterLoginPermissionSchema = z.object({
  targetEmployeeId: z.string().min(1, '沅뚰븳??蹂寃쏀븷 HR愿由ъ옄瑜??좏깮??二쇱꽭??'),
  enabled: z.boolean(),
})

export const AdminEmployeeUploadRowSchema = z.object({
  employeeNumber: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  googleEmail: z.string().email().max(255),
  departmentCode: z.string().trim().min(1).max(50),
  department: z.string().trim().min(1).max(100),
  team: EmptyStringToUndefined(z.string().max(100)),
  title: EmptyStringToUndefined(z.string().max(100)),
  role: AdminEmployeeRoleSchema,
  employmentStatus: AdminEmployeeStatusSchema.default('ACTIVE'),
  managerEmployeeNumber: EmptyStringToUndefined(z.string().max(50)),
  joinDate: EmptyStringToUndefined(EmployeeDateSchema),
  resignationDate: EmptyStringToUndefined(EmployeeDateSchema),
  sortOrder: SortOrderSchema,
  notes: EmptyStringToUndefined(z.string().max(500)),
})

export const BulkAdminEmployeeUploadSchema = z.object({
  fileName: z.string().max(255).optional(),
  rows: z.array(AdminEmployeeUploadRowSchema).min(1).max(500),
})

const CalibrationWorkspaceStatusSchema = z.enum(
  CALIBRATION_DISCUSSION_STATUS_OPTIONS.map((option) => option.value) as [string, ...string[]]
)

const CalibrationWorkspaceCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set-current-candidate'),
    targetId: z.string().min(1),
  }),
  z.object({
    type: z.literal('save-candidate-workspace'),
    targetId: z.string().min(1),
    status: CalibrationWorkspaceStatusSchema,
    shortReason: z.string().trim().max(300).default(''),
    discussionMemo: z.string().trim().max(2000).default(''),
    privateNote: z.string().trim().max(2000).default(''),
    publicComment: z.string().trim().max(1000).default(''),
  }),
  z.object({
    type: z.literal('start-timer'),
    targetId: z.string().min(1),
    durationMinutes: z.number().int().min(5).max(10).optional(),
  }),
  z.object({
    type: z.literal('reset-timer'),
    targetId: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('extend-timer'),
    minutes: z.number().int().min(1).max(5),
  }),
  z.object({
    type: z.literal('add-custom-prompt'),
    prompt: z.string().trim().min(1).max(200),
  }),
  z.object({
    type: z.literal('remove-custom-prompt'),
    prompt: z.string().trim().min(1).max(200),
  }),
])

const CalibrationFollowUpCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('save-comment-draft'),
    targetId: z.string().min(1),
    comment: z.string().trim().min(1).max(1000),
  }),
  z.object({
    type: z.literal('finalize-comment'),
    targetId: z.string().min(1),
    comment: z.string().trim().min(10).max(1000),
  }),
  z.object({
    type: z.literal('generate-communication-packet'),
    targetId: z.string().min(1),
  }),
  z.object({
    type: z.literal('set-review-flag'),
    targetId: z.string().min(1),
    compensationSensitive: z.boolean().default(false),
    note: z.string().trim().max(500).default(''),
  }),
  z.object({
    type: z.literal('submit-survey'),
    hardestPart: z.string().trim().min(10).max(500),
    missingData: z.string().trim().min(10).max(500),
    rulesAndTimebox: z.string().trim().min(5).max(500),
    positives: z.string().trim().min(10).max(500),
    improvements: z.string().trim().min(10).max(500),
    nextCycleNeeds: z.string().trim().min(10).max(500),
    leniencyFeedback: z.string().trim().max(500).default(''),
  }),
  z.object({
    type: z.literal('save-leader-feedback'),
    leaderId: z.string().min(1),
    leaderName: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(10).max(1000),
    suggestions: z.string().trim().max(1000).default(''),
  }),
])

export const CalibrationCandidateUpdateSchema = z
  .object({
    action: z.enum([
      'save',
      'clear',
      'bulk-import',
      'update-session-config',
      'upload-external-data',
      'update-workspace',
      'update-follow-up',
    ]),
    cycleId: z.string().min(1),
    targetId: z.string().min(1).optional(),
    gradeId: z.string().optional(),
    adjustReason: z.string().max(500).optional(),
    rows: z
      .array(
        z.object({
          targetId: z.string().min(1),
          gradeId: z.string().min(1),
          adjustReason: z.string().trim().min(30).max(500),
          rowNumber: z.number().int().min(1).optional(),
          identifier: z.string().trim().min(1).max(100).optional(),
        })
      )
      .max(300)
      .optional(),
    sessionConfig: z
      .object({
        excludedTargetIds: z.array(z.string().min(1)).max(500).default([]),
        participantIds: z.array(z.string().min(1)).max(100).default([]),
        evaluatorIds: z.array(z.string().min(1)).max(100).default([]),
        observerIds: z.array(z.string().min(1)).max(100).default([]),
        externalColumns: z
          .array(
            z.object({
              key: z.string().trim().min(1).max(60),
              label: z.string().trim().min(1).max(60),
            })
          )
          .max(20)
          .default([]),
        setup: z
          .object({
            sessionName: z.string().trim().max(100).default(''),
            sessionType: z.enum(CALIBRATION_SESSION_TYPE_OPTIONS.map((option) => option.value) as [string, ...string[]]).default('SINGLE_TEAM'),
            scopeMode: z.enum(CALIBRATION_SCOPE_MODE_OPTIONS.map((option) => option.value) as [string, ...string[]]).default('ORGANIZATION'),
            scopeDepartmentIds: z.array(z.string().min(1)).max(100).default([]),
            scopeLeaderIds: z.array(z.string().min(1)).max(100).default([]),
            ownerId: z.string().min(1).nullable().optional(),
            facilitatorId: z.string().min(1).nullable().optional(),
            recorderId: z.string().min(1).nullable().optional(),
            observerIds: z.array(z.string().min(1)).max(100).default([]),
            preReadDeadline: z.string().datetime().nullable().optional(),
            scheduledStart: z.string().datetime().nullable().optional(),
            scheduledEnd: z.string().datetime().nullable().optional(),
            timeboxMinutes: z.number().int().min(5).max(10).default(5),
            decisionPolicy: z.enum(CALIBRATION_DECISION_POLICY_OPTIONS.map((option) => option.value) as [string, ...string[]]).default('OWNER_DECIDES'),
            referenceDistributionUse: z.enum(CALIBRATION_REFERENCE_DISTRIBUTION_USE_OPTIONS.map((option) => option.value) as [string, ...string[]]).default('OFF'),
            referenceDistributionVisibility: z.enum(CALIBRATION_REFERENCE_DISTRIBUTION_VISIBILITY_OPTIONS.map((option) => option.value) as [string, ...string[]]).default('VISIBLE_ONLY'),
            referenceDistributionRatios: z.array(
              z.object({
                gradeId: z.string().min(1),
                gradeLabel: z.string().trim().min(1).max(20),
                ratio: z.number().min(0).max(100),
              })
            ).max(20).default([]),
            ratingGuideUse: z.boolean().default(true),
            ratingGuideLinks: z.array(
              z.object({
                id: z.string().trim().min(1).max(50),
                scopeType: z.enum(['POSITION', 'JOB_GROUP', 'LEVEL']),
                scopeValue: z.string().trim().min(1).max(100),
                memo: z.string().trim().max(300).optional(),
              })
            ).max(50).default([]),
            expectationAlignmentMemo: z.string().trim().max(2000).default(''),
            visibleDataColumns: z.array(
              z.enum(CALIBRATION_VISIBLE_COLUMN_OPTIONS.map((option) => option.key) as [string, ...string[]])
            ).max(20).default([]),
            memoCommentPolicyPreset: z.enum(CALIBRATION_MEMO_COMMENT_POLICY_OPTIONS.map((option) => option.value) as [string, ...string[]]).default('OWNER_REVIEW_REQUIRED'),
            objectionWindowOpenAt: z.string().datetime().nullable().optional(),
            objectionWindowCloseAt: z.string().datetime().nullable().optional(),
            followUpOwnerId: z.string().min(1).nullable().optional(),
            groundRules: z.array(
              z.object({
                key: z.enum(['LAS_VEGAS_RULE', 'WORKING_AS_A_TEAM', 'INTELLECTUAL_HONESTY', 'PSYCHOLOGICAL_SAFETY']),
                label: z.string().trim().min(1).max(100),
                description: z.string().trim().min(1).max(500),
                enabled: z.boolean().default(true),
              })
            ).min(1).max(20).default([]),
            groundRuleAcknowledgementPolicy: z.enum(['NOT_SET', 'REQUIRED', 'OPTIONAL']).default('NOT_SET'),
            facilitatorCanFinalize: z.boolean().default(false),
          })
          .superRefine((setup, ctx) => {
            if (setup.scheduledStart && setup.scheduledEnd && setup.scheduledStart >= setup.scheduledEnd) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['scheduledEnd'],
                message: '?몄뀡 醫낅즺 ?쒓컖? ?쒖옉 ?쒓컖蹂대떎 ?ㅼ뿬???⑸땲??',
              })
            }
            if (setup.objectionWindowOpenAt && setup.objectionWindowCloseAt && setup.objectionWindowOpenAt >= setup.objectionWindowCloseAt) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['objectionWindowCloseAt'],
                message: '?댁쓽?쒓린 醫낅즺 ?쒓컖? ?쒖옉 ?쒓컖蹂대떎 ?ㅼ뿬???⑸땲??',
              })
            }
          })
          .optional(),
      })
      .optional(),
    externalData: z
      .object({
        columns: z
          .array(
            z.object({
              key: z.string().trim().min(1).max(60),
              label: z.string().trim().min(1).max(60),
            })
          )
          .min(1)
          .max(20),
        rows: z
          .array(
            z.object({
              targetId: z.string().min(1),
              rowNumber: z.number().int().min(1).optional(),
              identifier: z.string().trim().min(1).max(100).optional(),
              values: z.record(z.string(), z.string().max(200)),
            })
          )
          .max(500),
        })
      .optional(),
    workspaceCommand: CalibrationWorkspaceCommandSchema.optional(),
    followUpCommand: CalibrationFollowUpCommandSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'clear' && !data.targetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetId'],
        message: '??곸옄瑜??좏깮??二쇱꽭??',
      })
      return
    }

    if (data.action === 'bulk-import') {
      if (!data.rows?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rows'],
          message: '?곸슜???깃툒/肄붾찘???됱씠 ?놁뒿?덈떎.',
        })
      }
      return
    }

    if (data.action === 'update-session-config') {
      if (!data.sessionConfig) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sessionConfig'],
          message: '?몄뀡 ?ㅼ젙 媛믪쓣 ?뺤씤??二쇱꽭??',
        })
      }
      return
    }

    if (data.action === 'upload-external-data') {
      if (!data.externalData) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['externalData'],
          message: '?낅줈?쒗븷 ?몃? ?곗씠?곌? ?놁뒿?덈떎.',
        })
      }
      return
    }

    if (data.action === 'update-workspace') {
      if (!data.workspaceCommand) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['workspaceCommand'],
          message: '?뚰겕?ㅽ럹?댁뒪 蹂寃??댁슜???뺤씤??二쇱꽭??',
        })
        return
      }

      if (
        ['NO', 'ESCALATED'].includes(data.workspaceCommand.type === 'save-candidate-workspace' ? data.workspaceCommand.status : '')
      ) {
        const reason =
          data.workspaceCommand.type === 'save-candidate-workspace'
            ? data.workspaceCommand.shortReason.trim()
            : ''
        if (reason.length < 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['workspaceCommand', 'shortReason'],
            message: 'No ?먮뒗 ?곸쐞 寃?좊뒗 吏㏃? ?ъ쑀瑜??④퍡 ?④꺼 二쇱꽭??',
          })
        }
      }
      return
    }

    if (data.action === 'update-follow-up') {
      if (!data.followUpCommand) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['followUpCommand'],
          message: '??곌킂嚥≪뮇毓?癰궰野???곸뒠???類ㅼ뵥??雅뚯눘苑??',
        })
      }
      return
    }

    if (data.action !== 'save') return

    if (!data.targetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetId'],
        message: '??곸옄瑜??좏깮??二쇱꽭??',
      })
    }

    if (!data.gradeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gradeId'],
        message: '議곗젙 ?깃툒???좏깮??二쇱꽭??',
      })
    }

    if (!data.adjustReason || data.adjustReason.trim().length < 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adjustReason'],
        message: '議곗젙 ?ъ쑀??理쒖냼 30???댁긽 ?낅젰??二쇱꽭??',
      })
    }
  })

export const CalibrationWorkflowSchema = z.object({
  cycleId: z.string().min(1),
  action: z.enum(['START_SESSION', 'CONFIRM_REVIEW', 'LOCK', 'REOPEN_REQUEST', 'MERGE', 'DELETE_SESSION']),
  scopeId: z.string().min(1).optional(),
})

export const CalibrationExportSchema = z.object({
  cycleId: z.string().min(1),
  scopeId: z.string().min(1).optional(),
  mode: z.enum(['basic', 'all']).default('basic'),
})

export const AiCompetencyTrackSchema = z.enum([
  'HR_SUPPORT',
  'FINANCE_OPERATIONS',
  'SALES_CS',
  'MARKETING_PLANNING',
])

export const AiCompetencyQuestionTypeSchema = z.enum([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'SCENARIO_JUDGEMENT',
  'SHORT_ANSWER',
  'PRACTICAL',
])

export const AiCompetencyDifficultySchema = z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED'])

export const AiCompetencyCycleStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'CLOSED'])

export const AiCompetencyDomainSchema = z.enum([
  'AI_FOUNDATION',
  'PROMPT_CONTEXT_DESIGN',
  'VERIFICATION_HALLUCINATION',
  'SECURITY_ETHICS',
  'BUSINESS_JUDGEMENT',
])

export const AiCompetencyTemplateStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])

export const AiCompetencyBlueprintScopeSchema = z.enum(['COMMON', 'TRACK_SPECIFIC'])

export const AiCompetencyCycleUpsertSchema = z
  .object({
    evalCycleId: z.string().min(1).optional(),
    cycleName: z.string().trim().min(1).max(100),
    firstRoundOpenAt: EmptyStringToUndefined(z.string().datetime()),
    firstRoundCloseAt: EmptyStringToUndefined(z.string().datetime()),
    secondRoundApplyOpenAt: EmptyStringToUndefined(z.string().datetime()),
    secondRoundApplyCloseAt: EmptyStringToUndefined(z.string().datetime()),
    reviewOpenAt: EmptyStringToUndefined(z.string().datetime()),
    reviewCloseAt: EmptyStringToUndefined(z.string().datetime()),
    calibrationOpenAt: EmptyStringToUndefined(z.string().datetime()),
    calibrationCloseAt: EmptyStringToUndefined(z.string().datetime()),
    resultPublishAt: EmptyStringToUndefined(z.string().datetime()),
    firstRoundPassThreshold: z.number().min(0).max(100),
    secondRoundBonusCap: z.number().min(0).max(30),
    scoreCap: z.number().min(60).max(100),
    timeLimitMinutes: z.number().int().min(10).max(240),
    randomizeQuestions: z.boolean().default(false),
    companyEmailDomain: EmptyStringToUndefined(z.string().max(100)),
    artifactMinCount: z.number().int().min(1).max(3),
    artifactMaxCount: z.number().int().min(1).max(5),
    policyAcknowledgementText: EmptyStringToUndefined(z.string().max(1000)),
    status: AiCompetencyCycleStatusSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.evalCycleId && !data.status) return
    if (data.artifactMinCount > data.artifactMaxCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['artifactMinCount'],
        message: '理쒖냼 ?쒖텧 媛쒖닔??理쒕? ?쒖텧 媛쒖닔蹂대떎 ?????놁뒿?덈떎.',
      })
    }
  })

export const AiCompetencyQuestionSchema = z.object({
  id: z.string().min(1).optional(),
  cycleId: z.string().min(1),
  track: AiCompetencyTrackSchema.optional().nullable(),
  version: z.number().int().min(1).max(20).default(1),
  competencyDomain: AiCompetencyDomainSchema.default('AI_FOUNDATION'),
  questionType: AiCompetencyQuestionTypeSchema,
  difficulty: AiCompetencyDifficultySchema.default('INTERMEDIATE'),
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(4000),
  options: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  answerKey: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  explanation: EmptyStringToUndefined(z.string().max(2000)),
  maxScore: z.number().min(1).max(100),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isCommon: z.boolean().default(false),
  isActive: z.boolean().default(true),
  randomizable: z.boolean().default(true),
  requiresManualScoring: z.boolean().default(false),
})

export const AiCompetencyBlueprintRowSchema = z.object({
  competencyDomain: AiCompetencyDomainSchema,
  itemType: AiCompetencyQuestionTypeSchema,
  difficulty: AiCompetencyDifficultySchema,
  requiredQuestionCount: z.number().int().min(1).max(100),
  pointsPerQuestion: z.number().min(1).max(100),
  scope: AiCompetencyBlueprintScopeSchema,
  requiredTags: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([]),
  excludedTags: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([]),
  displayOrder: z.number().int().min(0).max(999).default(0),
})

export const AiCompetencyBlueprintSchema = z
  .object({
    id: z.string().min(1).optional(),
    cycleId: z.string().min(1),
    blueprintName: z.string().trim().min(1).max(100),
    blueprintVersion: z.number().int().min(1).max(50).default(1),
    track: AiCompetencyTrackSchema.optional().nullable(),
    status: AiCompetencyTemplateStatusSchema.optional(),
    totalQuestionCount: z.number().int().min(1).max(300),
    totalPoints: z.number().min(1).max(100),
    timeLimitMinutes: z.number().int().min(10).max(240),
    passScore: z.number().min(0).max(100),
    randomizationEnabled: z.boolean().default(true),
    notes: EmptyStringToUndefined(z.string().max(1000)),
    rows: z.array(AiCompetencyBlueprintRowSchema).min(1).max(100),
  })
  .superRefine((data, ctx) => {
    const totalQuestionCount = data.rows.reduce((sum, row) => sum + row.requiredQuestionCount, 0)
    const totalPoints = data.rows.reduce((sum, row) => sum + row.requiredQuestionCount * row.pointsPerQuestion, 0)

    if (totalQuestionCount !== data.totalQuestionCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalQuestionCount'],
        message: '?됰퀎 臾명빆 ???⑷퀎媛 珥?臾명빆 ?섏? ?쇱튂?댁빞 ?⑸땲??',
      })
    }

    if (Math.abs(totalPoints - data.totalPoints) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalPoints'],
        message: '?됰퀎 諛곗젏 ?⑷퀎媛 珥앹젏怨??쇱튂?댁빞 ?⑸땲??',
      })
    }

    if (data.passScore > data.totalPoints) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passScore'],
        message: '?⑷꺽 湲곗?? 珥앹젏??珥덇낵?????놁뒿?덈떎.',
      })
    }
  })

export const AiCompetencyTemplateActionSchema = z.object({
  templateId: z.string().min(1),
})

export const AiCompetencyRubricBandSchema = z.object({
  score: z.number().min(0).max(100),
  title: z.string().trim().min(1).max(50),
  description: EmptyStringToUndefined(z.string().max(300)),
  guidance: EmptyStringToUndefined(z.string().max(500)),
  displayOrder: z.number().int().min(0).max(99).default(0),
})

export const AiCompetencyRubricCriterionSchema = z.object({
  criterionCode: z.string().trim().min(1).max(30),
  criterionName: z.string().trim().min(1).max(100),
  criterionDescription: EmptyStringToUndefined(z.string().max(1000)),
  maxScore: z.number().min(1).max(100),
  displayOrder: z.number().int().min(0).max(999).default(0),
  mandatory: z.boolean().default(true),
  knockout: z.boolean().default(false),
  bands: z.array(AiCompetencyRubricBandSchema).min(1).max(10),
})

export const AiCompetencyRubricSchema = z
  .object({
    id: z.string().min(1).optional(),
    cycleId: z.string().min(1),
    rubricName: z.string().trim().min(1).max(100),
    rubricVersion: z.number().int().min(1).max(50).default(1),
    track: AiCompetencyTrackSchema.optional().nullable(),
    status: AiCompetencyTemplateStatusSchema.optional(),
    totalScore: z.number().min(1).max(100),
    passScore: z.number().min(0).max(100),
    bonusScoreIfPassed: z.number().min(0).max(30),
    certificationLabel: EmptyStringToUndefined(z.string().max(100)),
    notes: EmptyStringToUndefined(z.string().max(1000)),
    criteria: z.array(AiCompetencyRubricCriterionSchema).min(1).max(30),
  })
  .superRefine((data, ctx) => {
    const totalScore = data.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0)
    if (Math.abs(totalScore - data.totalScore) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalScore'],
        message: '?됯? 湲곗? 諛곗젏 ?⑷퀎媛 珥앹젏怨??쇱튂?댁빞 ?⑸땲??',
      })
    }
    if (data.passScore > data.totalScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passScore'],
        message: '?⑷꺽 湲곗?? 珥앹젏??珥덇낵?????놁뒿?덈떎.',
      })
    }
  })

export const AiCompetencyAssignmentSchema = z.object({
  cycleId: z.string().min(1),
  employeeId: z.string().min(1),
  track: AiCompetencyTrackSchema,
  firstRoundRequired: z.boolean().default(true),
  secondRoundVolunteer: z.boolean().default(false),
  notes: EmptyStringToUndefined(z.string().max(500)),
})

export const AiCompetencyAttemptSaveSchema = z.object({
  attemptId: z.string().min(1),
  submit: z.boolean().default(false),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.union([z.string(), z.array(z.string()), z.record(z.string(), z.unknown()), z.null()]),
      })
    )
    .min(1)
    .max(200),
})

export const AiCompetencyShortAnswerScoreSchema = z.object({
  answerId: z.string().min(1),
  manualScore: z.number().min(0).max(100),
  reviewerNote: EmptyStringToUndefined(z.string().max(1000)),
})

export const AiCompetencySecondRoundSubmissionSchema = z.object({
  assignmentId: z.string().min(1),
  taskDescription: z.string().trim().min(10).max(2000),
  aiUsagePurpose: z.string().trim().min(5).max(1000),
  toolUsed: z.string().trim().min(2).max(200),
  promptSummary: z.string().trim().min(10).max(2000),
  verificationMethod: z.string().trim().min(10).max(1000),
  businessImpact: z.string().trim().min(10).max(1000),
  sensitiveDataCheck: z.string().trim().min(5).max(1000),
})

export const AiCompetencyReviewerAssignmentSchema = z.object({
  submissionId: z.string().min(1),
  reviewerIds: z.array(z.string().min(1)).min(1).max(5),
})

export const AiCompetencySubmissionReviewCriterionInputSchema = z.object({
  criterionId: z.string().min(1),
  score: z.number().min(0).max(100),
  comment: EmptyStringToUndefined(z.string().max(1000)),
  knockoutTriggered: z.boolean().default(false),
})

export const AiCompetencySubmissionReviewSchema = z
  .object({
    submissionId: z.string().min(1),
    criterionScores: z.array(AiCompetencySubmissionReviewCriterionInputSchema).min(1).max(30),
    decision: z.enum(['PASS', 'FAIL', 'REVISE']).optional(),
    notes: EmptyStringToUndefined(z.string().max(2000)),
    qnaNote: EmptyStringToUndefined(z.string().max(2000)),
    submitFinal: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.submitFinal && !data.decision) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['decision'],
        message: '理쒖쥌 ?쒖텧 ???먯젙???좏깮??二쇱꽭??',
      })
    }
  })

export const AiCompetencyExternalCertClaimSchema = z.object({
  assignmentId: z.string().min(1),
  certificateId: z.string().min(1),
  certificateNumber: EmptyStringToUndefined(z.string().max(100)),
  issuedAt: EmptyStringToUndefined(EmployeeDateSchema),
  expiresAt: EmptyStringToUndefined(EmployeeDateSchema),
  policyAcknowledged: z.boolean(),
})

export const AiCompetencyExternalCertDecisionSchema = z.object({
  claimId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: EmptyStringToUndefined(z.string().max(1000)),
})

export const AiCompetencyResultOverrideSchema = z.object({
  resultId: z.string().min(1),
  overrideScore: z.number().min(0).max(100),
  overrideReason: z.string().trim().min(5).max(1000),
})

export const AiCompetencyGateCycleStatusSchema = z.enum(['DRAFT', 'OPEN', 'CLOSED'])
export const AiCompetencyGateTrackSchema = z.enum(['AI_PROJECT_EXECUTION', 'AI_USE_CASE_EXPANSION'])
export const AiCompetencyGateStatusSchema = z.enum([
  'NOT_STARTED',
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REVISION_REQUESTED',
  'RESUBMITTED',
  'PASSED',
  'FAILED',
  'CLOSED',
])
export const AiCompetencyGateDecisionSchema = z.enum(['PASS', 'REVISION_REQUIRED', 'FAIL'])
export const AiCompetencyGateEvidenceTypeSchema = z.enum([
  'BEFORE',
  'AFTER',
  'METRIC_PROOF',
  'REUSE_ARTIFACT',
  'ADOPTION_PROOF',
  'SHARING_PROOF',
  'SECURITY_PROOF',
  'OTHER',
])
export const AiCompetencyGuideEntryTypeSchema = z.enum(['GUIDE', 'PASS_EXAMPLE', 'FAIL_EXAMPLE', 'FAQ'])
export const AiCompetencyGateTrackApplicabilitySchema = z.enum(['COMMON', 'PROJECT_ONLY', 'ADOPTION_ONLY'])

const AiCompetencyGateShortTextSchema = EmptyStringToUndefined(z.string().trim().max(200))
const AiCompetencyGateMediumTextSchema = EmptyStringToUndefined(z.string().trim().max(2000))
const AiCompetencyGateLongTextSchema = EmptyStringToUndefined(z.string().trim().max(20000))

export const AiCompetencyGateCycleUpsertSchema = z.object({
  cycleId: z.string().min(1).optional(),
  evalCycleId: z.string().min(1),
  cycleName: z.string().trim().min(1).max(100),
  status: AiCompetencyGateCycleStatusSchema.default('DRAFT'),
  submissionOpenAt: EmptyStringToUndefined(z.string().datetime()),
  submissionCloseAt: EmptyStringToUndefined(z.string().datetime()),
  reviewOpenAt: EmptyStringToUndefined(z.string().datetime()),
  reviewCloseAt: EmptyStringToUndefined(z.string().datetime()),
  resultPublishAt: EmptyStringToUndefined(z.string().datetime()),
  policyAcknowledgementText: AiCompetencyGateLongTextSchema,
  promotionGateEnabled: z.boolean().default(true),
})

export const AiCompetencyGateAssignmentUpsertSchema = z.object({
  cycleId: z.string().min(1),
  employeeId: z.string().min(1),
  reviewerId: EmptyStringToUndefined(z.string().min(1)),
  adminNote: AiCompetencyGateMediumTextSchema,
})

export const AiCompetencyGateMetricSchema = z.object({
  id: z.string().min(1).optional(),
  metricName: AiCompetencyGateShortTextSchema,
  beforeValue: AiCompetencyGateMediumTextSchema,
  afterValue: AiCompetencyGateMediumTextSchema,
  unit: AiCompetencyGateShortTextSchema,
  verificationMethod: AiCompetencyGateMediumTextSchema,
  displayOrder: z.number().int().min(0).max(99).default(0),
})

export const AiCompetencyGateDraftSchema = z.object({
  assignmentId: z.string().min(1),
  track: AiCompetencyGateTrackSchema,
  title: AiCompetencyGateShortTextSchema,
  problemStatement: AiCompetencyGateLongTextSchema,
  importanceReason: AiCompetencyGateLongTextSchema,
  goalStatement: AiCompetencyGateLongTextSchema,
  scopeDescription: AiCompetencyGateLongTextSchema,
  ownerRoleDescription: AiCompetencyGateLongTextSchema,
  beforeWorkflow: AiCompetencyGateLongTextSchema,
  afterWorkflow: AiCompetencyGateLongTextSchema,
  impactSummary: AiCompetencyGateLongTextSchema,
  teamOrganizationAdoption: AiCompetencyGateLongTextSchema,
  reusableOutputSummary: AiCompetencyGateLongTextSchema,
  humanReviewControl: AiCompetencyGateLongTextSchema,
  factCheckMethod: AiCompetencyGateLongTextSchema,
  securityEthicsPrivacyHandling: AiCompetencyGateLongTextSchema,
  sharingExpansionActivity: AiCompetencyGateLongTextSchema,
  toolList: AiCompetencyGateMediumTextSchema,
  approvedToolBasis: AiCompetencyGateLongTextSchema,
  sensitiveDataHandling: AiCompetencyGateLongTextSchema,
  maskingAnonymizationHandling: AiCompetencyGateLongTextSchema,
  prohibitedAutomationAcknowledged: z.boolean().default(false),
  finalDeclarationAccepted: z.boolean().default(false),
  metrics: z.array(AiCompetencyGateMetricSchema).max(20).default([]),
  projectDetail: z
    .object({
      projectBackground: AiCompetencyGateLongTextSchema,
      stakeholders: AiCompetencyGateLongTextSchema,
      executionSteps: AiCompetencyGateLongTextSchema,
      deliverables: AiCompetencyGateLongTextSchema,
      projectStartedAt: EmptyStringToUndefined(z.string().datetime()),
      projectEndedAt: EmptyStringToUndefined(z.string().datetime()),
      ownerPmRoleDetail: AiCompetencyGateLongTextSchema,
      contributionSummary: AiCompetencyGateLongTextSchema,
    })
    .default({}),
  adoptionDetail: z
    .object({
      useCaseDescription: AiCompetencyGateLongTextSchema,
      teamDivisionScope: AiCompetencyGateLongTextSchema,
      repeatedUseExamples: AiCompetencyGateLongTextSchema,
      measuredEffectDetail: AiCompetencyGateLongTextSchema,
      seminarSharingEvidence: AiCompetencyGateLongTextSchema,
      organizationExpansionDetail: AiCompetencyGateLongTextSchema,
    })
    .default({}),
})

export const AiCompetencyGateEvidenceUploadSchema = z.object({
  assignmentId: z.string().min(1),
  caseId: z.string().min(1),
  evidenceType: AiCompetencyGateEvidenceTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: AiCompetencyGateMediumTextSchema,
  linkUrl: EmptyStringToUndefined(z.string().trim().url('올바른 링크 주소를 입력해 주세요.').max(1000)),
  textNote: AiCompetencyGateLongTextSchema,
})

export const AiCompetencyGateEvidenceDeleteSchema = z.object({
  assignmentId: z.string().min(1),
  evidenceId: z.string().min(1),
})

export const AiCompetencyGatePreviewSchema = z.object({
  assignmentId: z.string().min(1),
})

export const AiCompetencyGateSubmitSchema = z.object({
  assignmentId: z.string().min(1),
})

export const AiCompetencyGateStartReviewSchema = z.object({
  caseId: z.string().min(1),
})

export const AiCompetencyGateReviewItemSchema = z.object({
  criterionId: z.string().min(1),
  decision: AiCompetencyGateDecisionSchema,
  comment: z.string().trim().min(1, '평가 의견을 입력해 주세요.').max(5000),
  requiredFix: AiCompetencyGateLongTextSchema,
})

export const AiCompetencyGateReviewDraftSchema = z.object({
  caseId: z.string().min(1),
  overallDecision: AiCompetencyGateDecisionSchema.optional(),
  overallComment: AiCompetencyGateLongTextSchema,
  nonRemediable: z.boolean().default(false),
  items: z.array(AiCompetencyGateReviewItemSchema).min(1).max(30),
})

export const AiCompetencyGateDecisionSubmitSchema = z.object({
  caseId: z.string().min(1),
  action: AiCompetencyGateDecisionSchema,
  overallComment: z.string().trim().min(5, '결정 사유를 5자 이상 입력해 주세요.').max(5000),
  nonRemediable: z.boolean().default(false),
  items: z.array(AiCompetencyGateReviewItemSchema).min(1).max(30),
})

export const AiCompetencyGuideEntryUpsertSchema = z.object({
  cycleId: EmptyStringToUndefined(z.string().min(1)),
  entryType: AiCompetencyGuideEntryTypeSchema,
  trackApplicability: AiCompetencyGateTrackApplicabilitySchema.default('COMMON'),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(20000),
  displayOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
})

export const WordCloud360CycleStatusSchema = z.enum(['DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED', 'ARCHIVED'])

export const WordCloudKeywordPolaritySchema = z.enum(['POSITIVE', 'NEGATIVE'])

export const WordCloudKeywordCategorySchema = z.enum(['ATTITUDE', 'ABILITY', 'BOTH', 'OTHER'])

export const WordCloudKeywordSourceTypeSchema = z.enum([
  'DOCUMENT_FINAL',
  'EXTRA_GOVERNANCE',
  'ADMIN_ADDED',
  'IMPORTED',
])

export const WordCloudEvaluatorGroupSchema = z.enum(['MANAGER', 'PEER', 'SUBORDINATE', 'SELF'])

export const WordCloud360CycleSchema = z
  .object({
    cycleId: EmptyStringToUndefined(z.string().min(1)),
    evalCycleId: EmptyStringToUndefined(z.string().min(1)),
    cycleName: z.string().trim().min(1).max(100),
    startDate: EmptyStringToUndefined(z.string().datetime()),
    endDate: EmptyStringToUndefined(z.string().datetime()),
    positiveSelectionLimit: z.number().int().min(1).max(30).default(10),
    negativeSelectionLimit: z.number().int().min(1).max(30).default(10),
    resultPrivacyThreshold: z.number().int().min(3).max(10).default(3),
    evaluatorGroups: z.array(WordCloudEvaluatorGroupSchema).min(1).max(4),
    notes: EmptyStringToUndefined(z.string().max(1000)),
    status: WordCloud360CycleStatusSchema.default('DRAFT'),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: '醫낅즺?쇱? ?쒖옉?쇰낫??鍮좊? ???놁뒿?덈떎.',
      })
    }
  })

export const ExportReasonSchema = z.object({
  reason: z.string().trim().min(5, '?ㅼ슫濡쒕뱶 ?ъ쑀瑜?5???댁긽 ?낅젰??二쇱꽭??').max(200, '?ㅼ슫濡쒕뱶 ?ъ쑀??200???댄븯濡??낅젰??二쇱꽭??'),
})

export const WordCloud360KeywordSchema = z.object({
  keywordId: z.string().min(1).optional(),
  keywordCode: EmptyStringToUndefined(z.string().trim().regex(/^[A-Z0-9_-]{2,50}$/i, '?ㅼ썙??肄붾뱶???곷Ц, ?レ옄, -, _ 議고빀?쇰줈 ?낅젰?섏꽭??')),
  keyword: z.string().trim().min(1).max(50),
  polarity: WordCloudKeywordPolaritySchema,
  category: WordCloudKeywordCategorySchema,
  sourceType: WordCloudKeywordSourceTypeSchema.default('ADMIN_ADDED'),
  active: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(999).default(0),
  note: EmptyStringToUndefined(z.string().max(500)),
  warningFlag: z.boolean().default(false),
})

export const WordCloud360KeywordImportModeSchema = z.enum(['preview', 'apply'])

export const WordCloud360AssignmentItemSchema = z
  .object({
    assignmentId: z.string().min(1).optional(),
    cycleId: z.string().min(1),
    evaluatorId: z.string().min(1),
    evaluateeId: z.string().min(1),
    evaluatorGroup: WordCloudEvaluatorGroupSchema,
  })
  .superRefine((data, ctx) => {
    if (data.evaluatorId === data.evaluateeId && data.evaluatorGroup !== 'SELF') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evaluateeId'],
        message: '?먭린 ?먯떊???됯????뚮뒗 SELF 洹몃９留??ъ슜?????덉뒿?덈떎.',
      })
    }
  })

export const WordCloud360AssignmentBatchSchema = z.object({
  cycleId: z.string().min(1),
  assignments: z.array(WordCloud360AssignmentItemSchema).min(1).max(500),
})

export const WordCloud360AutoAssignSchema = z.object({
  cycleId: z.string().min(1),
  includeSelf: z.boolean().default(false),
  peerLimit: z.number().int().min(0).max(5).default(3),
  subordinateLimit: z.number().int().min(0).max(5).default(3),
})

export const WordCloud360ResponseSchema = z
  .object({
    assignmentId: z.string().min(1),
    positiveKeywordIds: z.array(z.string().min(1)).max(30).default([]),
    negativeKeywordIds: z.array(z.string().min(1)).max(30).default([]),
    submitFinal: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.positiveKeywordIds).size !== data.positiveKeywordIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['positiveKeywordIds'],
        message: '湲띿젙 ?ㅼ썙?쒕뒗 以묐났 ?좏깮?????놁뒿?덈떎.',
      })
    }

    if (new Set(data.negativeKeywordIds).size !== data.negativeKeywordIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['negativeKeywordIds'],
        message: '遺???ㅼ썙?쒕뒗 以묐났 ?좏깮?????놁뒿?덈떎.',
      })
    }
  })

export const WordCloud360RevertResponseSchema = z.object({
  assignmentId: z.string().min(1, '理쒖쥌 ?쒖텧??痍⑥냼???묐떟???좏깮??二쇱꽭??'),
  reason: z.string().trim().min(5, '痍⑥냼 ?ъ쑀瑜?5???댁긽 ?낅젰??二쇱꽭??').max(500, '痍⑥냼 ?ъ쑀??500???댄븯濡??낅젰??二쇱꽭??'),
})

export const WordCloud360RestoreResponseSchema = z.object({
  assignmentId: z.string().min(1, '蹂듭썝???묐떟???좏깮??二쇱꽭??'),
  revisionId: z.string().min(1, '蹂듭썝???대젰 ?쒖젏???좏깮??二쇱꽭??'),
  reason: z.string().trim().min(5, '蹂듭썝 ?ъ쑀瑜?5???댁긽 ?낅젰??二쇱꽭??').max(500, '蹂듭썝 ?ъ쑀??500???댄븯濡??낅젰??二쇱꽭??'),
})

export const WordCloud360PublishSchema = z.object({
  cycleId: z.string().min(1),
  publish: z.boolean().default(true),
})


