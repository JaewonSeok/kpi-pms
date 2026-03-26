import { z } from 'zod'

// ============================================
// 조직도 관련
// ============================================

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1, '조직명을 입력하세요').max(100),
  fiscalYear: z.number().int().min(2020).max(2100),
})

// ============================================
// 등급 설정 관련
// ============================================

export const GradeSettingSchema = z.object({
  gradeOrder: z.number().int().min(1),
  gradeName: z.string().min(1).max(5, '등급명은 5자 이내'),
  baseScore: z.number().int().min(0).max(100),
  minScore: z.number().int().min(0).max(100),
  maxScore: z.number().int().min(0).max(100),
  levelName: z.string().min(1).max(20),
  description: z.string().max(200).optional(),
  targetDistRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().default(true),
}).refine(data => data.minScore <= data.maxScore, {
  message: '최솟값은 최댓값보다 작거나 같아야 합니다',
  path: ['minScore'],
})

export const UpdateGradeSettingsSchema = z.object({
  evalYear: z.number().int().min(2020).max(2100),
  grades: z.array(GradeSettingSchema).min(2).max(10),
})

// ============================================
// KPI 관련
// ============================================

export const CreateOrgKpiSchema = z.object({
  deptId: z.string().min(1),
  evalYear: z.number().int().min(2020).max(2100),
  kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']),
  kpiCategory: z.string().min(1).max(50),
  kpiName: z.string().min(1).max(100),
  definition: z.string().max(500).optional(),
  formula: z.string().max(500).optional(),
  targetValue: z.number().optional(),
  unit: z.string().max(20).optional(),
  weight: z.number().min(0).max(100),
  difficulty: z.enum(['HIGH', 'MEDIUM', 'LOW']),
})

export const UpdateOrgKpiSchema = z.object({
  deptId: z.string().min(1).optional(),
  evalYear: z.number().int().min(2020).max(2100).optional(),
  kpiType: z.enum(['QUANTITATIVE', 'QUALITATIVE']).optional(),
  kpiCategory: z.string().min(1).max(50).optional(),
  kpiName: z.string().min(1).max(100).optional(),
  definition: z.string().max(500).optional(),
  formula: z.string().max(500).optional(),
  targetValue: z.number().optional(),
  unit: z.string().max(20).optional(),
  weight: z.number().min(0).max(100).optional(),
  difficulty: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'ARCHIVED']).optional(),
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
  status: z.enum(['DRAFT', 'CONFIRMED', 'ARCHIVED']).optional(),
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
// 월별 실적 관련
// ============================================

export const MonthlyRecordSchema = z.object({
  personalKpiId: z.string().min(1),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM 형식으로 입력하세요'),
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
// 평가 관련
// ============================================

export const SubmitEvaluationSchema = z.object({
  comment: z.string().min(50, '종합 의견은 최소 50자 이상 입력하세요').max(2000),
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
  comment: z.string().max(2000).optional(),
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
  rejectionReason: z.string().min(10, '반려 사유는 최소 10자 이상 입력하세요').max(500),
})

export const CeoAdjustSchema = z.object({
  targetId: z.string(),
  gradeId: z.string().min(1, '등급을 선택하세요'),
  adjustReason: z.string().min(30, '조정 사유는 최소 30자 이상 입력하세요').max(500),
})

// ============================================
// 다면평가 관련
// ============================================

export const CreateFeedbackRoundSchema = z.object({
  evalCycleId: z.string().min(1),
  roundName: z.string().min(1).max(100),
  roundType: z.enum(['PEER', 'UPWARD', 'CROSS_DEPT', 'FULL_360']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isAnonymous: z.boolean().default(true),
  minRaters: z.number().int().min(1).max(10).default(3),
  maxRaters: z.number().int().min(1).max(20).default(8),
  weightInFinal: z.number().min(0).max(100).default(0),
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

export const Feedback360AiActionSchema = z.object({
  action: z.enum([
    'recommend-reviewers',
    'summarize-themes',
    'detect-careless-reviews',
    'suggest-development-plan',
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

export const DevelopmentPlanCreateSchema = z.object({
  employeeId: z.string().min(1).max(100),
  sourceType: z.enum(['FEEDBACK_360', 'EVALUATION', 'CHECKIN', 'MANUAL']).default('FEEDBACK_360'),
  sourceId: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  focusArea: z.string().min(1).max(200),
  actions: z.array(z.string().min(1).max(500)).min(1).max(10),
  managerSupport: z.array(z.string().min(1).max(500)).max(10).optional(),
  nextCheckinTopics: z.array(z.string().min(1).max(500)).max(10).optional(),
  note: z.string().max(1000).optional(),
  dueDate: z.string().datetime().optional(),
})

// ============================================
// 체크인 관련
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
// 이의신청 관련
// ============================================

export const AppealSchema = z.object({
  evaluationId: z.string().min(1),
  reason: z.string().min(20, '이의신청 사유는 최소 20자 이상 입력하세요').max(1000),
})

// ============================================
// 평가 주기 관련
// ============================================

export const EvalCycleSchema = z.object({
  orgId: z.string().min(1),
  evalYear: z.number().int().min(2020).max(2100),
  cycleName: z.string().min(1).max(100),
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
  requestType: z.enum(['KPI_ASSIST', 'EVAL_COMMENT_DRAFT', 'BIAS_ANALYSIS', 'GROWTH_PLAN']),
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
  growthMemo: z.string().max(4000).optional().default(''),
  draftGradeId: z.string().max(100).nullable().optional(),
  items: z.array(EvaluationAssistItemSchema).max(50).default([]),
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
  definition: z.string().max(500).optional(),
  formula: z.string().max(500).optional(),
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
    message: '날짜 형식이 올바르지 않습니다.',
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
        message: '본인을 관리자로 지정할 수 없습니다.',
      })
    }

    if (data.employmentStatus === 'ACTIVE' && data.resignationDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resignationDate'],
        message: '재직 상태가 ACTIVE이면 퇴사일을 입력할 수 없습니다.',
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
        message: '퇴사 처리 시 퇴사일을 입력해 주세요.',
      })
    }
  })

export const DeleteGoogleAccountEmployeeSchema = z.object({
  employeeId: z.string().min(1),
})

export const CreateAdminEmployeeSchema = AdminEmployeeRecordSchema

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

export const CalibrationCandidateUpdateSchema = z
  .object({
    action: z.enum(['save', 'clear']),
    cycleId: z.string().min(1),
    targetId: z.string().min(1),
    gradeId: z.string().optional(),
    adjustReason: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action !== 'save') return

    if (!data.gradeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gradeId'],
        message: '조정 등급을 선택해 주세요.',
      })
    }

    if (!data.adjustReason || data.adjustReason.trim().length < 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adjustReason'],
        message: '조정 사유는 최소 30자 이상 입력해 주세요.',
      })
    }
  })

export const CalibrationWorkflowSchema = z.object({
  cycleId: z.string().min(1),
  action: z.enum(['CONFIRM_REVIEW', 'LOCK', 'REOPEN_REQUEST']),
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
        message: '최소 제출 개수는 최대 제출 개수보다 클 수 없습니다.',
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
        message: '행별 문항 수 합계가 총 문항 수와 일치해야 합니다.',
      })
    }

    if (Math.abs(totalPoints - data.totalPoints) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalPoints'],
        message: '행별 배점 합계가 총점과 일치해야 합니다.',
      })
    }

    if (data.passScore > data.totalPoints) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passScore'],
        message: '합격 기준은 총점을 초과할 수 없습니다.',
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
        message: '평가 기준 배점 합계가 총점과 일치해야 합니다.',
      })
    }
    if (data.passScore > data.totalScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passScore'],
        message: '합격 기준은 총점을 초과할 수 없습니다.',
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
        message: '최종 제출 시 판정을 선택해 주세요.',
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
