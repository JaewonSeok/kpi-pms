import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { UpdateCheckInSchema } from '@/lib/validations'
import { canAccessCheckin } from '@/server/checkin-access'

async function findCheckin(id: string) {
  return prisma.checkIn.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          empName: true,
          empId: true,
          position: true,
          profileImageUrl: true,
          teamLeaderId: true,
          sectionChiefId: true,
          divisionHeadId: true,
          department: { select: { deptName: true } },
        },
      },
      manager: {
        select: { id: true, empName: true, empId: true, position: true },
      },
    },
  })
}

// GET /api/checkin/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await params
    const checkIn = await findCheckin(id)

    if (!checkIn) throw new AppError(404, 'NOT_FOUND', '체크인을 찾을 수 없습니다.')

    const allowed = await canAccessCheckin(session.user.id, session.user.role, checkIn)
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', '체크인에 접근할 권한이 없습니다.')
    }

    return successResponse(checkIn)
  } catch (error) {
    return errorResponse(error)
  }
}

// PUT /api/checkin/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await params
    const checkIn = await findCheckin(id)
    if (!checkIn) throw new AppError(404, 'NOT_FOUND', '체크인을 찾을 수 없습니다.')

    const allowed = await canAccessCheckin(session.user.id, session.user.role, checkIn)
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', '체크인을 수정할 권한이 없습니다.')
    }

    const body = await request.json()
    const validated = UpdateCheckInSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data
    const nextScheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : undefined
    const rescheduled =
      nextScheduledDate &&
      checkIn.scheduledDate.getTime() !== nextScheduledDate.getTime() &&
      checkIn.status !== 'COMPLETED' &&
      checkIn.status !== 'CANCELLED'

    const updated = await prisma.checkIn.update({
      where: { id },
      data: {
        agendaItems: data.agendaItems as never,
        ownerNotes: data.ownerNotes,
        managerNotes: data.managerNotes,
        keyTakeaways: data.keyTakeaways,
        actionItems: data.actionItems as never,
        nextCheckInDate:
          data.nextCheckInDate === null
            ? null
            : data.nextCheckInDate
              ? new Date(data.nextCheckInDate)
              : undefined,
        scheduledDate: nextScheduledDate,
        status: data.status ?? (rescheduled ? 'RESCHEDULED' : undefined),
      },
      include: {
        owner: {
          select: {
            id: true,
            empName: true,
            empId: true,
            position: true,
            profileImageUrl: true,
            department: { select: { deptName: true } },
          },
        },
        manager: {
          select: { id: true, empName: true, empId: true, position: true },
        },
      },
    })

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

// PATCH /api/checkin/[id]/cancel
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await params
    const checkIn = await findCheckin(id)
    if (!checkIn) throw new AppError(404, 'NOT_FOUND', '체크인을 찾을 수 없습니다.')

    const allowed = await canAccessCheckin(session.user.id, session.user.role, checkIn)
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', '체크인을 취소할 권한이 없습니다.')
    }

    const updated = await prisma.checkIn.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
