import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { OrganizationWeightsSchema } from '@/lib/validations'
import {
  resolveOrganizationWeights2026,
  writePolicy2026OrganizationWeightsToConfig,
} from '@/lib/policy-2026-organization-weights'
import { createAuditLog, getClientInfo } from '@/lib/audit'

type RouteContext = {
  params: Promise<{ id: string }>
}

// M1-C / PATCH /api/admin/eval-cycles/[id]/organization-weights
// 조직 30% 점수 내부 가중치(본부/실/팀)를 EvalCycle.performanceDesignConfig.policy2026OrganizationWeights에 저장.
// 기존 config의 다른 키(milestones, policy2026PreviewMappings 등)는 merge로 보존.
// 30:70 자체는 고정 — personal은 schema에서 0.70 강제. 조직 30%의 내부 분배만 커스텀.
// dormant — 본 라우트의 저장값을 읽는 코드 아직 없음 (M1-D에서 wiring 예정).
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { id: cycleId } = await context.params
    const body = await request.json()
    const validated = OrganizationWeightsSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const existing = await prisma.evalCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true,
        cycleName: true,
        performanceDesignConfig: true,
      },
    })
    if (!existing) {
      throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 사이클을 찾을 수 없습니다.')
    }

    // ★ Merge — 기존 config의 다른 키를 보존하면서 policy2026OrganizationWeights만 갱신.
    const nextConfig = writePolicy2026OrganizationWeightsToConfig(
      existing.performanceDesignConfig,
      validated.data,
    )

    const updated = await prisma.evalCycle.update({
      where: { id: cycleId },
      data: {
        performanceDesignConfig: nextConfig as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        cycleName: true,
        performanceDesignConfig: true,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'EVAL_CYCLE_ORGANIZATION_WEIGHTS_UPDATED',
      entityType: 'EvalCycle',
      entityId: cycleId,
      oldValue: resolveOrganizationWeights2026(existing.performanceDesignConfig),
      newValue: validated.data,
      ...getClientInfo(request),
    })

    return successResponse({
      id: updated.id,
      cycleName: updated.cycleName,
      organizationWeights: validated.data,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
