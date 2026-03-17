import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError, calcPdcaScore, calcWeightedScore } from '@/lib/utils'
import { SubmitEvaluationSchema } from '@/lib/validations'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { EvalStage } from '@prisma/client'

// PATCH /api/evaluation/[id]/submit
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await params

    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        items: {
          include: { personalKpi: true },
        },
        evalCycle: true,
      },
    })

    if (!evaluation) throw new AppError(404, 'NOT_FOUND', '평가를 찾을 수 없습니다.')
    if (evaluation.evaluatorId !== session.user.id) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
    }
    if (evaluation.status === 'SUBMITTED' || evaluation.status === 'CONFIRMED') {
      throw new AppError(400, 'ALREADY_SUBMITTED', '이미 제출된 평가입니다.')
    }

    const body = await request.json()
    const validated = SubmitEvaluationSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const { comment, gradeId, items } = validated.data

    // 점수 계산 및 업데이트
    let totalScore = 0

    await prisma.$transaction(async (tx) => {
      for (const itemInput of items) {
        const evalItem = evaluation.items.find(i => i.personalKpiId === itemInput.personalKpiId)
        if (!evalItem) continue

        const kpi = evalItem.personalKpi
        let itemScore = 0

        if (kpi.kpiType === 'QUANTITATIVE') {
          itemScore = itemInput.quantScore || 0
        } else {
          // PDCA 점수 계산
          const pdcaScore = calcPdcaScore(
            itemInput.planScore || 0,
            itemInput.doScore || 0,
            itemInput.checkScore || 0,
            itemInput.actScore || 0,
          )
          itemScore = pdcaScore
        }

        const weightedScore = calcWeightedScore(itemScore, kpi.weight)
        totalScore += weightedScore

        await tx.evaluationItem.update({
          where: { id: evalItem.id },
          data: {
            quantScore: itemInput.quantScore,
            planScore: itemInput.planScore,
            doScore: itemInput.doScore,
            checkScore: itemInput.checkScore,
            actScore: itemInput.actScore,
            qualScore: kpi.kpiType === 'QUALITATIVE' ? calcPdcaScore(
              itemInput.planScore || 0,
              itemInput.doScore || 0,
              itemInput.checkScore || 0,
              itemInput.actScore || 0,
            ) : null,
            itemComment: itemInput.itemComment,
            weightedScore,
          },
        })
      }

      await tx.evaluation.update({
        where: { id: id },
        data: {
          totalScore,
          gradeId,
          comment,
          status: 'SUBMITTED',
          isDraft: false,
          submittedAt: new Date(),
        },
      })

      // 다음 단계 평가 생성 (자동 이관)
      await createNextStageEvaluation(tx, evaluation, totalScore)
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'EVALUATION_SUBMIT',
      entityType: 'Evaluation',
      entityId: id,
      newValue: { stage: evaluation.evalStage, totalScore, submittedAt: new Date() },
      ...clientInfo,
    })

    return successResponse({ message: '평가가 제출되었습니다.', totalScore })
  } catch (error) {
    return errorResponse(error)
  }
}

// 다음 단계 평가자에게 평가 이관
async function createNextStageEvaluation(
  tx: any,
  evaluation: any,
  totalScore: number
) {
  const stageOrder: EvalStage[] = ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']
  const currentIndex = stageOrder.indexOf(evaluation.evalStage)
  if (currentIndex >= stageOrder.length - 1) return

  const nextStage = stageOrder[currentIndex + 1]

  // 피평가자 정보 조회
  const target = await tx.employee.findUnique({
    where: { id: evaluation.targetId },
  })
  if (!target) return

  // 다음 단계 평가자 결정
  let nextEvaluatorId: string | null = null
  if (nextStage === 'FIRST') nextEvaluatorId = target.teamLeaderId
  else if (nextStage === 'SECOND') nextEvaluatorId = target.sectionChiefId
  else if (nextStage === 'FINAL') nextEvaluatorId = target.divisionHeadId

  if (!nextEvaluatorId && nextStage !== 'CEO_ADJUST') return

  // CEO 조정은 별도 처리
  if (nextStage === 'CEO_ADJUST') {
    // CEO가 있는지 확인
    const ceo = await tx.employee.findFirst({
      where: { position: 'CEO', status: 'ACTIVE' },
    })
    if (!ceo) return
    nextEvaluatorId = ceo.id
  }

  if (!nextEvaluatorId) return

  // 이미 다음 단계 평가가 있으면 스킵
  const existing = await tx.evaluation.findUnique({
    where: {
      evalCycleId_targetId_evalStage: {
        evalCycleId: evaluation.evalCycleId,
        targetId: evaluation.targetId,
        evalStage: nextStage,
      },
    },
  })
  if (existing) return

  // 다음 단계 평가 아이템 (이전 단계 KPI 동일하게 복사)
  const prevItems = await tx.evaluationItem.findMany({
    where: { evaluationId: evaluation.id },
  })

  await tx.evaluation.create({
    data: {
      evalCycleId: evaluation.evalCycleId,
      targetId: evaluation.targetId,
      evaluatorId: nextEvaluatorId,
      evalStage: nextStage,
      status: 'PENDING',
      isDraft: true,
      items: {
        create: prevItems.map((item: any) => ({
          personalKpiId: item.personalKpiId,
        })),
      },
    },
  })

  // 알림 생성
  await tx.notification.create({
    data: {
      recipientId: nextEvaluatorId,
      type: 'EVAL_RECEIVED',
      title: '새 평가 요청',
      message: `${target.empName}의 ${getStageLabel(nextStage)} 평가 요청이 도착했습니다.`,
      link: `/evaluation/review/${evaluation.evalCycleId}`,
      channel: 'IN_APP',
    },
  })
}

function getStageLabel(stage: EvalStage): string {
  const labels: Record<EvalStage, string> = {
    SELF: '자기평가',
    FIRST: '1차',
    SECOND: '2차',
    FINAL: '최종',
    CEO_ADJUST: '등급 조정',
  }
  return labels[stage]
}
