import {
  WordCloud360AssignmentBatchSchema,
  WordCloud360AutoAssignSchema,
  WordCloud360CycleSchema,
  WordCloud360KeywordSchema,
  WordCloud360PublishSchema,
  WordCloud360ResponseSchema,
} from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  autoAssignWordCloud360Participants,
  deleteWordCloud360Assignment,
  publishWordCloud360Results,
  saveWordCloud360Assignments,
  saveWordCloud360Response,
  seedDefaultWordCloudKeywords,
  upsertWordCloud360Cycle,
  upsertWordCloud360Keyword,
} from '@/server/word-cloud-360'

type JsonEnvelope = {
  action?: string
  payload?: unknown
}

function getCycleValidationMessage(error: {
  issues?: Array<{
    path?: Array<PropertyKey>
    message?: string
  }>
}) {
  const issue = error.issues?.[0]
  const field = String(issue?.path?.[0] ?? '')

  switch (field) {
    case 'cycleName':
      return '주기명을 입력해 주세요.'
    case 'startDate':
    case 'endDate':
      return '시작일과 종료일 형식을 확인해 주세요.'
    case 'evalCycleId':
      return '연결할 PMS 평가 주기를 선택해 주세요.'
    case 'status':
      return '주기 상태를 확인해 주세요.'
    default:
      return '주기 정보가 올바르지 않습니다.'
  }
}

function ensureAdmin(role: string) {
  if (role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자만 처리할 수 있는 작업입니다.')
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('WORD_CLOUD_360')
    const body = (await request.json()) as JsonEnvelope

    switch (body.action) {
      case 'upsertCycle': {
        ensureAdmin(session.user.role)
        const validated = WordCloud360CycleSchema.safeParse(body.payload)
        const cycleValidationMessage = !validated.success ? getCycleValidationMessage(validated.error) : null
        if (cycleValidationMessage) {
          throw new AppError(400, 'VALIDATION_ERROR', cycleValidationMessage)
        }
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '주기 정보가 올바르지 않습니다.')
        }

        const cycle = await upsertWordCloud360Cycle({
          actorId: session.user.id,
          input: validated.data,
        })
        return successResponse(cycle)
      }

      case 'upsertKeyword': {
        ensureAdmin(session.user.role)
        const validated = WordCloud360KeywordSchema.safeParse(body.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '키워드 정보가 올바르지 않습니다.')
        }

        const keyword = await upsertWordCloud360Keyword({
          actorId: session.user.id,
          input: validated.data,
        })
        return successResponse(keyword)
      }

      case 'seedKeywords': {
        ensureAdmin(session.user.role)
        const result = await seedDefaultWordCloudKeywords({ actorId: session.user.id })
        return successResponse(result)
      }

      case 'saveAssignments': {
        ensureAdmin(session.user.role)
        const validated = WordCloud360AssignmentBatchSchema.safeParse(body.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '편성 데이터가 올바르지 않습니다.')
        }

        const saved = await saveWordCloud360Assignments({
          actorId: session.user.id,
          cycleId: validated.data.cycleId,
          assignments: validated.data.assignments,
        })
        return successResponse(saved)
      }

      case 'autoAssign': {
        ensureAdmin(session.user.role)
        const validated = WordCloud360AutoAssignSchema.safeParse(body.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '자동 편성 설정이 올바르지 않습니다.')
        }

        const result = await autoAssignWordCloud360Participants({
          actorId: session.user.id,
          cycleId: validated.data.cycleId,
          includeSelf: validated.data.includeSelf,
          peerLimit: validated.data.peerLimit,
          subordinateLimit: validated.data.subordinateLimit,
        })
        return successResponse(result)
      }

      case 'deleteAssignment': {
        ensureAdmin(session.user.role)
        const assignmentId = String((body.payload as { assignmentId?: string } | undefined)?.assignmentId ?? '')
        if (!assignmentId) {
          throw new AppError(400, 'VALIDATION_ERROR', '삭제할 편성을 선택해 주세요.')
        }
        await deleteWordCloud360Assignment({
          actorId: session.user.id,
          assignmentId,
        })
        return successResponse({ ok: true })
      }

      case 'saveResponse': {
        const validated = WordCloud360ResponseSchema.safeParse(body.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '응답 데이터가 올바르지 않습니다.')
        }

        const response = await saveWordCloud360Response({
          actorId: session.user.id,
          input: validated.data,
        })
        return successResponse(response)
      }

      case 'publishResults': {
        ensureAdmin(session.user.role)
        const validated = WordCloud360PublishSchema.safeParse(body.payload)
        if (!validated.success) {
          throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '결과 공개 설정이 올바르지 않습니다.')
        }

        const result = await publishWordCloud360Results({
          actorId: session.user.id,
          cycleId: validated.data.cycleId,
          publish: validated.data.publish,
        })
        return successResponse(result)
      }

      default:
        throw new AppError(400, 'UNKNOWN_ACTION', '지원하지 않는 워드클라우드 다면평가 작업입니다.')
    }
  } catch (error) {
    return errorResponse(error, '워드클라우드형 다면평가 요청을 처리하지 못했습니다.')
  }
}
