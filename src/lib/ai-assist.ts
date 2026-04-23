import {
  AIApprovalStatus,
  AIRequestStatus,
  AIRequestType,
  Prisma,
  type PrismaClient,
} from '@prisma/client'
import { EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT } from './ai/executive-performance-briefing-prompt'
import { buildPersonalKpiDraftFallbackResult } from './personal-kpi-ai-draft'
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
  KPI_ASSIST: 'KPI ?묒꽦 蹂댁“',
  EVAL_COMMENT_DRAFT: '?됯? 肄붾찘??珥덉븞',
  BIAS_ANALYSIS: '?명뼢 遺꾩꽍',
  GROWTH_PLAN: '?깆옣 怨꾪쉷 異붿쿇',
  EVAL_PERFORMANCE_BRIEFING: '성과평가 브리핑',
  MID_REVIEW_ASSIST: '중간 점검 AI 코치',
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
    'targetValueT',
    'targetValueE',
    'targetValueS',
    'unit',
    'weightSuggestion',
    'difficultySuggestion',
    'reviewPoints',
    'metricSource',
    'linkedParentKpiId',
    'linkedParentKpiTitle',
    'linkageReason',
    'whyThisIsHighQuality',
    'controllabilityNote',
    'riskNote',
    'recommendations',
  ],
  properties: {
    title: { type: 'string' },
    category: { type: ['string', 'null'] },
    definition: { type: 'string' },
    formula: { type: 'string' },
    targetValueSuggestion: { type: 'string' },
    targetValueT: { type: 'number' },
    targetValueE: { type: 'number' },
    targetValueS: { type: 'number' },
    unit: { type: 'string' },
    weightSuggestion: { type: 'number' },
    difficultySuggestion: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    metricSource: { type: 'string' },
    linkedParentKpiId: { type: ['string', 'null'] },
    linkedParentKpiTitle: { type: 'string' },
    linkageReason: { type: 'string' },
    whyThisIsHighQuality: { type: 'string' },
    controllabilityNote: { type: 'string' },
    riskNote: { type: 'string' },
    reviewPoints: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendations: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'recommendedTitle',
          'recommendedDefinition',
          'category',
          'formula',
          'metricSource',
          'targetT',
          'targetE',
          'targetS',
          'unit',
          'weightSuggestion',
          'difficultyLevel',
          'linkedParentKpiId',
          'linkedParentKpiTitle',
          'linkageReason',
          'whyThisIsHighQuality',
          'controllabilityNote',
          'riskNote',
          'alignmentScore',
          'qualityScore',
          'recommendedPriority',
        ],
        properties: {
          recommendedTitle: { type: 'string' },
          recommendedDefinition: { type: 'string' },
          category: { type: ['string', 'null'] },
          formula: { type: 'string' },
          metricSource: { type: 'string' },
          targetT: { type: 'number' },
          targetE: { type: 'number' },
          targetS: { type: 'number' },
          unit: { type: 'string' },
          weightSuggestion: { type: 'number' },
          difficultyLevel: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          linkedParentKpiId: { type: ['string', 'null'] },
          linkedParentKpiTitle: { type: 'string' },
          linkageReason: { type: 'string' },
          whyThisIsHighQuality: { type: 'string' },
          controllabilityNote: { type: 'string' },
          riskNote: { type: 'string' },
          alignmentScore: { type: 'number' },
          qualityScore: { type: 'number' },
          recommendedPriority: { type: 'number' },
        },
      },
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
  required: [
    'recommendedParentId',
    'recommendedParentTitle',
    'riskLevel',
    'rationale',
    'suggestedLinks',
  ],
  properties: {
    recommendedParentId: { type: ['string', 'null'] },
    recommendedParentTitle: { type: ['string', 'null'] },
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
    'summary',
    'title',
    'category',
    'definition',
    'formula',
    'targetValueSuggestion',
    'unit',
    'weightSuggestion',
    'difficultySuggestion',
    'evaluationCriteria',
    'reviewPoints',
    'alignmentSummary',
    'primaryLinkedOrgKpiId',
    'primaryLinkedOrgKpiTitle',
    'secondaryLinkedOrgKpiId',
    'secondaryLinkedOrgKpiTitle',
    'divisionKpiId',
    'divisionKpiTitle',
    'teamKpiId',
    'teamKpiTitle',
    'draftAngleLabel',
    'whyThisOption',
    'recommendations',
  ],
  properties: {
    summary: { type: 'string' },
    title: { type: 'string' },
    category: { type: ['string', 'null'] },
    definition: { type: 'string' },
    formula: { type: 'string' },
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
    alignmentSummary: { type: 'string' },
    primaryLinkedOrgKpiId: { type: ['string', 'null'] },
    primaryLinkedOrgKpiTitle: { type: 'string' },
    secondaryLinkedOrgKpiId: { type: ['string', 'null'] },
    secondaryLinkedOrgKpiTitle: { type: ['string', 'null'] },
    divisionKpiId: { type: ['string', 'null'] },
    divisionKpiTitle: { type: ['string', 'null'] },
    teamKpiId: { type: ['string', 'null'] },
    teamKpiTitle: { type: ['string', 'null'] },
    draftAngleLabel: { type: 'string' },
    whyThisOption: { type: 'string' },
    recommendations: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'recommendedTitle',
          'recommendedDefinition',
          'category',
          'formula',
          'metricSource',
          'targetT',
          'targetE',
          'targetS',
          'targetValueSuggestion',
          'unit',
          'weightSuggestion',
          'difficultyLevel',
          'linkedParentKpiId',
          'linkedParentKpiTitle',
          'linkageReason',
          'whyThisIsHighQuality',
          'controllabilityNote',
          'riskNote',
          'alignmentScore',
          'qualityScore',
          'recommendedPriority',
          'draftAngleLabel',
          'whyThisOption',
          'alignmentSummary',
          'primaryLinkedOrgKpiId',
          'primaryLinkedOrgKpiTitle',
          'secondaryLinkedOrgKpiId',
          'secondaryLinkedOrgKpiTitle',
          'divisionKpiId',
          'divisionKpiTitle',
          'teamKpiId',
          'teamKpiTitle',
        ],
        properties: {
          recommendedTitle: { type: 'string' },
          recommendedDefinition: { type: 'string' },
          category: { type: ['string', 'null'] },
          formula: { type: 'string' },
          metricSource: { type: 'string' },
          targetT: { type: 'number' },
          targetE: { type: 'number' },
          targetS: { type: 'number' },
          targetValueSuggestion: { type: 'string' },
          unit: { type: 'string' },
          weightSuggestion: { type: 'number' },
          difficultyLevel: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          linkedParentKpiId: { type: ['string', 'null'] },
          linkedParentKpiTitle: { type: 'string' },
          linkageReason: { type: 'string' },
          whyThisIsHighQuality: { type: 'string' },
          controllabilityNote: { type: 'string' },
          riskNote: { type: 'string' },
          alignmentScore: { type: 'number' },
          qualityScore: { type: 'number' },
          recommendedPriority: { type: 'number' },
          draftAngleLabel: { type: 'string' },
          whyThisOption: { type: 'string' },
          alignmentSummary: { type: 'string' },
          primaryLinkedOrgKpiId: { type: ['string', 'null'] },
          primaryLinkedOrgKpiTitle: { type: 'string' },
          secondaryLinkedOrgKpiId: { type: ['string', 'null'] },
          secondaryLinkedOrgKpiTitle: { type: ['string', 'null'] },
          divisionKpiId: { type: ['string', 'null'] },
          divisionKpiTitle: { type: ['string', 'null'] },
          teamKpiId: { type: ['string', 'null'] },
          teamKpiTitle: { type: ['string', 'null'] },
        },
      },
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

const ORG_TEAM_KPI_ALIGNED_RECOMMENDATION_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'recommendationType',
    'recommendedTitle',
    'recommendedDefinition',
    'formula',
    'metricSource',
    'targetT',
    'targetE',
    'targetS',
    'unit',
    'weightSuggestion',
    'difficultyLevel',
    'linkedParentKpiId',
    'linkedParentKpiTitle',
    'linkageReason',
    'recommendationReason',
    'whyThisIsHighQuality',
    'controllabilityNote',
    'riskNote',
    'alignmentScore',
    'qualityScore',
    'difficultyScore',
    'recommendedPriority',
  ],
  properties: {
    recommendationType: { type: 'string', enum: ['ALIGNED_WITH_DIVISION_KPI'] },
    title: { type: 'string' },
    definition: { type: 'string' },
    recommendedTitle: { type: 'string' },
    recommendedDefinition: { type: 'string' },
    formula: { type: 'string' },
    metricSource: { type: 'string' },
    targetValueT: { type: 'number' },
    targetValueE: { type: 'number' },
    targetValueS: { type: 'number' },
    targetT: { type: 'number' },
    targetE: { type: 'number' },
    targetS: { type: 'number' },
    unit: { type: 'string' },
    weightSuggestion: { type: 'number' },
    difficultySuggestion: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    difficultyLevel: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    sourceOrgKpiId: { type: ['string', 'null'] },
    sourceOrgKpiTitle: { type: ['string', 'null'] },
    linkedParentKpiId: { type: ['string', 'null'] },
    linkedParentKpiTitle: { type: ['string', 'null'] },
    linkageExplanation: { type: 'string' },
    linkageReason: { type: 'string' },
    recommendationReason: { type: 'string' },
    whyThisIsHighQuality: { type: 'string' },
    controllabilityNote: { type: 'string' },
    riskComment: { type: 'string' },
    riskNote: { type: 'string' },
    alignmentScore: { type: 'number' },
    qualityScore: { type: 'number' },
    difficultyScore: { type: 'number' },
    recommendedPriority: { type: 'number' },
  },
} satisfies JsonRecord

const ORG_TEAM_KPI_INDEPENDENT_RECOMMENDATION_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'recommendationType',
    'recommendedTitle',
    'recommendedDefinition',
    'formula',
    'metricSource',
    'targetT',
    'targetE',
    'targetS',
    'unit',
    'weightSuggestion',
    'difficultyLevel',
    'basedOnJobDescription',
    'jobDescriptionEvidence',
    'trendRationale',
    'whyThisFitsTeamRole',
    'recommendationReason',
    'whyThisIsHighQuality',
    'controllabilityNote',
    'riskNote',
    'alignmentScore',
    'qualityScore',
    'difficultyScore',
    'recommendedPriority',
  ],
  properties: {
    recommendationType: { type: 'string', enum: ['TEAM_INDEPENDENT'] },
    title: { type: 'string' },
    definition: { type: 'string' },
    recommendedTitle: { type: 'string' },
    recommendedDefinition: { type: 'string' },
    formula: { type: 'string' },
    metricSource: { type: 'string' },
    targetValueT: { type: 'number' },
    targetValueE: { type: 'number' },
    targetValueS: { type: 'number' },
    targetT: { type: 'number' },
    targetE: { type: 'number' },
    targetS: { type: 'number' },
    unit: { type: 'string' },
    weightSuggestion: { type: 'number' },
    difficultySuggestion: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    difficultyLevel: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    basedOnJobDescription: { type: 'boolean' },
    jobDescriptionEvidence: { type: 'string' },
    trendRationale: { type: 'string' },
    whyThisFitsTeamRole: { type: 'string' },
    recommendationReason: { type: 'string' },
    whyThisIsHighQuality: { type: 'string' },
    controllabilityNote: { type: 'string' },
    riskComment: { type: 'string' },
    riskNote: { type: 'string' },
    alignmentScore: { type: 'number' },
    qualityScore: { type: 'number' },
    difficultyScore: { type: 'number' },
    recommendedPriority: { type: 'number' },
  },
} satisfies JsonRecord

const ORG_TEAM_KPI_RECOMMENDATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'alignedRecommendations', 'independentRecommendations'],
  properties: {
    summary: { type: 'string' },
    alignedRecommendations: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: ORG_TEAM_KPI_ALIGNED_RECOMMENDATION_ITEM_SCHEMA,
    },
    independentRecommendations: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: ORG_TEAM_KPI_INDEPENDENT_RECOMMENDATION_ITEM_SCHEMA,
    },
  },
} satisfies JsonRecord

const ORG_TEAM_KPI_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'reviewType',
    'overallVerdict',
    'overallSummary',
    'linkedParentCoverage',
    'independentKpiCoverage',
    'items',
  ],
  properties: {
    reviewType: { type: 'string', enum: ['FULL_SET', 'ALIGNED_ONLY', 'TEAM_INDEPENDENT_ONLY'] },
    overallVerdict: { type: 'string', enum: ['ADEQUATE', 'CAUTION', 'INSUFFICIENT'] },
    overallSummary: { type: 'string' },
    linkedParentCoverage: { type: 'string' },
    independentKpiCoverage: { type: 'string' },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'orgKpiId',
          'kpiTitle',
          'recommendationType',
          'verdict',
          'rationale',
          'linkageComment',
          'roleFitComment',
          'measurabilityComment',
          'controllabilityComment',
          'challengeComment',
          'externalRiskComment',
          'clarityComment',
          'duplicationComment',
          'strongPoint',
          'weakPoint',
          'improvementSuggestions',
          'recommendationText',
        ],
        properties: {
          orgKpiId: { type: 'string' },
          kpiTitle: { type: 'string' },
          recommendationType: {
            type: 'string',
            enum: ['ALIGNED_WITH_DIVISION_KPI', 'TEAM_INDEPENDENT'],
          },
          verdict: { type: 'string', enum: ['ADEQUATE', 'CAUTION', 'INSUFFICIENT'] },
          rationale: { type: 'string' },
          linkageComment: { type: 'string' },
          roleFitComment: { type: 'string' },
          measurabilityComment: { type: 'string' },
          controllabilityComment: { type: 'string' },
          challengeComment: { type: 'string' },
          externalRiskComment: { type: 'string' },
          clarityComment: { type: 'string' },
          duplicationComment: { type: 'string' },
          strongPoint: { type: 'string' },
          weakPoint: { type: 'string' },
          improvementSuggestions: { type: 'string' },
          recommendationText: { type: 'string' },
        },
      },
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

const MID_REVIEW_ASSIST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'performanceSummary',
    'goalValidityReview',
    'executionCoachingReview',
    'followUpQuestions',
    'commentDraft',
    'vagueCommentSignals',
    'nextActions',
    'lowConfidenceNotice',
  ],
  properties: {
    performanceSummary: { type: 'string' },
    goalValidityReview: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'summary'],
      properties: {
        status: { type: 'string', enum: ['KEEP', 'ADJUST', 'REVISE'] },
        summary: { type: 'string' },
      },
    },
    executionCoachingReview: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'summary'],
      properties: {
        status: { type: 'string', enum: ['ON_TRACK', 'NEEDS_SUPPORT', 'REDESIGN_REQUIRED'] },
        summary: { type: 'string' },
      },
    },
    followUpQuestions: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: { type: 'string' },
    },
    commentDraft: { type: 'string' },
    vagueCommentSignals: {
      type: 'array',
      items: { type: 'string' },
    },
    nextActions: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: { type: 'string' },
    },
    lowConfidenceNotice: { type: 'string' },
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
  EVAL_PERFORMANCE_BRIEFING: {
    schemaName: 'executive_performance_briefing',
    schema: EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT.schema as JsonRecord,
    systemPrompt:
      'You are an executive performance briefing assistant. Use only the provided evidence, never assign a final grade, and return strictly validated JSON.',
  },
  MID_REVIEW_ASSIST: {
    schemaName: 'mid_review_assist',
    schema: MID_REVIEW_ASSIST_SCHEMA,
    systemPrompt:
      'You are a mid-review coaching assistant. Reply in Korean. Use only the provided evidence. Distinguish between goal validity issues and execution coaching issues. Never make final HR or evaluation decisions. When evidence is weak, explicitly say so.',
  },
}

const SOURCE_SCOPED_AI_CONFIGS: Record<SourceScopedAiConfigKey, AiConfig> = {
  'KPI_ASSIST:OrgKpiDraft': {
    schemaName: 'org_kpi_draft',
    schema: ORG_KPI_DRAFT_SCHEMA,
    systemPrompt:
      'You are a team KPI design expert. Reply in Korean. Read linked parent division KPIs first, then the business plan, then the team context, and only then design team KPI draft recommendations. Return exactly 3 to 5 ranked draft options. The top recommendation must also be mirrored in the top-level fields for direct apply. Prefer strategic outcome KPIs or strong leading KPIs over vague activity KPIs. Exclude easy, ambiguous, unmeasurable, uncontrollable, or duplicate KPI ideas. Every recommendation must name the linked parent KPI, explain the linkage, explain why the KPI is high quality, mention metric source, controllability, operational risk, and provide T/E/S target values plus alignment and quality scores.',
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
      'You are a KPI cascade assistant. Reply in Korean. Suggest the most natural parent organization KPI or cascade linkage based on department context, strategy direction, and the candidate KPIs. Always return recommendedParentId and recommendedParentTitle. If no confident parent exists, return null for both fields and explain the reason in rationale.',
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
  'KPI_ASSIST:OrgTeamKpiRecommendation': {
    schemaName: 'org_team_kpi_recommendation',
    schema: ORG_TEAM_KPI_RECOMMENDATION_SCHEMA,
    systemPrompt:
      'You are a team KPI design expert. Reply in Korean. First read the linked parent division KPIs, then the division business plan, then the division and team job descriptions, and only then design the team KPI recommendations. Produce two separate groups. Group 1: exactly 3 to 5 ALIGNED_WITH_DIVISION_KPI recommendations that directly contribute to a linked parent KPI. Group 2: exactly 2 to 3 TEAM_INDEPENDENT recommendations that are required by the team role even when they are not directly linked to a parent KPI. Prefer strategic outcome KPIs or strong leading KPIs over vague activity lists. Exclude easy, ambiguous, unmeasurable, uncontrollable, duplicate, or copy-paste KPI ideas. Each aligned recommendation must explain the linked parent KPI and linkage reason. Each independent recommendation must cite job-description evidence, team-role fit, and trend rationale grounded only in stored internal context or generic operational practice. Every recommendation must provide KPI name, definition, formula, metric source, T/E/S target values, high-quality rationale, controllability note, risk note, and alignment/quality/difficulty scoring.',
  },
  'KPI_ASSIST:OrgTeamKpiReview': {
    schemaName: 'org_team_kpi_review',
    schema: ORG_TEAM_KPI_REVIEW_SCHEMA,
    systemPrompt:
      'You are an HR KPI reviewer. Reply in Korean. Review the target team KPI set against the linked parent division KPIs, the division business plan, and the division/team job descriptions. Grade each KPI as ADEQUATE, CAUTION, or INSUFFICIENT. For ALIGNED_WITH_DIVISION_KPI items, evaluate parent-KPI alignment more strictly. For TEAM_INDEPENDENT items, evaluate role fit and job-description fit more strictly. Return overall coverage for linked-parent KPIs and independent team-role coverage, plus item-level rationale, strengths, weak points, measurability, controllability, challenge, external risk, clarity, duplication risk, and concrete improvement suggestions.',
  },
  'KPI_ASSIST:PersonalKpiDraft': {
    schemaName: 'personal_kpi_draft',
    schema: PERSONAL_KPI_DRAFT_SCHEMA,
    systemPrompt:
      'You are a personal KPI cascade design assistant. Reply in Korean. Design 3 to 5 personal KPI draft options grounded only in the provided employee role context, linked team KPI, upper division KPI, business and job-description context, existing personal KPI history, and recent evidence. Treat division KPI as strategy direction, team KPI as team execution focus, and personal KPI as the employee-level contribution expression. Each option must use a clearly different execution angle such as 운영 실행형, 프로세스 개선형, 협업/정렬형, 지표 개선형, 리스크 관리형, 자동화/효율화형, 고객/품질형, but choose only angles that actually fit the provided context. Never output near-duplicate drafts, shallow rewrites of one org KPI title, or options that collide with existing personal KPIs. Every option must explain which org KPI it aligns to, why the option is distinct, and how the metric logic differs from the other options. Mirror the best option in the top-level fields for safe preview/apply.',
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
  'MID_REVIEW_ASSIST:evidence-summary': {
    schemaName: 'mid_review_evidence_summary',
    schema: MID_REVIEW_ASSIST_SCHEMA,
    systemPrompt:
      'You are a mid-review evidence assistant. Reply in Korean. Summarize current performance evidence, clarify what is supported versus missing, and do not infer unsupported conclusions.',
  },
  'MID_REVIEW_ASSIST:leader-coach': {
    schemaName: 'mid_review_leader_coach',
    schema: MID_REVIEW_ASSIST_SCHEMA,
    systemPrompt:
      'You are a leader enablement coach for mid-review meetings. Reply in Korean. Separate goal redesign from execution coaching, provide follow-up questions for a one-on-one, and suggest concrete next actions grounded only in the given evidence.',
  },
  'MID_REVIEW_ASSIST:comment-support': {
    schemaName: 'mid_review_comment_support',
    schema: MID_REVIEW_ASSIST_SCHEMA,
    systemPrompt:
      'You are a comment drafting assistant for mid-review conversations. Reply in Korean. Produce evidence-backed wording, flag vague or unsupported statements, and avoid final ratings or people decisions.',
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

const DEFAULT_AI_TEXT_LIMIT = 6_000
const AI_TEXT_LIMITS_BY_KEY: Record<string, number> = {
  bodyText: 16_000,
  summaryText: 10_000,
  definition: 8_000,
  formula: 8_000,
  rationale: 8_000,
  recommendationText: 8_000,
  linkageReason: 6_000,
  whyThisIsHighQuality: 6_000,
  controllabilityNote: 6_000,
  riskNote: 6_000,
  riskComment: 6_000,
  note: 6_000,
  review: 8_000,
  reviewPoints: 8_000,
}

function resolveAiTextLimit(key?: string) {
  if (!key) {
    return DEFAULT_AI_TEXT_LIMIT
  }

  if (AI_TEXT_LIMITS_BY_KEY[key]) {
    return AI_TEXT_LIMITS_BY_KEY[key]
  }

  const normalizedKey = key.toLowerCase()
  if (normalizedKey.includes('body')) return AI_TEXT_LIMITS_BY_KEY.bodyText
  if (normalizedKey.includes('summary')) return AI_TEXT_LIMITS_BY_KEY.summaryText
  if (normalizedKey.includes('definition')) return AI_TEXT_LIMITS_BY_KEY.definition
  if (normalizedKey.includes('formula')) return AI_TEXT_LIMITS_BY_KEY.formula
  if (normalizedKey.includes('rationale')) return AI_TEXT_LIMITS_BY_KEY.rationale
  if (normalizedKey.includes('recommend')) return AI_TEXT_LIMITS_BY_KEY.recommendationText
  if (normalizedKey.includes('review')) return AI_TEXT_LIMITS_BY_KEY.review
  if (normalizedKey.includes('note')) return AI_TEXT_LIMITS_BY_KEY.note

  return DEFAULT_AI_TEXT_LIMIT
}

function truncateAiContextText(value: string, key?: string) {
  const limit = resolveAiTextLimit(key)
  if (value.length <= limit) {
    return value
  }

  const marker = `\n...[truncated ${value.length - limit} chars]...\n`
  const available = Math.max(limit - marker.length, 32)
  const headLength = Math.ceil(available * 0.7)
  const tailLength = Math.max(available - headLength, 16)

  return `${value.slice(0, headLength)}${marker}${value.slice(-tailLength)}`
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (key && OMIT_KEY_PATTERN.test(key)) {
    return undefined
  }

  if (typeof value === 'string') {
    return truncateAiContextText(redactText(value), key)
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item, key))
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
    /*
    const teamDepartment =
      typeof payload.teamDepartment === 'object' && payload.teamDepartment
        ? (payload.teamDepartment as Record<string, unknown>)
        : {}
    const sourceOrgKpis = Array.isArray(payload.sourceOrgKpis) ? payload.sourceOrgKpis : []
    const linkedParentOrgKpis = Array.isArray(payload.linkedParentOrgKpis) ? payload.linkedParentOrgKpis : []
    const prioritizedParents = linkedParentOrgKpis.length ? linkedParentOrgKpis : sourceOrgKpis
    const deptName =
      String(teamDepartment.name ?? payload.departmentName ?? payload.teamName ?? '?').trim() || '?'
    const recommendations = Array.from({
      length: Math.min(5, Math.max(3, prioritizedParents.length || sourceOrgKpis.length || 3)),
    }).map((_, index) => {
      const source =
        typeof prioritizedParents[index] === 'object' && prioritizedParents[index]
          ? (prioritizedParents[index] as Record<string, unknown>)
          : {}
      const linkedParentKpiTitle = String(source.title ?? `?곸쐞 KPI ${index + 1}`)
      const targetT = Number(source.targetValueT ?? 92 + index * 3)
      const targetE = Number(source.targetValueE ?? 100 + index * 4)
      const targetS = Number(source.targetValueS ?? 108 + index * 5)

      return {
        recommendedTitle: `${deptName} ${linkedParentKpiTitle} ?ㅼ쟻 ?ъ꽦瑜?,
        recommendedDefinition: `${linkedParentKpiTitle} ?ъ꽦??吏곸젒 湲곗뿬?섎룄濡?${deptName}???듭젣 媛?ν븳 ?듭떖 寃곌낵吏?쒖? ?좏뻾吏?쒕? 寃고빀??? KPI 珥덉븞?낅땲??`,
        category: String(payload.category ?? payload.kpiCategory ?? '?꾨왂 ?ㅽ뻾'),
        formula:
          typeof source.formula === 'string' && source.formula.trim().length
            ? source.formula
            : '?ㅼ쟻 / 紐⑺몴 x 100',
        metricSource: `${deptName} ?댁쁺 ?ㅼ쟻 ?곗씠??諛??붽컙 KPI 吏묎퀎`,
        targetT,
        targetE,
        targetS,
        unit: String(payload.unit ?? '%'),
        weightSuggestion: Number(payload.weight ?? 20),
        difficultyLevel: String(payload.difficulty ?? 'MEDIUM'),
        linkedParentKpiId: typeof source.id === 'string' ? source.id : null,
        linkedParentKpiTitle,
        linkageReason: `${linkedParentKpiTitle}???깃낵瑜?? ?ㅽ뻾 ?섏??먯꽌 吏곸젒 ?뚯뼱?щ┫ ???덈뒗 KPI濡??ㅺ퀎?덉뒿?덈떎.`,
        whyThisIsHighQuality:
          '?곸쐞 KPI ?뺣젹?? 痢≪젙 媛?μ꽦, ? ?듭젣 媛?μ꽦, stretch 紐⑺몴 ?섏????숈떆??異⑹”?섎룄濡??ㅺ퀎?덉뒿?덈떎.',
        controllabilityNote: `${deptName}??吏곸젒 ?먯썝 諛곕텇怨??ㅽ뻾 由щ벉??議곗젙???깃낵瑜??듭젣?????덈뒗 吏?쒖엯?덈떎.`,
        riskNote: '?곗씠???섏쭛 湲곗?怨?痢≪젙 二쇨린瑜?紐낇솗??怨좎젙?섏? ?딆쑝硫?鍮꾧탳 媛?μ꽦???⑥뼱吏????덉뒿?덈떎.',
        alignmentScore: Math.max(84, 96 - index * 3),
        qualityScore: Math.max(82, 95 - index * 3),
        recommendedPriority: index + 1,
      }
    })
    const primary = recommendations[0]

    return {
      title: primary?.recommendedTitle ?? (goal || orgKpi || '議곗쭅 KPI 珥덉븞'),
      category: primary?.category ?? String(payload.category ?? payload.kpiCategory ?? '?꾨왂 ?ㅽ뻾'),
      definition:
        primary?.recommendedDefinition ??
        (summary ||
        '?곸쐞 KPI? ?ъ뾽怨꾪쉷??諛⑺뼢??吏곸젒 ?ㅽ뻾?쇰줈 ?곌껐?섎뒗 ? KPI 珥덉븞?낅땲??'),
      formula: primary?.formula ?? '?ㅼ쟻 / 紐⑺몴 x 100',
      targetValueSuggestion: String(primary?.targetE ?? payload.targetValue ?? '100'),
      targetValueT: primary?.targetT ?? 95,
      targetValueE: primary?.targetE ?? 100,
      targetValueS: primary?.targetS ?? 110,
      unit: primary?.unit ?? String(payload.unit ?? '%'),
      weightSuggestion: primary?.weightSuggestion ?? Number(payload.weight ?? 20),
      difficultySuggestion: primary?.difficultyLevel ?? String(payload.difficulty ?? 'MEDIUM'),
      metricSource: primary?.metricSource ?? `${deptName} ?댁쁺 ?ㅼ쟻 ?곗씠??,
      linkedParentKpiId: primary?.linkedParentKpiId ?? null,
      linkedParentKpiTitle: primary?.linkedParentKpiTitle ?? '?곌퀎 ?곸쐞 KPI',
      linkageReason:
        primary?.linkageReason ?? '?곸쐞 蹂몃? KPI???ㅼ쭏?곸쑝濡?湲곗뿬?섎뒗 ? KPI瑜??곗꽑 異붿쿇?덉뒿?덈떎.',
      whyThisIsHighQuality:
        primary?.whyThisIsHighQuality ??
        '?꾨왂 ?뺣젹?? 痢≪젙 媛?μ꽦, ?듭젣 媛?μ꽦, ?꾩쟾?깆쓣 ?④퍡 異⑹”?섎룄濡?援ъ꽦?덉뒿?덈떎.',
      controllabilityNote:
        primary?.controllabilityNote ?? '???吏곸젒 愿由?媛?ν븳 ?ㅽ뻾吏?쒖씤吏 ?뺤씤???꾩슂?⑸땲??',
      riskNote:
        primary?.riskNote ?? '?몄깮 蹂???곹뼢怨??곗씠??吏묎퀎 二쇨린瑜?紐낇솗???뺤쓽?댁빞 ?⑸땲??',
      reviewPoints: [
        '?곌퀎???곸쐞 KPI? ?곌껐 ?댁쑀媛 紐낇솗?쒖? ?뺤씤?섏꽭??',
        '?곗떇怨??곗씠??異쒖쿂媛 ?ㅼ젣 ?댁쁺 ?곗씠?곕줈 痢≪젙 媛?ν븳吏 寃?좏븯?몄슂.',
        'T/E/S 紐⑺몴媛믪씠 ?덈Т ?쎌? ?딆? stretch ?섏??몄? 寃?좏븯?몄슂.',
      ],
      recommendations,
    }
    return {
      title: goal || orgKpi || '議곗쭅 KPI 珥덉븞',
      category: String(payload.category ?? payload.kpiCategory ?? '?꾨왂 ?ㅽ뻾'),
      definition:
        (summary ||
        '議곗쭅 ?꾨왂???붽컙 ?ㅽ뻾怨?媛쒖씤 KPI濡??곌껐?????덈룄濡?痢≪젙 媛?ν븳 寃곌낵 以묒떖?쇰줈 ?뺤쓽??議곗쭅 KPI 珥덉븞?낅땲??'),
      formula: '?ㅼ쟻 / 紐⑺몴 x 100',
      targetValueSuggestion: String(payload.targetValue ?? '?곌컙 紐⑺몴 100 湲곗?'),
      unit: String(payload.unit ?? '%'),
      weightSuggestion: Number(payload.weight ?? 20),
      difficultySuggestion: String(payload.difficulty ?? 'MEDIUM'),
      reviewPoints: [
        '媛以묒튂 ?⑷낵 遺?????ㅻⅨ KPI???以묐났 ?щ?瑜??④퍡 ?뺤씤?섏꽭??',
        '?붽컙 ?ㅼ쟻 ?곗씠?곕줈 ?ㅼ젣 痢≪젙 媛?ν븳吏 寃?좏븯?몄슂.',
      ],
    }
  }

    */

    const teamDepartment =
      typeof payload.teamDepartment === 'object' && payload.teamDepartment
        ? (payload.teamDepartment as Record<string, unknown>)
        : {}
    const sourceOrgKpis = Array.isArray(payload.sourceOrgKpis) ? payload.sourceOrgKpis : []
    const linkedParentOrgKpis = Array.isArray(payload.linkedParentOrgKpis) ? payload.linkedParentOrgKpis : []
    const prioritizedParents = linkedParentOrgKpis.length ? linkedParentOrgKpis : sourceOrgKpis
    const deptName =
      String(teamDepartment.name ?? payload.departmentName ?? payload.teamName ?? '팀').trim() || '팀'
    const primarySource =
      typeof prioritizedParents[0] === 'object' && prioritizedParents[0]
        ? (prioritizedParents[0] as Record<string, unknown>)
        : null
    const linkedParentKpiTitle =
      primarySource && typeof primarySource.title === 'string' && primarySource.title.trim().length
        ? primarySource.title.trim()
        : null

    return {
      title: goal || orgKpi || `${deptName} KPI 초안`,
      category: String(payload.category ?? payload.kpiCategory ?? '전략 실행'),
      definition:
        (summary ||
        `${deptName} 팀이 상위 전략과 연결된 실행 성과를 측정할 수 있도록 기본 초안을 준비했습니다. AI 추천을 다시 실행하면 더 구체적인 제안을 확인할 수 있습니다.`),
      formula:
        primarySource && typeof primarySource.formula === 'string' && primarySource.formula.trim().length
          ? primarySource.formula.trim()
          : '실적 / 목표 x 100',
      targetValueSuggestion: String(payload.targetValue ?? '100'),
      targetValueT: 95,
      targetValueE: 100,
      targetValueS: 110,
      unit: String(payload.unit ?? '%'),
      weightSuggestion: Number(payload.weight ?? 20),
      difficultySuggestion: String(payload.difficulty ?? 'MEDIUM'),
      metricSource: `${deptName} 운영 실적 데이터`,
      linkedParentKpiId:
        primarySource && typeof primarySource.id === 'string' && primarySource.id.trim().length
          ? primarySource.id
          : null,
      linkedParentKpiTitle,
      linkageReason:
        linkedParentKpiTitle
          ? `${linkedParentKpiTitle}와 연결되는 팀 KPI 초안을 다시 확인해 주세요.`
          : '연계 가능한 상위 KPI를 확인한 뒤 다시 추천을 실행해 주세요.',
      whyThisIsHighQuality:
        '현재는 기본 초안만 표시하고 있습니다. AI 응답이 복구되면 더 구체적인 정렬 근거와 품질 설명을 제공합니다.',
      controllabilityNote:
        '팀이 직접 관리 가능한 실행 지표인지 다시 확인해 주세요.',
      riskNote:
        '기본 초안이므로 실제 적용 전 연결성, 측정 기준, 외생 변수 영향을 다시 확인해 주세요.',
      reviewPoints: [
        '연계된 상위 KPI와의 연결 이유가 명확한지 확인해 주세요.',
        '산식과 데이터 출처가 실제 운영 데이터로 측정 가능한지 검토해 주세요.',
        'T/E/S 목표값이 너무 낮지 않고 stretch 수준인지 확인해 주세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiWording') {
    return {
      improvedTitle: goal || orgKpi || '측정 가능한 조직 KPI 문구',
      improvedDefinition:
        (summary ||
        '조직 목표와 측정 기준이 함께 드러나도록 문장을 간결하고 명확하게 다듬은 제안입니다.'),
      rationale: [
        '측정 대상과 기대 결과가 한 문장 안에서 드러나도록 정리했습니다.',
        '실제 실행 지표와 연결되도록 표현을 더 구체화했습니다.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiSmart') {
    return {
      overall: 'WARNING',
      summary: '현재 KPI는 방향성은 있으나 측정 기준과 기한 표현을 조금 더 선명하게 다듬을 필요가 있습니다.',
      criteria: [
        {
          name: 'Specific',
          status: 'WARN',
          reason: '대상과 결과 표현이 다소 넓습니다.',
          suggestion: '측정 대상 고객군이나 운영 지표를 더 명확히 지정해 주세요.',
        },
        {
          name: 'Measurable',
          status: 'PASS',
          reason: '목표값과 측정 방식이 포함되어 있습니다.',
          suggestion: '월간 추적 기준까지 함께 적으면 더 좋습니다.',
        },
        {
          name: 'Achievable',
          status: 'WARN',
          reason: '목표 수준의 근거가 부족합니다.',
          suggestion: '전년 실적이나 현재 기준치를 함께 적어 주세요.',
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
          reason: '평가 주기와 월간 관리 주기가 혼합돼 있습니다.',
          suggestion: '연간 목표와 월간 추적 기준을 구분해 명시해 주세요.',
        },
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiDuplicate') {
    return {
      summary: '유사 KPI 후보를 기준으로 중복 가능성을 정리했습니다.',
      duplicates: Array.isArray(payload.candidates)
        ? (payload.candidates as unknown[])
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
            .slice(0, 3)
            .map((item) => ({
              id: String(item.id ?? ''),
              title: String(item.title ?? '유사 KPI'),
              overlapLevel: 'MEDIUM',
              similarityReason: '측정 대상이나 전략 키워드가 유사합니다.',
            }))
        : [],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiAlignment') {
    return {
      recommendedParentId:
        typeof payload.recommendedParentId === 'string' && payload.recommendedParentId.trim().length
          ? payload.recommendedParentId
          : null,
      recommendedParentTitle:
        typeof payload.recommendedParentTitle === 'string' && payload.recommendedParentTitle.trim().length
          ? payload.recommendedParentTitle
          : null,
      riskLevel: 'MEDIUM',
      rationale:
        summary || '조직 트리와 KPI 카테고리 기준으로 가장 자연스러운 상위 연계 후보를 정리했습니다.',
      suggestedLinks: [
        '상위 전략 KPI와의 관계를 정의 문장에 함께 적어 주세요.',
        '개인 KPI로 이어질 표현은 월간 실적 기준으로 다시 풀어 써 주세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiOperationalRisk') {
    return {
      riskLevel: 'MEDIUM',
      executiveSummary:
        summary || '현재 KPI 구조는 운영 가능하지만 연결 누락과 실적 추적 공백이 일부 존재합니다.',
      risks: [
        '개인 KPI와 연결하기 어려운 항목이 있습니다.',
        '최근 월간 실적이 없는 KPI가 있습니다.',
      ],
      recommendations: [
        '연결 누락 KPI를 우선 검토하고 개인 KPI 템플릿과 연결해 주세요.',
        '측정성이 약한 KPI는 SMART 관점으로 다시 다듬어 주세요.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgKpiMonthlyComment') {
    return {
      comment:
        summary || '최근 월간 실적 기준으로 실행은 진행 중이지만 연결 커버리지와 실적 완성도를 함께 점검할 필요가 있습니다.',
      highlights: ['주요 KPI의 월간 추세 흐름이 유지되고 있습니다.'],
      concerns: ['연결된 개인 KPI가 적은 항목은 실행 추적이 약해질 수 있습니다.'],
      nextActions: ['다음 월말까지 미연결 KPI와 최근 실적 누락 항목을 우선 확인해 주세요.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgTeamKpiRecommendation') {
    const sourceOrgKpis = Array.isArray(payload.sourceOrgKpis) ? payload.sourceOrgKpis : []
    const linkedParentOrgKpis = Array.isArray(payload.linkedParentOrgKpis) ? payload.linkedParentOrgKpis : []
    const prioritizedParents = linkedParentOrgKpis.length ? linkedParentOrgKpis : sourceOrgKpis
    const divisionJobDescription =
      typeof payload.divisionJobDescription === 'object' && payload.divisionJobDescription
        ? (payload.divisionJobDescription as Record<string, unknown>)
        : {}
    const teamJobDescription =
      typeof payload.teamJobDescription === 'object' && payload.teamJobDescription
        ? (payload.teamJobDescription as Record<string, unknown>)
        : {}
    const planningDepartment =
      typeof payload.planningDepartment === 'object' && payload.planningDepartment
        ? (payload.planningDepartment as Record<string, unknown>)
        : {}
    const teamDepartment =
      typeof payload.teamDepartment === 'object' && payload.teamDepartment
        ? (payload.teamDepartment as Record<string, unknown>)
        : {}
    const teamName = String(teamDepartment.name ?? '팀')
    const planningName = String(planningDepartment.name ?? '본부')

    const alignedRecommendations = Array.from({
      length: Math.min(5, Math.max(3, prioritizedParents.length || sourceOrgKpis.length || 3)),
    }).map((_, index) => {
      const source =
        typeof prioritizedParents[index] === 'object' && prioritizedParents[index]
          ? (prioritizedParents[index] as Record<string, unknown>)
          : {}
      const sourceTitle = String(source.title ?? `상위 KPI ${index + 1}`)
      const targetT = Number(source.targetValueT ?? 90 + index * 5)
      const targetE = Number(source.targetValueE ?? 100 + index * 5)
      const targetS = Number(source.targetValueS ?? 110 + index * 5)

      return {
        recommendationType: 'ALIGNED_WITH_DIVISION_KPI',
        title: `${teamName} ${sourceTitle} 실행지표`,
        recommendedTitle: `${teamName} ${sourceTitle} 실행지표`,
        recommendedDefinition: `${planningName} KPI와 직접 연결되는 ${teamName} 실행 KPI 초안입니다.`,
        definition:
          summary ||
          `${planningName} 사업계획과 상위 KPI를 ${teamName} 수준의 실행 성과와 선행지표로 연결하기 위한 추천안입니다.`,
        formula: typeof source.formula === 'string' && source.formula ? source.formula : 'Actual / Target x 100',
        metricSource: `${teamName} 운영 결과 데이터 / 정기 실적 집계`,
        targetValueT: targetT,
        targetValueE: targetE,
        targetValueS: targetS,
        targetT,
        targetE,
        targetS,
        unit: String(source.unit ?? '%'),
        weightSuggestion: Number(source.weight ?? 20),
        difficultySuggestion: String(source.difficulty ?? 'MEDIUM'),
        difficultyLevel: String(source.difficulty ?? 'MEDIUM'),
        sourceOrgKpiId: typeof source.id === 'string' ? source.id : null,
        sourceOrgKpiTitle: typeof source.title === 'string' ? source.title : null,
        linkedParentKpiId: typeof source.id === 'string' ? source.id : null,
        linkedParentKpiTitle: typeof source.title === 'string' ? source.title : null,
        linkageReason: `${planningName} KPI를 ${teamName} 실행 KPI로 직접 분해한 추천안입니다.`,
        linkageExplanation: `${planningName} KPI와 ${teamName} 역할을 직접 연결하는 실행 KPI 추천입니다.`,
        whyThisIsHighQuality:
          '상위 KPI 정렬도, 측정 가능성, 스트레치 목표, 팀 통제 가능성을 함께 반영했습니다.',
        controllabilityNote: `${teamName}이 실제로 운영 계획과 실행 자원 조정을 통해 관리 가능한 지표입니다.`,
        recommendationReason:
          '상위 KPI의 전략 의도를 팀 실행 수준에서 측정 가능하고 도전적인 지표로 구체화했습니다.',
        riskComment: '데이터 기준과 측정 주기를 먼저 합의하지 않으면 실행 리스크가 커질 수 있습니다.',
        riskNote: '데이터 기준과 측정 주기를 먼저 합의하지 않으면 실행 리스크가 커질 수 있습니다.',
        alignmentScore: Math.max(84, 96 - index * 4),
        qualityScore: Math.max(82, 95 - index * 4),
        difficultyScore: Math.max(74, 88 - index * 3),
        recommendedPriority: index + 1,
      }
    })

    const independentRecommendations = Array.from({ length: 2 + (teamName.length % 2) }).map((_, index) => {
      const divisionJobTitle = String(divisionJobDescription.title ?? `${planningName} 직무기술서`)
      const teamJobTitle = String(teamJobDescription.title ?? `${teamName} 직무기술서`)
      const targetT = 88 + index * 4
      const targetE = 95 + index * 4
      const targetS = 102 + index * 4

      return {
        recommendationType: 'TEAM_INDEPENDENT',
        title: `${teamName} 핵심 역할 성과지표 ${index + 1}`,
        recommendedTitle: `${teamName} 핵심 역할 성과지표 ${index + 1}`,
        recommendedDefinition: `${teamJobTitle}와 ${divisionJobTitle}에 적힌 역할 범위를 바탕으로 ${teamName}의 고유 책임을 측정하는 독립형 KPI 초안입니다.`,
        definition:
          summary ||
          `${teamName}의 고유 직무 책임, 서비스 수준, 내부 운영 품질을 측정하기 위한 독립형 KPI 추천안입니다.`,
        formula: `(${teamName} 핵심 산출 실적 / ${teamName} 계획 기준) x 100`,
        metricSource: `${teamName} 운영 시스템 / 내부 서비스 수준 보고서`,
        targetValueT: targetT,
        targetValueE: targetE,
        targetValueS: targetS,
        targetT,
        targetE,
        targetS,
        unit: '%',
        weightSuggestion: 15 + index * 3,
        difficultySuggestion: index === 0 ? 'HIGH' : 'MEDIUM',
        difficultyLevel: index === 0 ? 'HIGH' : 'MEDIUM',
        basedOnJobDescription: true,
        jobDescriptionEvidence: `${teamJobTitle}에 명시된 핵심 책임과 ${planningName} 직무 기대 수준을 근거로 도출했습니다.`,
        trendRationale: '저장된 직무기술서와 일반적인 운영 효율화 관점 기준으로 자동화, 서비스 품질, 리드타임 관리 필요성을 반영했습니다.',
        whyThisFitsTeamRole: `${teamName}이 직접 통제할 수 있는 핵심 역할 성과와 운영 품질을 측정하도록 설계했습니다.`,
        recommendationReason: '상위 KPI에 직접 매달리지 않더라도 팀 고유 역할을 측정해야 지속 가능한 성과관리가 가능합니다.',
        whyThisIsHighQuality: '직무기술서 근거, 측정 가능성, 통제 가능성, 도전성을 함께 반영한 독립형 KPI입니다.',
        controllabilityNote: `${teamName}이 운영 절차, 우선순위, 리소스 배분을 통해 직접 개선할 수 있는 지표입니다.`,
        riskComment: '업무 범위 정의와 데이터 기준이 모호하면 부서 간 책임이 중첩될 수 있습니다.',
        riskNote: '업무 범위 정의와 데이터 기준이 모호하면 부서 간 책임이 중첩될 수 있습니다.',
        alignmentScore: Math.max(78, 90 - index * 4),
        qualityScore: Math.max(80, 92 - index * 3),
        difficultyScore: Math.max(72, 86 - index * 3),
        recommendedPriority: index + 1,
      }
    })

    return {
      summary:
        summary ||
        `${teamName}이 ${planningName} 사업계획, 상위 KPI, 직무기술서를 함께 반영해 연계형과 독립형 팀 KPI 초안을 생성했습니다.`,
      alignedRecommendations,
      independentRecommendations,
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'OrgTeamKpiReview') {
    const items = Array.isArray(payload.teamKpis) ? payload.teamKpis : []
    return {
      reviewType: 'FULL_SET',
      overallVerdict: 'CAUTION',
      overallSummary:
        summary || '?곸쐞 ?꾨왂怨쇱쓽 ?곌껐?깆? 蹂댁씠吏留??쇰? KPI??痢≪젙 洹쇨굅? ?듭젣 媛?μ꽦????遺꾨챸???ㅻ벉???꾩슂媛 ?덉뒿?덈떎.',
      linkedParentCoverage: '연계형 KPI는 상위 본부 KPI와의 연결은 보이지만, 일부 항목은 기여 경로를 더 구체화할 필요가 있습니다.',
      independentKpiCoverage: '독립형 KPI는 팀 역할을 반영하지만 직무기술서 표현과 측정 기준을 더 정교하게 맞춰야 합니다.',
      items: items.slice(0, 20).map((item, index) => {
        const row = typeof item === 'object' && item ? (item as Record<string, unknown>) : {}
        const recommendationType =
          row.recommendationType === 'TEAM_INDEPENDENT'
            ? 'TEAM_INDEPENDENT'
            : 'ALIGNED_WITH_DIVISION_KPI'
        return {
          orgKpiId: String(row.id ?? `kpi-${index + 1}`),
          kpiTitle: String(row.title ?? `? KPI ${index + 1}`),
          recommendationType,
          verdict: index === 0 ? 'ADEQUATE' : index % 2 === 0 ? 'CAUTION' : 'INSUFFICIENT',
          rationale: '?곸쐞 KPI???諛⑺뼢? 留욎?留?痢≪젙 ?뺤쓽? ?ㅽ뻾 踰붿쐞瑜?議곌툑 ??援ъ껜?뷀븷 ?꾩슂媛 ?덉뒿?덈떎.',
          linkageComment: '?ъ뾽怨꾪쉷?쒖쓽 ?듭떖 怨쇱젣? ?곌껐 ?ㅻ챸????以꾨줈 紐낇솗???곸쑝硫??뺣젹?꾧? ????蹂댁엯?덈떎.',
          roleFitComment:
            recommendationType === 'TEAM_INDEPENDENT'
              ? '팀 직무기술서에 적힌 핵심 책임과는 대체로 맞지만 역할 경계를 조금 더 선명하게 써 주는 편이 좋습니다.'
              : '상위 본부 KPI를 실행하는 팀 역할과 연결은 보이지만, 실제 팀 책임 범위와 통제 범위를 더 또렷하게 쓰는 편이 좋습니다.',
          measurabilityComment: '?곗떇怨??곗씠??異쒖쿂瑜??④퍡 ?먮㈃ ?붽컙 異붿쟻 媛?μ꽦???믪븘吏묐땲??',
          controllabilityComment: '???吏곸젒 ?듭젣 媛?ν븳 寃곌낵?몄? ??踰???寃?좏빐 蹂댁꽭??',
          challengeComment: '?꾨뀈 ?鍮?媛쒖꽑 ??씠??湲곗??좎쓣 媛숈씠 ?먮㈃ ?꾩쟾???먮떒???ъ썙吏묐땲??',
          externalRiskComment: '?몄깮 蹂???곹뼢????寃쎌슦 蹂댁“吏?쒕? ?④퍡 ?먮뒗 ?몄씠 ?덉쟾?⑸땲??',
          clarityComment: '紐⑦샇???쒗쁽 ?????? 寃곌낵, ?쒖젏???④퍡 ?곸쑝硫???紐낇솗?⑸땲??',
          duplicationComment: '기존 팀 KPI와 표현이 겹치지 않도록 측정 대상과 산식 범위를 조금 더 좁혀 주는 편이 좋습니다.',
          strongPoint:
            recommendationType === 'TEAM_INDEPENDENT'
              ? '팀 고유 역할을 KPI로 끌어낸 점이 강점입니다.'
              : '상위 본부 KPI와 연결되는 실행 KPI 구조가 강점입니다.',
          weakPoint:
            recommendationType === 'TEAM_INDEPENDENT'
              ? '직무기술서 근거 문장을 더 직접적으로 드러낼 필요가 있습니다.'
              : '상위 KPI 기여 경로와 데이터 기준을 더 직접적으로 써 주는 편이 좋습니다.',
          improvementSuggestions:
            recommendationType === 'TEAM_INDEPENDENT'
              ? '직무기술서 핵심 책임 문구와 데이터 출처를 정의/산식에 명시하세요.'
              : 'linked parent KPI와 기여 경로, 데이터 기준을 KPI 정의와 산식에 더 직접적으로 연결하세요.',
          recommendationText: '?곸쐞 KPI ?곌껐 臾몄옣怨?痢≪젙 湲곗???蹂댁셿????理쒖쥌 ?뺤젙?섏꽭??',
        }
      }),
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiDraft') {
    return buildPersonalKpiDraftFallbackResult(payload)
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiWording') {
    return {
      improvedTitle: goal || '痢≪젙 媛?ν븳 媛쒖씤 KPI 臾몄옣',
      improvedDefinition:
        summary || '吏곷Т 湲곕??깃낵? 痢≪젙 諛⑸쾿????紐낇솗?섍쾶 蹂댁씠?꾨줉 媛쒖씤 KPI 臾몄옣???뺣━???쒖븞?낅땲??',
      rationale: [
        '紐⑺몴 ??곴낵 湲곕? 寃곌낵瑜???遺꾨챸?섍쾶 ?쒕윭?대룄濡??뺣━?덉뒿?덈떎.',
        '?붽컙 ?ㅼ쟻怨??됯? 肄붾찘?몃줈 ?댁뼱吏????덇쾶 痢≪젙 ?쒗쁽??蹂댁셿?덉뒿?덈떎.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiSmart') {
    return {
      overall: 'WARNING',
      summary: '媛쒖씤 KPI??諛⑺뼢? ?곸젅?섏?留?痢≪젙 湲곗?怨?湲고븳 ?쒗쁽????援ъ껜?뷀븯硫?寃?좎? ?⑹쓽媛 ?ъ썙吏묐땲??',
      criteria: [
        { name: 'Specific', status: 'WARN', reason: '?듭떖 寃곌낵媛 ?ㅼ냼 ?볤쾶 ?쒗쁽?섏뼱 ?덉뒿?덈떎.', suggestion: '????낅Т??寃곌낵臾쇱쓣 ??紐낇솗???곸뼱蹂댁꽭??' },
        { name: 'Measurable', status: 'PASS', reason: '痢≪젙 湲곗????ы븿?섏뼱 ?덉뒿?덈떎.', suggestion: '?붽컙 ?ㅼ쟻?쇰줈 媛숈? 湲곗???異붿쟻?????덈뒗吏 ?뺤씤?섏꽭??' },
        { name: 'Achievable', status: 'WARN', reason: '紐⑺몴 ?섏???洹쇨굅媛 遺議깊빀?덈떎.', suggestion: '?꾨뀈 ?ㅼ쟻?대굹 湲곗??좎쓣 ?④퍡 ?곸뼱蹂댁꽭??' },
        { name: 'Relevant', status: 'PASS', reason: '議곗쭅 KPI? ?곌껐?깆씠 蹂댁엯?덈떎.', suggestion: '?곸쐞 紐⑺몴 ?ㅻ챸????以?異붽??섎㈃ ??醫뗭뒿?덈떎.' },
        { name: 'Time-bound', status: 'FAIL', reason: '?곌컙 ?먮뒗 ?붽컙 湲곗? ?쒖젏??遺꾨챸?섏? ?딆뒿?덈떎.', suggestion: '?됯? 二쇨린? ?붽컙 異붿쟻 ?쒖젏???④퍡 ?곸뼱二쇱꽭??' },
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiWeight') {
    const items = Array.isArray(payload.items) ? payload.items : []
    return {
      currentTotal: Number(payload.currentTotal ?? 100),
      recommendedTotal: 100,
      summary: '?꾩옱 KPI 臾띠쓬 湲곗??쇰줈 ?듭떖 ?깃낵????臾닿쾶瑜??먭퀬 蹂댁“ KPI??媛蹂띻쾶 議곗젙?섎뒗 ?몄씠 ?곸젅?⑸땲??',
      recommendations: items.slice(0, 5).map((item, index) => {
        const row = typeof item === 'object' && item ? (item as Record<string, unknown>) : {}
        const currentWeight = Number(row.weight ?? 20)
        return {
          title: String(row.title ?? `KPI ${index + 1}`),
          currentWeight,
          recommendedWeight: Math.max(10, Math.min(40, currentWeight)),
          reason: '議곗쭅 KPI ?곌껐?꾩? ?ㅽ뻾 鍮덈룄瑜??④퍡 怨좊젮??媛以묒튂瑜?議곗젙?덉뒿?덈떎.',
        }
      }),
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiAlignment') {
    return {
      recommendedOrgKpiId: String(payload.recommendedOrgKpiId ?? ''),
      recommendedOrgKpiTitle: String(payload.orgKpiName ?? '異붿쿇 議곗쭅 KPI'),
      rationale:
        summary || '?대떦 媛쒖씤 KPI???곸쐞 議곗쭅 KPI???ㅽ뻾 ?깃낵瑜?吏곸젒?곸쑝濡??룸컺移⑦븯???깃꺽?대씪 ?곌껐?깆씠 ?믪뒿?덈떎.',
      alternatives: ['媛숈? 移댄뀒怨좊━??議곗쭅 KPI? 以묐났 ?곌껐?섏? ?딅뒗吏 ?뺤씤?대낫?몄슂.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiDuplicate') {
    return {
      summary: '?꾩옱 KPI 紐⑸줉 ?덉뿉???쒗쁽??寃뱀튂嫄곕굹 痢≪젙 湲곗????좎궗????ぉ???뺣━?덉뒿?덈떎.',
      duplicates: Array.isArray(payload.candidates)
        ? (payload.candidates as unknown[])
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
            .slice(0, 4)
            .map((item) => ({
              id: String(item.id ?? ''),
              title: String(item.title ?? '?좎궗 KPI'),
              overlapLevel: 'MEDIUM',
              similarityReason: '痢≪젙 ??곸씠??寃곌낵 吏?쒓? ?좎궗?⑸땲??',
            }))
        : [],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiReviewerRisk') {
    return {
      summary: '由щ뜑 寃??愿?먯뿉??紐⑺몴 ?섏?怨?痢≪젙 諛⑸쾿????遺꾨챸?댁빞 ?섎뒗 KPI媛 蹂댁엯?덈떎.',
      risks: ['議곗쭅 KPI ?곌껐???녿뒗 ??ぉ???덉뒿?덈떎.', '?ъ꽦 湲곗???紐⑦샇???뺤꽦 KPI媛 ?ы븿?섏뼱 ?덉뒿?덈떎.'],
      reviewPoints: ['媛以묒튂 ?⑹씠 100?몄? 癒쇱? ?뺤씤?섏꽭??', '?붽컙 ?ㅼ쟻 ?낅젰 湲곗??쇰줈 異붿쟻 媛?ν븳吏 寃?좏븯?몄슂.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'PersonalKpiMonthlyComment') {
    return {
      comment:
        summary || '理쒓렐 ?붽컙 ?ㅼ쟻 ?먮쫫??蹂대㈃ ?ㅽ뻾? 吏꾪뻾 以묒씠吏留?紐⑺몴 ?鍮??몄감媛 ?덉뼱 ?ㅼ쓬 泥댄겕?몄뿉???곗꽑?쒖쐞? 吏???꾩슂?ы빆???④퍡 ?먭??섎뒗 寃껋씠 醫뗭뒿?덈떎.',
      nextActions: ['?ㅼ쓬 ?붽컙 ?ㅼ쟻 ?낅젰 ?꾧퉴吏 ?듭떖 ?μ븷?붿씤???뺣━?섏꽭??', '泥댄겕?몄뿉??吏???붿껌???꾩슂??遺遺꾩쓣 紐낇솗??怨듭쑀?섏꽭??'],
      managerNotes: ['?ㅼ쟻 ?섏튂肉??꾨땲???ㅽ뻾 怨쇱젙??蹂묐ぉ ?붿씤???④퍡 ?뺤씤?섏꽭??'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyPerformanceSummary') {
    return {
      summary:
        summary || '?대쾲 ??KPI ?ㅽ뻾 ?곹깭瑜?蹂대㈃ ?꾨컲?곸쑝濡?怨꾪쉷??怨쇱젣??吏꾪뻾?섍퀬 ?덉쑝?? ?쇰? 吏?쒕뒗 紐⑺몴 ?鍮??몄감媛 蹂댁뿬 異붽? ?먭????꾩슂?⑸땲??',
      highlights: ['二쇱슂 KPI???ㅽ뻾 ?먮쫫???좎??섍퀬 ?덉뒿?덈떎.', '?붽컙 湲곕줉怨?硫붾え媛 ?됯? 洹쇨굅濡??꾩쟻?섍퀬 ?덉뒿?덈떎.'],
      risks: ['?ъ꽦瑜좎씠 ??? KPI???먯씤怨????怨꾪쉷????援ъ껜?뷀븷 ?꾩슂媛 ?덉뒿?덈떎.'],
      nextActions: ['?ㅼ쓬 ?붽컙 ?낅젰 ?꾧퉴吏 ?꾪뿕 KPI???μ븷?붿씤怨????怨꾪쉷??蹂댁셿??二쇱꽭??'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyRiskExplanation') {
    return {
      riskLevel: 'MEDIUM',
      causeSummary: summary || '?대쾲 ???ㅼ쟻 ??섎뒗 ?ㅽ뻾 吏?곌낵 ?몃? ?섏〈 ?댁뒋媛 ?④퍡 ?곹뼢??以 寃껋쑝濡?蹂댁엯?덈떎.',
      responsePoints: ['吏???먯씤??援ъ껜?곸쑝濡?湲곕줉?섍퀬, ?ㅼ쓬 ??蹂댁셿 ?≪뀡??紐낆떆??二쇱꽭??', '泥댄겕?몄뿉??吏?먯씠 ?꾩슂??由ъ냼?ㅻ? ?④퍡 ?쇱쓽??蹂댁꽭??'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyManagerReview') {
    return {
      comment:
        summary || '?대쾲 ?ъ뿉??二쇱슂 怨쇱젣 異붿쭊???댁뼱議뚯?留??쇰? KPI??紐⑺몴 ?鍮??몄감媛 ?덉뼱 ?먯씤 遺꾩꽍怨??ㅼ쓬 ??蹂댁셿 怨꾪쉷??議곌툑 ??援ъ껜?뷀븯硫?醫뗪쿋?듬땲??',
      strengths: ['?듭떖 怨쇱젣瑜?袁몄???異붿쭊?덉뒿?덈떎.', '湲곕줉怨?洹쇨굅瑜?鍮꾧탳??異⑹떎?섍쾶 ?④꼈?듬땲??'],
      requests: ['?꾪뿕 KPI???μ븷?붿씤怨????怨꾪쉷????援ъ껜?곸쑝濡??뺣━??二쇱꽭??'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyEvidenceSummary') {
    return {
      summary: summary || '?꾩옱 ?낅젰??硫붾え? 泥⑤?瑜?湲곗??쇰줈 ?대쾲 ?ъ쓽 ?ㅽ뻾 洹쇨굅瑜??붿빟?덉뒿?덈떎.',
      evidenceHighlights: ['二쇱슂 ?쒕룞 ?댁뿭怨??쇰? 利앸튃???④퍡 湲곕줉?섏뼱 ?덉뒿?덈떎.'],
      missingEvidence: ['?꾪뿕 KPI?????蹂댁셿 利앸튃?????덉쑝硫??됯? 洹쇨굅媛 ??紐낇솗?댁쭛?덈떎.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyRetrospective') {
    return {
      strengths: ['以묒슂??怨쇱젣瑜?袁몄???異붿쭊?덉뒿?덈떎.'],
      risks: ['??? ?ъ꽦瑜?KPI???먯씤 ?ㅻ챸?????꾩슂?⑸땲??'],
      nextMonthPriorities: ['?곗꽑?쒖쐞 KPI??吏묒쨷?섍퀬, 利앸튃怨?硫붾え瑜???援ъ껜?뷀븯?몄슂.'],
      summary: summary || '?대쾲 ?ъ? ?ㅽ뻾 ?먮쫫? ?좎??먯?留??쇰? KPI??蹂댁셿???꾩슂???곹깭?낅땲??',
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyCheckinAgenda') {
    return {
      agenda: ['?꾪뿕 KPI ?먯씤怨?吏???꾩슂?ы빆 ?먭?', '?ㅼ쓬 ???곗꽑?쒖쐞? ?쇱젙 ?뺣젹'],
      leaderPrep: ['吏?곕맂 KPI??留λ씫怨?吏??媛??由ъ냼?ㅻ? ?뺣━??二쇱꽭??'],
      memberPrep: ['?대쾲 ???깃낵? ?대젮?, ?ㅼ쓬 ??怨꾪쉷??2~3臾몄옣?쇰줈 ?뺣━??二쇱꽭??'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'MonthlyEvaluationEvidence') {
    return {
      summary: summary || '?대쾲 ???ㅼ쟻? ?ν썑 ?됯? 肄붾찘?몄뿉???ㅽ뻾?κ낵 由ъ뒪????묒쓣 ?ㅻ챸?섎뒗 洹쇨굅濡??쒖슜?????덉뒿?덈떎.',
      evaluationPoints: ['주요 KPI 진행 상황', '위험 대응 방식', '근거 자료와 실행 메모'],
      watchouts: ['?뺣웾 ?ㅼ쟻??遺議깊븳 KPI???뺤꽦 洹쇨굅瑜?蹂댁셿?댁빞 ?⑸땲??'],
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
          name: String(reviewer.name ?? '由щ럭???꾨낫'),
          relationship: String(reviewer.relationship ?? record.key ?? 'PEER'),
        }))
    })

    return {
      recommendations,
      rationale:
        summary || '?듬챸 湲곗?怨?reviewer fatigue瑜??④퍡 怨좊젮???곸궗 1紐? ?숇즺 2紐? 遺???먮뒗 ?묒뾽 由щ럭??1~2紐낆쓣 ?곗꽑 異붿쿇?덉뒿?덈떎.',
      watchouts: [
        '?뚯닔 議곗쭅? ?숈씪 議고빀??諛섎났?섎㈃ ?듬챸?깆씠 ?쏀빐吏????덉뒿?덈떎.',
        '理쒓렐 ?ㅼ젣 ?묒뾽???놁뿀??由щ럭?대뒗 ?곗꽑?쒖쐞瑜???텛???몄씠 醫뗭뒿?덈떎.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'Feedback360ThemeSummary') {
    return {
      anonymousSummary:
        summary || '?듬챸 湲곗? ?덉뿉??諛섎났?곸쑝濡??멸툒??媛뺤젏怨?媛쒖꽑 ?ъ씤?몃? 以묒떖?쇰줈 ?ㅻ㈃?됯? ?댁슜???붿빟?덉뒿?덈떎.',
      strengths: ['?묒뾽 怨쇱젙?먯꽌 議곗쑉怨?而ㅻ??덉??댁뀡 ?덉젙?깆씠 ?믩떎???쇰뱶諛깆씠 諛섎났?⑸땲??'],
      blindSpots: ['?곗꽑?쒖쐞 ?꾪솚 ??湲곕? ?뺣젹怨?吏꾪뻾 怨듭쑀瑜???援ъ“?곸쑝濡??섎㈃ 醫뗫떎???섍껄???덉뒿?덈떎.'],
      textHighlights: Array.isArray(payload.textHighlights)
        ? (payload.textHighlights as unknown[])
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .slice(0, 3)
        : ['?듬챸 湲곗???異⑹”?섎㈃ ???肄붾찘???섏씠?쇱씠?멸? ???띾??댁쭛?덈떎.'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'Feedback360CarelessReview') {
    return {
      summary: summary || '?쇰? ?묐떟?먯꽌 ?숈씪 ?먯닔 諛섎났怨?吏㏃? ?쒖닠???묐떟??蹂댁뿬 ?덉쭏 寃?좉? ?꾩슂?⑸땲??',
      riskFlags: [
        {
          label: '?숈씪 ?먯닔 諛섎났',
          severity: 'MEDIUM',
          reason: '?щ윭 臾명빆???숈씪 ?먯닔媛 諛섎났?섎㈃ 愿李?湲곕컲 ?묐떟?몄? ?뺤씤???꾩슂?⑸땲??',
        },
        {
          label: '吏㏃? ?쒖닠???묐떟',
          severity: 'LOW',
          reason: '?쒖닠???띿뒪?멸? 吏?섏튂寃?吏㏃쑝硫?actionable insight媛 遺議깊븷 ???덉뒿?덈떎.',
        },
      ],
      recommendedActions: [
        'quality flag媛 遺숈? ?묐떟? HR ?댁쁺 ?붾㈃?먯꽌 ?곗꽑 寃?좏븯?몄슂.',
        '?꾩슂 ??reviewer reminder ?먮뒗 ?ъ슂泥??щ?瑜??댁쁺 硫붾え濡??④린?몄슂.',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'Feedback360DevelopmentPlan') {
    return {
      focusArea: String(payload.focusArea ?? '?묒뾽怨??쇰뱶諛??꾨떖 諛⑹떇 媛뺥솕'),
      actions: [
        '?ㅼ쓬 泥댄겕?몄뿉??blind spot ?섎굹瑜?援ъ껜 ?됰룞 ?щ?? ?④퍡 由щ럭?⑸땲??',
        '?ㅼ쓬 ?????숈븞 媛쒖꽑 ?ъ씤?몄? ?곌껐???됰룞 ?ㅽ뿕??1媛??ㅽ뻾?⑸땲??',
      ],
      managerSupport: [
        '由щ뜑??泥댄겕?몄뿉??湲곕? ?섏?怨??ㅼ젣 愿李?李⑥씠瑜?援ъ껜 ?덉떆 以묒떖?쇰줈 ?쇰뱶諛깊빀?덈떎.',
        '?붽컙 ?ㅼ쟻 肄붾찘?몄뿉 360 ?꾩냽 ?≪뀡 吏꾪뻾 ?щ?瑜?吏㏐쾶 ?④퉩?덈떎.',
      ],
      nextCheckinTopics: [
        '?묒뾽 留λ씫?먯꽌 媛???먯＜ ?섏삩 媛뺤젏???ы쁽 諛⑸쾿',
        'blind spot??以꾩씠湲??꾪븳 ?ㅼ쓬 ?됰룞 ?ㅽ뿕',
      ],
    }
  }

  if (requestType === AIRequestType.GROWTH_PLAN && sourceType === 'Feedback360GrowthCopilot') {
    return {
      summary:
        (summary ||
        '理쒓렐 由щ럭, 紐⑺몴, 1:1 湲곕줉??醫낇빀?섎㈃ 媛뺤젏? ?좎??섍퀬 ?덉?留?肄붿묶??紐낇솗?? ?ㅽ뻾 ?먭?, 湲곕?移??뺣젹????援ъ“?곸쑝濡?愿由ы븷 ?꾩슂媛 ?덉뒿?덈떎.'),
      growthAreas: [
        '?곗꽑?쒖쐞? 湲곕?移섎? ???좊챸?섍쾶 ?꾨떖?⑸땲??',
        '1:1?먯꽌 ?됰룞 ?⑥쐞???쇰뱶諛깃낵 ?꾩냽 吏덈Ц?????먯＜ ?④퉩?덈떎.',
        '紐⑺몴? ?깆옣 怨쇱젣瑜??곌껐??遺꾧린 ?⑥쐞濡?吏꾪뻾 ?곹솴???먭??⑸땲??',
      ],
      recommendedCompetencies: ['肄붿묶', '湲곕?移??ㅼ젙', '?쇰뱶諛??덉쭏'],
      oneOnOneQuestions: [
        '理쒓렐 媛??留됲엳???낅Т ?곹솴?먯꽌 ?닿? ??援ъ껜?곸쑝濡??꾩?以????덈뒗 遺遺꾩? 臾댁뾿?멸???',
        '?대쾲 遺꾧린 紐⑺몴 以??곗꽑?쒖쐞媛 媛??遺덈챸?뺥븳 ??ぉ? 臾댁뾿?멸???',
        '?ㅼ쓬 ?????덉뿉 ?됰룞?쇰줈 ?뺤씤?????덈뒗 ?깆옣 ?좏샇??臾댁뾿?멸???',
      ],
      coachingDraft:
        '理쒓렐 ?깃낵? ?쇰뱶諛깆쓣 蹂대㈃ 媛뺤젏? 遺꾨챸?⑸땲?? ?ㅼ쓬 ?④퀎?먯꽌??湲곕?移섎? ??紐낇솗???뺣━?섍퀬, 1:1?먯꽌 ?ㅽ뻾 寃곌낵瑜?吏㏃? 二쇨린濡??뺤씤?섎㈃ ?깆옣 ?띾룄瑜??믪씪 ???덉뒿?덈떎.',
      promotionReadinessHint:
        '?꾩옱 ??븷 ?뺤옣? 寃??媛?ν븯吏留? 湲곕?移??뺣젹怨?肄붿묶 ?쇨??깆씠 ???볦씠硫??ㅼ쓬 ?덈꺼 以鍮꾨룄媛 ??紐낇솗?댁쭏 ???덉뒿?덈떎.',
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'CalibrationRiskSummary') {
    return {
      summary: summary || '?꾩옱 罹섎━釉뚮젅?댁뀡?먯꽌??遺꾪룷 ?몄감? 議곗젙 ?ъ쑀 ?꾨씫 ?щ?瑜?癒쇱? ?뺤씤?섎뒗 寃껋씠 以묒슂?⑸땲??',
      priorityRisks: ['??몄썝 議곗쭅??遺꾪룷 ?쒓끝', '議곗젙 ?ъ쑀 ?꾨씫', '?먯젏?섏? 議곗젙?깃툒 愿대━'],
      recommendedActions: [
        '遺꾪룷 ?몄감媛 ??議곗쭅遺???꾨낫? 議곗젙 ?ъ쑀瑜??ㅼ떆 寃?좏븯?몄슂.',
        '?덉쇅 議곗쭅? 蹂꾨룄 ?뺤콉 硫붾え瑜??④꺼 媛먯궗 媛?μ꽦???뺣낫?섏꽭??',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'CompensationDecisionExplanation') {
    return {
      summary: summary || '?됯? 寃곌낵, ?깃툒 洹쒖튃, ?쒕굹由ъ삤 ?덉궛 踰붿쐞瑜?湲곗??쇰줈 蹂댁긽 寃곗젙 諛곌꼍???ㅻ챸?섎뒗 珥덉븞?낅땲??',
      drivers: ['理쒖쥌 ?됯? ?깃툒', '?쒕??덉씠??洹쒖튃', '?덉궛 ?쒕룄 諛??덉쇅 ?뱀씤 ?щ?'],
      employeeFacingNote:
        '?대쾲 蹂댁긽 寃곗젙? ?됯? 寃곌낵? ?곸슜??蹂댁긽 洹쒖튃??湲곗??쇰줈 ?곗젙?섏뿀?쇰ŉ, 怨듦컻 ??理쒖쥌 ?뱀씤怨??덉궛 寃?좊? 嫄곗낀?듬땲??',
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'NotificationOpsSummary') {
    return {
      summary:
        (summary ||
        '理쒓렐 ?뚮┝ ?댁쁺? ?꾨컲?곸쑝濡??덉젙?곸씠吏留??쇰? ?ㅽ뙣 ?쒗뵆由욧낵 dead letter ?뺣━媛 ?꾩슂?⑸땲??'),
      warnings: [
        '?ㅽ뙣 嫄댁씠 諛섎났?섎뒗 ?쒗뵆由욧낵 梨꾨꼸 議고빀???곗꽑 ?먭???二쇱꽭??',
        'dead letter ?꾩쟻 嫄댁? ?ъ쿂由???payload ?꾨씫 ?щ?瑜?癒쇱? ?뺤씤?섎뒗 寃껋씠 醫뗭뒿?덈떎.',
      ],
      recommendedActions: [
        '?ㅽ뙣 嫄댁씠 留롮? ?쒗뵆由우쓽 蹂?섏? ?쒖꽦 ?곹깭瑜?寃?좏븯?몄슂.',
        '理쒓렐 24?쒓컙 ?ъ떆???대젰怨?dead letter ?ъ쿂由?寃곌낵瑜??④퍡 紐⑤땲?곕쭅?섏꽭??',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'NotificationDeadLetterPatterns') {
    return {
      summary: summary || 'dead letter??蹂???꾨씫, ?섏떊 ????뺣낫 ?꾨씫, ?쇱떆??梨꾨꼸 ?ㅽ뙣 ?좏삎?쇰줈 臾띠뿬 蹂댁엯?덈떎.',
      patterns: [
        { reason: '蹂???꾨씫 ?먮뒗 移섑솚 ?ㅽ뙣', count: 2, impact: '媛숈? ?쒗뵆由우쓽 諛섎났 ?ㅽ뙣濡??댁뼱吏????덉뒿?덈떎.' },
        { reason: '?섏떊 ????뺣낫 ?꾨씫', count: 1, impact: '?뱀젙 ?ъ슜???뚮┝???꾨씫?????덉뒿?덈떎.' },
      ],
      recommendedActions: [
        '?쒗뵆由?蹂??紐⑸줉怨?payload ?ㅻ? 癒쇱? 鍮꾧탳?섏꽭??',
        '?섏떊 ????뺣낫媛 鍮꾩뼱 ?덈뒗 寃쎌슦 ?곗씠???먮낯怨??숆린???곹깭瑜??먭??섏꽭??',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'NotificationTemplateValidation') {
    return {
      summary: summary || '?쒗뵆由?蹂?섎뒗 ?泥대줈 ?쇨??섏?留??꾨씫?????덈뒗 placeholder? ?쒗쁽 以묐났???먭??섎뒗 寃껋씠 醫뗭뒿?덈떎.',
      missingVariables: ['dueDate'],
      confusingVariables: ['employeeName / recipientName 以??섎굹濡??듭씪 沅뚯옣'],
      suggestions: [
        '?쒕ぉ怨?蹂몃Ц?먯꽌 ?숈씪 ?섎? 蹂?섎챸? ?섎굹濡??듭씪?섏꽭??',
        '留곹겕 蹂?섎뒗 ?꾨씫 ???泥?臾멸뎄媛 蹂댁씠?꾨줉 泥섎━?섎뒗 寃껋씠 ?덉쟾?⑸땲??',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'NotificationOpsReport') {
    return {
      headline: summary || '理쒓렐 ?뚮┝ ?댁쁺? ?꾨컲?곸쑝濡??덉젙?곸씠???쇰? ?ㅽ뙣 ?쒗뵆由우뿉 ????댁쁺 ?먭????꾩슂?⑸땲??',
      highlights: ['二쇱슂 ?뚮┝? ?뺤긽?곸쑝濡?泥섎━?섍퀬 ?덉뒿?덈떎.', '???곸껜???쒗븳?곸씠硫??ъ쿂由??먮쫫? ?좎??섍퀬 ?덉뒿?덈떎.'],
      risks: ['dead letter ?꾩쟻??而ㅼ?硫??ъ슜??寃쏀뿕 ??섎줈 ?댁뼱吏????덉뒿?덈떎.', '鍮꾪솢???쒗뵆由우씠 ?꾩슂???대깽?몃? ?볦튂吏 ?딅뒗吏 ?뺤씤?댁빞 ?⑸땲??'],
      nextActions: ['?ㅽ뙣 ?쒗뵆由우쓣 ?곗꽑 ?먭??섍퀬 test send瑜??ㅽ뻾?섏꽭??', 'dead letter ?ъ쿂由???24?쒓컙 ?숈븞 ?щ컻 ?щ?瑜?紐⑤땲?곕쭅?섏꽭??'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'AdminOpsStatusSummary') {
    return {
      summary:
        summary || '理쒓렐 ?댁쁺 ?곹깭???꾨컲?곸쑝濡??뺤씤 媛?ν븯吏留? ?ㅽ뙣 ?묒뾽怨??낅Т 由ъ뒪?щ? ?④퍡 ?먭??섎뒗 ?댁쁺 ??묒씠 ?꾩슂?⑸땲??',
      highlights: [
        '?댁쁺 ?듭떖 吏?쒖? ?낅Т 由ъ뒪?щ? ???붾㈃?먯꽌 ?뺤씤?????덉뒿?덈떎.',
        '湲곗닠 ?곹깭? HR ?댁쁺 由ъ뒪?щ? ?④퍡 蹂대ŉ ?곗꽑?쒖쐞瑜??뺥븷 ???덉뒿?덈떎.',
      ],
      watchouts: [
        'dead letter, 濡쒓렇??以鍮?遺덇? 怨꾩젙, ?덉궛 珥덇낵 ?쒕굹由ъ삤??利됱떆 ?뺤씤???꾩슂?⑸땲??',
        'AI fallback 利앷????됯? 二쇨린 吏?곗? ?꾩냽 ?댁쁺 ?댁뒋濡??댁뼱吏????덉뒿?덈떎.',
      ],
      recommendedActions: [
        '?ㅽ뙣 ?묒뾽怨?dead letter瑜?癒쇱? 寃?좏븯怨?蹂듦뎄 ?щ?瑜??뺤씤?섏꽭??',
        '?됯? 二쇨린, ?붽컙 ?ㅼ쟻, 蹂댁긽 ?쒕??덉씠?섏쓽 吏????ぉ???곗꽑?쒖쐞濡??먭??섏꽭??',
      ],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'AdminOpsIncidentPatterns') {
    return {
      summary: summary || '理쒓렐 ?대깽?몃뒗 ?뚮┝ ?ㅽ뙣, 濡쒓렇??以鍮?遺덇? 怨꾩젙, ?댁쁺 吏???댁뒋 以묒떖?쇰줈 臾띠뿬 蹂댁엯?덈떎.',
      patterns: [
        {
          component: 'notification',
          pattern: 'dead letter? ?ъ떆??吏?곗씠 諛섎났?섎뒗 ?⑦꽩',
          severity: 'HIGH',
          action: '?뚮┝ ?댁쁺 ?붾㈃?먯꽌 ?ㅽ뙣 ?먯씤怨??ъ쿂由?寃곌낵瑜??곗꽑 ?뺤씤?섏꽭??',
        },
        {
          component: 'ops-summary',
          pattern: '?낅Т 由ъ뒪????ぉ??蹂듭닔 ?붾㈃?쇰줈 遺꾩궛?섏뼱 ?꾩냽 議곗튂媛 吏?곕릺???⑦꽩',
          severity: 'MEDIUM',
          action: '?낅Т 由ъ뒪????湲곗??쇰줈 ?곗꽑?쒖쐞瑜??뺥빐 愿???붾㈃?쇰줈 ?대룞?섏꽭??',
        },
      ],
      topRisks: ['dead letter ?꾩쟻', '濡쒓렇??以鍮?遺덇? 怨꾩젙', '?덉궛 珥덇낵 ?쒕굹由ъ삤'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'AdminOpsDailyReport') {
    return {
      headline: summary || '?ㅻ뒛 ?댁쁺 ?꾪솴? ?꾨컲?곸쑝濡??덉젙?곸씠?? ?쇰? ?댁쁺 由ъ뒪?щ뒗 利됱떆 ?뺤씤???꾩슂?⑸땲??',
      executiveSummary:
        '?ㅽ뙣 ?묒뾽, dead letter, 濡쒓렇??以鍮?遺덇? 怨꾩젙, ?덉궛 珥덇낵 ?쒕굹由ъ삤瑜??④퍡 ?뺤씤??湲곗닠 ?댁쁺怨??낅Т ?댁쁺 由ъ뒪?щ? ?숈떆??愿由ы빐???⑸땲??',
      issues: ['?뚮┝ ?ㅽ뙣 ?꾩쟻 ?щ? ?뺤씤', '?됯?/蹂댁긽 ?댁쁺 吏???щ? ?뺤씤', '濡쒓렇??以鍮?遺덇? 怨꾩젙 ?먭?'],
      nextActions: ['알림 운영 상태를 재확인', 'Google 계정 등록 누락 계정을 점검', '보상 시나리오 예산 초과를 검토'],
    }
  }

  if (requestType === AIRequestType.KPI_ASSIST && sourceType === 'AdminOpsRiskPrioritization') {
    return {
      summary: summary || '?꾩옱 ?댁쁺 由ъ뒪?щ뒗 ?ъ슜???곹뼢怨?蹂듦뎄 ?쒖씠?꾨? 湲곗??쇰줈 ?곗꽑?쒖쐞瑜??뺥븯??寃껋씠 醫뗭뒿?덈떎.',
      priorities: [
        {
          label: 'Dead Letter 諛??ㅽ뙣 ?묒뾽',
          priority: 'P1',
          reason: '?ъ슜???뚮┝ ?꾨씫?쇰줈 吏곸젒?곸씤 ?댁쁺 ?μ븷濡??댁뼱吏????덉뒿?덈떎.',
          action: '?뚮┝ ?댁쁺?먯꽌 ?ㅽ뙣 ?먯씤 ?뺤씤 ???ъ쿂由ы븯?몄슂.',
        },
        {
          label: '濡쒓렇??以鍮?遺덇? 怨꾩젙',
          priority: 'P2',
          reason: '?좉퇋/湲곗〈 ?ъ슜?먯쓽 ?묎렐 臾몄젣濡??댁쁺 臾몄쓽媛 利앷??????덉뒿?덈떎.',
          action: 'Google 怨꾩젙 ?깅줉 ?붾㈃?먯꽌 誘몃벑濡??먮뒗 ?꾨찓??遺덉씪移?怨꾩젙???뺣━?섏꽭??',
        },
        {
          label: '?덉궛 珥덇낵 蹂댁긽 ?쒕굹由ъ삤',
          priority: 'P3',
          reason: '利됱떆 ?μ븷???꾨땲吏留??뱀씤 吏?곌낵 怨듦컻 吏?곗쑝濡??댁뼱吏????덉뒿?덈떎.',
          action: '蹂댁긽 ?쒕??덉씠??愿由??붾㈃?먯꽌 珥덇낵 ?ъ쑀? ?덉쇅 ?뱀씤 ?щ?瑜??뺤씤?섏꽭??',
        },
      ],
    }
  }

  switch (requestType) {
    case AIRequestType.KPI_ASSIST:
      return {
        kpiName: goal || (orgKpi ? `${orgKpi} ?ㅽ뻾??媛뺥솕` : '?듭떖 KPI 珥덉븞'),
        definition:
          (summary ||
          '議곗쭅 紐⑺몴? ?곌껐???듭떖 寃곌낵瑜?遺꾧린 ?먮뒗 ?곌컙 湲곗??쇰줈 痢≪젙?????덇쾶 ?뺤쓽??KPI 珥덉븞?낅땲??'),
        formula: payload.kpiType === 'QUALITATIVE' ? '정성 평가 체크리스트 충족 여부' : 'Actual / Target x 100',
        targetValueSuggestion: String(payload.targetValue ?? '?붾퀎 紐⑺몴 100 湲곗?'),
        unitSuggestion: String(payload.unit ?? (payload.kpiType === 'QUALITATIVE' ? '점수' : '%')),
        weightSuggestion: Number(payload.weight ?? 20),
        difficultySuggestion: String(payload.difficulty ?? 'MEDIUM'),
        smartChecks: [
          '紐⑺몴 ??곴낵 ?곗텧臾쇱씠 臾몄옣???ы븿?섏뼱 ?덉뒿?덈떎.',
          '痢≪젙 諛⑹떇 ?먮뒗 ?먭? 湲곗????ы븿?섏뼱 ?덉뒿?덈떎.',
          '議곗쭅 KPI? ?곌껐?섎뒗 留λ씫???쒕윭?⑸땲??',
        ],
        managerReviewPoints: [
          '媛以묒튂媛 ?꾩껜 KPI ?⑷퀎? 異⑸룎?섏? ?딅뒗吏 ?뺤씤?섏꽭??',
          '痢≪젙 二쇨린? ?곗씠??異쒖쿂瑜???踰???寃?좏븯?몄슂.',
        ],
      }
    case AIRequestType.EVAL_COMMENT_DRAFT:
      return {
        summary: summary || '?꾩옱 ?낅젰??洹쇨굅瑜?湲곗??쇰줈 洹좏삎 ?≫엺 ?됯? 肄붾찘??珥덉븞??以鍮꾪뻽?듬땲??',
        strengths: toStringArray(payload.strengths, ['二쇱슂 KPI ?먮뒗 怨쇱젣?먯꽌 ?덉젙?곸씤 ?ㅽ뻾?μ쓣 蹂댁??듬땲??']),
        improvements: toStringArray(payload.improvements, ['?곗꽑?쒖쐞 議곗젙怨??꾩냽 而ㅻ??덉??댁뀡????紐낇솗???섎㈃ ?④낵媛 而ㅼ쭏 ???덉뒿?덈떎.']),
        draftComment:
          (summary ||
          `${grade ? `${grade} ?섏???` : ''}?깃낵瑜??룸컺移⑦븯??洹쇨굅瑜?以묒떖?쇰줈 媛뺤젏怨?媛쒖꽑 ?ъ씤?몃? ?④퍡 ?뺣━??珥덉븞?낅땲?? 援ъ껜 ?щ?? ?섏튂瑜?異붽??????쒖텧??二쇱꽭??`),
      }
    case AIRequestType.BIAS_ANALYSIS:
      return {
        riskLevel: 'MEDIUM',
        findings: [
          {
            severity: 'MEDIUM',
            issue: '二쇨????쒗쁽?대굹 ?깊뼢 以묒떖 ?쒗쁽???ы븿?????덉뒿?덈떎.',
            recommendation: '?됰룞怨?寃곌낵, 愿李?媛?ν븳 ?ъ떎 以묒떖?쇰줈 臾몄옣???ㅼ떆 ??二쇱꽭??',
          },
          {
            severity: 'LOW',
            issue: '理쒓렐 ?щ???洹쇨굅媛 移섏슦爾ㅻ뒗吏 ?뺤씤???꾩슂?⑸땲??',
            recommendation: '湲곌컙 ?꾩껜??????щ?瑜??④퍡 ?멸툒??二쇱꽭??',
          },
        ],
        balancedRewrite:
          (summary ||
          '愿李곕맂 ?됰룞, KPI 寃곌낵, ?묒뾽 湲곗뿬瑜?湲곗??쇰줈 ?쒗쁽???뺣━?섍퀬, 媛쒖씤 ?깊뼢 ???援ъ껜?곸씤 ?щ? 以묒떖?쇰줈 蹂댁셿??臾몄옣?낅땲??'),
      }
    case AIRequestType.GROWTH_PLAN:
      return {
        focusArea: goal || '?곗꽑 媛쒖꽑 ?곸뿭',
        recommendedActions: [
          '?ㅼ쓬 遺꾧린 ?듭떖 怨쇱젣 1媛쒕? ?좎젙??二쇨컙 ?먭? 吏?쒕? ?댁쁺?⑸땲??',
          '由щ럭 ?먮뒗 ?쇰뱶諛?猷⑦봽瑜???1???댁긽 ?뺣??뷀빀?덈떎.',
        ],
        supportNeeded: [
          '留ㅻ땲?? ?붾퀎 泥댄겕?몄뿉??吏꾪뻾 ?곹솴???뺤씤?⑸땲??',
          '?꾩슂??援먯쑁?대굹 硫섑넗留??먯썝???ъ쟾???뺣낫?⑸땲??',
        ],
        milestone: grade ? `${grade} 寃곌낵 ?쇰뱶諛?諛섏쁺 ??90????以묎컙 ?먭?` : '90????以묎컙 ?먭?',
      }
    case AIRequestType.MID_REVIEW_ASSIST:
      return {
        performanceSummary:
          summary || '현재 확보된 KPI, 월간 실적, 체크인 기록을 기준으로 중간 점검 대화를 준비했습니다.',
        goalValidityReview: {
          status: 'ADJUST',
          summary:
            '현재 목표는 완전히 폐기할 수준은 아니지만, 우선순위나 달성 방식 조정이 필요한지 확인해 보세요.',
        },
        executionCoachingReview: {
          status: 'NEEDS_SUPPORT',
          summary: '성과 대화에서는 실행 장애 요인과 필요한 지원이 구체적으로 정리되어야 합니다.',
        },
        followUpQuestions: [
          '현재 목표가 여전히 가장 중요한 우선순위인지 확인할 수 있는 근거는 무엇인가요?',
          '지금까지의 실행에서 가장 큰 병목은 무엇이었고, 어떤 지원이 있으면 달라질까요?',
          '다음 기간에 꼭 달라져야 하는 행동이나 결과를 한 문장으로 정리하면 무엇인가요?',
        ],
        commentDraft:
          '현재까지의 성과와 이슈를 바탕으로 목표 자체의 유효성과 실행 방식 모두를 다시 점검할 필요가 있습니다. 다음 기간에는 기대 상태와 판단 기준을 더 구체적으로 합의하고, 필요한 지원 계획을 함께 정리해 주세요.',
        vagueCommentSignals: ['근거 없이 추상적인 표현은 구체적인 사례나 지표로 보강해 주세요.'],
        nextActions: [
          '목표 유지 여부와 조정 필요성을 먼저 합의해 주세요.',
          '다음 기간의 기대 상태와 판단 기준을 문장으로 명확히 남겨 주세요.',
        ],
        lowConfidenceNotice: '근거가 부족한 영역은 최종 판단 전에 추가 확인이 필요합니다.',
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

function isOrgKpiAiRequest(requestType: AIRequestType, sourceType?: string) {
  return requestType === AIRequestType.KPI_ASSIST && typeof sourceType === 'string' && sourceType.startsWith('OrgKpi')
}

function resolveOrgKpiAiLogContext(payload: JsonRecord, sourceType?: string) {
  const teamDepartment =
    payload.teamDepartment && typeof payload.teamDepartment === 'object'
      ? (payload.teamDepartment as JsonRecord)
      : null

  const deptId =
    (typeof payload.deptId === 'string' && payload.deptId) ||
    (typeof teamDepartment?.id === 'string' && teamDepartment.id) ||
    null
  const evalYear =
    (typeof payload.evalYear === 'number' && Number.isFinite(payload.evalYear) ? payload.evalYear : null) ??
    (typeof payload.year === 'number' && Number.isFinite(payload.year) ? payload.year : null)

  return {
    deptId,
    evalYear,
    stepName: sourceType ?? null,
  }
}

function logOrgKpiAiEvent(
  event:
    | 'ORG_KPI_AI_SCHEMA_VALIDATE_START'
    | 'ORG_KPI_AI_SCHEMA_VALIDATE_FAILED'
    | 'ORG_KPI_AI_PROVIDER_PARSE_FAILED'
    | 'ORG_KPI_AI_FALLBACK_USED',
  requestType: AIRequestType,
  sourceType: string | undefined,
  payload: JsonRecord,
  extra: {
    errorCode?: string | null
    prismaCode?: string | null
    shortMessage?: string | null
  } = {},
) {
  if (!isOrgKpiAiRequest(requestType, sourceType)) {
    return
  }

  console.info(`[org-kpi-ai] ${event}`, {
    ...resolveOrgKpiAiLogContext(payload, sourceType),
    errorCode: extra.errorCode ?? null,
    prismaCode: extra.prismaCode ?? null,
    shortMessage: extra.shortMessage ?? null,
  })
}

type StrictJsonSchemaNode = JsonRecord & {
  properties?: Record<string, unknown>
  required?: unknown
  items?: unknown
}

function collectStrictJsonSchemaCoverageErrors(node: StrictJsonSchemaNode, path: string[] = []): string[] {
  const errors: string[] = []
  const properties =
    node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
      ? (node.properties as Record<string, unknown>)
      : null

  if (properties) {
    const required = Array.isArray(node.required) ? node.required.filter((item) => typeof item === 'string') : null
    const propertyKeys = Object.keys(properties)

    if (!required) {
      errors.push(
        `In context=${JSON.stringify(path)}, 'required' is required to be supplied and to be an array including every key in properties.`,
      )
    } else {
      for (const propertyKey of propertyKeys) {
        if (!required.includes(propertyKey)) {
          errors.push(
            `In context=${JSON.stringify([...path, 'properties'])}, 'required' is required to be supplied and to be an array including every key in properties. Missing '${propertyKey}'.`,
          )
        }
      }
    }

    for (const [propertyKey, propertyValue] of Object.entries(properties)) {
      if (propertyValue && typeof propertyValue === 'object' && !Array.isArray(propertyValue)) {
        errors.push(
          ...collectStrictJsonSchemaCoverageErrors(propertyValue as StrictJsonSchemaNode, [...path, 'properties', propertyKey]),
        )
      }
    }
  }

  if (node.items && typeof node.items === 'object' && !Array.isArray(node.items)) {
    errors.push(...collectStrictJsonSchemaCoverageErrors(node.items as StrictJsonSchemaNode, [...path, 'items']))
  }

  return errors
}

function assertStrictJsonSchemaCoverage(schemaName: string, schema: JsonRecord) {
  const errors = collectStrictJsonSchemaCoverageErrors(schema as StrictJsonSchemaNode)
  if (!errors.length) {
    return
  }

  throw new AppError(500, 'AI_SCHEMA_VALIDATION_ERROR', `Invalid schema for response_format '${schemaName}': ${errors[0]}`)
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
  logOrgKpiAiEvent('ORG_KPI_AI_SCHEMA_VALIDATE_START', requestType, sourceType, payload)
  try {
    assertStrictJsonSchemaCoverage(config.schemaName, config.schema)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Schema validation failed.'
    logOrgKpiAiEvent('ORG_KPI_AI_SCHEMA_VALIDATE_FAILED', requestType, sourceType, payload, {
      errorCode: error instanceof AppError ? error.code : 'AI_SCHEMA_VALIDATION_ERROR',
      shortMessage: errorMessage,
    })
    throw error
  }

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
    if (
      errorMessage.includes('response_format') ||
      errorMessage.includes('json_schema') ||
      errorMessage.includes('structured output')
    ) {
      logOrgKpiAiEvent('ORG_KPI_AI_SCHEMA_VALIDATE_FAILED', requestType, sourceType, payload, {
        errorCode: 'AI_SCHEMA_VALIDATION_ERROR',
        shortMessage: errorMessage,
      })
      throw new AppError(response.status, 'AI_SCHEMA_VALIDATION_ERROR', errorMessage)
    }

    throw new AppError(response.status, 'AI_REQUEST_FAILED', errorMessage)
  }

  const text = extractOutputText(json)
  if (!text) {
    logOrgKpiAiEvent('ORG_KPI_AI_PROVIDER_PARSE_FAILED', requestType, sourceType, payload, {
      errorCode: 'AI_EMPTY_RESPONSE',
      shortMessage: 'OpenAI response did not include structured output.',
    })
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'OpenAI response did not include structured output.')
  }

  let parsed: JsonRecord
  try {
    parsed = JSON.parse(text) as JsonRecord
  } catch {
    logOrgKpiAiEvent('ORG_KPI_AI_PROVIDER_PARSE_FAILED', requestType, sourceType, payload, {
      errorCode: 'AI_INVALID_JSON',
      shortMessage: 'OpenAI response JSON could not be parsed.',
    })
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
      fallbackReason: 'AI 기능이 비활성화되어 기본 결과로 표시했습니다.',
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

    logOrgKpiAiEvent('ORG_KPI_AI_FALLBACK_USED', params.requestType, params.sourceType, requestPayload, {
      errorCode,
      shortMessage: errorMessage,
    })

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
