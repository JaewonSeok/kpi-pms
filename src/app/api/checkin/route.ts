import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { CreateCheckInSchema } from '@/lib/validations'
import { canOperateCheckinRole } from '@/server/checkin-access'

// GET /api/checkin
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const role = session.user.role
    const isOperator = canOperateCheckinRole(role)

    const checkIns = await prisma.checkIn.findMany({
      where: {
        OR: isOperator
          ? [{ ownerId: session.user.id }, { managerId: session.user.id }]
          : [{ ownerId: session.user.id }],
        ...(status ? { status: status as never } : {}),
        ...(type ? { checkInType: type as never } : {}),
      },
      include: {
        owner: {
          select: {
            empName: true,
            empId: true,
            position: true,
            profileImageUrl: true,
            department: { select: { deptName: true } },
          },
        },
        manager: {
          select: {
            empName: true,
            empId: true,
            position: true,
          },
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

    let managerId = session.user.id
    const ownerId = data.ownerId

    if (ownerId === session.user.id) {
      const employee = await prisma.employee.findUnique({
        where: { id: session.user.id },
        select: { teamLeaderId: true },
      })

      if (!employee?.teamLeaderId) {
        throw new AppError(400, 'NO_MANAGER', '대상 리더가 없어 체크인을 예약할 수 없습니다.')
      }

      managerId = employee.teamLeaderId
    } else if (!canOperateCheckinRole(role)) {
      throw new AppError(403, 'FORBIDDEN', '리더 이상만 다른 구성원의 체크인을 예약할 수 있습니다.')
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        ownerId,
        managerId,
        checkInType: data.checkInType,
        scheduledDate: new Date(data.scheduledDate),
        agendaItems: data.agendaItems as never,
        ownerNotes: data.ownerNotes,
        status: 'SCHEDULED',
      },
      include: {
        owner: {
          select: {
            empName: true,
            empId: true,
            department: { select: { deptName: true } },
          },
        },
        manager: {
          select: { empName: true, empId: true },
        },
      },
    })

    const recipientId = session.user.id === ownerId ? managerId : ownerId
    await prisma.notification.create({
      data: {
        recipientId,
        type: 'CHECKIN_SCHEDULED',
        title: '체크인 일정',
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
