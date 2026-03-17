import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'

// POST /api/admin/grades/[year]/copy
// 이전 연도 등급 설정 복사
export async function POST(
  request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')

    const { year } = await params
    const targetYear = parseInt(year)
    if (isNaN(targetYear)) throw new AppError(400, 'INVALID_YEAR', '유효하지 않은 연도입니다.')

    const body = await request.json()
    const sourceYear = parseInt(body.sourceYear)
    if (isNaN(sourceYear)) throw new AppError(400, 'INVALID_SOURCE_YEAR', '원본 연도가 유효하지 않습니다.')

    const org = await prisma.organization.findFirst()
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')

    const sourceGrades = await prisma.gradeSetting.findMany({
      where: { orgId: org.id, evalYear: sourceYear },
      orderBy: { gradeOrder: 'asc' },
    })

    if (sourceGrades.length === 0) {
      throw new AppError(404, 'NO_SOURCE_GRADES', `${sourceYear}년 등급 설정이 없습니다.`)
    }

    // 대상 연도에 기존 데이터가 있으면 삭제 후 복사
    await prisma.$transaction(async (tx) => {
      await tx.gradeSetting.deleteMany({
        where: { orgId: org.id, evalYear: targetYear },
      })

      await tx.gradeSetting.createMany({
        data: sourceGrades.map(g => ({
          orgId: org.id,
          evalYear: targetYear,
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

    const newGrades = await prisma.gradeSetting.findMany({
      where: { orgId: org.id, evalYear: targetYear },
      orderBy: { gradeOrder: 'asc' },
    })

    return successResponse(newGrades)
  } catch (error) {
    return errorResponse(error)
  }
}
