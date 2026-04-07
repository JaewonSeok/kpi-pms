import {
  AIApprovalStatus,
  AIRequestStatus,
  AIRequestType,
  Prisma,
  type PrismaClient,
} from '@prisma/client'
import { prisma } from './prisma'
import { AppError } from './utils'
import { isFeatureEnabled } from './feature-flags'
import { recordOperationalEvent } from './operations'

type JsonRecord = Record<string, unknown>

type AiConfig = {
  schemaName: string
  schema: JsonRecord
  systemPrompt: string
}

type SourceScopedAiConfigKey = `${AIRequestType}:${string}`

type AiAssistExecutionParams = {
  requesterId: string
  requestType: AIRequestType
  sourceType?: string
  sourceId?: string
  payload: JsonRecord
}

type DecisionParams = {
  id: string
  actorId: string
  action: 'approve' | 'reject'
  approvedPayload?: JsonRecord
  rejectionReason?: string
}

type OpenAIResponseData = {
  result: JsonRecord
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

export const AI_REQUEST_LABELS: Record<AIRequestType, string> = {
  KPI_ASSIST: 'KPI 작성 보조',
  EVAL_COMMENT_DRAFT: '평가 코멘트 초안',
  BIAS_ANALYSIS: '편향 분석',
  GROWTH_PLAN: '성장 계획 추천',
}

const KPI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'kpiName',
    'definition',
    'formula',
    'targetValueSuggestion',
    'unitSuggestion',
    'weightSuggestion',
    'difficultySuggestion',
    'smartChecks',
    'managerReviewPoints',
  ],
  properties: {
    kpiName: { type: 'string' },
    definition: { type: 'string' },
    formula: { type: 'string' },
    targetValueSuggestion: { type: 'string' },
    unitSuggestion: { type: 'string' },
    weightSuggestion: { type: 'number' },
    difficultySuggestion: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    smartChecks: {
      type: 'array',
      items: { type: 'string' },
    },
    managerReviewPoints: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const ORG_KPI_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'category',
    'definition',
    'formula',
    'targetValueSuggestion',
    'unit',
    'weightSuggestion',
    'difficultySuggestion',
    'reviewPoints',
  ],
  properties: {
    title: { type: 'string' },
    category: { type: ['string', 'null'] },
    definition: { type: 'string' },
    formula: { type: 'string' },
    targetValueSuggestion: { type: 'string' },
    unit: { type: 'string' },
    weightSuggestion: { type: 'number' },
    difficultySuggestion: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    reviewPoints: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const ORG_KPI_WORDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['improvedTitle', 'improvedDefinition', 'rationale'],
  properties: {
    improvedTitle: { type: 'string' },
    improvedDefinition: { type: 'string' },
    rationale: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const ORG_KPI_SMART_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overall', 'criteria', 'summary'],
  properties: {
    overall: { type: 'string', enum: ['GOOD', 'WARNING', 'CRITICAL'] },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'status', 'reason', 'suggestion'],
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['PASS', 'WARN', 'FAIL'] },
          reason: { type: 'string' },
          suggestion: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
  },
} satisfies JsonRecord

const ORG_KPI_DUPLICATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'duplicates'],
  properties: {
    summary: { type: 'string' },
    duplicates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'overlapLevel', 'similarityReason'],
        properties: {
          id: { type: ['string', 'null'] },
          title: { type: 'string' },
          overlapLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          similarityReason: { type: 'string' },
        },
      },
    },
  },
} satisfies JsonRecord

const ORG_KPI_ALIGNMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['riskLevel', 'rationale', 'suggestedLinks'],
  properties: {
    recommendedParentId: { type: 'string' },
    recommendedParentTitle: { type: 'string' },
    riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    rationale: { type: 'string' },
    suggestedLinks: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const ORG_KPI_RISK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['riskLevel', 'executiveSummary', 'risks', 'recommendations'],
  properties: {
    riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    executiveSummary: { type: 'string' },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const ORG_KPI_MONTHLY_COMMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['comment', 'highlights', 'concerns', 'nextActions'],
  properties: {
    comment: { type: 'string' },
    highlights: {
      type: 'array',
      items: { type: 'string' },
    },
    concerns: {
      type: 'array',
      items: { type: 'string' },
    },
    nextActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const PERSONAL_KPI_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'definition',
    'formula',
    'targetValueSuggestion',
    'unit',
    'weightSuggestion',
    'difficultySuggestion',
    'evaluationCriteria',
    'reviewPoints',
  ],
  properties: {
    title: { type: 'string' },
    definition: { type: 'string' },
    formula: { type: ['string', 'null'] },
    targetValueSuggestion: { type: 'string' },
    unit: { type: 'string' },
    weightSuggestion: { type: 'number' },
    difficultySuggestion: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    evaluationCriteria: {
      type: 'array',
      items: { type: 'string' },
    },
    reviewPoints: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const PERSONAL_KPI_WORDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['improvedTitle', 'improvedDefinition', 'rationale'],
  properties: {
    improvedTitle: { type: 'string' },
    improvedDefinition: { type: 'string' },
    rationale: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const PERSONAL_KPI_SMART_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overall', 'summary', 'criteria'],
  properties: {
    overall: { type: 'string', enum: ['PASS', 'WARNING', 'FAIL'] },
    summary: { type: 'string' },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'status', 'reason', 'suggestion'],
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['PASS', 'WARN', 'FAIL'] },
          reason: { type: 'string' },
          suggestion: { type: 'string' },
        },
      },
    },
  },
} satisfies JsonRecord

const PERSONAL_KPI_WEIGHT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['currentTotal', 'recommendedTotal', 'recommendations', 'summary'],
  properties: {
    currentTotal: { type: 'number' },
    recommendedTotal: { type: 'number' },
    summary: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'currentWeight', 'recommendedWeight', 'reason'],
        properties: {
          title: { type: 'string' },
          currentWeight: { type: 'number' },
          recommendedWeight: { type: 'number' },
          reason: { type: 'string' },
        },
      },
    },
  },
} satisfies JsonRecord

const PERSONAL_KPI_ALIGNMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendedOrgKpiId', 'recommendedOrgKpiTitle', 'rationale', 'alternatives'],
  properties: {
    recommendedOrgKpiId: { type: 'string' },
    recommendedOrgKpiTitle: { type: 'string' },
    rationale: { type: 'string' },
    alternatives: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const PERSONAL_KPI_DUPLICATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'duplicates'],
  properties: {
    summary: { type: 'string' },
    duplicates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'overlapLevel', 'similarityReason'],
        properties: {
          id: { type: ['string', 'null'] },
          title: { type: 'string' },
          overlapLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          similarityReason: { type: 'string' },
        },
      },
    },
  },
} satisfies JsonRecord

const PERSONAL_KPI_REVIEWER_RISK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'risks', 'reviewPoints'],
  properties: {
    summary: { type: 'string' },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
    reviewPoints: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const PERSONAL_KPI_MONTHLY_COMMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['comment', 'nextActions', 'managerNotes'],
  properties: {
    comment: { type: 'string' },
    nextActions: {
      type: 'array',
      items: { type: 'string' },
    },
    managerNotes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const MONTHLY_PERFORMANCE_SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'highlights', 'risks', 'nextActions'],
  properties: {
    summary: { type: 'string' },
    highlights: {
      type: 'array',
      items: { type: 'string' },
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
    nextActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const MONTHLY_RISK_EXPLANATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['riskLevel', 'causeSummary', 'responsePoints'],
  properties: {
    riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    causeSummary: { type: 'string' },
    responsePoints: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const MONTHLY_MANAGER_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['comment', 'strengths', 'requests'],
  properties: {
    comment: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    requests: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const MONTHLY_EVIDENCE_SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'evidenceHighlights', 'missingEvidence'],
  properties: {
    summary: { type: 'string' },
    evidenceHighlights: {
      type: 'array',
      items: { type: 'string' },
    },
    missingEvidence: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const MONTHLY_RETROSPECTIVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['strengths', 'risks', 'nextMonthPriorities', 'summary'],
  properties: {
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
    nextMonthPriorities: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
  },
} satisfies JsonRecord

const MONTHLY_CHECKIN_AGENDA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['agenda', 'leaderPrep', 'memberPrep'],
  properties: {
    agenda: {
      type: 'array',
      items: { type: 'string' },
    },
    leaderPrep: {
      type: 'array',
      items: { type: 'string' },
    },
    memberPrep: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const MONTHLY_EVALUATION_EVIDENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'evaluationPoints', 'watchouts'],
  properties: {
    summary: { type: 'string' },
    evaluationPoints: {
      type: 'array',
      items: { type: 'string' },
    },
    watchouts: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const FEEDBACK_360_REVIEWER_RECOMMENDATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendations', 'rationale', 'watchouts'],
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['employeeId', 'name', 'relationship'],
        properties: {
          employeeId: { type: 'string' },
          name: { type: 'string' },
          relationship: { type: 'string' },
        },
      },
    },
    rationale: { type: 'string' },
    watchouts: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const FEEDBACK_360_THEME_SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['anonymousSummary', 'strengths', 'blindSpots', 'textHighlights'],
  properties: {
    anonymousSummary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    blindSpots: {
      type: 'array',
      items: { type: 'string' },
    },
    textHighlights: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const FEEDBACK_360_CARELESS_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'riskFlags', 'recommendedActions'],
  properties: {
    summary: { type: 'string' },
    riskFlags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'severity', 'reason'],
        properties: {
          label: { type: 'string' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          reason: { type: 'string' },
        },
      },
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const FEEDBACK_360_DEVELOPMENT_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['focusArea', 'actions', 'managerSupport', 'nextCheckinTopics'],
  properties: {
    focusArea: { type: 'string' },
    actions: {
      type: 'array',
      items: { type: 'string' },
    },
    managerSupport: {
      type: 'array',
      items: { type: 'string' },
    },
    nextCheckinTopics: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const FEEDBACK_360_GROWTH_COPILOT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'growthAreas',
    'recommendedCompetencies',
    'oneOnOneQuestions',
    'coachingDraft',
    'promotionReadinessHint',
  ],
  properties: {
    summary: { type: 'string' },
    growthAreas: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendedCompetencies: {
      type: 'array',
      items: { type: 'string' },
    },
    oneOnOneQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
    coachingDraft: { type: 'string' },
    promotionReadinessHint: { type: 'string' },
  },
} satisfies JsonRecord

const CALIBRATION_RISK_SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'priorityRisks', 'recommendedActions'],
  properties: {
    summary: { type: 'string' },
    priorityRisks: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const COMPENSATION_DECISION_EXPLANATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'drivers', 'employeeFacingNote'],
  properties: {
    summary: { type: 'string' },
    drivers: {
      type: 'array',
      items: { type: 'string' },
    },
    employeeFacingNote: { type: 'string' },
  },
} satisfies JsonRecord

const NOTIFICATION_OPS_SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'warnings', 'recommendedActions'],
  properties: {
    summary: { type: 'string' },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const NOTIFICATION_DEAD_LETTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'patterns', 'recommendedActions'],
  properties: {
    summary: { type: 'string' },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['reason', 'count', 'impact'],
        properties: {
          reason: { type: 'string' },
          count: { type: 'number' },
          impact: { type: 'string' },
        },
      },
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const NOTIFICATION_TEMPLATE_VALIDATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'missingVariables', 'confusingVariables', 'suggestions'],
  properties: {
    summary: { type: 'string' },
    missingVariables: {
      type: 'array',
      items: { type: 'string' },
    },
    confusingVariables: {
      type: 'array',
      items: { type: 'string' },
    },
    suggestions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const NOTIFICATION_OPS_REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'highlights', 'risks', 'nextActions'],
  properties: {
    headline: { type: 'string' },
    highlights: {
      type: 'array',
      items: { type: 'string' },
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
    nextActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const ADMIN_OPS_STATUS_SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'highlights', 'watchouts', 'recommendedActions'],
  properties: {
    summary: { type: 'string' },
    highlights: {
      type: 'array',
      items: { type: 'string' },
    },
    watchouts: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const ADMIN_OPS_INCIDENT_PATTERNS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'patterns', 'topRisks'],
  properties: {
    summary: { type: 'string' },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['component', 'pattern', 'severity', 'action'],
        properties: {
          component: { type: 'string' },
          pattern: { type: 'string' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          action: { type: 'string' },
        },
      },
    },
    topRisks: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const ADMIN_OPS_DAILY_REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'executiveSummary', 'issues', 'nextActions'],
  properties: {
    headline: { type: 'string' },
    executiveSummary: { type: 'string' },
    issues: {
      type: 'array',
      items: { type: 'string' },
    },
    nextActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const ADMIN_OPS_RISK_PRIORITIZATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'priorities'],
  properties: {
    summary: { type: 'string' },
    priorities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'priority', 'reason', 'action'],
        properties: {
          label: { type: 'string' },
          priority: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          reason: { type: 'string' },
          action: { type: 'string' },
        },
      },
    },
  },
} satisfies JsonRecord

const EVAL_COMMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'strengths', 'improvements', 'draftComment'],
  properties: {
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    improvements: {
      type: 'array',
      items: { type: 'string' },
    },
    draftComment: { type: 'string' },
  },
} satisfies JsonRecord

const BIAS_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['riskLevel', 'findings', 'balancedRewrite'],
  properties: {
    riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'issue', 'recommendation'],
        properties: {
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          issue: { type: 'string' },
          recommendation: { type: 'string' },
        },
      },
    },
    balancedRewrite: { type: 'string' },
  },
} satisfies JsonRecord

const GROWTH_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['focusArea', 'recommendedActions', 'supportNeeded', 'milestone'],
  properties: {
    focusArea: { type: 'string' },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
    },
    supportNeeded: {
      type: 'array',
      items: { type: 'string' },
    },
    milestone: { type: 'string' },
  },
} satisfies JsonRecord

const AI_CONFIGS: Record<AIRequestType, AiConfig> = {
  KPI_ASSIST: {
    schemaName: 'kpi_assist',
    schema: KPI_SCHEMA,
    systemPrompt:
      'You are an HR performance management assistant. Draft a SMART KPI suggestion using only the provided sanitized context. Never include personal identifiers. Keep the output concise and practical.',
  },
  EVAL_COMMENT_DRAFT: {
    schemaName: 'evaluation_comment_draft',
    schema: EVAL_COMMENT_SCHEMA,
    systemPrompt:
      'You are an evaluation writing assistant. Produce balanced, evidence-based feedback using only the provided sanitized context. Avoid absolute claims, sensitive identity assumptions, and unsupported conclusions.',
  },
  BIAS_ANALYSIS: {
    schemaName: 'bias_analysis',
    schema: BIAS_ANALYSIS_SCHEMA,
    systemPrompt:
      'You are a bias review assistant for performance evaluations. Detect wording risks such as subjectivity, recency bias, halo effect, gendered or personality-loaded language, and missing evidence. Return actionable recommendations.',
  },
  GROWTH_PLAN: {
    schemaName: 'growth_plan',
    schema: GROWTH_PLAN_SCHEMA,
    systemPrompt:
      'You are a career development assistant. Recommend a short growth plan grounded in the provided performance context. Keep it specific, realistic, and appropriate for manager review.',
  },
}

const SOURCE_SCOPED_AI_CONFIGS: Record<SourceScopedAiConfigKey, AiConfig> = {
  'KPI_ASSIST:OrgKpiDraft': {
    schemaName: 'org_kpi_draft',
    schema: ORG_KPI_DRAFT_SCHEMA,
    systemPrompt:
      'You are an HR strategy assistant for organization KPI design. Reply in Korean. Generate concise, measurable organization KPI draft suggestions that align top-down strategy with monthly execution and personal KPI cascade. Avoid personal data and avoid vague wording.',
  },
  'KPI_ASSIST:OrgKpiWording': {
    schemaName: 'org_kpi_wording',
    schema: ORG_KPI_WORDING_SCHEMA,
    systemPrompt:
      'You are an HR strategy editor. Reply in Korean. Improve organization KPI wording so that the title and definition are clearer, measurable, and easier for executives and HR operators to understand.',
  },
  'KPI_ASSIST:OrgKpiSmart': {
    schemaName: 'org_kpi_smart_check',
    schema: ORG_KPI_SMART_SCHEMA,
    systemPrompt:
      'You are a SMART KPI reviewer. Reply in Korean. Diagnose whether the organization KPI is specific, measurable, achievable, relevant, and time-bound, and provide concise actionable suggestions.',
  },
  'KPI_ASSIST:OrgKpiDuplicate': {
    schemaName: 'org_kpi_duplicate_detection',
    schema: ORG_KPI_DUPLICATE_SCHEMA,
    systemPrompt:
      'You are an HR KPI governance assistant. Reply in Korean. Detect duplicated or overlapping organization KPIs inside the provided list and explain the overlap briefly.',
  },
  'KPI_ASSIST:OrgKpiAlignment': {
    schemaName: 'org_kpi_alignment',
    schema: ORG_KPI_ALIGNMENT_SCHEMA,
    systemPrompt:
      'You are a KPI cascade assistant. Reply in Korean. Suggest the most natural parent organization KPI or cascade linkage based on department context, strategy direction, and the candidate KPIs.',
  },
  'KPI_ASSIST:OrgKpiOperationalRisk': {
    schemaName: 'org_kpi_operational_risk',
    schema: ORG_KPI_RISK_SCHEMA,
    systemPrompt:
      'You are an HR operations analyst. Reply in Korean. Summarize the operational risks in the current organization KPI structure, including linkage gaps, unclear measures, and cascade difficulties, with concise recommendations.',
  },
  'KPI_ASSIST:OrgKpiMonthlyComment': {
    schemaName: 'org_kpi_monthly_comment',
    schema: ORG_KPI_MONTHLY_COMMENT_SCHEMA,
    systemPrompt:
      'You are a monthly KPI review assistant. Reply in Korean. Draft a short operational comment for an organization KPI using monthly execution signals. Highlight achievements, concerns, and next actions.',
  },
  'KPI_ASSIST:PersonalKpiDraft': {
    schemaName: 'personal_kpi_draft',
    schema: PERSONAL_KPI_DRAFT_SCHEMA,
    systemPrompt:
      'You are a personal KPI design assistant. Reply in Korean. Generate concise and measurable personal KPI draft suggestions aligned to the employee role, linked organization KPI, and expected yearly outcomes. Keep the wording practical for employee-manager agreement.',
  },
  'KPI_ASSIST:PersonalKpiWording': {
    schemaName: 'personal_kpi_wording',
    schema: PERSONAL_KPI_WORDING_SCHEMA,
    systemPrompt:
      'You are an HR goal-writing editor. Reply in Korean. Improve personal KPI wording so the title and definition are clearer, measurable, and easier for employees and leaders to review.',
  },
  'KPI_ASSIST:PersonalKpiSmart': {
    schemaName: 'personal_kpi_smart_check',
    schema: PERSONAL_KPI_SMART_SCHEMA,
    systemPrompt:
      'You are a SMART personal KPI reviewer. Reply in Korean. Diagnose whether the KPI is specific, measurable, achievable, relevant, and time-bound, with concise suggestions.',
  },
  'KPI_ASSIST:PersonalKpiWeight': {
    schemaName: 'personal_kpi_weight_recommendation',
    schema: PERSONAL_KPI_WEIGHT_SCHEMA,
    systemPrompt:
      'You are a KPI portfolio balancing assistant. Reply in Korean. Review the current personal KPI set, detect weight imbalance, and suggest better weight allocation while keeping the portfolio practical.',
  },
  'KPI_ASSIST:PersonalKpiAlignment': {
    schemaName: 'personal_kpi_org_alignment',
    schema: PERSONAL_KPI_ALIGNMENT_SCHEMA,
    systemPrompt:
      'You are a KPI alignment assistant. Reply in Korean. Suggest the most natural organization KPI alignment for the personal KPI and explain why it fits.',
  },
  'KPI_ASSIST:PersonalKpiDuplicate': {
    schemaName: 'personal_kpi_duplicate_detection',
    schema: PERSONAL_KPI_DUPLICATE_SCHEMA,
    systemPrompt:
      'You are a KPI governance assistant. Reply in Korean. Detect overlapping or duplicated personal KPIs and briefly explain the overlap.',
  },
  'KPI_ASSIST:PersonalKpiReviewerRisk': {
    schemaName: 'personal_kpi_reviewer_risk',
    schema: PERSONAL_KPI_REVIEWER_RISK_SCHEMA,
    systemPrompt:
      'You are a leader review assistant. Reply in Korean. Highlight risky, vague, or hard-to-review personal KPIs and provide concise review points for the manager.',
  },
  'KPI_ASSIST:PersonalKpiMonthlyComment': {
    schemaName: 'personal_kpi_monthly_comment',
    schema: PERSONAL_KPI_MONTHLY_COMMENT_SCHEMA,
    systemPrompt:
      'You are a monthly execution assistant. Reply in Korean. Draft a short execution comment and next actions for the personal KPI using recent monthly progress signals.',
  },
  'KPI_ASSIST:MonthlyPerformanceSummary': {
    schemaName: 'monthly_performance_summary',
    schema: MONTHLY_PERFORMANCE_SUMMARY_SCHEMA,
    systemPrompt:
      'You are a monthly performance summary assistant. Reply in Korean. Summarize the current month KPI execution with concise highlights, risks, and next actions that can be reused in monthly reports.',
  },
  'KPI_ASSIST:MonthlyRiskExplanation': {
    schemaName: 'monthly_risk_explanation',
    schema: MONTHLY_RISK_EXPLANATION_SCHEMA,
    systemPrompt:
      'You are a KPI risk explanation assistant. Reply in Korean. Explain why the KPI is risky this month and suggest practical response points for the employee and manager.',
  },
  'KPI_ASSIST:MonthlyManagerReview': {
    schemaName: 'monthly_manager_review',
    schema: MONTHLY_MANAGER_REVIEW_SCHEMA,
    systemPrompt:
      'You are a manager review drafting assistant. Reply in Korean. Suggest a balanced monthly review comment with strengths and practical requests for the next month.',
  },
  'KPI_ASSIST:MonthlyEvidenceSummary': {
    schemaName: 'monthly_evidence_summary',
    schema: MONTHLY_EVIDENCE_SUMMARY_SCHEMA,
    systemPrompt:
      'You are an evidence summarization assistant. Reply in Korean. Summarize the monthly evidence and mention what proof is strong or still missing.',
  },
  'KPI_ASSIST:MonthlyRetrospective': {
    schemaName: 'monthly_retrospective',
    schema: MONTHLY_RETROSPECTIVE_SCHEMA,
    systemPrompt:
      'You are a retrospective assistant. Reply in Korean. Organize this month into strengths, risks, next-month priorities, and a concise summary for HR-style reporting.',
  },
  'KPI_ASSIST:MonthlyCheckinAgenda': {
    schemaName: 'monthly_checkin_agenda',
    schema: MONTHLY_CHECKIN_AGENDA_SCHEMA,
    systemPrompt:
      'You are a check-in preparation assistant. Reply in Korean. Suggest a concise check-in agenda and preparation points for both the leader and the member.',
  },
  'KPI_ASSIST:MonthlyEvaluationEvidence': {
    schemaName: 'monthly_evaluation_evidence',
    schema: MONTHLY_EVALUATION_EVIDENCE_SCHEMA,
    systemPrompt:
      'You are an evaluation evidence assistant. Reply in Korean. Summarize how the current month performance can be referenced later in performance evaluation comments.',
  },
  'KPI_ASSIST:NotificationOpsSummary': {
    schemaName: 'notification_ops_summary',
    schema: NOTIFICATION_OPS_SUMMARY_SCHEMA,
    systemPrompt:
      'You are a notification operations analyst. Reply in Korean. Summarize the current notification operation health using concise admin-facing language, focusing on delivery status, failure risks, and immediate actions.',
  },
  'KPI_ASSIST:NotificationDeadLetterPatterns': {
    schemaName: 'notification_dead_letter_patterns',
    schema: NOTIFICATION_DEAD_LETTER_SCHEMA,
    systemPrompt:
      'You are a dead letter analysis assistant. Reply in Korean. Identify repeated dead letter failure patterns, explain the operational impact briefly, and suggest practical next actions for an admin operator.',
  },
  'KPI_ASSIST:NotificationTemplateValidation': {
    schemaName: 'notification_template_validation',
    schema: NOTIFICATION_TEMPLATE_VALIDATION_SCHEMA,
    systemPrompt:
      'You are a notification template QA assistant. Reply in Korean. Review the provided notification template and variables, point out missing or confusing placeholders, and suggest safer wording or variable handling.',
  },
  'KPI_ASSIST:NotificationOpsReport': {
    schemaName: 'notification_ops_report',
    schema: NOTIFICATION_OPS_REPORT_SCHEMA,
    systemPrompt:
      'You are an HR operations reporting assistant. Reply in Korean. Draft a short admin report for notification operations, covering highlights, risks, and recommended next actions in concise executive-ready language.',
  },
  'KPI_ASSIST:AdminOpsStatusSummary': {
    schemaName: 'admin_ops_status_summary',
    schema: ADMIN_OPS_STATUS_SUMMARY_SCHEMA,
    systemPrompt:
      'You are an admin operations analyst. Reply in Korean. Summarize the current service and business operations health in concise operator-friendly language, including immediate watchouts and practical next actions.',
  },
  'KPI_ASSIST:AdminOpsIncidentPatterns': {
    schemaName: 'admin_ops_incident_patterns',
    schema: ADMIN_OPS_INCIDENT_PATTERNS_SCHEMA,
    systemPrompt:
      'You are an incident pattern analyst. Reply in Korean. Review operations events and explain repeated patterns, likely impact, and the next actions an admin operator should take.',
  },
  'KPI_ASSIST:AdminOpsDailyReport': {
    schemaName: 'admin_ops_daily_report',
    schema: ADMIN_OPS_DAILY_REPORT_SCHEMA,
    systemPrompt:
      'You are an HR SaaS operations reporting assistant. Reply in Korean. Draft a concise daily operations report for admins and leadership, focusing on current health, issues, and next actions.',
  },
  'KPI_ASSIST:AdminOpsRiskPrioritization': {
    schemaName: 'admin_ops_risk_prioritization',
    schema: ADMIN_OPS_RISK_PRIORITIZATION_SCHEMA,
    systemPrompt:
      'You are an operations prioritization assistant. Reply in Korean. Rank current operational risks by urgency, explain why they matter, and suggest the first action for each.',
  },
  'KPI_ASSIST:Feedback360ReviewerRecommendation': {
    schemaName: 'feedback_360_reviewer_recommendation',
    schema: FEEDBACK_360_REVIEWER_RECOMMENDATION_SCHEMA,
    systemPrompt:
      'You are a 360 feedback nomination assistant. Reply in Korean. Recommend a balanced reviewer mix across supervisor, peer, and subordinate groups while protecting anonymity and minimizing reviewer fatigue.',
  },
  'KPI_ASSIST:Feedback360ThemeSummary': {
    schemaName: 'feedback_360_theme_summary',
    schema: FEEDBACK_360_THEME_SUMMARY_SCHEMA,
    systemPrompt:
      'You are a 360 feedback summary assistant. Reply in Korean. Summarize anonymized feedback themes into strengths, blind spots, and representative highlights without exposing identifying details.',
  },
  'KPI_ASSIST:Feedback360CarelessReview': {
    schemaName: 'feedback_360_careless_review',
    schema: FEEDBACK_360_CARELESS_REVIEW_SCHEMA,
    systemPrompt:
      'You are a 360 feedback quality analyst. Reply in Korean. Identify signs of careless reviews, explain why they are risky, and suggest concrete follow-up actions for HR operators.',
  },
  'KPI_ASSIST:Feedback360DevelopmentPlan': {
    schemaName: 'feedback_360_development_plan',
    schema: FEEDBACK_360_DEVELOPMENT_PLAN_SCHEMA,
    systemPrompt:
      'You are a development planning assistant. Reply in Korean. Convert 360 feedback themes into a focused development plan with practical actions, manager support, and next check-in topics.',
  },
  'GROWTH_PLAN:Feedback360GrowthCopilot': {
    schemaName: 'feedback_360_growth_copilot',
    schema: FEEDBACK_360_GROWTH_COPILOT_SCHEMA,
    systemPrompt:
      'You are a leadership growth copilot. Reply in Korean. Use recent review, goal, feedback, and one-on-one context to summarize growth areas, suggest one-on-one questions, draft a coaching message, and provide a cautious promotion-readiness hint. You are only a draft assistant and must not make final personnel decisions.',
  },
  'KPI_ASSIST:CalibrationRiskSummary': {
    schemaName: 'calibration_risk_summary',
    schema: CALIBRATION_RISK_SUMMARY_SCHEMA,
    systemPrompt:
      'You are a calibration risk assistant. Reply in Korean. Summarize distribution and fairness risks in a calibration session and suggest the next action for HR or executives.',
  },
  'KPI_ASSIST:CompensationDecisionExplanation': {
    schemaName: 'compensation_decision_explanation',
    schema: COMPENSATION_DECISION_EXPLANATION_SCHEMA,
    systemPrompt:
      'You are a compensation explanation assistant. Reply in Korean. Explain the main drivers of a compensation decision in concise, employee-friendly language without exposing internal-only details.',
  },
}

function getAiConfig(requestType: AIRequestType, sourceType?: string) {
  if (sourceType) {
    const sourceScoped = SOURCE_SCOPED_AI_CONFIGS[`${requestType}:${sourceType}` as SourceScopedAiConfigKey]
    if (sourceScoped) {
      return sourceScoped
    }
  }

  return AI_CONFIGS[requestType]
}

const OMIT_KEY_PATTERN =
  /^(name|empname|employeename|email|gwsemail|empid|employeeid|requesterid|targetid|evaluatorid|recipientid|approvedbyid|linkedorgkpiid)$/i

function redactText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\bEMP-\d{4}-\d{3,}\b/gi, '[redacted-employee-id]')
    .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, '[redacted-phone]')
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (key && OMIT_KEY_PATTERN.test(key)) {
    return undefined
  }

  if (typeof value === 'string') {
    return redactText(value).slice(0, 4000)
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined)
      .slice(0, 20)
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([entryKey, entryValue]) => [entryKey, sanitizeValue(entryValue, entryKey)] as const)
      .filter(([, entryValue]) => entryValue !== undefined)

    return Object.fromEntries(entries)
  }

  if (value === undefined) {
    return undefined
  }

  return String(value)
}

export function sanitizeAiPayload(payload: JsonRecord) {
  return (sanitizeValue(payload) ?? {}) as JsonRecord
}

function toJsonValue(value: JsonRecord | undefined) {
  return (value ?? {}) as Prisma.InputJsonValue
}

function toStringArray(values: unknown, fallback: string[]) {
  if (!Array.isArray(values)) return fallback
  const list = values.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return list.length ? list : fallback
}

export function buildFallbackResult(
  requestType: AIRequestType,
  payload: JsonRecord,
  sourceType?: string
): JsonRecord {
  const summary = String(payload.summary ?? payload.contextSummary ?? payload.definition ?? '').trim()
  const goal = String(payload.goal ?? payload.kpiName ?? payload.focusArea ?? '').trim()
  const orgKpi = String(payload.orgKpiName ?? '').trim()
  const grade = String(payload.gradeName ?? '').trim()

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiDraft') {
    return {
      title: goal || orgKpi || '조직 KPI 초안',
      category: String(payload.category ?? payload.kpiCategory ?? '전략 실행'),
      definition:
        summary ||
        '조직 전략을 월간 실행과 개인 KPI로 연결할 수 있도록 측정 가능한 결과 중심으로 정의한 조직 KPI 초안입니다.',
      formula: '실적 / 목표 x 100',
      targetValueSuggestion: String(payload.targetValue ?? '연간 목표 100 기준'),
      unit: String(payload.unit ?? '%'),
      weightSuggestion: Number(payload.weight ?? 20),
      difficultySuggestion: String(payload.difficulty ?? 'MEDIUM'),
      reviewPoints: [
        '가중치 합과 부서 내 다른 KPI와의 중복 여부를 함께 확인하세요.',
        '월간 실적 데이터로 실제 측정 가능한지 검토하세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiWording') {
    return {
      improvedTitle: goal || orgKpi || '측정 가능한 조직 KPI 문구',
      improvedDefinition:
        summary ||
        '조직 목표와 측정 기준이 함께 드러나도록 문장을 간결하게 정리한 제안입니다.',
      rationale: [
        '측정 대상과 기대 결과를 한 문장 안에서 읽히게 정리했습니다.',
        '실제 실행 지표와 연결될 수 있도록 표현을 구체화했습니다.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiSmart') {
    return {
      overall: 'WARNING',
      summary: '현재 KPI는 방향성은 있으나 측정 기준과 기한 표현을 더 선명하게 다듬을 필요가 있습니다.',
      criteria: [
        {
          name: 'Specific',
          status: 'WARN',
          reason: '대상과 결과 표현이 다소 넓습니다.',
          suggestion: '핵심 고객군 또는 운영 지표를 명확히 지정하세요.',
        },
        {
          name: 'Measurable',
          status: 'PASS',
          reason: '목표값과 측정 방식이 포함되어 있습니다.',
          suggestion: '월간 추적 기준을 함께 적으면 더 좋습니다.',
        },
        {
          name: 'Achievable',
          status: 'WARN',
          reason: '목표 수준의 근거가 부족합니다.',
          suggestion: '전년 실적 또는 현재 기준치를 함께 적으세요.',
        },
        {
          name: 'Relevant',
          status: 'PASS',
          reason: '조직 전략 방향과 연결되어 있습니다.',
          suggestion: '상위 전략 키워드를 문장에 반영하면 더 분명해집니다.',
        },
        {
          name: 'Time-bound',
          status: 'FAIL',
          reason: '평가 주기나 점검 주기가 약합니다.',
          suggestion: '연간 목표와 월간 점검 기준을 함께 명시하세요.',
        },
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiDuplicate') {
    return {
      summary: '유사 KPI 후보를 기반으로 중복 가능성을 정리했습니다.',
      duplicates: Array.isArray(payload.candidates)
        ? (payload.candidates as unknown[])
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
            .slice(0, 3)
            .map((item) => ({
              id: String(item.id ?? ''),
              title: String(item.title ?? '유사 KPI'),
              overlapLevel: 'MEDIUM',
              similarityReason: '측정 대상 또는 전략 키워드가 유사합니다.',
            }))
        : [],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiAlignment') {
    return {
      recommendedParentId: String(payload.recommendedParentId ?? ''),
      recommendedParentTitle: String(payload.recommendedParentTitle ?? '상위 KPI 후보'),
      riskLevel: 'MEDIUM',
      rationale:
        summary || '조직 트리와 KPI 카테고리 기준으로 가장 자연스러운 상위 연결 후보를 정리했습니다.',
      suggestedLinks: [
        '상위 전략 KPI와의 관계를 정의 문장에 함께 적어 두세요.',
        '개인 KPI로 풀어내기 어려운 표현은 월간 실적 기준으로 다시 다듬으세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiOperationalRisk') {
    return {
      riskLevel: 'MEDIUM',
      executiveSummary:
        summary || '현재 KPI 구조는 운영 가능하지만 연결 누락과 실적 추적 공백이 일부 존재합니다.',
      risks: [
        '개인 KPI 연결 수가 낮은 항목이 있습니다.',
        '최근 월간 실적이 없는 KPI가 있습니다.',
      ],
      recommendations: [
        '연결 누락 KPI를 우선 검토하고 개인 KPI 템플릿과 연결하세요.',
        '측정식이 약한 KPI는 SMART 관점으로 다시 정리하세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiMonthlyComment') {
    return {
      comment:
        summary || '최근 월간 실적 기준으로는 실행은 진행 중이지만 연결 커버리지와 달성률 편차를 함께 점검할 필요가 있습니다.',
      highlights: ['주요 KPI의 월간 달성 흐름은 유지되고 있습니다.'],
      concerns: ['연결된 개인 KPI 수가 적은 항목은 실행 추적이 약해질 수 있습니다.'],
      nextActions: ['다음 점검 전까지 미연결 KPI와 최근 실적 누락 항목을 우선 확인하세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiDraft') {
    return {
      title: goal || '개인 KPI 초안',
      definition:
        summary || '조직 KPI와 연결되고 월간 실적과 평가에서 근거로 활용할 수 있는 개인 KPI 초안입니다.',
      formula: payload.kpiType === 'QUALITATIVE' ? '정성 기준 체크리스트 충족 여부' : '실적 / 목표 x 100',
      targetValueSuggestion: String(payload.targetValue ?? '연간 목표 100 기준'),
      unit: String(payload.unit ?? (payload.kpiType === 'QUALITATIVE' ? '건' : '%')),
      weightSuggestion: Number(payload.weight ?? 25),
      difficultySuggestion: String(payload.difficulty ?? 'MEDIUM'),
      evaluationCriteria: [
        '월간 실적 입력 시 동일한 기준으로 추적 가능한지 확인합니다.',
        '리더 검토 시 목표 수준과 측정 방법이 설명 가능한지 확인합니다.',
      ],
      reviewPoints: [
        '조직 KPI와의 연결 문장이 충분히 분명한지 확인하세요.',
        '가중치 합이 100이 되도록 다른 KPI와 함께 조정하세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiWording') {
    return {
      improvedTitle: goal || '측정 가능한 개인 KPI 문장',
      improvedDefinition:
        summary || '직무 기대성과와 측정 방법이 더 명확하게 보이도록 개인 KPI 문장을 정리한 제안입니다.',
      rationale: [
        '목표 대상과 기대 결과를 더 분명하게 드러내도록 정리했습니다.',
        '월간 실적과 평가 코멘트로 이어질 수 있게 측정 표현을 보완했습니다.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiSmart') {
    return {
      overall: 'WARNING',
      summary: '개인 KPI의 방향은 적절하지만 측정 기준과 기한 표현을 더 구체화하면 검토와 합의가 쉬워집니다.',
      criteria: [
        { name: 'Specific', status: 'WARN', reason: '핵심 결과가 다소 넓게 표현되어 있습니다.', suggestion: '대상 업무나 결과물을 더 명확히 적어보세요.' },
        { name: 'Measurable', status: 'PASS', reason: '측정 기준이 포함되어 있습니다.', suggestion: '월간 실적으로 같은 기준을 추적할 수 있는지 확인하세요.' },
        { name: 'Achievable', status: 'WARN', reason: '목표 수준의 근거가 부족합니다.', suggestion: '전년 실적이나 기준선을 함께 적어보세요.' },
        { name: 'Relevant', status: 'PASS', reason: '조직 KPI와 연결성이 보입니다.', suggestion: '상위 목표 설명을 한 줄 추가하면 더 좋습니다.' },
        { name: 'Time-bound', status: 'FAIL', reason: '연간 또는 월간 기준 시점이 분명하지 않습니다.', suggestion: '평가 주기와 월간 추적 시점을 함께 적어주세요.' },
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiWeight') {
    const items = Array.isArray(payload.items) ? payload.items : []
    return {
      currentTotal: Number(payload.currentTotal ?? 100),
      recommendedTotal: 100,
      summary: '현재 KPI 묶음 기준으로 핵심 성과에 더 무게를 두고 보조 KPI는 가볍게 조정하는 편이 적절합니다.',
      recommendations: items.slice(0, 5).map((item, index) => {
        const row = typeof item === 'object' && item ? (item as Record<string, unknown>) : {}
        const currentWeight = Number(row.weight ?? 20)
        return {
          title: String(row.title ?? `KPI ${index + 1}`),
          currentWeight,
          recommendedWeight: Math.max(10, Math.min(40, currentWeight)),
          reason: '조직 KPI 연결도와 실행 빈도를 함께 고려해 가중치를 조정했습니다.',
        }
      }),
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiAlignment') {
    return {
      recommendedOrgKpiId: String(payload.recommendedOrgKpiId ?? ''),
      recommendedOrgKpiTitle: String(payload.orgKpiName ?? '추천 조직 KPI'),
      rationale:
        summary || '해당 개인 KPI는 상위 조직 KPI의 실행 성과를 직접적으로 뒷받침하는 성격이라 연결성이 높습니다.',
      alternatives: ['같은 카테고리의 조직 KPI와 중복 연결되지 않는지 확인해보세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiDuplicate') {
    return {
      summary: '현재 KPI 목록 안에서 표현이 겹치거나 측정 기준이 유사한 항목을 정리했습니다.',
      duplicates: Array.isArray(payload.candidates)
        ? (payload.candidates as unknown[])
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
            .slice(0, 4)
            .map((item) => ({
              id: String(item.id ?? ''),
              title: String(item.title ?? '유사 KPI'),
              overlapLevel: 'MEDIUM',
              similarityReason: '측정 대상이나 결과 지표가 유사합니다.',
            }))
        : [],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiReviewerRisk') {
    return {
      summary: '리더 검토 관점에서 목표 수준과 측정 방법이 더 분명해야 하는 KPI가 보입니다.',
      risks: ['조직 KPI 연결이 없는 항목이 있습니다.', '달성 기준이 모호한 정성 KPI가 포함되어 있습니다.'],
      reviewPoints: ['가중치 합이 100인지 먼저 확인하세요.', '월간 실적 입력 기준으로 추적 가능한지 검토하세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiMonthlyComment') {
    return {
      comment:
        summary || '최근 월간 실적 흐름을 보면 실행은 진행 중이지만 목표 대비 편차가 있어 다음 체크인에서 우선순위와 지원 필요사항을 함께 점검하는 것이 좋습니다.',
      nextActions: ['다음 월간 실적 입력 전까지 핵심 장애요인을 정리하세요.', '체크인에서 지원 요청이 필요한 부분을 명확히 공유하세요.'],
      managerNotes: ['실적 수치뿐 아니라 실행 과정의 병목 요인을 함께 확인하세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyPerformanceSummary') {
    return {
      summary:
        summary || '이번 달 KPI 실행 상태를 보면 전반적으로 계획된 과제는 진행되고 있으나, 일부 지표는 목표 대비 편차가 보여 추가 점검이 필요합니다.',
      highlights: ['주요 KPI의 실행 흐름이 유지되고 있습니다.', '월간 기록과 메모가 평가 근거로 누적되고 있습니다.'],
      risks: ['달성률이 낮은 KPI는 원인과 대응 계획을 더 구체화할 필요가 있습니다.'],
      nextActions: ['다음 월간 입력 전까지 위험 KPI의 장애요인과 대응 계획을 보완해 주세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyRiskExplanation') {
    return {
      riskLevel: 'MEDIUM',
      causeSummary: summary || '이번 달 실적 저하는 실행 지연과 외부 의존 이슈가 함께 영향을 준 것으로 보입니다.',
      responsePoints: ['지연 원인을 구체적으로 기록하고, 다음 달 보완 액션을 명시해 주세요.', '체크인에서 지원이 필요한 리소스를 함께 논의해 보세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyManagerReview') {
    return {
      comment:
        summary || '이번 달에는 주요 과제 추진이 이어졌지만 일부 KPI는 목표 대비 편차가 있어 원인 분석과 다음 달 보완 계획을 조금 더 구체화하면 좋겠습니다.',
      strengths: ['핵심 과제를 꾸준히 추진했습니다.', '기록과 근거를 비교적 충실하게 남겼습니다.'],
      requests: ['위험 KPI의 장애요인과 대응 계획을 더 구체적으로 정리해 주세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyEvidenceSummary') {
    return {
      summary: summary || '현재 입력된 메모와 첨부를 기준으로 이번 달의 실행 근거를 요약했습니다.',
      evidenceHighlights: ['주요 활동 내역과 일부 증빙이 함께 기록되어 있습니다.'],
      missingEvidence: ['위험 KPI에 대한 보완 증빙이 더 있으면 평가 근거가 더 명확해집니다.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyRetrospective') {
    return {
      strengths: ['중요한 과제를 꾸준히 추진했습니다.'],
      risks: ['낮은 달성률 KPI의 원인 설명이 더 필요합니다.'],
      nextMonthPriorities: ['우선순위 KPI에 집중하고, 증빙과 메모를 더 구체화하세요.'],
      summary: summary || '이번 달은 실행 흐름은 유지됐지만 일부 KPI는 보완이 필요한 상태입니다.',
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyCheckinAgenda') {
    return {
      agenda: ['위험 KPI 원인과 지원 필요사항 점검', '다음 달 우선순위와 일정 정렬'],
      leaderPrep: ['지연된 KPI의 맥락과 지원 가능 리소스를 정리해 주세요.'],
      memberPrep: ['이번 달 성과와 어려움, 다음 달 계획을 2~3문장으로 정리해 주세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyEvaluationEvidence') {
    return {
      summary: summary || '이번 달 실적은 향후 평가 코멘트에서 실행력과 리스크 대응을 설명하는 근거로 활용할 수 있습니다.',
      evaluationPoints: ['주요 KPI 진행 상황', '위험 대응 방식', '근거 자료와 실행 메모의 일관성'],
      watchouts: ['정량 실적이 부족한 KPI는 정성 근거를 보완해야 합니다.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'Feedback360ReviewerRecommendation') {
    const reviewerGroups = Array.isArray(payload.reviewerGroups) ? payload.reviewerGroups : []
    const recommendations = reviewerGroups.flatMap((group) => {
      const record = typeof group === 'object' && group ? (group as Record<string, unknown>) : {}
      const reviewers = Array.isArray(record.reviewers) ? record.reviewers : []
      const limit = record.key === 'peer' || record.key === 'subordinate' ? 2 : 1

      return reviewers
        .filter((reviewer): reviewer is Record<string, unknown> => Boolean(reviewer && typeof reviewer === 'object'))
        .slice(0, limit)
        .map((reviewer) => ({
          employeeId: String(reviewer.employeeId ?? ''),
          name: String(reviewer.name ?? '리뷰어 후보'),
          relationship: String(reviewer.relationship ?? record.key ?? 'PEER'),
        }))
    })

    return {
      recommendations,
      rationale:
        summary || '익명 기준과 reviewer fatigue를 함께 고려해 상사 1명, 동료 2명, 부하 또는 협업 리뷰어 1~2명을 우선 추천했습니다.',
      watchouts: [
        '소수 조직은 동일 조합이 반복되면 익명성이 약해질 수 있습니다.',
        '최근 실제 협업이 없었던 리뷰어는 우선순위를 낮추는 편이 좋습니다.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'Feedback360ThemeSummary') {
    return {
      anonymousSummary:
        summary || '익명 기준 안에서 반복적으로 언급된 강점과 개선 포인트를 중심으로 다면평가 내용을 요약했습니다.',
      strengths: ['협업 과정에서 조율과 커뮤니케이션 안정성이 높다는 피드백이 반복됩니다.'],
      blindSpots: ['우선순위 전환 시 기대 정렬과 진행 공유를 더 구조적으로 하면 좋다는 의견이 있습니다.'],
      textHighlights: Array.isArray(payload.textHighlights)
        ? (payload.textHighlights as unknown[])
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .slice(0, 3)
        : ['익명 기준을 충족하면 대표 코멘트 하이라이트가 더 풍부해집니다.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'Feedback360CarelessReview') {
    return {
      summary: summary || '일부 응답에서 동일 점수 반복과 짧은 서술형 응답이 보여 품질 검토가 필요합니다.',
      riskFlags: [
        {
          label: '동일 점수 반복',
          severity: 'MEDIUM',
          reason: '여러 문항에 동일 점수가 반복되면 관찰 기반 응답인지 확인이 필요합니다.',
        },
        {
          label: '짧은 서술형 응답',
          severity: 'LOW',
          reason: '서술형 텍스트가 지나치게 짧으면 actionable insight가 부족할 수 있습니다.',
        },
      ],
      recommendedActions: [
        'quality flag가 붙은 응답은 HR 운영 화면에서 우선 검토하세요.',
        '필요 시 reviewer reminder 또는 재요청 여부를 운영 메모로 남기세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'Feedback360DevelopmentPlan') {
    return {
      focusArea: String(payload.focusArea ?? '협업과 피드백 전달 방식 강화'),
      actions: [
        '다음 체크인에서 blind spot 하나를 구체 행동 사례와 함께 리뷰합니다.',
        '다음 한 달 동안 개선 포인트와 연결된 행동 실험을 1개 실행합니다.',
      ],
      managerSupport: [
        '리더는 체크인에서 기대 수준과 실제 관찰 차이를 구체 예시 중심으로 피드백합니다.',
        '월간 실적 코멘트에 360 후속 액션 진행 여부를 짧게 남깁니다.',
      ],
      nextCheckinTopics: [
        '협업 맥락에서 가장 자주 나온 강점의 재현 방법',
        'blind spot을 줄이기 위한 다음 행동 실험',
      ],
    }
  }

  if (requestType === AIRequestType.GROWTH_PLAN && sourceType === 'Feedback360GrowthCopilot') {
    return {
      summary:
        summary ||
        '최근 리뷰, 목표, 1:1 기록을 종합하면 강점은 유지되고 있지만 코칭의 명확성, 실행 점검, 기대치 정렬을 더 구조적으로 관리할 필요가 있습니다.',
      growthAreas: [
        '우선순위와 기대치를 더 선명하게 전달합니다.',
        '1:1에서 행동 단위의 피드백과 후속 질문을 더 자주 남깁니다.',
        '목표와 성장 과제를 연결해 분기 단위로 진행 상황을 점검합니다.',
      ],
      recommendedCompetencies: ['코칭', '기대치 설정', '피드백 품질'],
      oneOnOneQuestions: [
        '최근 가장 막히는 업무 상황에서 내가 더 구체적으로 도와줄 수 있는 부분은 무엇인가요?',
        '이번 분기 목표 중 우선순위가 가장 불명확한 항목은 무엇인가요?',
        '다음 한 달 안에 행동으로 확인할 수 있는 성장 신호는 무엇인가요?',
      ],
      coachingDraft:
        '최근 성과와 피드백을 보면 강점은 분명합니다. 다음 단계에서는 기대치를 더 명확히 정리하고, 1:1에서 실행 결과를 짧은 주기로 확인하면 성장 속도를 높일 수 있습니다.',
      promotionReadinessHint:
        '현재 역할 확장은 검토 가능하지만, 기대치 정렬과 코칭 일관성이 더 쌓이면 다음 레벨 준비도가 더 명확해질 수 있습니다.',
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'CalibrationRiskSummary') {
    return {
      summary: summary || '현재 캘리브레이션에서는 분포 편차와 조정 사유 누락 여부를 먼저 확인하는 것이 중요합니다.',
      priorityRisks: ['저인원 조직의 분포 왜곡', '조정 사유 누락', '원점수와 조정등급 괴리'],
      recommendedActions: [
        '분포 편차가 큰 조직부터 후보와 조정 사유를 다시 검토하세요.',
        '예외 조직은 별도 정책 메모를 남겨 감사 가능성을 확보하세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'CompensationDecisionExplanation') {
    return {
      summary: summary || '평가 결과, 등급 규칙, 시나리오 예산 범위를 기준으로 보상 결정 배경을 설명하는 초안입니다.',
      drivers: ['최종 평가 등급', '시뮬레이션 규칙', '예산 한도 및 예외 승인 여부'],
      employeeFacingNote:
        '이번 보상 결정은 평가 결과와 적용된 보상 규칙을 기준으로 산정되었으며, 공개 전 최종 승인과 예산 검토를 거쳤습니다.',
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'NotificationOpsSummary') {
    return {
      summary:
        summary ||
        '최근 알림 운영은 전반적으로 안정적이지만 일부 실패 템플릿과 dead letter 정리가 필요합니다.',
      warnings: [
        '실패 건이 반복되는 템플릿과 채널 조합을 우선 점검해 주세요.',
        'dead letter 누적 건은 재처리 전 payload 누락 여부를 먼저 확인하는 것이 좋습니다.',
      ],
      recommendedActions: [
        '실패 건이 많은 템플릿의 변수와 활성 상태를 검토하세요.',
        '최근 24시간 재시도 이력과 dead letter 재처리 결과를 함께 모니터링하세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'NotificationDeadLetterPatterns') {
    return {
      summary: summary || 'dead letter는 변수 누락, 수신 대상 정보 누락, 일시적 채널 실패 유형으로 묶여 보입니다.',
      patterns: [
        { reason: '변수 누락 또는 치환 실패', count: 2, impact: '같은 템플릿의 반복 실패로 이어질 수 있습니다.' },
        { reason: '수신 대상 정보 누락', count: 1, impact: '특정 사용자 알림이 누락될 수 있습니다.' },
      ],
      recommendedActions: [
        '템플릿 변수 목록과 payload 키를 먼저 비교하세요.',
        '수신 대상 정보가 비어 있는 경우 데이터 원본과 동기화 상태를 점검하세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'NotificationTemplateValidation') {
    return {
      summary: summary || '템플릿 변수는 대체로 일관되지만 누락될 수 있는 placeholder와 표현 중복을 점검하는 것이 좋습니다.',
      missingVariables: ['dueDate'],
      confusingVariables: ['employeeName / recipientName 중 하나로 통일 권장'],
      suggestions: [
        '제목과 본문에서 동일 의미 변수명은 하나로 통일하세요.',
        '링크 변수는 누락 시 대체 문구가 보이도록 처리하는 것이 안전합니다.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'NotificationOpsReport') {
    return {
      headline: summary || '최근 알림 운영은 전반적으로 안정적이나 일부 실패 템플릿에 대한 운영 점검이 필요합니다.',
      highlights: ['주요 알림은 정상적으로 처리되고 있습니다.', '큐 적체는 제한적이며 재처리 흐름은 유지되고 있습니다.'],
      risks: ['dead letter 누적이 커지면 사용자 경험 저하로 이어질 수 있습니다.', '비활성 템플릿이 필요한 이벤트를 놓치지 않는지 확인해야 합니다.'],
      nextActions: ['실패 템플릿을 우선 점검하고 test send를 실행하세요.', 'dead letter 재처리 후 24시간 동안 재발 여부를 모니터링하세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'AdminOpsStatusSummary') {
    return {
      summary:
        summary || '최근 운영 상태는 전반적으로 확인 가능하지만, 실패 작업과 업무 리스크를 함께 점검하는 운영 대응이 필요합니다.',
      highlights: [
        '운영 핵심 지표와 업무 리스크를 한 화면에서 확인할 수 있습니다.',
        '기술 상태와 HR 운영 리스크를 함께 보며 우선순위를 정할 수 있습니다.',
      ],
      watchouts: [
        'dead letter, 로그인 준비 불가 계정, 예산 초과 시나리오는 즉시 확인이 필요합니다.',
        'AI fallback 증가나 평가 주기 지연은 후속 운영 이슈로 이어질 수 있습니다.',
      ],
      recommendedActions: [
        '실패 작업과 dead letter를 먼저 검토하고 복구 여부를 확인하세요.',
        '평가 주기, 월간 실적, 보상 시뮬레이션의 지연 항목을 우선순위로 점검하세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'AdminOpsIncidentPatterns') {
    return {
      summary: summary || '최근 이벤트는 알림 실패, 로그인 준비 불가 계정, 운영 지연 이슈 중심으로 묶여 보입니다.',
      patterns: [
        {
          component: 'notification',
          pattern: 'dead letter와 재시도 지연이 반복되는 패턴',
          severity: 'HIGH',
          action: '알림 운영 화면에서 실패 원인과 재처리 결과를 우선 확인하세요.',
        },
        {
          component: 'ops-summary',
          pattern: '업무 리스크 항목이 복수 화면으로 분산되어 후속 조치가 지연되는 패턴',
          severity: 'MEDIUM',
          action: '업무 리스크 탭 기준으로 우선순위를 정해 관련 화면으로 이동하세요.',
        },
      ],
      topRisks: ['dead letter 누적', '로그인 준비 불가 계정', '예산 초과 시나리오'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'AdminOpsDailyReport') {
    return {
      headline: summary || '오늘 운영 현황은 전반적으로 안정적이나, 일부 운영 리스크는 즉시 확인이 필요합니다.',
      executiveSummary:
        '실패 작업, dead letter, 로그인 준비 불가 계정, 예산 초과 시나리오를 함께 확인해 기술 운영과 업무 운영 리스크를 동시에 관리해야 합니다.',
      issues: ['알림 실패 누적 여부 확인', '평가/보상 운영 지연 여부 확인', '로그인 준비 불가 계정 점검'],
      nextActions: ['알림 운영에서 재처리 상태 확인', 'Google 계정 등록 화면에서 미등록 계정 점검', '보상 시뮬레이션의 예산 초과 시나리오 검토'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'AdminOpsRiskPrioritization') {
    return {
      summary: summary || '현재 운영 리스크는 사용자 영향과 복구 난이도를 기준으로 우선순위를 정하는 것이 좋습니다.',
      priorities: [
        {
          label: 'Dead Letter 및 실패 작업',
          priority: 'P1',
          reason: '사용자 알림 누락으로 직접적인 운영 장애로 이어질 수 있습니다.',
          action: '알림 운영에서 실패 원인 확인 후 재처리하세요.',
        },
        {
          label: '로그인 준비 불가 계정',
          priority: 'P2',
          reason: '신규/기존 사용자의 접근 문제로 운영 문의가 증가할 수 있습니다.',
          action: 'Google 계정 등록 화면에서 미등록 또는 도메인 불일치 계정을 정리하세요.',
        },
        {
          label: '예산 초과 보상 시나리오',
          priority: 'P3',
          reason: '즉시 장애는 아니지만 승인 지연과 공개 지연으로 이어질 수 있습니다.',
          action: '보상 시뮬레이션 관리 화면에서 초과 사유와 예외 승인 여부를 확인하세요.',
        },
      ],
    }
  }

  switch (requestType) {
    case AIRequestType.KPI_ASSIST:
      return {
        kpiName: goal || (orgKpi ? `${orgKpi} 실행력 강화` : '핵심 KPI 초안'),
        definition:
          summary ||
          '조직 목표와 연결된 핵심 결과를 분기 또는 연간 기준으로 측정할 수 있게 정의한 KPI 초안입니다.',
        formula: payload.kpiType === 'QUALITATIVE' ? '정성 평가 체크리스트 충족률' : '실적 / 목표 x 100',
        targetValueSuggestion: String(payload.targetValue ?? '월별 목표 100 기준'),
        unitSuggestion: String(payload.unit ?? (payload.kpiType === 'QUALITATIVE' ? '점수' : '%')),
        weightSuggestion: Number(payload.weight ?? 20),
        difficultySuggestion: String(payload.difficulty ?? 'MEDIUM'),
        smartChecks: [
          '목표 대상과 산출물이 문장에 포함되어 있습니다.',
          '측정 방식 또는 점검 기준이 포함되어 있습니다.',
          '조직 KPI와 연결되는 맥락이 드러납니다.',
        ],
        managerReviewPoints: [
          '가중치가 전체 KPI 합계와 충돌하지 않는지 확인하세요.',
          '측정 주기와 데이터 출처를 한 번 더 검토하세요.',
        ],
      }
    case AIRequestType.EVAL_COMMENT_DRAFT:
      return {
        summary: summary || '현재 입력된 근거를 기준으로 균형 잡힌 평가 코멘트 초안을 준비했습니다.',
        strengths: toStringArray(payload.strengths, ['주요 KPI 또는 과제에서 안정적인 실행력을 보였습니다.']),
        improvements: toStringArray(payload.improvements, ['우선순위 조정과 후속 커뮤니케이션을 더 명확히 하면 효과가 커질 수 있습니다.']),
        draftComment:
          summary ||
          `${grade ? `${grade} 수준의 ` : ''}성과를 뒷받침하는 근거를 중심으로 강점과 개선 포인트를 함께 정리한 초안입니다. 구체 사례와 수치를 추가한 뒤 제출해 주세요.`,
      }
    case AIRequestType.BIAS_ANALYSIS:
      return {
        riskLevel: 'MEDIUM',
        findings: [
          {
            severity: 'MEDIUM',
            issue: '주관적 표현이나 성향 중심 표현이 포함될 수 있습니다.',
            recommendation: '행동과 결과, 관찰 가능한 사실 중심으로 문장을 다시 써 주세요.',
          },
          {
            severity: 'LOW',
            issue: '최근 사례에 근거가 치우쳤는지 확인이 필요합니다.',
            recommendation: '기간 전체의 대표 사례를 함께 언급해 주세요.',
          },
        ],
        balancedRewrite:
          summary ||
          '관찰된 행동, KPI 결과, 협업 기여를 기준으로 표현을 정리하고, 개인 성향 대신 구체적인 사례 중심으로 보완한 문장입니다.',
      }
    case AIRequestType.GROWTH_PLAN:
      return {
        focusArea: goal || '우선 개선 영역',
        recommendedActions: [
          '다음 분기 핵심 과제 1개를 선정해 주간 점검 지표를 운영합니다.',
          '리뷰 또는 피드백 루프를 월 1회 이상 정례화합니다.',
        ],
        supportNeeded: [
          '매니저와 월별 체크인에서 진행 상황을 확인합니다.',
          '필요한 교육이나 멘토링 자원을 사전에 확보합니다.',
        ],
        milestone: grade ? `${grade} 결과 피드백 반영 후 90일 내 중간 점검` : '90일 내 중간 점검',
      }
    default:
      return {
        summary: 'Fallback response',
      }
  }
}

export function estimateAiCostUsd(params: { inputTokens: number; outputTokens: number }) {
  const inputRate = Number(process.env.OPENAI_INPUT_COST_PER_1M ?? 0)
  const outputRate = Number(process.env.OPENAI_OUTPUT_COST_PER_1M ?? 0)
  const total =
    (Math.max(params.inputTokens, 0) / 1_000_000) * inputRate +
    (Math.max(params.outputTokens, 0) / 1_000_000) * outputRate

  return Math.round(total * 1_000_000) / 1_000_000
}

export function isAiFeatureEnabled() {
  return isFeatureEnabled('aiAssist')
}

function extractOutputText(response: JsonRecord) {
  const outputText = response.output_text
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText
  }

  const output = Array.isArray(response.output) ? response.output : []
  const chunks: string[] = []

  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as JsonRecord).content)
      ? ((item as JsonRecord).content as unknown[])
      : []

    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const record = part as JsonRecord
      if (typeof record.text === 'string' && record.text.trim()) {
        chunks.push(record.text)
      }
    }
  }

  return chunks.join('\n').trim()
}

async function callOpenAIResponsesApi(
  requestType: AIRequestType,
  payload: JsonRecord,
  sourceType?: string
): Promise<OpenAIResponseData> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new AppError(503, 'AI_API_KEY_MISSING', 'OPENAI_API_KEY is not configured.')
  }

  const config = getAiConfig(requestType, sourceType)
  const model = process.env.OPENAI_RESPONSES_MODEL || 'gpt-5-mini'
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: config.systemPrompt }],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: config.schemaName,
          schema: config.schema,
          strict: true,
        },
      },
    }),
  })

  const json = (await response.json()) as JsonRecord
  if (!response.ok) {
    const errorMessage =
      typeof (json.error as JsonRecord | undefined)?.message === 'string'
        ? String((json.error as JsonRecord).message)
        : 'OpenAI Responses API request failed.'
    throw new AppError(response.status, 'AI_REQUEST_FAILED', errorMessage)
  }

  const text = extractOutputText(json)
  if (!text) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'OpenAI response did not include structured output.')
  }

  let parsed: JsonRecord
  try {
    parsed = JSON.parse(text) as JsonRecord
  } catch {
    throw new AppError(502, 'AI_INVALID_JSON', 'OpenAI response JSON could not be parsed.')
  }

  const usage = (json.usage ?? {}) as JsonRecord
  const inputTokens = Number(usage.input_tokens ?? 0)
  const outputTokens = Number(usage.output_tokens ?? 0)

  return {
    result: parsed,
    model: typeof json.model === 'string' ? json.model : model,
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateAiCostUsd({ inputTokens, outputTokens }),
  }
}

export async function generateAiAssist(
  params: AiAssistExecutionParams,
  db: PrismaClient = prisma
) {
  const requestPayload = sanitizeAiPayload(params.payload)
  const fallbackResult = buildFallbackResult(params.requestType, requestPayload, params.sourceType)
  const baseData = {
    requesterId: params.requesterId,
    requestType: params.requestType,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    requestPayload: toJsonValue(requestPayload),
    piiMinimized: true,
  }

  if (!isAiFeatureEnabled()) {
    await recordOperationalEvent({
      level: 'WARN',
      component: 'ai-assist',
      eventType: 'AI_DISABLED_FALLBACK',
      message: 'AI feature is disabled. Serving deterministic fallback.',
      metadata: {
        requestType: params.requestType,
        requesterId: params.requesterId,
      },
    }, db)

    const log = await db.aiRequestLog.create({
      data: {
        ...baseData,
        requestStatus: AIRequestStatus.DISABLED,
        responsePayload: toJsonValue(fallbackResult),
        errorCode: 'AI_DISABLED',
        errorMessage: 'AI feature is disabled. Returned deterministic fallback.',
      },
    })

    return {
      requestLogId: log.id,
      source: 'disabled' as const,
      result: fallbackResult,
      fallbackReason: 'AI 기능이 비활성화되어 기본 제안을 제공합니다.',
    }
  }

  try {
    const aiResult = await callOpenAIResponsesApi(params.requestType, requestPayload, params.sourceType)
    const log = await db.aiRequestLog.create({
      data: {
        ...baseData,
        requestStatus: AIRequestStatus.SUCCESS,
        provider: 'OPENAI',
        model: aiResult.model,
        responsePayload: toJsonValue(aiResult.result),
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        estimatedCostUsd: aiResult.estimatedCostUsd,
      },
    })

    return {
      requestLogId: log.id,
      source: 'ai' as const,
      result: aiResult.result,
      fallbackReason: null,
    }
  } catch (error) {
    const errorCode = error instanceof AppError ? error.code : 'AI_REQUEST_FAILED'
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI request error.'

    await recordOperationalEvent({
      level: 'WARN',
      component: 'ai-assist',
      eventType: 'AI_FALLBACK_TRIGGERED',
      message: errorMessage,
      metadata: {
        errorCode,
        requestType: params.requestType,
        requesterId: params.requesterId,
      },
    }, db)

    const log = await db.aiRequestLog.create({
      data: {
        ...baseData,
        requestStatus: AIRequestStatus.FALLBACK,
        provider: 'OPENAI',
        model: process.env.OPENAI_RESPONSES_MODEL || 'gpt-5-mini',
        responsePayload: toJsonValue(fallbackResult),
        errorCode,
        errorMessage,
      },
    })

    return {
      requestLogId: log.id,
      source: 'fallback' as const,
      result: fallbackResult,
      fallbackReason: errorMessage,
    }
  }
}

export async function decideAiRequest(
  params: DecisionParams,
  db: PrismaClient = prisma
) {
  const log = await db.aiRequestLog.findUnique({
    where: { id: params.id },
  })

  if (!log) {
    throw new AppError(404, 'AI_REQUEST_NOT_FOUND', 'AI request log not found.')
  }

  if (log.approvalStatus !== AIApprovalStatus.PENDING) {
    throw new AppError(409, 'AI_REQUEST_ALREADY_DECIDED', 'This AI request has already been decided.')
  }

  if (params.action === 'approve') {
    return db.aiRequestLog.update({
      where: { id: params.id },
      data: {
        approvalStatus: AIApprovalStatus.APPROVED,
        approvedPayload: toJsonValue(
          params.approvedPayload ??
            ((log.responsePayload as JsonRecord | null | undefined) ?? buildFallbackResult(log.requestType, {}))
        ),
        approvedById: params.actorId,
        approvedAt: new Date(),
      },
    })
  }

  return db.aiRequestLog.update({
    where: { id: params.id },
    data: {
      approvalStatus: AIApprovalStatus.REJECTED,
      approvedById: params.actorId,
      rejectedAt: new Date(),
      rejectionReason: params.rejectionReason ?? 'User rejected the suggestion.',
    },
  })
}
