import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { CompleteCheckInSchema } from '@/lib/validations'
import { canAccessCheckin, canOperateCheckinRole } from '@/server/checkin-access'

// PATCH /api/checkin/[id]/complete
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await params

    const checkIn = await prisma.checkIn.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            teamLeaderId: true,
            sectionChiefId: true,
            divisionHeadId: true,
          },
        },
      },
    })

    if (!checkIn) throw new AppError(404, 'NOT_FOUND', '체크인을 찾을 수 없습니다.')

    const hasAccess = await canAccessCheckin(session.user.id, session.user.role, checkIn)
    if (!hasAccess || !canOperateCheckinRole(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '체크인을 완료 처리할 권한이 없습니다.')
    }

    const body = await request.json()
    const validated = CompleteCheckInSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    const updated = await prisma.checkIn.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualDate: new Date(data.actualDate),
        duration: data.duration,
        keyTakeaways: data.keyTakeaways,
        managerNotes: data.managerNotes,
        actionItems: data.actionItems as never,
        nextCheckInDate: data.nextCheckInDate ? new Date(data.nextCheckInDate) : null,
        kpiDiscussed: data.kpiDiscussed as never,
        energyLevel: data.energyLevel,
        satisfactionLevel: data.satisfactionLevel,
        blockerCount: data.blockerCount,
      },
    })

    if (data.nextCheckInDate) {
      await prisma.notification.create({
        data: {
          recipientId: checkIn.ownerId,
          type: 'CHECKIN_SCHEDULED',
          title: '다음 체크인 일정',
          message: `다음 체크인이 ${new Date(data.nextCheckInDate).toLocaleDateString('ko-KR')}으로 예약되었습니다.`,
          link: '/checkin',
          channel: 'IN_APP',
        },
      })
    }

    if (data.energyLevel && data.energyLevel <= 2) {
      const recentCheckIns = await prisma.checkIn.findMany({
        where: {
          ownerId: checkIn.ownerId,
          status: 'COMPLETED',
          id: { not: id },
        },
        orderBy: { actualDate: 'desc' },
        take: 1,
      })

      if (recentCheckIns.length > 0 && (recentCheckIns[0].energyLevel || 5) <= 2) {
        await prisma.notification.create({
          data: {
            recipientId: checkIn.managerId,
            type: 'SYSTEM',
            title: '반복 낮은 에너지 감지',
            message: '최근 체크인에서 에너지 레벨 저하가 연속으로 감지되었습니다. 확인이 필요합니다.',
            link: `/checkin?employeeId=${checkIn.ownerId}&scope=employee`,
            channel: 'BOTH',
          },
        })
      }
    }

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
