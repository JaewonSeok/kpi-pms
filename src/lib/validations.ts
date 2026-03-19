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
  relationship: z.enum(['SUPERVISOR', 'PEER', 'CROSS_TEAM_PEER', 'SUBORDINATE', 'CROSS_DEPT']),
  overallComment: z.string().max(1000).optional(),
  responses: z.array(z.object({
    questionId: z.string(),
    ratingValue: z.number().int().min(1).max(5).optional(),
    textValue: z.string().max(500).optional(),
  })),
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

export const AdminEmployeeRoleSchema = z.enum([
  'ROLE_MEMBER',
  'ROLE_TEAM_LEADER',
  'ROLE_SECTION_CHIEF',
  'ROLE_DIV_HEAD',
  'ROLE_CEO',
  'ROLE_ADMIN',
])

export const AdminEmployeeStatusSchema = z.enum(['ACTIVE', 'ON_LEAVE', 'RESIGNED'])

export const RegisterGoogleAccountSchema = z.object({
  employeeId: z.string().min(1),
  gwsEmail: z.string().email().max(255),
})

export const UpdateGoogleAccountEmployeeSchema = RegisterGoogleAccountSchema.extend({
  role: AdminEmployeeRoleSchema,
  deptId: z.string().min(1),
  status: AdminEmployeeStatusSchema.default('ACTIVE'),
})

export const CreateAdminEmployeeSchema = z.object({
  empId: z.string().min(1).max(50),
  empName: z.string().min(1).max(100),
  deptId: z.string().min(1),
  role: AdminEmployeeRoleSchema,
  status: AdminEmployeeStatusSchema.default('ACTIVE'),
  gwsEmail: z.string().email().max(255),
  joinDate: EmployeeDateSchema,
})

export const BulkAdminEmployeeRowSchema = z.object({
  empId: z.string().min(1).max(50),
  empName: z.string().min(1).max(100),
  deptCode: z.string().min(1).max(50),
  deptName: z.string().min(1).max(100),
  parentDeptCode: z.string().max(50).optional(),
  role: AdminEmployeeRoleSchema,
  status: AdminEmployeeStatusSchema.default('ACTIVE'),
  gwsEmail: z.string().email().max(255),
  joinDate: EmployeeDateSchema.optional(),
})

export const BulkAdminEmployeeUploadSchema = z.object({
  fileName: z.string().max(255).optional(),
  rows: z.array(BulkAdminEmployeeRowSchema).min(1).max(500),
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
