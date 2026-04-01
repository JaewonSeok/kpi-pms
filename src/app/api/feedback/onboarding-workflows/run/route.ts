import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { OnboardingReviewWorkflowRunSchema } from '@/lib/validations'
import { runOnboardingReviewGeneration } from '@/server/onboarding-review-workflow'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '온보딩 리뷰 자동 생성은 관리자만 실행할 수 있습니다.')
    }

    const body = await request.json().catch(() => ({}))
    const validated = OnboardingReviewWorkflowRunSchema.safeParse(body)
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
      where: { id: validated.data.cycleId },
      select: {
        id: true,
        orgId: true,
      },
    })

    if (!cycle || cycle.orgId !== employee.department.orgId) {
      throw new AppError(404, 'CYCLE_NOT_FOUND', '현재 조직에서 사용할 평가 주기를 찾을 수 없습니다.')
    }

    const result = await runOnboardingReviewGeneration({
      cycleId: validated.data.cycleId,
      workflowId: validated.data.workflowId,
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'ONBOARDING_REVIEW_GENERATION_TRIGGERED',
      entityType: 'OnboardingReviewWorkflow',
      entityId: validated.data.workflowId,
      newValue: result,
      ...getClientInfo(request),
    })

    return successResponse({
      ...result,
      message: `자동 생성 ${result.createdCount}건, 중복 제외 ${result.duplicateCount}건을 처리했습니다.`,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
