import { z } from 'zod'
import {
  AiCompetencyGateAssignmentUpsertSchema,
  AiCompetencyGateCycleUpsertSchema,
  AiCompetencyGateDecisionSubmitSchema,
  AiCompetencyGateDraftSchema,
  AiCompetencyGateEvidenceDeleteSchema,
  AiCompetencyGateEvidenceUploadSchema,
  AiCompetencyGateReviewDraftSchema,
  AiCompetencyGateSubmitSchema,
} from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  deleteAiCompetencyGateEvidence,
  saveAiCompetencyGateDraft,
  submitAiCompetencyGateCase,
  uploadAiCompetencyGateEvidence,
  upsertAiCompetencyGateAssignment,
  upsertAiCompetencyGateCycle,
} from '@/server/ai-competency-gate'
import {
  finalizeAiCompetencyGateDecision,
  saveAiCompetencyGateReviewDraft,
  startAiCompetencyGateReview,
} from '@/server/ai-competency-gate-admin'

type JsonEnvelope = {
  action?: string
  payload?: unknown
}

async function toStoredUpload(file: File) {
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
    return {
      kind: 'form',
      action: String(formData.get('action') ?? ''),
      payload: JSON.parse(String(formData.get('payload') ?? '{}')),
      formData,
    }
  }
  const body = (await request.json()) as JsonEnvelope
  return { kind: 'json', action: body.action ?? '', payload: body.payload }
}

function validate<T>(schema: z.ZodSchema<T>, payload: unknown, fallback: string) {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? fallback)
  }
  return parsed.data
}

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('AI_COMPETENCY')
    const parsed = await parseRequest(request)

    switch (parsed.action) {
      case 'upsertCycle': {
        const payload = validate(AiCompetencyGateCycleUpsertSchema, parsed.payload, '회차 정보를 확인해 주세요.')
        return successResponse(await upsertAiCompetencyGateCycle({ session, input: payload }))
      }
      case 'upsertAssignment': {
        const payload = validate(AiCompetencyGateAssignmentUpsertSchema, parsed.payload, '배정 정보를 확인해 주세요.')
        return successResponse(await upsertAiCompetencyGateAssignment({ session, input: payload }))
      }
      case 'saveDraft': {
        const payload = validate(AiCompetencyGateDraftSchema, parsed.payload, '제출서 초안 정보를 확인해 주세요.')
        return successResponse(await saveAiCompetencyGateDraft({ session, input: payload }))
      }
      case 'uploadEvidence': {
        if (parsed.kind !== 'form') {
          throw new AppError(400, 'VALIDATION_ERROR', '증빙 업로드는 파일 형식 요청만 지원합니다.')
        }
        const payload = validate(AiCompetencyGateEvidenceUploadSchema, parsed.payload, '증빙 정보를 확인해 주세요.')
        const file = parsed.formData.get('file')
        return successResponse(
          await uploadAiCompetencyGateEvidence({
            session,
            input: {
              ...payload,
              file: file instanceof File ? await toStoredUpload(file) : undefined,
            },
          })
        )
      }
      case 'deleteEvidence': {
        const payload = validate(AiCompetencyGateEvidenceDeleteSchema, parsed.payload, '삭제할 증빙을 확인해 주세요.')
        return successResponse(await deleteAiCompetencyGateEvidence({ session, ...payload }))
      }
      case 'submitCase': {
        const payload = validate(AiCompetencyGateSubmitSchema, parsed.payload, '제출 대상 정보를 확인해 주세요.')
        return successResponse(await submitAiCompetencyGateCase({ session, assignmentId: payload.assignmentId }))
      }
      case 'startReview': {
        const payload = validate(z.object({ caseId: z.string().min(1) }), parsed.payload, '검토 대상을 확인해 주세요.')
        return successResponse(await startAiCompetencyGateReview({ session, caseId: payload.caseId }))
      }
      case 'saveReviewDraft': {
        const payload = validate(AiCompetencyGateReviewDraftSchema, parsed.payload, '검토 초안 정보를 확인해 주세요.')
        return successResponse(await saveAiCompetencyGateReviewDraft({ session, input: payload }))
      }
      case 'finalizeDecision': {
        const payload = validate(AiCompetencyGateDecisionSubmitSchema, parsed.payload, '최종 결정을 확인해 주세요.')
        return successResponse(await finalizeAiCompetencyGateDecision({ session, input: payload }))
      }
      default:
        throw new AppError(400, 'UNSUPPORTED_ACTION', '지원하지 않는 AI 역량평가 액션입니다.')
    }
  } catch (error) {
    return errorResponse(error)
  }
}
