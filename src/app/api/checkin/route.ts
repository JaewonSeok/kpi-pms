import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { CreateCheckInSchema } from '@/lib/validations'

// GET /api/checkin
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const role = session.user.role

    const isManager = ['ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO', 'ROLE_ADMIN'].includes(role)

    const checkIns = await prisma.checkIn.findMany({
      where: {
        OR: isManager
          ? [
              { ownerId: session.user.id },
              { managerId: session.user.id },
            ]
          : [{ ownerId: session.user.id }],
        ...(status ? { status: status as any } : {}),
        ...(type ? { checkInType: type as any } : {}),
      },
      include: {
        owner: {
          select: { empName: true, empId: true, position: true, profileImageUrl: true },
        },
        manager: {
          select: { empName: true, empId: true, position: true },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    })

    return successResponse(checkIns)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/checkin
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const body = await request.json()
    const validated = CreateCheckInSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data
    const role = session.user.role

    // 팀장이 팀원의 체크인을 생성하거나, 팀원이 본인 체크인 요청
    let managerId = session.user.id
    let ownerId = data.ownerId

    if (ownerId === session.user.id) {
      // 팀원이 직접 요청 - 팀장을 매니저로
      const employee = await prisma.employee.findUnique({
        where: { id: session.user.id },
      })
      if (!employee?.teamLeaderId) {
        throw new AppError(400, 'NO_MANAGER', '담당 팀장이 없습니다.')
      }
      managerId = employee.teamLeaderId
    } else {
      // 팀장이 팀원 체크인 생성
      if (!['ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_ADMIN'].includes(role)) {
        throw new AppError(403, 'FORBIDDEN', '팀장 이상만 타인의 체크인을 생성할 수 있습니다.')
      }
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        ownerId,
        managerId,
        checkInType: data.checkInType,
        scheduledDate: new Date(data.scheduledDate),
        agendaItems: data.agendaItems as any,
        ownerNotes: data.ownerNotes,
        status: 'SCHEDULED',
      },
      include: {
        owner: { select: { empName: true, empId: true } },
        manager: { select: { empName: true, empId: true } },
      },
    })

    // 알림 생성
    const notifyId = session.user.id === ownerId ? managerId : ownerId
    await prisma.notification.create({
      data: {
        recipientId: notifyId,
        type: 'CHECKIN_SCHEDULED',
        title: '체크인 예정',
        message: `${new Date(data.scheduledDate).toLocaleDateString('ko-KR')} 체크인이 예약되었습니다.`,
        link: `/checkin/${checkIn.id}`,
        channel: 'IN_APP',
      },
    })

    return successResponse(checkIn)
  } catch (error) {
    return errorResponse(error)
  }
}
