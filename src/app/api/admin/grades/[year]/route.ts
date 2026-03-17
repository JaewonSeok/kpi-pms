import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { UpdateGradeSettingsSchema } from '@/lib/validations'
import { createAuditLog, getClientInfo } from '@/lib/audit'

// GET /api/admin/grades/[year]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')

    const { year: yearParam } = await params
    const year = parseInt(yearParam)
    if (isNaN(year)) throw new AppError(400, 'INVALID_YEAR', '유효하지 않은 연도입니다.')

    // 조직 조회 (첫 번째 조직 사용 - 단일 조직 가정)
    const org = await prisma.organization.findFirst()
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')

    const grades = await prisma.gradeSetting.findMany({
      where: { orgId: org.id, evalYear: year },
      orderBy: { gradeOrder: 'asc' },
    })

    return successResponse(grades)
  } catch (error) {
    return errorResponse(error)
  }
}

// PUT /api/admin/grades/[year]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')

    const { year: yearParam } = await params
    const year = parseInt(yearParam)
    if (isNaN(year)) throw new AppError(400, 'INVALID_YEAR', '유효하지 않은 연도입니다.')

    const body = await request.json()
    const validated = UpdateGradeSettingsSchema.safeParse({ evalYear: year, grades: body.grades })
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const { grades } = validated.data

    // 점수 범위 중복/공백 검증
    const sorted = [...grades].sort((a, b) => a.minScore - b.minScore)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].maxScore >= sorted[i + 1].minScore) {
        throw new AppError(400, 'SCORE_OVERLAP', `등급 ${sorted[i].gradeName}와 ${sorted[i + 1].gradeName}의 점수 범위가 겹칩니다.`)
      }
      if (sorted[i].maxScore + 1 < sorted[i + 1].minScore) {
        throw new AppError(400, 'SCORE_GAP', `등급 간 점수 범위에 공백이 있습니다. (${sorted[i].maxScore + 1} ~ ${sorted[i + 1].minScore - 1})`)
      }
    }

    const org = await prisma.organization.findFirst()
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')

    // 기존 등급 조회 (감사 로그용)
    const oldGrades = await prisma.gradeSetting.findMany({
      where: { orgId: org.id, evalYear: year },
    })

    // 트랜잭션으로 일괄 업데이트
    await prisma.$transaction(async (tx) => {
      // 기존 등급 삭제
      await tx.gradeSetting.deleteMany({
        where: { orgId: org.id, evalYear: year },
      })

      // 새 등급 생성
      await tx.gradeSetting.createMany({
        data: grades.map(g => ({
          orgId: org.id,
          evalYear: year,
          gradeOrder: g.gradeOrder,
          gradeName: g.gradeName,
          baseScore: g.baseScore,
          minScore: g.minScore,
          maxScore: g.maxScore,
          levelName: g.levelName,
          description: g.description,
          targetDistRate: g.targetDistRate,
          isActive: g.isActive,
        })),
      })
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'GRADE_SETTINGS_UPDATE',
      entityType: 'GradeSetting',
      oldValue: { grades: oldGrades },
      newValue: { grades, evalYear: year },
      ...clientInfo,
    })

    const updatedGrades = await prisma.gradeSetting.findMany({
      where: { orgId: org.id, evalYear: year },
      orderBy: { gradeOrder: 'asc' },
    })

    return successResponse(updatedGrades)
  } catch (error) {
    return errorResponse(error)
  }
}
