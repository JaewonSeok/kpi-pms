import { Prisma } from '@prisma/client'
import type {
  AiCompetencyQuestion,
  AiCompetencyCertificationStatus,
  AiCompetencyCycleStatus,
  AiCompetencyDifficulty,
  AiCompetencyDomain,
  AiCompetencyExternalCertClaimStatus,
  AiCompetencyGrade,
  AiCompetencyQuestionType,
  AiCompetencyReviewDecision,
  AiCompetencySecondRoundStatus,
  AiCompetencySyncState,
  AiCompetencyTemplateStatus,
  AiCompetencyTrack,
  SystemRole,
} from '@prisma/client'
import type { Session } from 'next-auth'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { AppError } from '@/lib/utils'
import {
  calculateAiCompetencyFinalScore,
  calculateAiCompetencyGrade,
  canApplyForSecondRound,
  scoreObjectiveQuestion,
} from '@/lib/ai-competency-scoring'
import {
  analyzeBlueprintQuestionPool,
  assembleExamFromBlueprint,
  validateBlueprintDefinition,
  type AiCompetencyBlueprintDefinition,
  type AiCompetencyBlueprintQuestion,
  type AiCompetencyBlueprintRowDefinition,
} from '@/lib/ai-competency-blueprint'
import {
  calculateRubricReview,
  validateRubricDefinition,
  type AiCompetencyReviewCriterionInput,
  type AiCompetencyRubricCriterionDefinition,
  type AiCompetencyRubricDefinition,
} from '@/lib/ai-competency-rubric'

export {
  calculateAiCompetencyFinalScore,
  calculateAiCompetencyGrade,
  canApplyForSecondRound,
  scoreObjectiveQuestion,
} from '@/lib/ai-competency-scoring'

export type StoredUpload = {
  fileName: string
  mimeType: string
  sizeBytes: number
  buffer: Uint8Array<ArrayBuffer>
}

type AuthenticatedSession = Session & {
  user: NonNullable<Session['user']> & {
    id: string
    role: SystemRole
  }
}

export type AiCompetencyPageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type AiCompetencyPageData = {
  state: AiCompetencyPageState
  message?: string
  currentUser?: {
    id: string
    name: string
    role: SystemRole
    department: string
  }
  availableCycles: Array<{
    id: string
    name: string
    year: number
    status: AiCompetencyCycleStatus
    evalCycleId: string
  }>
  availableEvalCycles?: Array<{
    id: string
    name: string
    year: number
    organizationName: string
    linkedAiCycleId?: string
  }>
  selectedCycleId?: string
  permissions?: {
    canManageCycles: boolean
    canManageQuestions: boolean
    canManageAssignments: boolean
    canManageResults: boolean
    canReviewSubmissions: boolean
    canViewExecutive: boolean
  }
  summary?: {
    targetCount: number
    completedFirstRoundCount: number
    passedFirstRoundCount: number
    secondRoundSubmissionCount: number
    certificationCount: number
    syncedCount: number
  }
  employeeView?: {
    assignment?: {
      id: string
      track: AiCompetencyTrack
      firstRoundRequired: boolean
      secondRoundVolunteer: boolean
      policyAcknowledgedAt?: string
    }
    questions: Array<{
      id: string
      title: string
      prompt: string
      competencyDomain: AiCompetencyDomain
      questionType: AiCompetencyQuestionType
      difficulty: AiCompetencyDifficulty
      maxScore: number
      options: string[]
      requiresManualScoring: boolean
      savedAnswer?: unknown
    }>
    assessmentPlan?: {
      totalQuestionCount: number
      totalPoints: number
      timeLimitMinutes: number
      passScore: number
      blueprints: Array<{
        id: string
        blueprintName: string
        track?: AiCompetencyTrack
      }>
    }
    attempt?: {
      id: string
      status: string
      startedAt?: string
      dueAt?: string
      submittedAt?: string
      objectiveScore?: number
      manualScore?: number
      totalScore?: number
      passStatus?: string
      timeLimitMinutes: number
    }
    secondRound: {
      eligible: boolean
      application?: {
        id: string
        status: AiCompetencySecondRoundStatus
        taskDescription: string
        aiUsagePurpose: string
        toolUsed: string
        promptSummary: string
        verificationMethod: string
        businessImpact: string
        sensitiveDataCheck: string
        aggregatedScore?: number
        aggregatedBonus?: number
        internalCertificationGranted: boolean
        artifacts: Array<{
          id: string
          fileName: string
          sizeBytes: number
        }>
        reviews: Array<{
          reviewerId: string
          reviewerName: string
          decision?: AiCompetencyReviewDecision
          bonusScore?: number
          reviewedAt?: string
          notes?: string
          qnaNote?: string
        }>
      }
    }
    externalCerts: {
      masters: Array<{
        id: string
        name: string
        vendor?: string
        mappedScore: number
        validityMonths?: number
        requiresPolicyAcknowledgement: boolean
      }>
      claims: Array<{
        id: string
        status: AiCompetencyExternalCertClaimStatus
        certificateName: string
        mappedScoreSnapshot: number
        submittedAt: string
        decidedAt?: string
        rejectionReason?: string
        proofFileName: string
      }>
    }
    result?: {
      id: string
      firstRoundScore?: number
      secondRoundBonus: number
      externalCertMappedScore?: number
      finalScore: number
      finalGrade: AiCompetencyGrade
      certificationStatus: AiCompetencyCertificationStatus
      syncState: AiCompetencySyncState
      syncedAt?: string
      publishedAt?: string
    }
  }
  reviewerView?: {
    queue: Array<{
      reviewId: string
      submissionId: string
      employeeName: string
      department: string
      track: AiCompetencyTrack
      status: AiCompetencySecondRoundStatus
      artifactCount: number
      artifacts: Array<{
        id: string
        fileName: string
        sizeBytes: number
      }>
      taskDescription: string
      submittedAt: string
      reviewStatus: string
      aggregatedScore?: number
      existingDecision?: AiCompetencyReviewDecision
      existingBonus?: number
      existingNote?: string
      existingQnaNote?: string
      existingCriteriaScores: Array<{
        criterionId: string
        score: number
        comment?: string
        knockoutTriggered: boolean
      }>
      rubric?: {
        rubricId: string
        rubricName: string
        totalScore: number
        passScore: number
        bonusScoreIfPassed: number
        certificationLabel?: string
        criteria: Array<{
          criterionId: string
          criterionCode: string
          criterionName: string
          criterionDescription?: string
          maxScore: number
          mandatory: boolean
          knockout: boolean
          bands: Array<{
            score: number
            title: string
            description?: string
            guidance?: string
          }>
        }>
      }
    }>
  }
  adminView?: {
    cycle?: {
      id: string
      evalCycleId: string
      cycleName: string
      status: AiCompetencyCycleStatus
      firstRoundPassThreshold: number
      secondRoundBonusCap: number
      scoreCap: number
      timeLimitMinutes: number
      randomizeQuestions: boolean
      companyEmailDomain?: string
      firstRoundOpenAt?: string
      firstRoundCloseAt?: string
      secondRoundApplyOpenAt?: string
      secondRoundApplyCloseAt?: string
      reviewOpenAt?: string
      reviewCloseAt?: string
      calibrationOpenAt?: string
      calibrationCloseAt?: string
      resultPublishAt?: string
      artifactMinCount: number
      artifactMaxCount: number
      policyAcknowledgementText?: string
    }
    employeeDirectory: Array<{
      id: string
      employeeNumber: string
      name: string
      email: string
      department: string
      position: string
      role: string
      status: string
    }>
    reviewerDirectory: Array<{
      id: string
      name: string
      department: string
      position: string
      role: string
    }>
    questionBank: Array<{
      id: string
      title: string
      prompt: string
      competencyDomain: AiCompetencyDomain
      track?: AiCompetencyTrack
      questionType: AiCompetencyQuestionType
      difficulty: AiCompetencyDifficulty
      options: string[]
      answerKey: string[]
      tags: string[]
      explanation?: string
      maxScore: number
      sortOrder: number
      isActive: boolean
      isCommon: boolean
      version: number
      randomizable: boolean
      requiresManualScoring: boolean
    }>
    assignments: Array<{
      id: string
      employeeId: string
      employeeNumber: string
      name: string
      department: string
      track: AiCompetencyTrack
      firstRoundStatus: string
      firstRoundScore?: number
      secondRoundVolunteer: boolean
      secondRoundStatus?: AiCompetencySecondRoundStatus
      externalCertStatus?: AiCompetencyExternalCertClaimStatus
      finalScore?: number
      finalGrade?: AiCompetencyGrade
      syncState?: AiCompetencySyncState
    }>
    manualScoringQueue: Array<{
      answerId: string
      employeeName: string
      track: AiCompetencyTrack
      questionTitle: string
      answerText: string
      maxScore: number
      attemptId: string
    }>
    secondRoundQueue: Array<{
      submissionId: string
      employeeName: string
      department: string
      track: AiCompetencyTrack
      status: AiCompetencySecondRoundStatus
      artifactCount: number
      reviewerCount: number
      submittedAt: string
      aggregatedBonus?: number
    }>
    blueprints: Array<{
      id: string
      blueprintName: string
      blueprintVersion: number
      track?: AiCompetencyTrack
      status: AiCompetencyTemplateStatus
      totalQuestionCount: number
      totalPoints: number
      timeLimitMinutes: number
      passScore: number
      randomizationEnabled: boolean
      notes?: string
      canActivate: boolean
      validationErrors: string[]
      shortageCount: number
      rows: Array<{
        competencyDomain: AiCompetencyDomain
        itemType: AiCompetencyQuestionType
        difficulty: AiCompetencyDifficulty
        scope: 'COMMON' | 'TRACK_SPECIFIC'
        requiredQuestionCount: number
        pointsPerQuestion: number
        availableQuestionCount: number
        shortageCount: number
        requiredTags: string[]
        excludedTags: string[]
        displayOrder: number
      }>
      exportUrls: {
        csv: string
        xlsx: string
      }
    }>
    blueprintLibrary: Array<{
      id: string
      cycleName: string
      year: number
      blueprintName: string
      blueprintVersion: number
      track?: AiCompetencyTrack
    }>
    rubrics: Array<{
      id: string
      rubricName: string
      rubricVersion: number
      track?: AiCompetencyTrack
      status: AiCompetencyTemplateStatus
      totalScore: number
      passScore: number
      bonusScoreIfPassed: number
      certificationLabel?: string
      notes?: string
      canActivate: boolean
      validationErrors: string[]
      criteria: Array<{
        criterionId: string
        criterionCode: string
        criterionName: string
        criterionDescription?: string
        maxScore: number
        mandatory: boolean
        knockout: boolean
        displayOrder: number
        bands: Array<{
          score: number
          title: string
          description?: string
          guidance?: string
        }>
      }>
    }>
    rubricLibrary: Array<{
      id: string
      cycleName: string
      year: number
      rubricName: string
      rubricVersion: number
      track?: AiCompetencyTrack
    }>
    certClaims: Array<{
      claimId: string
      employeeName: string
      certificateName: string
      status: AiCompetencyExternalCertClaimStatus
      mappedScoreSnapshot: number
      submittedAt: string
      decidedAt?: string
      proofFileName: string
    }>
    results: Array<{
      resultId: string
      employeeName: string
      department: string
      track: AiCompetencyTrack
      firstRoundScore?: number
      externalCertMappedScore?: number
      secondRoundBonus: number
      finalScore: number
      finalGrade: AiCompetencyGrade
      certificationStatus: AiCompetencyCertificationStatus
      syncState: AiCompetencySyncState
      syncedAt?: string
      overrideScore?: number
    }>
  }
  executiveView?: {
    completionRate: number
    passRate: number
    secondRoundParticipationRate: number
    certificationRate: number
    trackDistribution: Array<{
      track: AiCompetencyTrack
      averageScore: number
      count: number
      passRate: number
    }>
    departmentDistribution: Array<{
      department: string
      averageScore: number
      count: number
    }>
    exportUrls: {
      csv: string
      xlsx: string
    }
  }
}

const DEFAULT_POLICY_ACKNOWLEDGEMENT =
  '외부 자격으로 대체하더라도 사내 AI 활용 가이드와 민감정보 처리 원칙을 숙지하고 준수합니다.'

const DEFAULT_CERTIFICATE_MASTERS = [
  {
    name: 'AWS Certified AI Practitioner',
    vendor: 'AWS',
    validityMonths: 36,
    mappedScore: 85,
    requiresPolicyAcknowledgement: true,
    displayOrder: 1,
  },
  {
    name: 'Google Cloud Generative AI Leader',
    vendor: 'Google Cloud',
    validityMonths: 24,
    mappedScore: 88,
    requiresPolicyAcknowledgement: true,
    displayOrder: 2,
  },
  {
    name: 'Microsoft AI Business Professional',
    vendor: 'Microsoft',
    validityMonths: 24,
    mappedScore: 82,
    requiresPolicyAcknowledgement: true,
    displayOrder: 3,
  },
] as const

const TRACK_LABELS: Record<AiCompetencyTrack, string> = {
  HR_SUPPORT: 'HR/경영지원',
  FINANCE_OPERATIONS: '재무/운영',
  SALES_CS: '영업/CS',
  MARKETING_PLANNING: '마케팅/기획',
}

const QUESTION_TYPE_LABELS: Partial<Record<AiCompetencyQuestionType, string>> = {
  SINGLE_CHOICE: '단일선택',
  MULTIPLE_CHOICE: '복수선택',
  SCENARIO_JUDGEMENT: '시나리오 판단',
  SHORT_ANSWER: '단답/실무형',
}

const DIFFICULTY_LABELS: Record<AiCompetencyDifficulty, string> = {
  BASIC: '기초',
  INTERMEDIATE: '중간',
  ADVANCED: '심화',
}

const ARTIFACT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const CERT_PROOF_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
])

const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024
const MAX_CERT_PROOF_BYTES = 5 * 1024 * 1024

type QuestionRecord = AiCompetencyQuestion

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

function clampScore(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined
}

function isAdmin(role: SystemRole) {
  return role === 'ROLE_ADMIN'
}

function canViewExecutive(role: SystemRole) {
  return role === 'ROLE_ADMIN' || role === 'ROLE_CEO'
}

function canServeAsReviewer(role: SystemRole) {
  return role !== 'ROLE_MEMBER'
}

function toPrismaJsonValue(value: Prisma.JsonValue): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)
}

function serializeOptions(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

function serializeTags(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : []
}

function getQuestionAnswerText(value: Prisma.JsonValue | null | undefined) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return ''
}

function deterministicShuffle<T>(items: T[], seed: string) {
  const cloned = [...items]
  let state = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1
  const next = () => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const target = Math.floor(next() * (index + 1))
    ;[cloned[index], cloned[target]] = [cloned[target], cloned[index]]
  }
  return cloned
}

export function calculateCertificationStatus(params: {
  secondRoundPassed: boolean
  externalApproved: boolean
}): AiCompetencyCertificationStatus {
  if (params.secondRoundPassed && params.externalApproved) return 'INTERNAL_AND_EXTERNAL'
  if (params.secondRoundPassed) return 'INTERNAL_CERTIFIED'
  if (params.externalApproved) return 'EXTERNAL_RECOGNIZED'
  return 'NOT_CERTIFIED'
}

function validateUpload(params: {
  upload: StoredUpload
  allowedMimeTypes: Set<string>
  maxBytes: number
  label: string
}) {
  if (!params.allowedMimeTypes.has(params.upload.mimeType)) {
    throw new AppError(400, 'INVALID_FILE_TYPE', `${params.label} 파일 형식이 허용되지 않습니다.`)
  }
  if (params.upload.sizeBytes > params.maxBytes) {
    throw new AppError(
      400,
      'FILE_TOO_LARGE',
      `${params.label} 파일은 ${Math.floor(params.maxBytes / 1024 / 1024)}MB 이하만 업로드할 수 있습니다.`
    )
  }
}

function buildQuestionOrder(questions: QuestionRecord[], seed: string, randomize: boolean) {
  const ids = questions.map((question) => question.id)
  return randomize ? deterministicShuffle(ids, seed) : ids
}

function buildBlueprintDefinitionFromRecord(blueprint: {
  id: string
  blueprintName: string
  blueprintVersion: number
  track: AiCompetencyTrack | null
  totalQuestionCount: number
  totalPoints: number
  timeLimitMinutes: number
  passScore: number
  randomizationEnabled: boolean
}) {
  return {
    id: blueprint.id,
    blueprintName: blueprint.blueprintName,
    blueprintVersion: blueprint.blueprintVersion,
    track: blueprint.track,
    totalQuestionCount: blueprint.totalQuestionCount,
    totalPoints: blueprint.totalPoints,
    timeLimitMinutes: blueprint.timeLimitMinutes,
    passScore: blueprint.passScore,
    randomizationEnabled: blueprint.randomizationEnabled,
  } satisfies AiCompetencyBlueprintDefinition & { id: string }
}

function buildBlueprintRowsFromRecord(rows: Array<{
  id: string
  competencyDomain: AiCompetencyDomain
  itemType: AiCompetencyQuestionType
  difficulty: AiCompetencyDifficulty
  requiredQuestionCount: number
  pointsPerQuestion: number
  scope: 'COMMON' | 'TRACK_SPECIFIC'
  requiredTags: Prisma.JsonValue | null
  excludedTags: Prisma.JsonValue | null
  displayOrder: number
}>) {
  return rows.map((row) => ({
    id: row.id,
    competencyDomain: row.competencyDomain,
    itemType: row.itemType,
    difficulty: row.difficulty,
    requiredQuestionCount: row.requiredQuestionCount,
    pointsPerQuestion: row.pointsPerQuestion,
    scope: row.scope,
    requiredTags: serializeTags(row.requiredTags),
    excludedTags: serializeTags(row.excludedTags),
    displayOrder: row.displayOrder,
  })) satisfies AiCompetencyBlueprintRowDefinition[]
}

function buildRubricDefinitionFromRecord(rubric: {
  rubricName: string
  rubricVersion: number
  track: AiCompetencyTrack | null
  totalScore: number
  passScore: number
  bonusScoreIfPassed: number
  certificationLabel: string | null
}) {
  return {
    rubricName: rubric.rubricName,
    rubricVersion: rubric.rubricVersion,
    track: rubric.track,
    totalScore: rubric.totalScore,
    passScore: rubric.passScore,
    bonusScoreIfPassed: rubric.bonusScoreIfPassed,
    certificationLabel: rubric.certificationLabel,
  } satisfies AiCompetencyRubricDefinition
}

function buildRubricCriteriaFromRecord(criteria: Array<{
  id: string
  criterionCode: string
  criterionName: string
  criterionDescription: string | null
  maxScore: number
  displayOrder: number
  mandatory: boolean
  knockout: boolean
  bands: Array<{
    score: number
    title: string
    description: string | null
    guidance: string | null
    displayOrder: number
  }>
}>) {
  return criteria.map((criterion) => ({
    id: criterion.id,
    criterionCode: criterion.criterionCode,
    criterionName: criterion.criterionName,
    criterionDescription: criterion.criterionDescription ?? undefined,
    maxScore: criterion.maxScore,
    displayOrder: criterion.displayOrder,
    mandatory: criterion.mandatory,
    knockout: criterion.knockout,
    bands: criterion.bands.map((band) => ({
      score: band.score,
      title: band.title,
      description: band.description ?? undefined,
      guidance: band.guidance ?? undefined,
      displayOrder: band.displayOrder,
    })),
  })) satisfies AiCompetencyRubricCriterionDefinition[]
}

function mapQuestionToBlueprintQuestion(question: QuestionRecord) {
  return {
    id: question.id,
    competencyDomain: question.competencyDomain,
    questionType: question.questionType,
    difficulty: question.difficulty,
    track: question.track,
    isCommon: question.isCommon,
    isActive: question.isActive,
    maxScore: question.maxScore,
    sortOrder: question.sortOrder,
    tags: serializeTags(question.tags),
  } satisfies AiCompetencyBlueprintQuestion
}

async function ensureDefaultCertificateMasters(orgId: string) {
  const existingCount = await prisma.aiCompetencyExternalCertMaster.count({
    where: { orgId },
  })
  if (existingCount > 0) return
  await prisma.aiCompetencyExternalCertMaster.createMany({
    data: DEFAULT_CERTIFICATE_MASTERS.map((item) => ({
      orgId,
      ...item,
    })),
    skipDuplicates: true,
  })
}

async function loadEmployeeWithOrg(userId: string) {
  return prisma.employee.findUnique({
    where: { id: userId },
    include: {
      department: {
        include: {
          organization: true,
        },
      },
    },
  })
}

async function requireCycleForMutation(cycleId: string) {
  const cycle = await prisma.aiCompetencyCycle.findUnique({
    where: { id: cycleId },
    include: {
      evalCycle: {
        include: {
          organization: true,
        },
      },
    },
  })
  if (!cycle) {
    throw new AppError(404, 'AI_COMPETENCY_CYCLE_NOT_FOUND', 'AI 활용능력 평가 주기를 찾을 수 없습니다.')
  }
  return cycle
}

async function loadActiveBlueprintBundle(params: {
  cycleId: string
  track: AiCompetencyTrack
}) {
  return prisma.aiCompetencyExamBlueprint.findMany({
    where: {
      cycleId: params.cycleId,
      status: 'ACTIVE',
      OR: [{ track: null }, { track: params.track }],
    },
    include: {
      rows: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ track: 'asc' }, { blueprintVersion: 'desc' }, { createdAt: 'asc' }],
  })
}

async function loadActiveRubricForTrack(params: {
  cycleId: string
  track: AiCompetencyTrack
}) {
  const rubrics = await prisma.aiCompetencyReviewRubric.findMany({
    where: {
      cycleId: params.cycleId,
      status: 'ACTIVE',
      OR: [{ track: params.track }, { track: null }],
    },
    include: {
      criteria: {
        include: {
          bands: {
            orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
          },
        },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ track: 'desc' }, { rubricVersion: 'desc' }, { createdAt: 'desc' }],
  })

  return rubrics[0] ?? null
}

async function validatePublishReadiness(cycleId: string) {
  const [assignmentCount, questions, assignmentTracks, blueprints] = await Promise.all([
    prisma.aiCompetencyAssignment.count({ where: { cycleId } }),
    prisma.aiCompetencyQuestion.findMany({
      where: { cycleId, isActive: true },
      select: {
        id: true,
        competencyDomain: true,
        questionType: true,
        difficulty: true,
        track: true,
        isCommon: true,
        isActive: true,
        maxScore: true,
        sortOrder: true,
        tags: true,
      },
    }),
    prisma.aiCompetencyAssignment.findMany({
      where: { cycleId },
      select: { track: true },
      distinct: ['track'],
    }),
    prisma.aiCompetencyExamBlueprint.findMany({
      where: {
        cycleId,
        status: 'ACTIVE',
      },
      include: {
        rows: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    }),
  ])

  if (!assignmentCount) {
    throw new AppError(400, 'AI_COMPETENCY_EMPTY_ASSIGNMENT', '대상자 배정이 없어 주기를 공개할 수 없습니다.')
  }
  if (!questions.length) {
    throw new AppError(400, 'AI_COMPETENCY_EMPTY_QUESTION_BANK', '활성 문항이 없어 주기를 공개할 수 없습니다.')
  }

  if (blueprints.length) {
    for (const assignment of assignmentTracks) {
      const applicableBlueprints = blueprints.filter(
        (blueprint) => blueprint.track === null || blueprint.track === assignment.track
      )

      if (!applicableBlueprints.length) {
        throw new AppError(
          400,
          'AI_COMPETENCY_BLUEPRINT_MISSING',
          `${TRACK_LABELS[assignment.track]} 트랙에 활성 문항 체계표가 없습니다.`
        )
      }

      const totalPoints = applicableBlueprints.reduce((sum, blueprint) => sum + blueprint.totalPoints, 0)
      if (Math.abs(totalPoints - 100) > 0.5) {
        throw new AppError(
          400,
          'AI_COMPETENCY_BLUEPRINT_SCORE_SUM_INVALID',
          `${TRACK_LABELS[assignment.track]} 트랙 활성 체계표 총점이 100점 기준과 일치하지 않습니다.`
        )
      }

      for (const blueprint of applicableBlueprints) {
        const definition = buildBlueprintDefinitionFromRecord(blueprint)
        const rows = buildBlueprintRowsFromRecord(blueprint.rows)
        const validation = validateBlueprintDefinition({
          blueprint: definition,
          rows,
        })
        if (!validation.isValid) {
          throw new AppError(
            400,
            'AI_COMPETENCY_BLUEPRINT_INVALID',
            validation.errors[0] ?? '문항 체계표 검증을 통과하지 못했습니다.'
          )
        }

        const gapAnalysis = analyzeBlueprintQuestionPool({
          blueprint: definition,
          rows,
          questions: questions.map((question) => ({
            ...question,
            tags: serializeTags(question.tags),
          })),
        })
        if (!gapAnalysis.canAssemble) {
          throw new AppError(
            400,
            'AI_COMPETENCY_BLUEPRINT_POOL_SHORTAGE',
            `${TRACK_LABELS[assignment.track]} 트랙 체계표를 충족할 활성 문항 풀이 부족합니다.`
          )
        }
      }
    }
    return
  }

  const totalScore = questions.reduce((sum, question) => sum + question.maxScore, 0)
  if (Math.abs(totalScore - 100) > 0.5) {
    throw new AppError(400, 'AI_COMPETENCY_SCORE_SUM_INVALID', '1차 문항 총점은 100점 기준으로 구성해야 합니다.')
  }
}

function serializeQuestionForEmployee(question: QuestionRecord, savedAnswer?: Prisma.JsonValue | null) {
  return {
    id: question.id,
    title: question.title,
    prompt: question.prompt,
    competencyDomain: question.competencyDomain,
    questionType: question.questionType,
    difficulty: question.difficulty,
    maxScore: question.maxScore,
    options: serializeOptions(question.options),
    requiresManualScoring:
      question.requiresManualScoring ||
      question.questionType === 'SHORT_ANSWER' ||
      question.questionType === 'PRACTICAL',
    savedAnswer: savedAnswer ?? undefined,
  }
}

async function recomputeAttemptScore(
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  attemptId: string
) {
  const attempt = await tx.aiCompetencyAttempt.findUnique({
    where: { id: attemptId },
    include: {
      cycle: true,
      assignment: true,
      answers: {
        include: {
          question: true,
        },
      },
    },
  })
  if (!attempt) return null

  let objectiveScore = 0
  let manualScore = 0
  let pendingManual = false

  for (const answer of attempt.answers) {
    const requiresManual =
      answer.question.questionType === 'SHORT_ANSWER' ||
      answer.question.questionType === 'PRACTICAL' ||
      answer.question.requiresManualScoring
    if (requiresManual) {
      if (typeof answer.manualScore === 'number') {
        manualScore += answer.manualScore
      } else {
        pendingManual = true
      }
      continue
    }
    if (typeof answer.objectiveScore === 'number') {
      objectiveScore += answer.objectiveScore
    }
  }

  const totalScore = roundScore(objectiveScore + manualScore)
  const passStatus = pendingManual
    ? 'MANUAL_REVIEW_REQUIRED'
    : totalScore >= attempt.cycle.firstRoundPassThreshold
      ? 'PASSED'
      : 'FAILED'

  const status = pendingManual ? 'SUBMITTED' : 'SCORED'

  return tx.aiCompetencyAttempt.update({
    where: { id: attemptId },
    data: {
      objectiveScore,
      manualScore,
      totalScore,
      passStatus,
      status,
    },
  })
}

async function recomputeResultForAssignment(
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  assignmentId: string
) {
  const assignment = await tx.aiCompetencyAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      cycle: true,
      attempt: true,
      secondRoundSubmissions: {
        include: {
          reviews: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
      externalCertClaims: {
        where: {
          status: 'APPROVED',
        },
        orderBy: [{ mappedScoreSnapshot: 'desc' }, { submittedAt: 'desc' }],
      },
      result: true,
    },
  })

  if (!assignment) return null

  const latestSubmission = assignment.secondRoundSubmissions[0]
  const approvedClaim = assignment.externalCertClaims.find((claim) => {
    if (!claim.expiresAt) return true
    return claim.expiresAt >= new Date()
  })

  const secondRoundPassed = latestSubmission?.status === 'PASSED'
  const externalApproved = Boolean(approvedClaim)
  const secondRoundBonus = secondRoundPassed
    ? clampScore(latestSubmission?.aggregatedBonus ?? 0, 0, assignment.cycle.secondRoundBonusCap)
    : 0

  const finalScore = calculateAiCompetencyFinalScore({
    firstRoundScore: assignment.attempt?.totalScore,
    externalCertMappedScore: approvedClaim?.mappedScoreSnapshot,
    secondRoundBonus,
    cap: assignment.cycle.scoreCap,
    overrideScore: assignment.result?.overrideScore,
  })
  const certificationStatus = calculateCertificationStatus({
    secondRoundPassed,
    externalApproved,
  })
  const finalGrade = calculateAiCompetencyGrade({
    finalScore,
    secondRoundPassed,
  })

  return tx.aiCompetencyResult.upsert({
    where: { assignmentId },
    create: {
      cycleId: assignment.cycleId,
      evalCycleId: assignment.cycle.evalCycleId,
      employeeId: assignment.employeeId,
      assignmentId: assignment.id,
      externalCertClaimId: approvedClaim?.id,
      firstRoundScore: assignment.attempt?.totalScore,
      secondRoundBonus,
      secondRoundPassed,
      externalCertMappedScore: approvedClaim?.mappedScoreSnapshot,
      finalScore,
      finalGrade,
      certificationStatus,
      syncState:
        assignment.cycle.resultPublishAt && assignment.cycle.resultPublishAt <= new Date() ? 'SYNCED' : 'PENDING',
      syncedAt:
        assignment.cycle.resultPublishAt && assignment.cycle.resultPublishAt <= new Date() ? new Date() : null,
      syncedCompetencyScore:
        assignment.cycle.resultPublishAt && assignment.cycle.resultPublishAt <= new Date() ? finalScore : null,
      publishedAt: assignment.cycle.resultPublishAt,
    },
    update: {
      externalCertClaimId: approvedClaim?.id,
      firstRoundScore: assignment.attempt?.totalScore,
      secondRoundBonus,
      secondRoundPassed,
      externalCertMappedScore: approvedClaim?.mappedScoreSnapshot,
      finalScore,
      finalGrade,
      certificationStatus,
      syncState:
        assignment.cycle.resultPublishAt && assignment.cycle.resultPublishAt <= new Date()
          ? 'SYNCED'
          : assignment.result?.syncState ?? 'PENDING',
      syncedAt:
        assignment.cycle.resultPublishAt && assignment.cycle.resultPublishAt <= new Date()
          ? new Date()
          : assignment.result?.syncedAt ?? null,
      syncedCompetencyScore:
        assignment.cycle.resultPublishAt && assignment.cycle.resultPublishAt <= new Date()
          ? finalScore
          : assignment.result?.syncedCompetencyScore ?? null,
      publishedAt: assignment.cycle.resultPublishAt,
    },
  })
}

async function loadCycleQuestions(params: {
  cycleId: string
  track: AiCompetencyTrack
}) {
  const questions = await prisma.aiCompetencyQuestion.findMany({
    where: {
      cycleId: params.cycleId,
      isActive: true,
      OR: [{ isCommon: true }, { track: params.track }],
    },
    orderBy: [{ isCommon: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  if (!questions.length) {
    throw new AppError(400, 'AI_COMPETENCY_EMPTY_QUESTION_BANK', '해당 트랙에 사용할 문항이 없습니다.')
  }
  return questions
}

export async function getAiCompetencyPageData(params: {
  session: AuthenticatedSession
  cycleId?: string
}): Promise<AiCompetencyPageData> {
  try {
    const employee = await loadEmployeeWithOrg(params.session.user.id)
    if (!employee) {
      return {
        state: 'permission-denied',
        message: '직원 정보를 찾을 수 없습니다.',
        availableCycles: [],
      }
    }

    const [regularEvalCycles, aiCycles] = await Promise.all([
      prisma.evalCycle.findMany({
        where: { orgId: employee.department.orgId },
        include: {
          organization: { select: { name: true } },
          aiCompetencyCycle: { select: { id: true } },
        },
        orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.aiCompetencyCycle.findMany({
        where: {
          evalCycle: {
            orgId: employee.department.orgId,
          },
        },
        include: {
          evalCycle: true,
        },
        orderBy: [{ evalCycle: { evalYear: 'desc' } }, { createdAt: 'desc' }],
      }),
    ])

    const selectedCycle =
      aiCycles.find((cycle) => cycle.id === params.cycleId) ??
      aiCycles[0] ??
      null

    const permissions = {
      canManageCycles: isAdmin(params.session.user.role),
      canManageQuestions: isAdmin(params.session.user.role),
      canManageAssignments: isAdmin(params.session.user.role),
      canManageResults: isAdmin(params.session.user.role),
      canReviewSubmissions: canServeAsReviewer(params.session.user.role),
      canViewExecutive: canViewExecutive(params.session.user.role),
    }

    if (!selectedCycle) {
      if (!isAdmin(params.session.user.role)) {
        return {
          state: 'empty',
          message: '운영 중인 AI 활용능력 평가 주기가 없습니다.',
          currentUser: {
            id: employee.id,
            name: employee.empName,
            role: params.session.user.role,
            department: employee.department.deptName,
          },
          availableCycles: [],
        }
      }

      return {
        state: 'ready',
        currentUser: {
          id: employee.id,
          name: employee.empName,
          role: params.session.user.role,
          department: employee.department.deptName,
        },
        availableCycles: [],
        availableEvalCycles: regularEvalCycles.map((cycle) => ({
          id: cycle.id,
          name: cycle.cycleName,
          year: cycle.evalYear,
          organizationName: cycle.organization.name,
          linkedAiCycleId: cycle.aiCompetencyCycle?.id,
        })),
        permissions,
        adminView: {
          employeeDirectory: [],
          reviewerDirectory: [],
          questionBank: [],
          assignments: [],
          manualScoringQueue: [],
          secondRoundQueue: [],
          blueprints: [],
          blueprintLibrary: [],
          rubrics: [],
          rubricLibrary: [],
          certClaims: [],
          results: [],
        },
      }
    }

    await ensureDefaultCertificateMasters(selectedCycle.evalCycle.orgId)

    const [certMasters, cycleAssignments, cycleQuestions, reviewerQueue, cycleSummary] = await Promise.all([
      prisma.aiCompetencyExternalCertMaster.findMany({
        where: {
          orgId: selectedCycle.evalCycle.orgId,
          isActive: true,
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.aiCompetencyAssignment.findMany({
        where: { cycleId: selectedCycle.id },
        include: {
          employee: {
            include: {
              department: true,
            },
          },
          attempt: {
            include: {
              answers: {
                select: {
                  questionId: true,
                  answerPayload: true,
                },
              },
              generatedSet: true,
            },
          },
          secondRoundSubmissions: {
            include: {
              artifacts: true,
              rubric: {
                include: {
                  criteria: {
                    include: {
                      bands: {
                        orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
                      },
                    },
                    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
                  },
                },
              },
              reviews: {
                include: {
                  reviewer: {
                    select: {
                      id: true,
                      empName: true,
                    },
                  },
                  rubric: {
                    include: {
                      criteria: {
                        include: {
                          bands: {
                            orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
                          },
                        },
                        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
                      },
                    },
                  },
                  scores: true,
                },
              },
            },
          },
          externalCertClaims: {
            include: {
              certificate: true,
            },
            orderBy: [{ createdAt: 'desc' }],
          },
          result: true,
        },
        orderBy: [{ employee: { empName: 'asc' } }],
      }),
      prisma.aiCompetencyQuestion.findMany({
        where: { cycleId: selectedCycle.id },
        orderBy: [{ isActive: 'desc' }, { isCommon: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.aiCompetencySubmissionReview.findMany({
        where: isAdmin(params.session.user.role)
          ? { submission: { cycleId: selectedCycle.id } }
          : { reviewerId: employee.id, submission: { cycleId: selectedCycle.id } },
        include: {
          scores: true,
          rubric: {
            include: {
              criteria: {
                include: {
                  bands: {
                    orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
                  },
                },
                orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
              },
            },
          },
          submission: {
            include: {
              employee: {
                include: {
                  department: true,
                },
              },
              assignment: true,
              artifacts: true,
              rubric: {
                include: {
                  criteria: {
                    include: {
                      bands: {
                        orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
                      },
                    },
                    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
                  },
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      Promise.all([
        prisma.aiCompetencyAssignment.count({ where: { cycleId: selectedCycle.id } }),
        prisma.aiCompetencyAttempt.count({ where: { cycleId: selectedCycle.id, status: { in: ['SUBMITTED', 'SCORED'] } } }),
        prisma.aiCompetencyAttempt.count({ where: { cycleId: selectedCycle.id, passStatus: 'PASSED' } }),
        prisma.aiCompetencySecondRoundSubmission.count({ where: { cycleId: selectedCycle.id } }),
        prisma.aiCompetencyResult.count({
          where: {
            cycleId: selectedCycle.id,
            certificationStatus: {
              in: ['INTERNAL_CERTIFIED', 'EXTERNAL_RECOGNIZED', 'INTERNAL_AND_EXTERNAL'],
            },
          },
        }),
        prisma.aiCompetencyResult.count({ where: { cycleId: selectedCycle.id, syncState: 'SYNCED' } }),
      ]),
    ])

    const [targetCount, completedFirstRoundCount, passedFirstRoundCount, secondRoundSubmissionCount, certificationCount, syncedCount] =
      cycleSummary

    const [cycleBlueprints, blueprintLibrary, cycleRubrics, rubricLibrary] = await Promise.all([
      prisma.aiCompetencyExamBlueprint.findMany({
        where: { cycleId: selectedCycle.id },
        include: {
          rows: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: [{ track: 'asc' }, { status: 'asc' }, { blueprintVersion: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.aiCompetencyExamBlueprint.findMany({
        where: {
          cycle: {
            evalCycle: {
              orgId: employee.department.orgId,
            },
          },
        },
        include: {
          cycle: {
            include: {
              evalCycle: true,
            },
          },
        },
        orderBy: [{ cycle: { evalCycle: { evalYear: 'desc' } } }, { createdAt: 'desc' }],
      }),
      prisma.aiCompetencyReviewRubric.findMany({
        where: { cycleId: selectedCycle.id },
        include: {
          criteria: {
            include: {
              bands: {
                orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
              },
            },
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: [{ track: 'asc' }, { status: 'asc' }, { rubricVersion: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.aiCompetencyReviewRubric.findMany({
        where: {
          cycle: {
            evalCycle: {
              orgId: employee.department.orgId,
            },
          },
        },
        include: {
          cycle: {
            include: {
              evalCycle: true,
            },
          },
        },
        orderBy: [{ cycle: { evalCycle: { evalYear: 'desc' } } }, { createdAt: 'desc' }],
      }),
    ])

    const pageData: AiCompetencyPageData = {
      state: 'ready',
      currentUser: {
        id: employee.id,
        name: employee.empName,
        role: params.session.user.role,
        department: employee.department.deptName,
      },
      availableCycles: aiCycles.map((cycle) => ({
        id: cycle.id,
        name: cycle.cycleName,
        year: cycle.evalCycle.evalYear,
        status: cycle.status,
        evalCycleId: cycle.evalCycleId,
      })),
      availableEvalCycles: regularEvalCycles.map((cycle) => ({
        id: cycle.id,
        name: cycle.cycleName,
        year: cycle.evalYear,
        organizationName: cycle.organization.name,
        linkedAiCycleId: cycle.aiCompetencyCycle?.id,
      })),
      selectedCycleId: selectedCycle.id,
      permissions,
      summary: {
        targetCount,
        completedFirstRoundCount,
        passedFirstRoundCount,
        secondRoundSubmissionCount,
        certificationCount,
        syncedCount,
      },
    }

    const selfAssignment = cycleAssignments.find((assignment) => assignment.employeeId === employee.id)
    const reviewQueue = reviewerQueue.map((review) => ({
      reviewId: review.id,
      submissionId: review.submissionId,
      employeeName: review.submission.employee.empName,
      department: review.submission.employee.department.deptName,
      track: review.submission.assignment.track,
      status: review.submission.status,
      artifactCount: review.submission.artifacts.length,
      artifacts: review.submission.artifacts.map((artifact) => ({
        id: artifact.id,
        fileName: artifact.fileName,
        sizeBytes: artifact.sizeBytes,
      })),
      taskDescription: review.submission.taskDescription,
      submittedAt: review.submission.submittedAt.toISOString(),
      reviewStatus: review.status,
      aggregatedScore: review.submission.aggregatedScore ?? undefined,
      existingDecision: review.decision ?? undefined,
      existingBonus: review.bonusScore ?? undefined,
      existingNote: review.notes ?? undefined,
      existingQnaNote: review.qnaNote ?? undefined,
      existingCriteriaScores: review.scores.map((score) => ({
        criterionId: score.criterionId,
        score: score.score,
        comment: score.comment ?? undefined,
        knockoutTriggered: score.knockoutTriggered,
      })),
      rubric: (review.rubric ?? review.submission.rubric)
        ? {
            rubricId: (review.rubric ?? review.submission.rubric)!.id,
            rubricName: (review.rubric ?? review.submission.rubric)!.rubricName,
            totalScore: (review.rubric ?? review.submission.rubric)!.totalScore,
            passScore: (review.rubric ?? review.submission.rubric)!.passScore,
            bonusScoreIfPassed: (review.rubric ?? review.submission.rubric)!.bonusScoreIfPassed,
            certificationLabel: (review.rubric ?? review.submission.rubric)!.certificationLabel ?? undefined,
            criteria: (review.rubric ?? review.submission.rubric)!.criteria.map((criterion) => ({
              criterionId: criterion.id,
              criterionCode: criterion.criterionCode,
              criterionName: criterion.criterionName,
              criterionDescription: criterion.criterionDescription ?? undefined,
              maxScore: criterion.maxScore,
              mandatory: criterion.mandatory,
              knockout: criterion.knockout,
              bands: criterion.bands.map((band) => ({
                score: band.score,
                title: band.title,
                description: band.description ?? undefined,
                guidance: band.guidance ?? undefined,
              })),
            })),
          }
        : undefined,
    }))

    if (selfAssignment) {
      const activeBlueprintsForTrack = cycleBlueprints.filter(
        (blueprint) =>
          blueprint.status === 'ACTIVE' &&
          (blueprint.track === null || blueprint.track === selfAssignment.track)
      )
      const questionsForTrack = cycleQuestions
        .filter((question) => question.isActive)
        .filter((question) => question.isCommon || question.track === selfAssignment.track)

      const answerMap = new Map(
        selfAssignment.attempt?.answers.map((answer) => [answer.questionId, answer.answerPayload] as const) ?? []
      )
      const orderedQuestions =
        selfAssignment.attempt?.questionOrder && Array.isArray(selfAssignment.attempt.questionOrder)
          ? selfAssignment.attempt.questionOrder
              .map((questionId) => questionsForTrack.find((question) => question.id === questionId))
              .filter((question): question is QuestionRecord => Boolean(question))
          : activeBlueprintsForTrack.length
            ? []
            : questionsForTrack

      const assessmentPlan = activeBlueprintsForTrack.length
        ? {
            totalQuestionCount: activeBlueprintsForTrack.reduce((sum, blueprint) => sum + blueprint.totalQuestionCount, 0),
            totalPoints: activeBlueprintsForTrack.reduce((sum, blueprint) => sum + blueprint.totalPoints, 0),
            timeLimitMinutes: activeBlueprintsForTrack.reduce((sum, blueprint) => sum + blueprint.timeLimitMinutes, 0),
            passScore: activeBlueprintsForTrack.reduce((sum, blueprint) => sum + blueprint.passScore, 0),
            blueprints: activeBlueprintsForTrack.map((blueprint) => ({
              id: blueprint.id,
              blueprintName: blueprint.blueprintName,
              track: blueprint.track ?? undefined,
            })),
          }
        : {
            totalQuestionCount: questionsForTrack.length,
            totalPoints: questionsForTrack.reduce((sum, question) => sum + question.maxScore, 0),
            timeLimitMinutes: selectedCycle.timeLimitMinutes,
            passScore: selectedCycle.firstRoundPassThreshold,
            blueprints: [],
          }

      const latestSubmission = selfAssignment.secondRoundSubmissions[0]
      pageData.employeeView = {
        assignment: {
          id: selfAssignment.id,
          track: selfAssignment.track,
          firstRoundRequired: selfAssignment.firstRoundRequired,
          secondRoundVolunteer: selfAssignment.secondRoundVolunteer,
          policyAcknowledgedAt: toIso(selfAssignment.policyAcknowledgedAt),
        },
        questions: orderedQuestions.map((question) =>
          serializeQuestionForEmployee(question, answerMap.get(question.id))
        ),
        assessmentPlan,
        attempt: selfAssignment.attempt
          ? {
              id: selfAssignment.attempt.id,
              status: selfAssignment.attempt.status,
              startedAt: toIso(selfAssignment.attempt.startedAt),
              dueAt: toIso(selfAssignment.attempt.dueAt),
              submittedAt: toIso(selfAssignment.attempt.submittedAt),
              objectiveScore: selfAssignment.attempt.objectiveScore ?? undefined,
              manualScore: selfAssignment.attempt.manualScore ?? undefined,
              totalScore: selfAssignment.attempt.totalScore ?? undefined,
              passStatus: selfAssignment.attempt.passStatus ?? undefined,
              timeLimitMinutes: selfAssignment.attempt.timeLimitMinutes,
            }
          : undefined,
        secondRound: {
          eligible: canApplyForSecondRound({
            firstRoundScore: selfAssignment.attempt?.totalScore,
            passThreshold: selectedCycle.firstRoundPassThreshold,
            passStatus: selfAssignment.attempt?.passStatus,
          }),
        },
        externalCerts: {
          masters: certMasters.map((master) => ({
            id: master.id,
            name: master.name,
            vendor: master.vendor ?? undefined,
            mappedScore: master.mappedScore,
            validityMonths: master.validityMonths ?? undefined,
            requiresPolicyAcknowledgement: master.requiresPolicyAcknowledgement,
          })),
          claims: selfAssignment.externalCertClaims.map((claim) => ({
            id: claim.id,
            status: claim.status,
            certificateName: claim.certificate.name,
            mappedScoreSnapshot: claim.mappedScoreSnapshot,
            submittedAt: claim.submittedAt.toISOString(),
            decidedAt: toIso(claim.decidedAt),
            rejectionReason: claim.rejectionReason ?? undefined,
            proofFileName: claim.proofFileName,
          })),
        },
        result: selfAssignment.result
          ? {
              id: selfAssignment.result.id,
              firstRoundScore: selfAssignment.result.firstRoundScore ?? undefined,
              secondRoundBonus: selfAssignment.result.secondRoundBonus,
              externalCertMappedScore: selfAssignment.result.externalCertMappedScore ?? undefined,
              finalScore: selfAssignment.result.finalScore,
              finalGrade: selfAssignment.result.finalGrade,
              certificationStatus: selfAssignment.result.certificationStatus,
              syncState: selfAssignment.result.syncState,
              syncedAt: toIso(selfAssignment.result.syncedAt),
              publishedAt: toIso(selfAssignment.result.publishedAt),
            }
          : undefined,
      }

      if (latestSubmission) {
        pageData.employeeView.secondRound.application = {
          id: latestSubmission.id,
          status: latestSubmission.status,
          taskDescription: latestSubmission.taskDescription,
          aiUsagePurpose: latestSubmission.aiUsagePurpose,
          toolUsed: latestSubmission.toolUsed,
          promptSummary: latestSubmission.promptSummary,
          verificationMethod: latestSubmission.verificationMethod,
          businessImpact: latestSubmission.businessImpact,
          sensitiveDataCheck: latestSubmission.sensitiveDataCheck,
          aggregatedScore: latestSubmission.aggregatedScore ?? undefined,
          aggregatedBonus: latestSubmission.aggregatedBonus ?? undefined,
          internalCertificationGranted: latestSubmission.internalCertificationGranted,
          artifacts: latestSubmission.artifacts.map((artifact) => ({
            id: artifact.id,
            fileName: artifact.fileName,
            sizeBytes: artifact.sizeBytes,
          })),
          reviews: latestSubmission.reviews.map((review) => ({
            reviewerId: review.reviewerId,
            reviewerName: review.reviewer.empName,
            decision: review.decision ?? undefined,
            bonusScore: review.bonusScore ?? undefined,
            reviewedAt: toIso(review.reviewedAt),
            notes: review.notes ?? undefined,
            qnaNote: review.qnaNote ?? undefined,
          })),
        }
      }
    } else {
      pageData.employeeView = {
        questions: [],
        secondRound: { eligible: false },
        externalCerts: {
          masters: certMasters.map((master) => ({
            id: master.id,
            name: master.name,
            vendor: master.vendor ?? undefined,
            mappedScore: master.mappedScore,
            validityMonths: master.validityMonths ?? undefined,
            requiresPolicyAcknowledgement: master.requiresPolicyAcknowledgement,
          })),
          claims: [],
        },
      }
    }

    if (canServeAsReviewer(params.session.user.role)) {
      pageData.reviewerView = {
        queue: reviewQueue,
      }
    }

    if (isAdmin(params.session.user.role)) {
      const departments = await prisma.department.findMany({
        where: { orgId: employee.department.orgId },
        select: { id: true },
      })
      const orgEmployees = await prisma.employee.findMany({
        where: {
          deptId: { in: departments.map((department) => department.id) },
        },
        include: {
          department: true,
        },
        orderBy: [{ status: 'asc' }, { empName: 'asc' }],
      })
      const manualScoringQueue = await prisma.aiCompetencyAnswer.findMany({
        where: {
          question: {
            cycleId: selectedCycle.id,
            OR: [{ questionType: 'SHORT_ANSWER' }, { questionType: 'PRACTICAL' }, { requiresManualScoring: true }],
          },
          manualScore: null,
          attempt: {
            status: 'SUBMITTED',
          },
        },
        include: {
          question: true,
          attempt: {
            include: {
              assignment: {
                include: {
                  employee: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      })

      pageData.adminView = {
        cycle: {
          id: selectedCycle.id,
          evalCycleId: selectedCycle.evalCycleId,
          cycleName: selectedCycle.cycleName,
          status: selectedCycle.status,
          firstRoundPassThreshold: selectedCycle.firstRoundPassThreshold,
          secondRoundBonusCap: selectedCycle.secondRoundBonusCap,
          scoreCap: selectedCycle.scoreCap,
          timeLimitMinutes: selectedCycle.timeLimitMinutes,
          randomizeQuestions: selectedCycle.randomizeQuestions,
          companyEmailDomain: selectedCycle.companyEmailDomain ?? undefined,
          firstRoundOpenAt: toIso(selectedCycle.firstRoundOpenAt),
          firstRoundCloseAt: toIso(selectedCycle.firstRoundCloseAt),
          secondRoundApplyOpenAt: toIso(selectedCycle.secondRoundApplyOpenAt),
          secondRoundApplyCloseAt: toIso(selectedCycle.secondRoundApplyCloseAt),
          reviewOpenAt: toIso(selectedCycle.reviewOpenAt),
          reviewCloseAt: toIso(selectedCycle.reviewCloseAt),
          calibrationOpenAt: toIso(selectedCycle.calibrationOpenAt),
          calibrationCloseAt: toIso(selectedCycle.calibrationCloseAt),
          resultPublishAt: toIso(selectedCycle.resultPublishAt),
          artifactMinCount: selectedCycle.artifactMinCount,
          artifactMaxCount: selectedCycle.artifactMaxCount,
          policyAcknowledgementText: selectedCycle.policyAcknowledgementText ?? undefined,
        },
        employeeDirectory: orgEmployees.map((member) => ({
          id: member.id,
          employeeNumber: member.empId,
          name: member.empName,
          email: member.gwsEmail,
          department: member.department.deptName,
          position: member.position,
          role: member.role,
          status: member.status,
        })),
        reviewerDirectory: orgEmployees
          .filter((member) => canServeAsReviewer(member.role))
          .map((member) => ({
            id: member.id,
            name: member.empName,
            department: member.department.deptName,
            position: member.position,
            role: member.role,
          })),
        questionBank: cycleQuestions.map((question) => ({
          id: question.id,
          title: question.title,
          prompt: question.prompt,
          competencyDomain: question.competencyDomain,
          track: question.track ?? undefined,
          questionType: question.questionType,
          difficulty: question.difficulty,
          options: serializeOptions(question.options),
          answerKey: serializeOptions(question.answerKey),
          tags: serializeTags(question.tags),
          explanation: question.explanation ?? undefined,
          maxScore: question.maxScore,
          sortOrder: question.sortOrder,
          isActive: question.isActive,
          isCommon: question.isCommon,
          version: question.version,
          randomizable: question.randomizable,
          requiresManualScoring: question.requiresManualScoring,
        })),
        assignments: cycleAssignments.map((assignment) => ({
          id: assignment.id,
          employeeId: assignment.employeeId,
          employeeNumber: assignment.employee.empId,
          name: assignment.employee.empName,
          department: assignment.employee.department.deptName,
          track: assignment.track,
          firstRoundStatus: assignment.attempt?.status ?? 'NOT_STARTED',
          firstRoundScore: assignment.attempt?.totalScore ?? undefined,
          secondRoundVolunteer: assignment.secondRoundVolunteer,
          secondRoundStatus: assignment.secondRoundSubmissions[0]?.status ?? undefined,
          externalCertStatus: assignment.externalCertClaims[0]?.status ?? undefined,
          finalScore: assignment.result?.finalScore ?? undefined,
          finalGrade: assignment.result?.finalGrade ?? undefined,
          syncState: assignment.result?.syncState ?? undefined,
        })),
        manualScoringQueue: manualScoringQueue.map((row) => ({
          answerId: row.id,
          employeeName: row.attempt.assignment.employee.empName,
          track: row.attempt.assignment.track,
          questionTitle: row.question.title,
          answerText: getQuestionAnswerText(row.answerPayload),
          maxScore: row.question.maxScore,
          attemptId: row.attemptId,
        })),
        secondRoundQueue: cycleAssignments.flatMap((assignment) =>
          assignment.secondRoundSubmissions.map((submission) => ({
            submissionId: submission.id,
            employeeName: assignment.employee.empName,
            department: assignment.employee.department.deptName,
            track: assignment.track,
            status: submission.status,
            artifactCount: submission.artifacts.length,
            reviewerCount: submission.reviews.length,
            submittedAt: submission.submittedAt.toISOString(),
            aggregatedScore: submission.aggregatedScore ?? undefined,
            aggregatedBonus: submission.aggregatedBonus ?? undefined,
          }))
        ),
        blueprints: cycleBlueprints.map((blueprint) => {
          const definition = buildBlueprintDefinitionFromRecord(blueprint)
          const rows = buildBlueprintRowsFromRecord(blueprint.rows)
          const validation = validateBlueprintDefinition({
            blueprint: definition,
            rows,
          })
          const gapAnalysis = analyzeBlueprintQuestionPool({
            blueprint: definition,
            rows,
            questions: cycleQuestions.map((question) => mapQuestionToBlueprintQuestion(question)),
          })

          return {
            id: blueprint.id,
            blueprintName: blueprint.blueprintName,
            blueprintVersion: blueprint.blueprintVersion,
            track: blueprint.track ?? undefined,
            status: blueprint.status,
            totalQuestionCount: blueprint.totalQuestionCount,
            totalPoints: blueprint.totalPoints,
            timeLimitMinutes: blueprint.timeLimitMinutes,
            passScore: blueprint.passScore,
            randomizationEnabled: blueprint.randomizationEnabled,
            notes: blueprint.notes ?? undefined,
            canActivate: validation.isValid && gapAnalysis.canAssemble,
            validationErrors: validation.errors,
            shortageCount: gapAnalysis.shortageCount,
            rows: rows.map((row, index) => ({
              competencyDomain: row.competencyDomain,
              itemType: row.itemType,
              difficulty: row.difficulty,
              scope: row.scope,
              requiredQuestionCount: row.requiredQuestionCount,
              pointsPerQuestion: row.pointsPerQuestion,
              availableQuestionCount: gapAnalysis.rows[index]?.availableQuestionCount ?? 0,
              shortageCount: gapAnalysis.rows[index]?.shortageCount ?? 0,
              requiredTags: row.requiredTags ?? [],
              excludedTags: row.excludedTags ?? [],
              displayOrder: row.displayOrder,
            })),
            exportUrls: {
              csv: `/api/evaluation/ai-competency/blueprints/${blueprint.id}/export?format=csv`,
              xlsx: `/api/evaluation/ai-competency/blueprints/${blueprint.id}/export?format=xlsx`,
            },
          }
        }),
        blueprintLibrary: blueprintLibrary
          .filter((blueprint) => blueprint.cycleId !== selectedCycle.id)
          .map((blueprint) => ({
            id: blueprint.id,
            cycleName: blueprint.cycle.cycleName,
            year: blueprint.cycle.evalCycle.evalYear,
            blueprintName: blueprint.blueprintName,
            blueprintVersion: blueprint.blueprintVersion,
            track: blueprint.track ?? undefined,
          })),
        rubrics: cycleRubrics.map((rubric) => {
          const definition = buildRubricDefinitionFromRecord(rubric)
          const criteria = buildRubricCriteriaFromRecord(rubric.criteria)
          const validation = validateRubricDefinition({
            rubric: definition,
            criteria,
          })
          return {
            id: rubric.id,
            rubricName: rubric.rubricName,
            rubricVersion: rubric.rubricVersion,
            track: rubric.track ?? undefined,
            status: rubric.status,
            totalScore: rubric.totalScore,
            passScore: rubric.passScore,
            bonusScoreIfPassed: rubric.bonusScoreIfPassed,
            certificationLabel: rubric.certificationLabel ?? undefined,
            notes: rubric.notes ?? undefined,
            canActivate: validation.isValid,
            validationErrors: validation.errors,
            criteria: criteria.map((criterion) => ({
              criterionId: criterion.id ?? criterion.criterionCode,
              criterionCode: criterion.criterionCode,
              criterionName: criterion.criterionName,
              criterionDescription: criterion.criterionDescription ?? undefined,
              maxScore: criterion.maxScore,
              mandatory: criterion.mandatory,
              knockout: criterion.knockout,
              displayOrder: criterion.displayOrder,
              bands: criterion.bands.map((band) => ({
                score: band.score,
                title: band.title,
                description: band.description ?? undefined,
                guidance: band.guidance ?? undefined,
              })),
            })),
          }
        }),
        rubricLibrary: rubricLibrary
          .filter((rubric) => rubric.cycleId !== selectedCycle.id)
          .map((rubric) => ({
            id: rubric.id,
            cycleName: rubric.cycle.cycleName,
            year: rubric.cycle.evalCycle.evalYear,
            rubricName: rubric.rubricName,
            rubricVersion: rubric.rubricVersion,
            track: rubric.track ?? undefined,
          })),
        certClaims: cycleAssignments.flatMap((assignment) =>
          assignment.externalCertClaims.map((claim) => ({
            claimId: claim.id,
            employeeName: assignment.employee.empName,
            certificateName: claim.certificate.name,
            status: claim.status,
            mappedScoreSnapshot: claim.mappedScoreSnapshot,
            submittedAt: claim.submittedAt.toISOString(),
            decidedAt: toIso(claim.decidedAt),
            proofFileName: claim.proofFileName,
          }))
        ),
        results: cycleAssignments
          .filter((assignment) => Boolean(assignment.result))
          .map((assignment) => ({
            resultId: assignment.result!.id,
            employeeName: assignment.employee.empName,
            department: assignment.employee.department.deptName,
            track: assignment.track,
            firstRoundScore: assignment.result!.firstRoundScore ?? undefined,
            externalCertMappedScore: assignment.result!.externalCertMappedScore ?? undefined,
            secondRoundBonus: assignment.result!.secondRoundBonus,
            finalScore: assignment.result!.finalScore,
            finalGrade: assignment.result!.finalGrade,
            certificationStatus: assignment.result!.certificationStatus,
            syncState: assignment.result!.syncState,
            syncedAt: toIso(assignment.result!.syncedAt),
            overrideScore: assignment.result!.overrideScore ?? undefined,
          })),
      }
    }

    if (canViewExecutive(params.session.user.role)) {
      const results = cycleAssignments
        .filter((assignment) => Boolean(assignment.result))
        .map((assignment) => ({
          track: assignment.track,
          department: assignment.employee.department.deptName,
          finalScore: assignment.result!.finalScore,
          passStatus: assignment.result!.finalScore >= selectedCycle.firstRoundPassThreshold,
          certificationStatus: assignment.result!.certificationStatus,
        }))

      const trackDistribution = (Object.keys(TRACK_LABELS) as AiCompetencyTrack[]).map((track) => {
        const rows = results.filter((result) => result.track === track)
        return {
          track,
          averageScore: rows.length ? roundScore(rows.reduce((sum, row) => sum + row.finalScore, 0) / rows.length) : 0,
          count: rows.length,
          passRate: rows.length ? roundScore((rows.filter((row) => row.passStatus).length / rows.length) * 100) : 0,
        }
      })

      const departmentMap = new Map<string, number[]>()
      results.forEach((result) => {
        const current = departmentMap.get(result.department) ?? []
        current.push(result.finalScore)
        departmentMap.set(result.department, current)
      })

      pageData.executiveView = {
        completionRate: targetCount ? roundScore((completedFirstRoundCount / targetCount) * 100) : 0,
        passRate: targetCount ? roundScore((passedFirstRoundCount / targetCount) * 100) : 0,
        secondRoundParticipationRate: targetCount ? roundScore((secondRoundSubmissionCount / targetCount) * 100) : 0,
        certificationRate: targetCount ? roundScore((certificationCount / targetCount) * 100) : 0,
        trackDistribution,
        departmentDistribution: [...departmentMap.entries()].map(([department, scores]) => ({
          department,
          averageScore: scores.length ? roundScore(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
          count: scores.length,
        })),
        exportUrls: {
          csv: `/api/evaluation/ai-competency/export/${selectedCycle.id}?format=csv`,
          xlsx: `/api/evaluation/ai-competency/export/${selectedCycle.id}?format=xlsx`,
        },
      }
    }

    return pageData
  } catch (error) {
    console.error('[ai-competency] failed to build page data', error)
    return {
      state: 'error',
      message: 'AI 활용능력 평가 화면을 준비하는 중 오류가 발생했습니다.',
      availableCycles: [],
    }
  }
}

export async function createAiCompetencyCycle(params: {
  actorId: string
  input: {
    evalCycleId: string
    cycleName: string
    firstRoundOpenAt?: Date
    firstRoundCloseAt?: Date
    secondRoundApplyOpenAt?: Date
    secondRoundApplyCloseAt?: Date
    reviewOpenAt?: Date
    reviewCloseAt?: Date
    calibrationOpenAt?: Date
    calibrationCloseAt?: Date
    resultPublishAt?: Date
    firstRoundPassThreshold: number
    secondRoundBonusCap: number
    scoreCap: number
    timeLimitMinutes: number
    randomizeQuestions: boolean
    companyEmailDomain?: string
    artifactMinCount: number
    artifactMaxCount: number
    policyAcknowledgementText?: string
    status?: AiCompetencyCycleStatus
  }
}) {
  const evalCycle = await prisma.evalCycle.findUnique({
    where: { id: params.input.evalCycleId },
  })
  if (!evalCycle) {
    throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '연결할 PMS 평가 주기를 찾을 수 없습니다.')
  }

  await ensureDefaultCertificateMasters(evalCycle.orgId)
  const cycle = await prisma.aiCompetencyCycle.create({
    data: {
      ...params.input,
      status: params.input.status ?? 'DRAFT',
      companyEmailDomain: params.input.companyEmailDomain ?? process.env.ALLOWED_DOMAIN ?? undefined,
      policyAcknowledgementText:
        params.input.policyAcknowledgementText?.trim() || DEFAULT_POLICY_ACKNOWLEDGEMENT,
      createdById: params.actorId,
    },
  })
  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_CYCLE_CREATED',
    entityType: 'AiCompetencyCycle',
    entityId: cycle.id,
    newValue: params.input as unknown as Prisma.JsonObject,
  })
  return cycle
}

export async function updateAiCompetencyCycle(params: {
  actorId: string
  cycleId: string
  input: Partial<{
    cycleName: string
    firstRoundOpenAt: Date | null
    firstRoundCloseAt: Date | null
    secondRoundApplyOpenAt: Date | null
    secondRoundApplyCloseAt: Date | null
    reviewOpenAt: Date | null
    reviewCloseAt: Date | null
    calibrationOpenAt: Date | null
    calibrationCloseAt: Date | null
    resultPublishAt: Date | null
    firstRoundPassThreshold: number
    secondRoundBonusCap: number
    scoreCap: number
    timeLimitMinutes: number
    randomizeQuestions: boolean
    companyEmailDomain: string | null
    artifactMinCount: number
    artifactMaxCount: number
    policyAcknowledgementText: string | null
    status: AiCompetencyCycleStatus
  }>
}) {
  const current = await requireCycleForMutation(params.cycleId)
  if (params.input.status === 'PUBLISHED') {
    await validatePublishReadiness(params.cycleId)
  }

  const updated = await prisma.aiCompetencyCycle.update({
    where: { id: params.cycleId },
    data: {
      ...params.input,
      updatedById: params.actorId,
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_CYCLE_UPDATED',
    entityType: 'AiCompetencyCycle',
    entityId: params.cycleId,
    oldValue: {
      status: current.status,
      cycleName: current.cycleName,
    },
    newValue: params.input as Prisma.JsonObject,
  })
  return updated
}

export async function upsertAiCompetencyQuestion(params: {
  actorId: string
  input: {
    id?: string
    cycleId: string
    track?: AiCompetencyTrack | null
    version: number
    competencyDomain: AiCompetencyDomain
    questionType: AiCompetencyQuestionType
    difficulty: AiCompetencyDifficulty
    title: string
    prompt: string
    options?: string[]
    answerKey?: string[]
    tags?: string[]
    explanation?: string
    maxScore: number
    sortOrder: number
    isCommon: boolean
    isActive: boolean
    randomizable: boolean
    requiresManualScoring: boolean
  }
}) {
  await requireCycleForMutation(params.input.cycleId)
  const payload = {
    cycleId: params.input.cycleId,
    track: params.input.track ?? null,
    version: params.input.version,
    competencyDomain: params.input.competencyDomain,
    questionType: params.input.questionType,
    difficulty: params.input.difficulty,
    title: params.input.title,
    prompt: params.input.prompt,
    options: params.input.options ?? [],
    answerKey: params.input.answerKey ?? [],
    tags: params.input.tags ?? [],
    explanation: params.input.explanation ?? null,
    maxScore: params.input.maxScore,
    sortOrder: params.input.sortOrder,
    isCommon: params.input.isCommon,
    isActive: params.input.isActive,
    randomizable: params.input.randomizable,
    requiresManualScoring:
      params.input.requiresManualScoring ||
      params.input.questionType === 'SHORT_ANSWER' ||
      params.input.questionType === 'PRACTICAL',
  }

  const question = params.input.id
    ? await prisma.aiCompetencyQuestion.update({
        where: { id: params.input.id },
        data: payload,
      })
    : await prisma.aiCompetencyQuestion.create({
        data: payload,
      })

  await createAuditLog({
    userId: params.actorId,
    action: params.input.id ? 'AI_COMPETENCY_QUESTION_UPDATED' : 'AI_COMPETENCY_QUESTION_CREATED',
    entityType: 'AiCompetencyQuestion',
    entityId: question.id,
    newValue: payload as Prisma.JsonObject,
  })
  return question
}

export async function upsertAiCompetencyBlueprint(params: {
  actorId: string
  input: {
    id?: string
    cycleId: string
    blueprintName: string
    blueprintVersion: number
    track?: AiCompetencyTrack | null
    totalQuestionCount: number
    totalPoints: number
    timeLimitMinutes: number
    passScore: number
    randomizationEnabled: boolean
    notes?: string
    rows: AiCompetencyBlueprintRowDefinition[]
  }
}) {
  await requireCycleForMutation(params.input.cycleId)
  const validation = validateBlueprintDefinition({
    blueprint: {
      blueprintName: params.input.blueprintName,
      blueprintVersion: params.input.blueprintVersion,
      track: params.input.track ?? null,
      totalQuestionCount: params.input.totalQuestionCount,
      totalPoints: params.input.totalPoints,
      timeLimitMinutes: params.input.timeLimitMinutes,
      passScore: params.input.passScore,
      randomizationEnabled: params.input.randomizationEnabled,
    },
    rows: params.input.rows,
  })

  if (!validation.isValid) {
    throw new AppError(
      400,
      'AI_COMPETENCY_BLUEPRINT_INVALID',
      validation.errors[0] ?? '문항 체계표 입력값을 다시 확인해 주세요.'
    )
  }

  const blueprint = await prisma.$transaction(async (tx) => {
    const saved = params.input.id
      ? await tx.aiCompetencyExamBlueprint.update({
          where: { id: params.input.id },
          data: {
            blueprintName: params.input.blueprintName,
            blueprintVersion: params.input.blueprintVersion,
            track: params.input.track ?? null,
            totalQuestionCount: params.input.totalQuestionCount,
            totalPoints: params.input.totalPoints,
            timeLimitMinutes: params.input.timeLimitMinutes,
            passScore: params.input.passScore,
            randomizationEnabled: params.input.randomizationEnabled,
            notes: params.input.notes ?? null,
            updatedById: params.actorId,
          },
        })
      : await tx.aiCompetencyExamBlueprint.create({
          data: {
            cycleId: params.input.cycleId,
            blueprintName: params.input.blueprintName,
            blueprintVersion: params.input.blueprintVersion,
            track: params.input.track ?? null,
            totalQuestionCount: params.input.totalQuestionCount,
            totalPoints: params.input.totalPoints,
            timeLimitMinutes: params.input.timeLimitMinutes,
            passScore: params.input.passScore,
            randomizationEnabled: params.input.randomizationEnabled,
            notes: params.input.notes ?? null,
            createdById: params.actorId,
            updatedById: params.actorId,
          },
        })

    await tx.aiCompetencyExamBlueprintRow.deleteMany({
      where: { blueprintId: saved.id },
    })

    await tx.aiCompetencyExamBlueprintRow.createMany({
      data: params.input.rows.map((row) => ({
        blueprintId: saved.id,
        competencyDomain: row.competencyDomain,
        itemType: row.itemType,
        difficulty: row.difficulty,
        scope: row.scope,
        requiredQuestionCount: row.requiredQuestionCount,
        pointsPerQuestion: row.pointsPerQuestion,
        rowPoints: row.requiredQuestionCount * row.pointsPerQuestion,
        requiredTags: row.requiredTags ?? [],
        excludedTags: row.excludedTags ?? [],
        displayOrder: row.displayOrder,
      })),
    })

    return saved
  })

  await createAuditLog({
    userId: params.actorId,
    action: params.input.id ? 'AI_COMPETENCY_BLUEPRINT_UPDATED' : 'AI_COMPETENCY_BLUEPRINT_CREATED',
    entityType: 'AiCompetencyExamBlueprint',
    entityId: blueprint.id,
    newValue: {
      blueprintName: params.input.blueprintName,
      track: params.input.track ?? null,
      rowCount: params.input.rows.length,
    },
  })
  return blueprint
}

export async function activateAiCompetencyBlueprint(params: {
  actorId: string
  blueprintId: string
}) {
  const blueprint = await prisma.aiCompetencyExamBlueprint.findUnique({
    where: { id: params.blueprintId },
    include: {
      rows: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
  if (!blueprint) {
    throw new AppError(404, 'AI_COMPETENCY_BLUEPRINT_NOT_FOUND', '문항 체계표를 찾을 수 없습니다.')
  }

  const questions = await prisma.aiCompetencyQuestion.findMany({
    where: { cycleId: blueprint.cycleId, isActive: true },
  })
  const definition = buildBlueprintDefinitionFromRecord(blueprint)
  const rows = buildBlueprintRowsFromRecord(blueprint.rows)
  const validation = validateBlueprintDefinition({
    blueprint: definition,
    rows,
  })
  if (!validation.isValid) {
    throw new AppError(400, 'AI_COMPETENCY_BLUEPRINT_INVALID', validation.errors[0] ?? '문항 체계표가 유효하지 않습니다.')
  }
  const gapAnalysis = analyzeBlueprintQuestionPool({
    blueprint: definition,
    rows,
    questions: questions.map((question) => mapQuestionToBlueprintQuestion(question)),
  })
  if (!gapAnalysis.canAssemble) {
    throw new AppError(400, 'AI_COMPETENCY_BLUEPRINT_POOL_SHORTAGE', '문항 부족 경고가 있어 체계표를 활성화할 수 없습니다.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.aiCompetencyExamBlueprint.updateMany({
      where: {
        cycleId: blueprint.cycleId,
        track: blueprint.track,
        status: 'ACTIVE',
        id: { not: blueprint.id },
      },
      data: {
        status: 'ARCHIVED',
        updatedById: params.actorId,
      },
    })

    await tx.aiCompetencyExamBlueprint.update({
      where: { id: blueprint.id },
      data: {
        status: 'ACTIVE',
        updatedById: params.actorId,
      },
    })
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_BLUEPRINT_ACTIVATED',
    entityType: 'AiCompetencyExamBlueprint',
    entityId: blueprint.id,
    newValue: {
      track: blueprint.track ?? null,
      shortageCount: gapAnalysis.shortageCount,
    },
  })
}

export async function archiveAiCompetencyBlueprint(params: {
  actorId: string
  blueprintId: string
}) {
  const blueprint = await prisma.aiCompetencyExamBlueprint.update({
    where: { id: params.blueprintId },
    data: {
      status: 'ARCHIVED',
      updatedById: params.actorId,
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_BLUEPRINT_ARCHIVED',
    entityType: 'AiCompetencyExamBlueprint',
    entityId: blueprint.id,
  })
  return blueprint
}

export async function duplicateAiCompetencyBlueprint(params: {
  actorId: string
  sourceBlueprintId: string
  targetCycleId: string
}) {
  await requireCycleForMutation(params.targetCycleId)

  const source = await prisma.aiCompetencyExamBlueprint.findUnique({
    where: { id: params.sourceBlueprintId },
    include: {
      rows: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!source) {
    throw new AppError(404, 'AI_COMPETENCY_BLUEPRINT_NOT_FOUND', '복제할 문항 체계표를 찾을 수 없습니다.')
  }

  const latestVersion = await prisma.aiCompetencyExamBlueprint.findFirst({
    where: {
      cycleId: params.targetCycleId,
      track: source.track,
    },
    orderBy: [{ blueprintVersion: 'desc' }],
    select: { blueprintVersion: true },
  })

  const duplicated = await upsertAiCompetencyBlueprint({
    actorId: params.actorId,
    input: {
      cycleId: params.targetCycleId,
      blueprintName: source.blueprintName,
      blueprintVersion: (latestVersion?.blueprintVersion ?? 0) + 1,
      track: source.track,
      totalQuestionCount: source.totalQuestionCount,
      totalPoints: source.totalPoints,
      timeLimitMinutes: source.timeLimitMinutes,
      passScore: source.passScore,
      randomizationEnabled: source.randomizationEnabled,
      notes: source.notes ?? undefined,
      rows: buildBlueprintRowsFromRecord(source.rows),
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_BLUEPRINT_DUPLICATED',
    entityType: 'AiCompetencyExamBlueprint',
    entityId: duplicated.id,
    newValue: {
      sourceBlueprintId: source.id,
      targetCycleId: params.targetCycleId,
      track: source.track ?? null,
    },
  })

  return duplicated
}

export async function upsertAiCompetencyRubric(params: {
  actorId: string
  input: {
    id?: string
    cycleId: string
    rubricName: string
    rubricVersion: number
    track?: AiCompetencyTrack | null
    totalScore: number
    passScore: number
    bonusScoreIfPassed: number
    certificationLabel?: string
    notes?: string
    criteria: AiCompetencyRubricCriterionDefinition[]
  }
}) {
  await requireCycleForMutation(params.input.cycleId)
  const validation = validateRubricDefinition({
    rubric: {
      rubricName: params.input.rubricName,
      rubricVersion: params.input.rubricVersion,
      track: params.input.track ?? null,
      totalScore: params.input.totalScore,
      passScore: params.input.passScore,
      bonusScoreIfPassed: params.input.bonusScoreIfPassed,
      certificationLabel: params.input.certificationLabel ?? null,
    },
    criteria: params.input.criteria,
  })

  if (!validation.isValid) {
    throw new AppError(400, 'AI_COMPETENCY_RUBRIC_INVALID', validation.errors[0] ?? '루브릭 시트를 다시 확인해 주세요.')
  }

  const rubric = await prisma.$transaction(async (tx) => {
    const saved = params.input.id
      ? await tx.aiCompetencyReviewRubric.update({
          where: { id: params.input.id },
          data: {
            rubricName: params.input.rubricName,
            rubricVersion: params.input.rubricVersion,
            track: params.input.track ?? null,
            totalScore: params.input.totalScore,
            passScore: params.input.passScore,
            bonusScoreIfPassed: params.input.bonusScoreIfPassed,
            certificationLabel: params.input.certificationLabel ?? null,
            notes: params.input.notes ?? null,
            updatedById: params.actorId,
          },
        })
      : await tx.aiCompetencyReviewRubric.create({
          data: {
            cycleId: params.input.cycleId,
            rubricName: params.input.rubricName,
            rubricVersion: params.input.rubricVersion,
            track: params.input.track ?? null,
            totalScore: params.input.totalScore,
            passScore: params.input.passScore,
            bonusScoreIfPassed: params.input.bonusScoreIfPassed,
            certificationLabel: params.input.certificationLabel ?? null,
            notes: params.input.notes ?? null,
            createdById: params.actorId,
            updatedById: params.actorId,
          },
        })

    const existingCriteria = await tx.aiCompetencyReviewRubricCriterion.findMany({
      where: { rubricId: saved.id },
      select: { id: true },
    })
    if (existingCriteria.length) {
      await tx.aiCompetencyReviewRubricBand.deleteMany({
        where: {
          criterionId: { in: existingCriteria.map((criterion) => criterion.id) },
        },
      })
      await tx.aiCompetencyReviewRubricCriterion.deleteMany({
        where: { rubricId: saved.id },
      })
    }

    for (const criterion of params.input.criteria) {
      const createdCriterion = await tx.aiCompetencyReviewRubricCriterion.create({
        data: {
          rubricId: saved.id,
          criterionCode: criterion.criterionCode,
          criterionName: criterion.criterionName,
          criterionDescription: criterion.criterionDescription ?? null,
          maxScore: criterion.maxScore,
          displayOrder: criterion.displayOrder,
          mandatory: criterion.mandatory,
          knockout: criterion.knockout,
        },
      })

      if (criterion.bands.length) {
        await tx.aiCompetencyReviewRubricBand.createMany({
          data: criterion.bands.map((band) => ({
            criterionId: createdCriterion.id,
            score: band.score,
            title: band.title,
            description: band.description ?? null,
            guidance: band.guidance ?? null,
            displayOrder: band.displayOrder,
          })),
        })
      }
    }

    return saved
  })

  await createAuditLog({
    userId: params.actorId,
    action: params.input.id ? 'AI_COMPETENCY_RUBRIC_UPDATED' : 'AI_COMPETENCY_RUBRIC_CREATED',
    entityType: 'AiCompetencyReviewRubric',
    entityId: rubric.id,
    newValue: {
      rubricName: params.input.rubricName,
      track: params.input.track ?? null,
      criterionCount: params.input.criteria.length,
    },
  })
  return rubric
}

export async function activateAiCompetencyRubric(params: {
  actorId: string
  rubricId: string
}) {
  const rubric = await prisma.aiCompetencyReviewRubric.findUnique({
    where: { id: params.rubricId },
    include: {
      criteria: {
        include: {
          bands: true,
        },
      },
    },
  })
  if (!rubric) {
    throw new AppError(404, 'AI_COMPETENCY_RUBRIC_NOT_FOUND', '루브릭 시트를 찾을 수 없습니다.')
  }

  const validation = validateRubricDefinition({
    rubric: buildRubricDefinitionFromRecord(rubric),
    criteria: buildRubricCriteriaFromRecord(rubric.criteria),
  })
  if (!validation.isValid) {
    throw new AppError(400, 'AI_COMPETENCY_RUBRIC_INVALID', validation.errors[0] ?? '루브릭 시트가 유효하지 않습니다.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.aiCompetencyReviewRubric.updateMany({
      where: {
        cycleId: rubric.cycleId,
        track: rubric.track,
        status: 'ACTIVE',
        id: { not: rubric.id },
      },
      data: {
        status: 'ARCHIVED',
        updatedById: params.actorId,
      },
    })
    await tx.aiCompetencyReviewRubric.update({
      where: { id: rubric.id },
      data: {
        status: 'ACTIVE',
        updatedById: params.actorId,
      },
    })
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_RUBRIC_ACTIVATED',
    entityType: 'AiCompetencyReviewRubric',
    entityId: rubric.id,
    newValue: {
      track: rubric.track ?? null,
      totalScore: rubric.totalScore,
      passScore: rubric.passScore,
    },
  })
}

export async function archiveAiCompetencyRubric(params: {
  actorId: string
  rubricId: string
}) {
  const rubric = await prisma.aiCompetencyReviewRubric.update({
    where: { id: params.rubricId },
    data: {
      status: 'ARCHIVED',
      updatedById: params.actorId,
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_RUBRIC_ARCHIVED',
    entityType: 'AiCompetencyReviewRubric',
    entityId: rubric.id,
  })
  return rubric
}

export async function duplicateAiCompetencyRubric(params: {
  actorId: string
  sourceRubricId: string
  targetCycleId: string
}) {
  await requireCycleForMutation(params.targetCycleId)

  const source = await prisma.aiCompetencyReviewRubric.findUnique({
    where: { id: params.sourceRubricId },
    include: {
      criteria: {
        include: {
          bands: {
            orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
          },
        },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!source) {
    throw new AppError(404, 'AI_COMPETENCY_RUBRIC_NOT_FOUND', '복제할 루브릭 시트를 찾을 수 없습니다.')
  }

  const latestVersion = await prisma.aiCompetencyReviewRubric.findFirst({
    where: {
      cycleId: params.targetCycleId,
      track: source.track,
    },
    orderBy: [{ rubricVersion: 'desc' }],
    select: { rubricVersion: true },
  })

  const duplicated = await upsertAiCompetencyRubric({
    actorId: params.actorId,
    input: {
      cycleId: params.targetCycleId,
      rubricName: source.rubricName,
      rubricVersion: (latestVersion?.rubricVersion ?? 0) + 1,
      track: source.track,
      totalScore: source.totalScore,
      passScore: source.passScore,
      bonusScoreIfPassed: source.bonusScoreIfPassed,
      certificationLabel: source.certificationLabel ?? undefined,
      notes: source.notes ?? undefined,
      criteria: buildRubricCriteriaFromRecord(source.criteria),
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_RUBRIC_DUPLICATED',
    entityType: 'AiCompetencyReviewRubric',
    entityId: duplicated.id,
    newValue: {
      sourceRubricId: source.id,
      targetCycleId: params.targetCycleId,
      track: source.track ?? null,
    },
  })

  return duplicated
}

export async function upsertAiCompetencyAssignment(params: {
  actorId: string
  input: {
    cycleId: string
    employeeId: string
    track: AiCompetencyTrack
    firstRoundRequired: boolean
    secondRoundVolunteer: boolean
    notes?: string
  }
}) {
  const cycle = await requireCycleForMutation(params.input.cycleId)
  const employee = await prisma.employee.findUnique({
    where: { id: params.input.employeeId },
    include: {
      department: true,
    },
  })
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '대상 직원을 찾을 수 없습니다.')
  }
  if (employee.status === 'RESIGNED') {
    throw new AppError(400, 'EMPLOYEE_RESIGNED', '퇴사자는 대상자로 배정할 수 없습니다.')
  }
  if (employee.department.orgId !== cycle.evalCycle.orgId) {
    throw new AppError(400, 'ORG_SCOPE_MISMATCH', '선택한 직원은 주기와 같은 조직에 속하지 않습니다.')
  }

  const assignment = await prisma.aiCompetencyAssignment.upsert({
    where: {
      cycleId_employeeId: {
        cycleId: params.input.cycleId,
        employeeId: params.input.employeeId,
      },
    },
    create: {
      ...params.input,
      assignedById: params.actorId,
    },
    update: {
      track: params.input.track,
      firstRoundRequired: params.input.firstRoundRequired,
      secondRoundVolunteer: params.input.secondRoundVolunteer,
      notes: params.input.notes ?? null,
      assignedById: params.actorId,
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_ASSIGNMENT_UPSERTED',
    entityType: 'AiCompetencyAssignment',
    entityId: assignment.id,
    newValue: params.input as Prisma.JsonObject,
  })
  return assignment
}

export async function startAiCompetencyAttempt(params: {
  session: AuthenticatedSession
  assignmentId: string
}) {
  const assignment = await prisma.aiCompetencyAssignment.findUnique({
    where: { id: params.assignmentId },
    include: {
      cycle: true,
      attempt: true,
    },
  })
  if (!assignment) {
    throw new AppError(404, 'AI_COMPETENCY_ASSIGNMENT_NOT_FOUND', '배정 정보를 찾을 수 없습니다.')
  }
  if (assignment.employeeId !== params.session.user.id && !isAdmin(params.session.user.role)) {
    throw new AppError(403, 'FORBIDDEN', '본인 응시 정보만 열 수 있습니다.')
  }
  if (assignment.cycle.status !== 'PUBLISHED' && !isAdmin(params.session.user.role)) {
    throw new AppError(400, 'AI_COMPETENCY_CYCLE_NOT_PUBLISHED', '공개된 주기만 응시할 수 있습니다.')
  }

  const now = new Date()
  if (
    !isAdmin(params.session.user.role) &&
    ((assignment.cycle.firstRoundOpenAt && assignment.cycle.firstRoundOpenAt > now) ||
      (assignment.cycle.firstRoundCloseAt && assignment.cycle.firstRoundCloseAt < now))
  ) {
    throw new AppError(400, 'AI_COMPETENCY_FIRST_ROUND_CLOSED', '1차 공통평가 응시 기간이 아닙니다.')
  }

  if (assignment.attempt) {
    return assignment.attempt
  }

  const [questions, activeBlueprints] = await Promise.all([
    loadCycleQuestions({
      cycleId: assignment.cycleId,
      track: assignment.track,
    }),
    loadActiveBlueprintBundle({
      cycleId: assignment.cycleId,
      track: assignment.track,
    }),
  ])

  const activeQuestions = questions.filter((question) => question.isActive)
  let questionOrder = buildQuestionOrder(
    activeQuestions,
    assignment.id,
    assignment.cycle.randomizeQuestions
  )
  let timeLimitMinutes = assignment.cycle.timeLimitMinutes
  let blueprintSnapshot: Prisma.JsonValue | null = null

  if (activeBlueprints.length) {
    try {
      const assembled = assembleExamFromBlueprint({
        blueprints: activeBlueprints.map((blueprint) => ({
          blueprint: buildBlueprintDefinitionFromRecord(blueprint),
          rows: buildBlueprintRowsFromRecord(blueprint.rows),
        })),
        questions: activeQuestions.map((question) => mapQuestionToBlueprintQuestion(question)),
        seed: assignment.id,
      })
      questionOrder = assembled.questionIds
      timeLimitMinutes =
        activeBlueprints.reduce((sum, blueprint) => sum + blueprint.timeLimitMinutes, 0) ||
        assignment.cycle.timeLimitMinutes
      blueprintSnapshot = assembled.blueprintSnapshot as Prisma.JsonValue
    } catch (error) {
      throw new AppError(
        400,
        'AI_COMPETENCY_BLUEPRINT_ASSEMBLY_FAILED',
        error instanceof Error ? error.message : '문항 체계표 기준 시험지를 생성하지 못했습니다.'
      )
    }
  }

  const attempt = await prisma.$transaction(async (tx) => {
    const created = await tx.aiCompetencyAttempt.create({
      data: {
        cycleId: assignment.cycleId,
        assignmentId: assignment.id,
        employeeId: assignment.employeeId,
        status: 'IN_PROGRESS',
        startedAt: now,
        lastSavedAt: now,
        dueAt: new Date(now.getTime() + timeLimitMinutes * 60 * 1000),
        timeLimitMinutes,
        questionOrder,
      },
    })

    if (blueprintSnapshot) {
      await tx.aiCompetencyGeneratedExamSet.create({
        data: {
          cycleId: assignment.cycleId,
          assignmentId: assignment.id,
          attemptId: created.id,
          employeeId: assignment.employeeId,
          blueprintSnapshot: blueprintSnapshot as Prisma.InputJsonValue,
          questionSet: questionOrder as Prisma.InputJsonValue,
        },
      })
    }

    return created
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: 'AI_COMPETENCY_ATTEMPT_STARTED',
    entityType: 'AiCompetencyAttempt',
    entityId: attempt.id,
    newValue: {
      assignmentId: assignment.id,
      questionCount: questionOrder.length,
      blueprintCount: activeBlueprints.length,
    },
  })
  if (activeBlueprints.length) {
    await createAuditLog({
      userId: params.session.user.id,
      action: 'AI_COMPETENCY_EXAM_GENERATED',
      entityType: 'AiCompetencyAttempt',
      entityId: attempt.id,
      newValue: {
        assignmentId: assignment.id,
        questionCount: questionOrder.length,
        blueprintCount: activeBlueprints.length,
      },
    })
  }
  return attempt
}

export async function saveAiCompetencyAttempt(params: {
  session: AuthenticatedSession
  attemptId: string
  answers: Array<{
    questionId: string
    answer: Prisma.JsonValue
  }>
  submit: boolean
}) {
  const attempt = await prisma.aiCompetencyAttempt.findUnique({
    where: { id: params.attemptId },
    include: {
      cycle: true,
      assignment: true,
    },
  })
  if (!attempt) {
    throw new AppError(404, 'AI_COMPETENCY_ATTEMPT_NOT_FOUND', '응시 정보를 찾을 수 없습니다.')
  }
  if (attempt.employeeId !== params.session.user.id && !isAdmin(params.session.user.role)) {
    throw new AppError(403, 'FORBIDDEN', '본인 응시 정보만 저장할 수 있습니다.')
  }
  if (attempt.status === 'SCORED') {
    throw new AppError(400, 'AI_COMPETENCY_ATTEMPT_LOCKED', '이미 채점이 완료된 응시입니다.')
  }
  if (attempt.dueAt && attempt.dueAt < new Date() && !isAdmin(params.session.user.role)) {
    throw new AppError(400, 'AI_COMPETENCY_TIME_LIMIT_EXCEEDED', '응시 제한 시간이 지났습니다.')
  }

  const questions = await loadCycleQuestions({
    cycleId: attempt.cycleId,
    track: attempt.assignment.track,
  })
  const questionMap = new Map(questions.map((question) => [question.id, question]))

  if (params.submit) {
    const answeredIds = new Set(
      params.answers
        .filter(
          (row) =>
            row.answer !== null &&
            row.answer !== undefined &&
            !(typeof row.answer === 'string' && !row.answer.trim()) &&
            !(Array.isArray(row.answer) && row.answer.length === 0)
        )
        .map((row) => row.questionId)
    )
    const missingRequired = questions.some((question) => !answeredIds.has(question.id))
    if (missingRequired) {
      throw new AppError(400, 'AI_COMPETENCY_REQUIRED_ANSWER_MISSING', '모든 문항에 응답한 뒤 제출해 주세요.')
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of params.answers) {
      const question = questionMap.get(row.questionId)
      if (!question) continue
      const scored = scoreObjectiveQuestion({
        questionType: question.questionType,
        answerKey: question.answerKey,
        answerPayload: row.answer,
        maxScore: question.maxScore,
      })
      await tx.aiCompetencyAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: params.attemptId,
            questionId: row.questionId,
          },
        },
        create: {
          attemptId: params.attemptId,
          questionId: row.questionId,
          answerPayload: toPrismaJsonValue(row.answer),
          isCorrect: scored.isCorrect ?? undefined,
          objectiveScore: typeof scored.score === 'number' ? scored.score : null,
          finalScore: typeof scored.score === 'number' ? scored.score : null,
        },
        update: {
          answerPayload: toPrismaJsonValue(row.answer),
          isCorrect: scored.isCorrect ?? undefined,
          objectiveScore: typeof scored.score === 'number' ? scored.score : null,
          finalScore:
            typeof scored.score === 'number'
              ? scored.score
              : question.questionType === 'SHORT_ANSWER' ||
                question.questionType === 'PRACTICAL' ||
                question.requiresManualScoring
                ? null
                : undefined,
        },
      })
    }

    await tx.aiCompetencyAttempt.update({
      where: { id: params.attemptId },
      data: {
        status: params.submit ? 'SUBMITTED' : 'IN_PROGRESS',
        lastSavedAt: new Date(),
        submittedAt: params.submit ? new Date() : undefined,
      },
    })

    if (params.submit) {
      await recomputeAttemptScore(tx, params.attemptId)
      await recomputeResultForAssignment(tx, attempt.assignmentId)
    }
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: params.submit ? 'AI_COMPETENCY_ATTEMPT_SUBMITTED' : 'AI_COMPETENCY_ATTEMPT_SAVED',
    entityType: 'AiCompetencyAttempt',
    entityId: params.attemptId,
    newValue: {
      answerCount: params.answers.length,
    },
  })

  return prisma.aiCompetencyAttempt.findUnique({
    where: { id: params.attemptId },
    include: {
      answers: true,
    },
  })
}

export async function scoreAiCompetencyShortAnswer(params: {
  actorId: string
  answerId: string
  manualScore: number
  reviewerNote?: string
}) {
  const answer = await prisma.aiCompetencyAnswer.findUnique({
    where: { id: params.answerId },
    include: {
      question: true,
      attempt: true,
    },
  })
  if (!answer) {
    throw new AppError(404, 'AI_COMPETENCY_ANSWER_NOT_FOUND', '채점할 답변을 찾을 수 없습니다.')
  }
  if (
    !(
      answer.question.questionType === 'SHORT_ANSWER' ||
      answer.question.questionType === 'PRACTICAL' ||
      answer.question.requiresManualScoring
    )
  ) {
    throw new AppError(400, 'AI_COMPETENCY_NOT_MANUAL_SCORE_TARGET', '수기 채점 대상 문항이 아닙니다.')
  }
  if (params.manualScore < 0 || params.manualScore > answer.question.maxScore) {
    throw new AppError(400, 'AI_COMPETENCY_MANUAL_SCORE_INVALID', '문항 최대 점수 범위 안에서 점수를 입력해 주세요.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.aiCompetencyAnswer.update({
      where: { id: params.answerId },
      data: {
        manualScore: params.manualScore,
        finalScore: params.manualScore,
        reviewerId: params.actorId,
        reviewerNote: params.reviewerNote ?? null,
        scoredAt: new Date(),
      },
    })
    await recomputeAttemptScore(tx, answer.attemptId)
    await recomputeResultForAssignment(tx, answer.attempt.assignmentId)
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_SHORT_ANSWER_SCORED',
    entityType: 'AiCompetencyAnswer',
    entityId: params.answerId,
    newValue: {
      manualScore: params.manualScore,
      reviewerNote: params.reviewerNote,
    },
  })
}

export async function submitAiCompetencySecondRound(params: {
  session: AuthenticatedSession
  input: {
    assignmentId: string
    taskDescription: string
    aiUsagePurpose: string
    toolUsed: string
    promptSummary: string
    verificationMethod: string
    businessImpact: string
    sensitiveDataCheck: string
  }
  artifacts: StoredUpload[]
}) {
  const assignment = await prisma.aiCompetencyAssignment.findUnique({
    where: { id: params.input.assignmentId },
    include: {
      cycle: true,
      attempt: true,
      secondRoundSubmissions: {
        take: 1,
      },
    },
  })
  if (!assignment) {
    throw new AppError(404, 'AI_COMPETENCY_ASSIGNMENT_NOT_FOUND', '대상자 배정 정보를 찾을 수 없습니다.')
  }
  if (assignment.employeeId !== params.session.user.id && !isAdmin(params.session.user.role)) {
    throw new AppError(403, 'FORBIDDEN', '본인 2차 신청만 제출할 수 있습니다.')
  }
  if (!assignment.secondRoundVolunteer) {
    throw new AppError(400, 'AI_COMPETENCY_SECOND_ROUND_NOT_ENABLED', '해당 대상자는 2차 실무인증 신청 대상이 아닙니다.')
  }
  if (
    !canApplyForSecondRound({
      firstRoundScore: assignment.attempt?.totalScore,
      passThreshold: assignment.cycle.firstRoundPassThreshold,
      passStatus: assignment.attempt?.passStatus,
    })
  ) {
    throw new AppError(400, 'AI_COMPETENCY_SECOND_ROUND_NOT_ELIGIBLE', '1차 합격자만 2차 실무인증에 신청할 수 있습니다.')
  }
  if (assignment.secondRoundSubmissions[0] && assignment.secondRoundSubmissions[0].status !== 'REVISE_REQUESTED') {
    throw new AppError(409, 'AI_COMPETENCY_SECOND_ROUND_ALREADY_EXISTS', '이미 제출된 2차 실무인증 신청이 있습니다.')
  }
  if (params.artifacts.length < assignment.cycle.artifactMinCount || params.artifacts.length > assignment.cycle.artifactMaxCount) {
    throw new AppError(
      400,
      'AI_COMPETENCY_ARTIFACT_COUNT_INVALID',
      `실무 산출물은 ${assignment.cycle.artifactMinCount}개 이상 ${assignment.cycle.artifactMaxCount}개 이하로 제출해야 합니다.`
    )
  }
  params.artifacts.forEach((artifact) =>
    validateUpload({
      upload: artifact,
      allowedMimeTypes: ARTIFACT_ALLOWED_MIME_TYPES,
      maxBytes: MAX_ARTIFACT_BYTES,
      label: '실무 산출물',
    })
  )

  const activeRubric = await loadActiveRubricForTrack({
    cycleId: assignment.cycleId,
    track: assignment.track,
  })

  const submission = await prisma.$transaction(async (tx) => {
    let saved = assignment.secondRoundSubmissions[0]
    if (saved) {
      saved = await tx.aiCompetencySecondRoundSubmission.update({
        where: { id: saved.id },
        data: {
          ...params.input,
          rubricId: activeRubric?.id ?? null,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          aggregatedScore: null,
          aggregatedBonus: null,
          reviewerSummary: null,
          internalCertificationGranted: false,
          finalDecisionById: null,
          finalDecisionNote: null,
          decidedAt: null,
        },
      })
      await tx.aiCompetencySecondRoundArtifact.deleteMany({
        where: { submissionId: saved.id },
      })
      await tx.aiCompetencySubmissionReview.deleteMany({
        where: { submissionId: saved.id },
      })
    } else {
      saved = await tx.aiCompetencySecondRoundSubmission.create({
        data: {
          ...params.input,
          cycleId: assignment.cycleId,
          assignmentId: assignment.id,
          employeeId: assignment.employeeId,
          rubricId: activeRubric?.id ?? null,
        },
      })
    }

    if (params.artifacts.length) {
      await tx.aiCompetencySecondRoundArtifact.createMany({
        data: params.artifacts.map((artifact) => ({
          submissionId: saved.id,
          fileName: artifact.fileName,
          mimeType: artifact.mimeType,
          sizeBytes: artifact.sizeBytes,
          content: artifact.buffer,
        })),
      })
    }

    await recomputeResultForAssignment(tx, assignment.id)
    return saved
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: 'AI_COMPETENCY_SECOND_ROUND_SUBMITTED',
    entityType: 'AiCompetencySecondRoundSubmission',
    entityId: submission.id,
    newValue: {
      artifactCount: params.artifacts.length,
    },
  })
  return submission
}

export async function assignAiCompetencyReviewers(params: {
  actorId: string
  submissionId: string
  reviewerIds: string[]
}) {
  const submission = await prisma.aiCompetencySecondRoundSubmission.findUnique({
    where: { id: params.submissionId },
    include: {
      assignment: true,
    },
  })
  if (!submission) {
    throw new AppError(404, 'AI_COMPETENCY_SUBMISSION_NOT_FOUND', '2차 신청 정보를 찾을 수 없습니다.')
  }
  if (!params.reviewerIds.length) {
    throw new AppError(400, 'AI_COMPETENCY_REVIEWER_REQUIRED', '최소 1명의 리뷰어를 지정해 주세요.')
  }
  const reviewers = await prisma.employee.findMany({
    where: {
      id: { in: params.reviewerIds },
      status: 'ACTIVE',
    },
  })
  const activeRubric =
    submission.rubricId
      ? await prisma.aiCompetencyReviewRubric.findUnique({
          where: { id: submission.rubricId },
        })
      : await loadActiveRubricForTrack({
          cycleId: submission.cycleId,
          track: submission.assignment.track,
        })
  if (reviewers.length !== params.reviewerIds.length) {
    throw new AppError(400, 'AI_COMPETENCY_REVIEWER_INVALID', '활성 상태가 아닌 리뷰어가 포함되어 있습니다.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.aiCompetencySubmissionReview.deleteMany({
      where: {
        submissionId: params.submissionId,
      },
    })
    await tx.aiCompetencySubmissionReview.createMany({
      data: params.reviewerIds.map((reviewerId) => ({
        submissionId: params.submissionId,
        reviewerId,
        rubricId: activeRubric?.id ?? null,
        status: 'ASSIGNED',
      })),
      skipDuplicates: true,
    })
    await tx.aiCompetencySecondRoundSubmission.update({
      where: { id: params.submissionId },
      data: {
        rubricId: activeRubric?.id ?? null,
        status: 'UNDER_REVIEW',
      },
    })
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_REVIEWERS_ASSIGNED',
    entityType: 'AiCompetencySecondRoundSubmission',
    entityId: params.submissionId,
    newValue: {
      reviewerIds: params.reviewerIds,
    },
  })
}

export async function reviewAiCompetencySubmission(params: {
  session: AuthenticatedSession
  submissionId: string
  input: {
    criterionScores: AiCompetencyReviewCriterionInput[]
    decision?: AiCompetencyReviewDecision
    notes?: string
    qnaNote?: string
    submitFinal: boolean
  }
}) {
  const review = await prisma.aiCompetencySubmissionReview.findFirst({
    where: {
      submissionId: params.submissionId,
      reviewerId: params.session.user.id,
    },
    include: {
      scores: true,
      rubric: {
        include: {
          criteria: {
            include: {
              bands: {
                orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
              },
            },
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
      submission: {
        include: {
          assignment: true,
          reviews: true,
          cycle: true,
          rubric: {
            include: {
              criteria: {
                include: {
                  bands: {
                    orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
                  },
                },
                orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
              },
            },
          },
        },
      },
    },
  })
  if (!review && !isAdmin(params.session.user.role)) {
    throw new AppError(403, 'FORBIDDEN', '배정된 리뷰어만 심사할 수 있습니다.')
  }

  const activeReview =
    review ??
    (await prisma.aiCompetencySubmissionReview.create({
      data: {
        submissionId: params.submissionId,
        reviewerId: params.session.user.id,
        rubricId: null,
        status: 'ASSIGNED',
      },
      include: {
        scores: true,
        rubric: {
          include: {
            criteria: {
              include: {
                bands: {
                  orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
                },
              },
              orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
        submission: {
          include: {
            assignment: true,
            reviews: true,
            cycle: true,
            rubric: {
              include: {
                criteria: {
                  include: {
                    bands: {
                      orderBy: [{ displayOrder: 'asc' }, { score: 'desc' }],
                    },
                  },
                  orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
          },
        },
      },
    }))

  if (!params.input.submitFinal && activeReview.status === 'SUBMITTED') {
    throw new AppError(
      400,
      'AI_COMPETENCY_REVIEW_ALREADY_SUBMITTED',
      '이미 최종 제출된 심사입니다. 점수를 수정하려면 다시 최종 제출해 주세요.'
    )
  }

  const activeRubric =
    activeReview.rubric ??
    activeReview.submission.rubric ??
    (await loadActiveRubricForTrack({
      cycleId: activeReview.submission.cycleId,
      track: activeReview.submission.assignment.track,
    }))

  if (!activeRubric) {
    throw new AppError(400, 'AI_COMPETENCY_RUBRIC_NOT_FOUND', '활성 루브릭 시트가 없어 심사를 진행할 수 없습니다.')
  }

  const rubricDefinition = buildRubricDefinitionFromRecord(activeRubric)
  const rubricCriteria = buildRubricCriteriaFromRecord(activeRubric.criteria)
  const calculated = calculateRubricReview({
    rubric: rubricDefinition,
    criteria: rubricCriteria,
    criterionScores: params.input.criterionScores,
    decision: params.input.decision,
    submitFinal: params.input.submitFinal,
  })

  if (!calculated.isValid) {
    throw new AppError(
      400,
      'AI_COMPETENCY_REVIEW_INVALID',
      calculated.errors[0] ?? '루브릭 심사 입력값을 다시 확인해 주세요.'
    )
  }

  const rubricPayload = {
    rubricId: activeRubric.id,
    rubricName: activeRubric.rubricName,
    totalScore: calculated.totalScore,
    decision: calculated.decision,
    criteria: params.input.criterionScores,
  } satisfies Prisma.JsonObject

  await prisma.$transaction(async (tx) => {
    await tx.aiCompetencySubmissionReviewScore.deleteMany({
      where: { reviewId: activeReview.id },
    })
    if (params.input.criterionScores.length) {
      await tx.aiCompetencySubmissionReviewScore.createMany({
        data: params.input.criterionScores.map((score) => ({
          reviewId: activeReview.id,
          criterionId: score.criterionId,
          score: score.score,
          comment: score.comment ?? null,
          knockoutTriggered: score.knockoutTriggered ?? false,
        })),
      })
    }

    await tx.aiCompetencySubmissionReview.update({
      where: { id: activeReview.id },
      data: {
          rubricId: activeRubric.id,
          status: params.input.submitFinal ? 'SUBMITTED' : 'DRAFT',
          rubricPayload: toPrismaJsonValue(rubricPayload),
          score: calculated.totalScore,
          bonusScore: calculated.bonusScore,
          decision: params.input.submitFinal ? calculated.decision : null,
        notes: params.input.notes ?? null,
        qnaNote: params.input.qnaNote ?? null,
        reviewedAt: params.input.submitFinal ? new Date() : null,
      },
    })

    const reviews = await tx.aiCompetencySubmissionReview.findMany({
      where: { submissionId: params.submissionId },
    })

    const submittedReviews = reviews.filter((item) => item.status === 'SUBMITTED')
    let submissionStatus: AiCompetencySecondRoundStatus = 'UNDER_REVIEW'
    let aggregatedScore = null as number | null
    let aggregatedBonus = null as number | null
    let reviewerSummary = null as string | null
    let internalCertificationGranted = false

    if (submittedReviews.some((item) => item.decision === 'REVISE')) {
      submissionStatus = 'REVISE_REQUESTED'
    } else if (submittedReviews.length && submittedReviews.every((item) => item.decision === 'PASS')) {
      submissionStatus = 'PASSED'
      aggregatedScore = roundScore(
        submittedReviews.reduce((sum, item) => sum + (item.score ?? 0), 0) / submittedReviews.length
      )
      aggregatedBonus = roundScore(
        submittedReviews.reduce((sum, item) => sum + (item.bonusScore ?? 0), 0) / submittedReviews.length
      )
      internalCertificationGranted = true
    } else if (submittedReviews.some((item) => item.decision === 'FAIL')) {
      submissionStatus = 'FAILED'
      aggregatedScore = roundScore(
        submittedReviews.reduce((sum, item) => sum + (item.score ?? 0), 0) / submittedReviews.length
      )
    }

    reviewerSummary =
      submittedReviews
        .map((item) => item.notes?.trim())
        .filter((item): item is string => Boolean(item))
        .join('\n\n') || null

    await tx.aiCompetencySecondRoundSubmission.update({
      where: { id: params.submissionId },
      data: {
        rubricId: activeRubric.id,
        status: submissionStatus,
        aggregatedScore,
        aggregatedBonus,
        reviewerSummary,
        internalCertificationGranted,
        finalDecisionById:
          submissionStatus === 'PASSED' || submissionStatus === 'FAILED' || submissionStatus === 'REVISE_REQUESTED'
            ? params.session.user.id
            : undefined,
        finalDecisionNote:
          submissionStatus === 'PASSED' || submissionStatus === 'FAILED' || submissionStatus === 'REVISE_REQUESTED'
            ? params.input.notes ?? null
            : undefined,
        decidedAt:
          submissionStatus === 'PASSED' || submissionStatus === 'FAILED' || submissionStatus === 'REVISE_REQUESTED'
            ? new Date()
            : undefined,
      },
    })

    if (params.input.submitFinal) {
      await recomputeResultForAssignment(tx, activeReview.submission.assignmentId)
    }
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: params.input.submitFinal ? 'AI_COMPETENCY_SECOND_ROUND_REVIEWED' : 'AI_COMPETENCY_REVIEW_DRAFT_SAVED',
    entityType: 'AiCompetencySecondRoundSubmission',
    entityId: params.submissionId,
    newValue: {
      decision: calculated.decision,
      bonusScore: calculated.bonusScore,
      totalScore: calculated.totalScore,
      submitFinal: params.input.submitFinal,
    },
  })
}

export async function submitAiCompetencyExternalCertClaim(params: {
  session: AuthenticatedSession
  input: {
    assignmentId: string
    certificateId: string
    certificateNumber?: string
    issuedAt?: Date
    expiresAt?: Date
    policyAcknowledged: boolean
  }
  proof: StoredUpload
}) {
  const assignment = await prisma.aiCompetencyAssignment.findUnique({
    where: { id: params.input.assignmentId },
  })
  if (!assignment) {
    throw new AppError(404, 'AI_COMPETENCY_ASSIGNMENT_NOT_FOUND', '대상자 배정 정보를 찾을 수 없습니다.')
  }
  if (assignment.employeeId !== params.session.user.id && !isAdmin(params.session.user.role)) {
    throw new AppError(403, 'FORBIDDEN', '본인 외부자격만 제출할 수 있습니다.')
  }

  const certificate = await prisma.aiCompetencyExternalCertMaster.findUnique({
    where: { id: params.input.certificateId },
  })
  if (!certificate || !certificate.isActive) {
    throw new AppError(404, 'AI_COMPETENCY_CERT_MASTER_NOT_FOUND', '선택한 외부 자격 정보를 찾을 수 없습니다.')
  }
  if (certificate.requiresPolicyAcknowledgement && !params.input.policyAcknowledged) {
    throw new AppError(400, 'AI_COMPETENCY_POLICY_ACK_REQUIRED', '사내 정책 확인이 필요합니다.')
  }

  validateUpload({
    upload: params.proof,
    allowedMimeTypes: CERT_PROOF_ALLOWED_MIME_TYPES,
    maxBytes: MAX_CERT_PROOF_BYTES,
    label: '자격증 증빙',
  })

  const claim = await prisma.aiCompetencyExternalCertClaim.create({
    data: {
      cycleId: assignment.cycleId,
      assignmentId: assignment.id,
      employeeId: assignment.employeeId,
      certificateId: certificate.id,
      certificateNumber: params.input.certificateNumber ?? null,
      issuedAt: params.input.issuedAt ?? null,
      expiresAt: params.input.expiresAt ?? null,
      policyAcknowledgedAt: params.input.policyAcknowledged ? new Date() : null,
      proofFileName: params.proof.fileName,
      proofMimeType: params.proof.mimeType,
      proofSizeBytes: params.proof.sizeBytes,
      proofContent: params.proof.buffer,
      mappedScoreSnapshot: certificate.mappedScore,
    },
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: 'AI_COMPETENCY_EXTERNAL_CERT_SUBMITTED',
    entityType: 'AiCompetencyExternalCertClaim',
    entityId: claim.id,
    newValue: {
      certificateId: certificate.id,
      mappedScore: certificate.mappedScore,
    },
  })
  return claim
}

export async function reviewAiCompetencyExternalCertClaim(params: {
  actorId: string
  claimId: string
  action: 'APPROVE' | 'REJECT'
  rejectionReason?: string
}) {
  const claim = await prisma.aiCompetencyExternalCertClaim.findUnique({
    where: { id: params.claimId },
  })
  if (!claim) {
    throw new AppError(404, 'AI_COMPETENCY_CERT_CLAIM_NOT_FOUND', '외부 자격 신청 정보를 찾을 수 없습니다.')
  }

  const now = new Date()
  const status =
    params.action === 'APPROVE'
      ? claim.expiresAt && claim.expiresAt < now
        ? 'EXPIRED'
        : 'APPROVED'
      : 'REJECTED'

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.aiCompetencyExternalCertClaim.update({
      where: { id: params.claimId },
      data: {
        status,
        decidedAt: now,
        decidedById: params.actorId,
        rejectionReason: params.action === 'REJECT' ? params.rejectionReason ?? '운영 검토 결과 보완이 필요합니다.' : null,
      },
    })
    await recomputeResultForAssignment(tx, claim.assignmentId)
    return saved
  })

  await createAuditLog({
    userId: params.actorId,
    action: params.action === 'APPROVE' ? 'AI_COMPETENCY_EXTERNAL_CERT_APPROVED' : 'AI_COMPETENCY_EXTERNAL_CERT_REJECTED',
    entityType: 'AiCompetencyExternalCertClaim',
    entityId: params.claimId,
    newValue: {
      status,
      rejectionReason: params.rejectionReason,
    },
  })
  return updated
}

export async function overrideAiCompetencyResult(params: {
  actorId: string
  resultId: string
  overrideScore: number
  overrideReason: string
}) {
  const result = await prisma.aiCompetencyResult.findUnique({
    where: { id: params.resultId },
    include: {
      cycle: true,
    },
  })
  if (!result) {
    throw new AppError(404, 'AI_COMPETENCY_RESULT_NOT_FOUND', '결과 정보를 찾을 수 없습니다.')
  }
  const nextScore = calculateAiCompetencyFinalScore({
    firstRoundScore: result.firstRoundScore,
    externalCertMappedScore: result.externalCertMappedScore,
    secondRoundBonus: result.secondRoundBonus,
    cap: result.cycle.scoreCap,
    overrideScore: params.overrideScore,
  })
  const nextGrade = calculateAiCompetencyGrade({
    finalScore: nextScore,
    secondRoundPassed: result.secondRoundPassed,
  })

  const updated = await prisma.aiCompetencyResult.update({
    where: { id: params.resultId },
    data: {
      overrideScore: params.overrideScore,
      overrideReason: params.overrideReason,
      finalScore: nextScore,
      finalGrade: nextGrade,
      syncedCompetencyScore: result.syncState === 'SYNCED' ? nextScore : result.syncedCompetencyScore,
      syncedAt: result.syncState === 'SYNCED' ? new Date() : result.syncedAt,
      syncActorId: result.syncState === 'SYNCED' ? params.actorId : result.syncActorId,
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_RESULT_OVERRIDDEN',
    entityType: 'AiCompetencyResult',
    entityId: params.resultId,
    oldValue: {
      finalScore: result.finalScore,
      finalGrade: result.finalGrade,
    },
    newValue: {
      overrideScore: params.overrideScore,
      overrideReason: params.overrideReason,
      finalScore: nextScore,
      finalGrade: nextGrade,
    },
  })
  return updated
}

export async function publishAiCompetencyResults(params: {
  actorId: string
  cycleId: string
}) {
  const cycle = await requireCycleForMutation(params.cycleId)
  const now = new Date()
  await validatePublishReadiness(params.cycleId)

  const assignments = await prisma.aiCompetencyAssignment.findMany({
    where: { cycleId: params.cycleId },
    select: { id: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.aiCompetencyCycle.update({
      where: { id: params.cycleId },
      data: {
        resultPublishAt: cycle.resultPublishAt ?? now,
        updatedById: params.actorId,
      },
    })

    for (const assignment of assignments) {
      const result = await recomputeResultForAssignment(tx, assignment.id)
      if (!result) continue
      await tx.aiCompetencyResult.update({
        where: { id: result.id },
        data: {
          syncState: 'SYNCED',
          syncedAt: now,
          syncActorId: params.actorId,
          syncedCompetencyScore: result.finalScore,
          publishedAt: cycle.resultPublishAt ?? now,
        },
      })
    }
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'AI_COMPETENCY_RESULTS_PUBLISHED',
    entityType: 'AiCompetencyCycle',
    entityId: params.cycleId,
    newValue: {
      publishedAt: now.toISOString(),
    },
  })
}

export async function exportAiCompetencyReport(params: {
  cycleId: string
  format: 'csv' | 'xlsx'
}) {
  const cycle = await prisma.aiCompetencyCycle.findUnique({
    where: { id: params.cycleId },
    include: {
      evalCycle: true,
      results: {
        include: {
          employee: {
            include: {
              department: true,
            },
          },
          assignment: true,
        },
        orderBy: [{ finalScore: 'desc' }, { employee: { empName: 'asc' } }],
      },
    },
  })
  if (!cycle) {
    throw new AppError(404, 'AI_COMPETENCY_CYCLE_NOT_FOUND', 'AI 활용능력 평가 주기를 찾을 수 없습니다.')
  }

  const rows = cycle.results.map((result) => ({
    employeeNumber: result.employee.empId,
    name: result.employee.empName,
    department: result.employee.department.deptName,
    track: TRACK_LABELS[result.assignment.track],
    firstRoundScore: result.firstRoundScore ?? '',
    externalCertMappedScore: result.externalCertMappedScore ?? '',
    secondRoundBonus: result.secondRoundBonus,
    finalScore: result.finalScore,
    finalGrade: result.finalGrade,
    certificationStatus: result.certificationStatus,
    syncState: result.syncState,
  }))

  if (params.format === 'csv') {
    const headers = Object.keys(
      rows[0] ?? {
        employeeNumber: '',
        name: '',
        department: '',
        track: '',
        firstRoundScore: '',
        externalCertMappedScore: '',
        secondRoundBonus: '',
        finalScore: '',
        finalGrade: '',
        certificationStatus: '',
        syncState: '',
      }
    )
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => JSON.stringify(row[header as keyof typeof row] ?? '')).join(',')
      ),
    ].join('\n')
    return {
      fileName: `ai-competency-${cycle.evalCycle.evalYear}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: Buffer.from(csv, 'utf8'),
    }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'results')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return {
    fileName: `ai-competency-${cycle.evalCycle.evalYear}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: buffer,
  }
}

export async function exportAiCompetencyBlueprint(params: {
  blueprintId: string
  format: 'csv' | 'xlsx'
}) {
  const blueprint = await prisma.aiCompetencyExamBlueprint.findUnique({
    where: { id: params.blueprintId },
    include: {
      cycle: {
        include: {
          evalCycle: true,
        },
      },
      rows: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!blueprint) {
    throw new AppError(404, 'AI_COMPETENCY_BLUEPRINT_NOT_FOUND', '문항 체계표를 찾을 수 없습니다.')
  }

  const rows = blueprint.rows.map((row) => ({
    blueprintName: blueprint.blueprintName,
    blueprintVersion: blueprint.blueprintVersion,
    track: blueprint.track ?? 'COMMON',
    competencyDomain: row.competencyDomain,
    itemType: row.itemType,
    difficulty: row.difficulty,
    scope: row.scope,
    requiredQuestionCount: row.requiredQuestionCount,
    pointsPerQuestion: row.pointsPerQuestion,
    rowPoints: row.rowPoints,
    requiredTags: serializeTags(row.requiredTags).join('|'),
    excludedTags: serializeTags(row.excludedTags).join('|'),
    displayOrder: row.displayOrder,
  }))

  if (params.format === 'csv') {
    const headers = Object.keys(rows[0] ?? {
      blueprintName: '',
      blueprintVersion: '',
      track: '',
      competencyDomain: '',
      itemType: '',
      difficulty: '',
      scope: '',
      requiredQuestionCount: '',
      pointsPerQuestion: '',
      rowPoints: '',
      requiredTags: '',
      excludedTags: '',
      displayOrder: '',
    })
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => JSON.stringify(row[header as keyof typeof row] ?? '')).join(',')
      ),
    ].join('\n')
    return {
      fileName: `ai-blueprint-${blueprint.cycle.evalCycle.evalYear}-${blueprint.blueprintVersion}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: Buffer.from(csv, 'utf8'),
    }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'blueprint')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return {
    fileName: `ai-blueprint-${blueprint.cycle.evalCycle.evalYear}-${blueprint.blueprintVersion}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: buffer,
  }
}

export async function getAiCompetencyArtifactDownload(params: {
  session: AuthenticatedSession
  artifactId: string
}) {
  const artifact = await prisma.aiCompetencySecondRoundArtifact.findUnique({
    where: { id: params.artifactId },
    include: {
      submission: {
        include: {
          reviews: true,
        },
      },
    },
  })
  if (!artifact) {
    throw new AppError(404, 'AI_COMPETENCY_ARTIFACT_NOT_FOUND', '첨부 산출물을 찾을 수 없습니다.')
  }
  const canAccess =
    isAdmin(params.session.user.role) ||
    params.session.user.role === 'ROLE_CEO' ||
    artifact.submission.employeeId === params.session.user.id ||
    artifact.submission.reviews.some((item) => item.reviewerId === params.session.user.id)
  if (!canAccess) {
    throw new AppError(403, 'FORBIDDEN', '해당 산출물을 다운로드할 권한이 없습니다.')
  }
  return {
    fileName: artifact.fileName,
    contentType: artifact.mimeType,
    body: Buffer.from(artifact.content),
  }
}

export async function getAiCompetencyCertProofDownload(params: {
  session: AuthenticatedSession
  claimId: string
}) {
  const claim = await prisma.aiCompetencyExternalCertClaim.findUnique({
    where: { id: params.claimId },
  })
  if (!claim) {
    throw new AppError(404, 'AI_COMPETENCY_CERT_PROOF_NOT_FOUND', '자격증 증빙을 찾을 수 없습니다.')
  }
  const canAccess =
    isAdmin(params.session.user.role) ||
    params.session.user.role === 'ROLE_CEO' ||
    claim.employeeId === params.session.user.id
  if (!canAccess) {
    throw new AppError(403, 'FORBIDDEN', '해당 증빙을 다운로드할 권한이 없습니다.')
  }
  return {
    fileName: claim.proofFileName,
    contentType: claim.proofMimeType,
    body: Buffer.from(claim.proofContent),
  }
}

export async function loadAiCompetencySyncedResults(params: {
  evalCycleIds: string[]
  employeeIds: string[]
}) {
  if (!params.evalCycleIds.length || !params.employeeIds.length) {
    return new Map<
      string,
      {
        finalScore: number
        finalGrade: AiCompetencyGrade
        certificationStatus: AiCompetencyCertificationStatus
      }
    >()
  }

  const rows = await prisma.aiCompetencyResult.findMany({
    where: {
      evalCycleId: { in: params.evalCycleIds },
      employeeId: { in: params.employeeIds },
      syncState: 'SYNCED',
    },
    select: {
      evalCycleId: true,
      employeeId: true,
      finalScore: true,
      finalGrade: true,
      certificationStatus: true,
    },
  })

  return new Map(
    rows.map((row) => [
      `${row.evalCycleId}:${row.employeeId}`,
      {
        finalScore: row.finalScore,
        finalGrade: row.finalGrade,
        certificationStatus: row.certificationStatus,
      },
    ])
  )
}

export function getAiCompetencyTrackLabel(track: AiCompetencyTrack) {
  return TRACK_LABELS[track]
}

export function getAiCompetencyQuestionTypeLabel(type: AiCompetencyQuestionType) {
  return QUESTION_TYPE_LABELS[type]
}

export function getAiCompetencyDifficultyLabel(difficulty: AiCompetencyDifficulty) {
  return DIFFICULTY_LABELS[difficulty]
}
