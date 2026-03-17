import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'

// GET /api/checkin/[id]
export async function GET(
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
        owner: { select: { empName: true, empId: true, position: true, profileImageUrl: true } },
        manager: { select: { empName: true, empId: true, position: true } },
      },
    })

    if (!checkIn) throw new AppError(404, 'NOT_FOUND', '체크인을 찾을 수 없습니다.')

    // 접근 권한: 당사자만
    if (checkIn.ownerId !== session.user.id && checkIn.managerId !== session.user.id && session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
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

    const checkIn = await prisma.checkIn.findUnique({ where: { id } })
    if (!checkIn) throw new AppError(404, 'NOT_FOUND', '체크인을 찾을 수 없습니다.')
    if (checkIn.ownerId !== session.user.id && checkIn.managerId !== session.user.id) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
    }

    const body = await request.json()
    const updated = await prisma.checkIn.update({
      where: { id },
      data: {
        agendaItems: body.agendaItems,
        ownerNotes: body.ownerNotes,
        managerNotes: body.managerNotes,
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
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

    const checkIn = await prisma.checkIn.findUnique({ where: { id } })
    if (!checkIn) throw new AppError(404, 'NOT_FOUND', '체크인을 찾을 수 없습니다.')
    if (checkIn.ownerId !== session.user.id && checkIn.managerId !== session.user.id) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
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
