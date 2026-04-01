import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildGoalAlignmentCsv, getGoalAlignmentPageData, type GoalAlignmentStatusFilter } from '@/server/goal-alignment'
import { AppError, errorResponse } from '@/lib/utils'

function parseStatus(value?: string | null): GoalAlignmentStatusFilter | undefined {
  if (
    value === 'ALL' ||
    value === 'CONFIRMED' ||
    value === 'DRAFT' ||
    value === 'ORPHAN' ||
    value === 'AT_RISK'
  ) {
    return value
  }
  return undefined
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '성과 얼라인먼트 요약을 내보낼 권한이 없습니다.')
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const data = await getGoalAlignmentPageData(session, {
      year: year ? Number(year) : undefined,
      cycleId: searchParams.get('cycleId') ?? undefined,
      departmentId: searchParams.get('departmentId') ?? undefined,
      status: parseStatus(searchParams.get('status')),
    })

    const csv = buildGoalAlignmentCsv(data)
    const filename = `goal-alignment-${data.selectedYear}.csv`

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
