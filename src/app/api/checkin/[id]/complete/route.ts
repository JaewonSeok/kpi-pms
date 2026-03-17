import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { CompleteCheckInSchema } from '@/lib/validations'

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
    })
    if (!checkIn) throw new AppError(404, 'NOT_FOUND', '체크인을 찾을 수 없습니다.')

    // 매니저만 완료 처리 가능
    if (checkIn.managerId !== session.user.id && session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '매니저만 체크인을 완료 처리할 수 있습니다.')
    }

    const body = await request.json()
    const validated = CompleteCheckInSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    const updated = await prisma.checkIn.update({
      where: { id: id },
      data: {
        status: 'COMPLETED',
        actualDate: new Date(data.actualDate),
        duration: data.duration,
        keyTakeaways: data.keyTakeaways,
        managerNotes: data.managerNotes,
        actionItems: data.actionItems as any,
        nextCheckInDate: data.nextCheckInDate ? new Date(data.nextCheckInDate) : null,
        kpiDiscussed: data.kpiDiscussed as any,
        energyLevel: data.energyLevel,
        satisfactionLevel: data.satisfactionLevel,
        blockerCount: data.blockerCount,
      },
    })

    // 다음 체크인 자동 예약 알림
    if (data.nextCheckInDate) {
      await prisma.notification.create({
        data: {
          recipientId: checkIn.ownerId,
          type: 'CHECKIN_SCHEDULED',
          title: '다음 체크인 예정',
          message: `다음 체크인이 ${new Date(data.nextCheckInDate).toLocaleDateString('ko-KR')}으로 예약되었습니다.`,
          link: '/checkin',
          channel: 'IN_APP',
        },
      })
    }

    // 에너지 레벨 낮은 경우 매니저에게 알림 (번아웃 조기 감지)
    if (data.energyLevel && data.energyLevel <= 2) {
      // 두 번 연속 낮은 에너지 확인
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
            title: '⚠️ 번아웃 위험 감지',
            message: `${checkIn.ownerId} 팀원의 에너지 레벨이 2회 연속 낮습니다. 확인이 필요합니다.`,
            link: `/checkin/analytics?empId=${checkIn.ownerId}`,
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
