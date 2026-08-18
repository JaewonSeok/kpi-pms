import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { CreateDepartmentScoreIntakeSchema, DeleteDepartmentScoreIntakeSchema } from '@/lib/validations'
import { createAuditLog, getClientInfo } from '@/lib/audit'

// M1-B2 / POST /api/admin/department-score-intake
// ADMIN이 cycle×본부/실/팀별 조직 점수를 입력(upsert)한다. unique key (evalCycleId, deptId).
// source는 DB default '전략기획팀' 사용. receivedById는 세션 직원 id 자동 주입.
// dormant — 다른 코드가 이 row를 아직 읽지 않음.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN')
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')

    const body = await request.json()
    const validated = CreateDepartmentScoreIntakeSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const { evalCycleId, deptId, score, note, gradeId } = validated.data
    const receivedById = session.user.id
    const now = new Date()

    // audit oldValue를 위해 upsert 전 기존 row 1회 조회 (없으면 null).
    const previous = await prisma.departmentScoreIntake.findUnique({
      where: { evalCycleId_deptId: { evalCycleId, deptId } },
      select: {
        id: true,
        score: true,
        note: true,
        gradeId: true,
        receivedById: true,
        receivedAt: true,
      },
    })

    const intake = await prisma.departmentScoreIntake.upsert({
      where: { evalCycleId_deptId: { evalCycleId, deptId } },
      create: {
        evalCycleId,
        deptId,
        score,
        note,
        gradeId: gradeId ?? null,
        receivedById,
        // source는 DB default '전략기획팀'에 위임 (사용자 명시).
      },
      update: {
        score,
        note: note ?? null,
        // gradeId: undefined → 기존 값 유지, null → 등급 삭제, string → 갱신
        ...(typeof gradeId !== 'undefined' ? { gradeId } : {}),
        receivedById,
        receivedAt: now,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'DEPARTMENT_SCORE_INTAKE_UPSERT',
      entityType: 'DepartmentScoreIntake',
      entityId: intake.id,
      oldValue: previous
        ? {
            score: previous.score,
            note: previous.note,
            gradeId: previous.gradeId,
            receivedById: previous.receivedById,
            receivedAt: previous.receivedAt,
          }
        : undefined,
      newValue: {
        evalCycleId,
        deptId,
        score,
        note: note ?? null,
        gradeId: gradeId ?? null,
        receivedById,
      },
      ...getClientInfo(request),
    })

    return successResponse(intake)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN')
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const validated = DeleteDepartmentScoreIntakeSchema.safeParse({
      evalCycleId: searchParams.get('evalCycleId'),
      deptId: searchParams.get('deptId'),
    })
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const { evalCycleId, deptId } = validated.data

    const existing = await prisma.departmentScoreIntake.findFirst({
      where: { evalCycleId, deptId },
      select: { id: true, score: true, note: true, gradeId: true, receivedById: true, receivedAt: true },
    })
    if (!existing) throw new AppError(404, 'INTAKE_NOT_FOUND', '입력된 점수가 없습니다.')

    await prisma.departmentScoreIntake.delete({ where: { id: existing.id } })

    await createAuditLog({
      userId: session.user.id,
      action: 'DEPARTMENT_SCORE_INTAKE_DELETED',
      entityType: 'DepartmentScoreIntake',
      entityId: existing.id,
      oldValue: {
        deptId,
        evalCycleId,
        score: existing.score,
        note: existing.note,
        gradeId: existing.gradeId,
        receivedById: existing.receivedById,
        receivedAt: existing.receivedAt,
      },
      ...getClientInfo(request),
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
