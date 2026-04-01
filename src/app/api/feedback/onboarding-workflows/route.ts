import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { OnboardingReviewWorkflowSchema } from '@/lib/validations'
import { upsertOnboardingReviewWorkflow } from '@/server/onboarding-review-workflow'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '온보딩 리뷰 워크플로우는 관리자만 설정할 수 있습니다.')
    }

    const payload = await request.json()
    const validated = OnboardingReviewWorkflowSchema.safeParse(payload)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    }

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.id },
      include: { department: true },
    })

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const cycle = await prisma.evalCycle.findUnique({
      where: { id: validated.data.evalCycleId },
      select: {
        id: true,
        orgId: true,
      },
    })

    if (!cycle || cycle.orgId !== employee.department.orgId) {
      throw new AppError(404, 'CYCLE_NOT_FOUND', '현재 조직에서 사용할 평가 주기를 찾을 수 없습니다.')
    }

    const existing = validated.data.id
      ? await prisma.onboardingReviewWorkflow.findUnique({
          where: { id: validated.data.id },
        })
      : null

    if (existing && existing.evalCycleId !== validated.data.evalCycleId) {
      throw new AppError(400, 'WORKFLOW_CYCLE_MISMATCH', '워크플로우의 평가 주기는 변경할 수 없습니다.')
    }

    const saved = await upsertOnboardingReviewWorkflow({
      id: validated.data.id,
      evalCycleId: validated.data.evalCycleId,
      workflowName: validated.data.workflowName,
      isActive: validated.data.isActive,
      scheduleHourKst: validated.data.scheduleHourKst,
      targetConditions: validated.data.targetConditions,
      steps: validated.data.steps,
      createdById: existing?.createdById ?? session.user.id,
    })

    await createAuditLog({
      userId: session.user.id,
      action: existing ? 'ONBOARDING_REVIEW_WORKFLOW_UPDATED' : 'ONBOARDING_REVIEW_WORKFLOW_CREATED',
      entityType: 'OnboardingReviewWorkflow',
      entityId: saved.id,
      oldValue: existing
        ? {
            workflowName: existing.workflowName,
            isActive: existing.isActive,
            scheduleHourKst: existing.scheduleHourKst,
            targetConditions: existing.targetConditions,
            stepConfig: existing.stepConfig,
          }
        : undefined,
      newValue: {
        workflowName: saved.workflowName,
        isActive: saved.isActive,
        scheduleHourKst: saved.scheduleHourKst,
        targetConditions: saved.targetConditions,
        stepConfig: saved.stepConfig,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      id: saved.id,
      workflowName: saved.workflowName,
      message: existing ? '온보딩 리뷰 워크플로우를 수정했습니다.' : '온보딩 리뷰 워크플로우를 저장했습니다.',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
