import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import {
  AiCompetencyAssignmentSchema,
  AiCompetencyAttemptSaveSchema,
  AiCompetencyBlueprintSchema,
  AiCompetencyCycleUpsertSchema,
  AiCompetencyExternalCertClaimSchema,
  AiCompetencyExternalCertDecisionSchema,
  AiCompetencyQuestionSchema,
  AiCompetencyResultOverrideSchema,
  AiCompetencyReviewerAssignmentSchema,
  AiCompetencyRubricSchema,
  AiCompetencyShortAnswerScoreSchema,
  AiCompetencySubmissionReviewSchema,
  AiCompetencySecondRoundSubmissionSchema,
  AiCompetencyTemplateActionSchema,
} from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  activateAiCompetencyBlueprint,
  activateAiCompetencyRubric,
  archiveAiCompetencyBlueprint,
  archiveAiCompetencyRubric,
  assignAiCompetencyReviewers,
  createAiCompetencyCycle,
  duplicateAiCompetencyBlueprint,
  duplicateAiCompetencyRubric,
  publishAiCompetencyResults,
  reviewAiCompetencyExternalCertClaim,
  reviewAiCompetencySubmission,
  saveAiCompetencyAttempt,
  scoreAiCompetencyShortAnswer,
  startAiCompetencyAttempt,
  submitAiCompetencyExternalCertClaim,
  submitAiCompetencySecondRound,
  updateAiCompetencyCycle,
  upsertAiCompetencyAssignment,
  upsertAiCompetencyBlueprint,
  upsertAiCompetencyQuestion,
  upsertAiCompetencyRubric,
  overrideAiCompetencyResult,
  type StoredUpload,
} from '@/server/ai-competency'

const StartAttemptSchema = z.object({
  assignmentId: z.string().min(1),
})

const PublishResultsSchema = z.object({
  cycleId: z.string().min(1),
})

const DuplicateTemplateSchema = z.object({
  templateId: z.string().min(1),
  cycleId: z.string().min(1),
})

const UpdateCycleSchema = z.object({
  cycleId: z.string().min(1),
  cycleName: z.string().trim().min(1).max(100).optional(),
  firstRoundOpenAt: z.string().datetime().optional(),
  firstRoundCloseAt: z.string().datetime().optional(),
  secondRoundApplyOpenAt: z.string().datetime().optional(),
  secondRoundApplyCloseAt: z.string().datetime().optional(),
  reviewOpenAt: z.string().datetime().optional(),
  reviewCloseAt: z.string().datetime().optional(),
  calibrationOpenAt: z.string().datetime().optional(),
  calibrationCloseAt: z.string().datetime().optional(),
  resultPublishAt: z.string().datetime().optional(),
  firstRoundPassThreshold: z.number().min(0).max(100).optional(),
  secondRoundBonusCap: z.number().min(0).max(30).optional(),
  scoreCap: z.number().min(60).max(100).optional(),
  timeLimitMinutes: z.number().int().min(10).max(240).optional(),
  randomizeQuestions: z.boolean().optional(),
  companyEmailDomain: z.string().max(100).optional(),
  artifactMinCount: z.number().int().min(1).max(3).optional(),
  artifactMaxCount: z.number().int().min(1).max(5).optional(),
  policyAcknowledgementText: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
})

type JsonEnvelope = {
  action?: string
  payload?: unknown
}

function ensureAdmin(role: string) {
  if (role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자만 처리할 수 있는 작업입니다.')
  }
}

function parseOptionalDate(value?: string | null) {
  if (!value) return undefined
  return new Date(value)
}

async function toStoredUpload(file: File): Promise<StoredUpload> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer) as Uint8Array<ArrayBuffer>
  return {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: buffer.byteLength,
    buffer,
  }
}

async function parseRequest(request: Request): Promise<
  | { kind: 'json'; action: string; payload: unknown }
  | { kind: 'form'; action: string; payload: unknown; formData: FormData }
> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const action = String(formData.get('action') ?? '')
    const payloadRaw = String(formData.get('payload') ?? '{}')
    const payload = JSON.parse(payloadRaw)
    return { kind: 'form', action, payload, formData }
  }

  const body = (await request.json()) as JsonEnvelope
  return {
    kind: 'json',
    action: body.action ?? '',
    payload: body.payload,
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('AI_COMPETENCY')
    const parsed = await parseRequest(request)

    switch (parsed.action) {
      case 'createCycle': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyCycleUpsertSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '주기 정보가 올바르지 않습니다.')
        }
        if (!validated.data.evalCycleId) {
          throw new AppError(400, 'VALIDATION_ERROR', '연결할 PMS 평가 주기를 선택해 주세요.')
        }
        const cycle = await createAiCompetencyCycle({
          actorId: session.user.id,
          input: {
            ...validated.data,
            evalCycleId: validated.data.evalCycleId,
            firstRoundOpenAt: parseOptionalDate(validated.data.firstRoundOpenAt),
            firstRoundCloseAt: parseOptionalDate(validated.data.firstRoundCloseAt),
            secondRoundApplyOpenAt: parseOptionalDate(validated.data.secondRoundApplyOpenAt),
            secondRoundApplyCloseAt: parseOptionalDate(validated.data.secondRoundApplyCloseAt),
            reviewOpenAt: parseOptionalDate(validated.data.reviewOpenAt),
            reviewCloseAt: parseOptionalDate(validated.data.reviewCloseAt),
            calibrationOpenAt: parseOptionalDate(validated.data.calibrationOpenAt),
            calibrationCloseAt: parseOptionalDate(validated.data.calibrationCloseAt),
            resultPublishAt: parseOptionalDate(validated.data.resultPublishAt),
          },
        })
        return successResponse(cycle)
      }

      case 'updateCycle': {
        ensureAdmin(session.user.role)
        const validated = UpdateCycleSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '주기 수정값이 올바르지 않습니다.')
        }
        const updated = await updateAiCompetencyCycle({
          actorId: session.user.id,
          cycleId: validated.data.cycleId,
          input: {
            cycleName: validated.data.cycleName,
            firstRoundOpenAt: parseOptionalDate(validated.data.firstRoundOpenAt),
            firstRoundCloseAt: parseOptionalDate(validated.data.firstRoundCloseAt),
            secondRoundApplyOpenAt: parseOptionalDate(validated.data.secondRoundApplyOpenAt),
            secondRoundApplyCloseAt: parseOptionalDate(validated.data.secondRoundApplyCloseAt),
            reviewOpenAt: parseOptionalDate(validated.data.reviewOpenAt),
            reviewCloseAt: parseOptionalDate(validated.data.reviewCloseAt),
            calibrationOpenAt: parseOptionalDate(validated.data.calibrationOpenAt),
            calibrationCloseAt: parseOptionalDate(validated.data.calibrationCloseAt),
            resultPublishAt: parseOptionalDate(validated.data.resultPublishAt),
            firstRoundPassThreshold: validated.data.firstRoundPassThreshold,
            secondRoundBonusCap: validated.data.secondRoundBonusCap,
            scoreCap: validated.data.scoreCap,
            timeLimitMinutes: validated.data.timeLimitMinutes,
            randomizeQuestions: validated.data.randomizeQuestions,
            companyEmailDomain: validated.data.companyEmailDomain ?? undefined,
            artifactMinCount: validated.data.artifactMinCount,
            artifactMaxCount: validated.data.artifactMaxCount,
            policyAcknowledgementText: validated.data.policyAcknowledgementText ?? undefined,
            status: validated.data.status,
          },
        })
        return successResponse(updated)
      }

      case 'upsertBlueprint': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyBlueprintSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '문항 체계표 정보가 올바르지 않습니다.')
        }
        const blueprint = await upsertAiCompetencyBlueprint({
          actorId: session.user.id,
          input: validated.data,
        })
        return successResponse(blueprint)
      }

      case 'activateBlueprint': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyTemplateActionSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', '활성화할 문항 체계표를 선택해 주세요.')
        }
        await activateAiCompetencyBlueprint({
          actorId: session.user.id,
          blueprintId: validated.data.templateId,
        })
        return successResponse({ ok: true })
      }

      case 'archiveBlueprint': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyTemplateActionSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', '아카이브할 문항 체계표를 선택해 주세요.')
        }
        await archiveAiCompetencyBlueprint({
          actorId: session.user.id,
          blueprintId: validated.data.templateId,
        })
        return successResponse({ ok: true })
      }

      case 'duplicateBlueprint': {
        ensureAdmin(session.user.role)
        const validated = DuplicateTemplateSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', '복제할 문항 체계표와 대상 주기를 선택해 주세요.')
        }
        const blueprint = await duplicateAiCompetencyBlueprint({
          actorId: session.user.id,
          sourceBlueprintId: validated.data.templateId,
          targetCycleId: validated.data.cycleId,
        })
        return successResponse(blueprint)
      }

      case 'upsertRubric': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyRubricSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '루브릭 시트 정보가 올바르지 않습니다.')
        }
        const rubric = await upsertAiCompetencyRubric({
          actorId: session.user.id,
          input: validated.data,
        })
        return successResponse(rubric)
      }

      case 'activateRubric': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyTemplateActionSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', '활성화할 루브릭 시트를 선택해 주세요.')
        }
        await activateAiCompetencyRubric({
          actorId: session.user.id,
          rubricId: validated.data.templateId,
        })
        return successResponse({ ok: true })
      }

      case 'archiveRubric': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyTemplateActionSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', '아카이브할 루브릭 시트를 선택해 주세요.')
        }
        await archiveAiCompetencyRubric({
          actorId: session.user.id,
          rubricId: validated.data.templateId,
        })
        return successResponse({ ok: true })
      }

      case 'duplicateRubric': {
        ensureAdmin(session.user.role)
        const validated = DuplicateTemplateSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', '복제할 루브릭 시트와 대상 주기를 선택해 주세요.')
        }
        const rubric = await duplicateAiCompetencyRubric({
          actorId: session.user.id,
          sourceRubricId: validated.data.templateId,
          targetCycleId: validated.data.cycleId,
        })
        return successResponse(rubric)
      }

      case 'upsertQuestion': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyQuestionSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '문항 정보가 올바르지 않습니다.')
        }
        const question = await upsertAiCompetencyQuestion({
          actorId: session.user.id,
          input: validated.data,
        })
        return successResponse(question)
      }

      case 'upsertAssignment': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyAssignmentSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '대상자 배정 정보가 올바르지 않습니다.')
        }
        const assignment = await upsertAiCompetencyAssignment({
          actorId: session.user.id,
          input: validated.data,
        })
        return successResponse(assignment)
      }

      case 'startAttempt': {
        const validated = StartAttemptSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', '응시 시작 요청이 올바르지 않습니다.')
        }
        const attempt = await startAiCompetencyAttempt({
          session,
          assignmentId: validated.data.assignmentId,
        })
        return successResponse(attempt)
      }

      case 'saveAttempt': {
        const validated = AiCompetencyAttemptSaveSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '답안 저장 요청이 올바르지 않습니다.')
        }
        const attempt = await saveAiCompetencyAttempt({
          session,
          attemptId: validated.data.attemptId,
          answers: validated.data.answers.map((row) => ({
            questionId: row.questionId,
            answer: row.answer as Prisma.JsonValue,
          })),
          submit: validated.data.submit,
        })
        return successResponse(attempt)
      }

      case 'scoreShortAnswer': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyShortAnswerScoreSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '수기 채점 입력값이 올바르지 않습니다.')
        }
        await scoreAiCompetencyShortAnswer({
          actorId: session.user.id,
          answerId: validated.data.answerId,
          manualScore: validated.data.manualScore,
          reviewerNote: validated.data.reviewerNote,
        })
        return successResponse({ ok: true })
      }

      case 'submitSecondRound': {
        const payload = AiCompetencySecondRoundSubmissionSchema.safeParse(parsed.payload)
        if (!payload.success) {
          throw new AppError(400, 'VALIDATION_ERROR', payload.error.issues[0]?.message ?? '2차 신청 정보가 올바르지 않습니다.')
        }
        if (parsed.kind !== 'form') {
          throw new AppError(400, 'INVALID_REQUEST', '첨부 파일과 함께 전송해 주세요.')
        }
        const files = parsed.formData
          .getAll('artifacts')
          .filter((entry): entry is File => entry instanceof File && entry.size > 0)
        const submission = await submitAiCompetencySecondRound({
          session,
          input: payload.data,
          artifacts: await Promise.all(files.map((file) => toStoredUpload(file))),
        })
        return successResponse(submission)
      }

      case 'assignReviewers': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyReviewerAssignmentSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '리뷰어 지정 정보가 올바르지 않습니다.')
        }
        await assignAiCompetencyReviewers({
          actorId: session.user.id,
          submissionId: validated.data.submissionId,
          reviewerIds: validated.data.reviewerIds,
        })
        return successResponse({ ok: true })
      }

      case 'reviewSubmission': {
        const validated = AiCompetencySubmissionReviewSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '리뷰 입력값이 올바르지 않습니다.')
        }
        await reviewAiCompetencySubmission({
          session,
          submissionId: validated.data.submissionId,
          input: {
            decision: validated.data.decision,
            criterionScores: validated.data.criterionScores,
            notes: validated.data.notes,
            qnaNote: validated.data.qnaNote,
            submitFinal: validated.data.submitFinal,
          },
        })
        return successResponse({ ok: true })
      }

      case 'submitCertClaim': {
        const validated = AiCompetencyExternalCertClaimSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '외부 자격 신청 정보가 올바르지 않습니다.')
        }
        if (parsed.kind !== 'form') {
          throw new AppError(400, 'INVALID_REQUEST', '증빙 파일과 함께 전송해 주세요.')
        }
        const proofFile = parsed.formData.get('proof')
        if (!(proofFile instanceof File) || proofFile.size <= 0) {
          throw new AppError(400, 'VALIDATION_ERROR', '증빙 파일을 첨부해 주세요.')
        }
        const claim = await submitAiCompetencyExternalCertClaim({
          session,
          input: {
            ...validated.data,
            issuedAt: validated.data.issuedAt ? new Date(validated.data.issuedAt) : undefined,
            expiresAt: validated.data.expiresAt ? new Date(validated.data.expiresAt) : undefined,
          },
          proof: await toStoredUpload(proofFile),
        })
        return successResponse(claim)
      }

      case 'decideCertClaim': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyExternalCertDecisionSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '외부 자격 승인 정보가 올바르지 않습니다.')
        }
        const result = await reviewAiCompetencyExternalCertClaim({
          actorId: session.user.id,
          claimId: validated.data.claimId,
          action: validated.data.action,
          rejectionReason: validated.data.rejectionReason,
        })
        return successResponse(result)
      }

      case 'overrideResult': {
        ensureAdmin(session.user.role)
        const validated = AiCompetencyResultOverrideSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '보정 점수 입력값이 올바르지 않습니다.')
        }
        const result = await overrideAiCompetencyResult({
          actorId: session.user.id,
          resultId: validated.data.resultId,
          overrideScore: validated.data.overrideScore,
          overrideReason: validated.data.overrideReason,
        })
        return successResponse(result)
      }

      case 'publishResults': {
        ensureAdmin(session.user.role)
        const validated = PublishResultsSchema.safeParse(parsed.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', '결과 반영 요청이 올바르지 않습니다.')
        }
        await publishAiCompetencyResults({
          actorId: session.user.id,
          cycleId: validated.data.cycleId,
        })
        return successResponse({ ok: true })
      }

      default:
        throw new AppError(400, 'UNSUPPORTED_ACTION', '지원하지 않는 AI 활용능력 평가 작업입니다.')
    }
  } catch (error) {
    return errorResponse(error)
  }
}
