import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { FeedbackFolderSchema } from '@/lib/validations'
import { resolveFeedbackFolderId } from '@/server/feedback-360-admin'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

async function getAdminEmployee(userId: string) {
  return prisma.employee.findUnique({
    where: { id: userId },
    include: {
      department: true,
    },
  })
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '리뷰 폴더는 관리자만 관리할 수 있습니다.')
    }

    const employee = await getAdminEmployee(session.user.id)
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const folders = await prisma.feedbackFolder.findMany({
      where: {
        orgId: employee.department.orgId,
      },
      include: {
        _count: {
          select: {
            rounds: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return successResponse(folders)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '리뷰 폴더는 관리자만 관리할 수 있습니다.')
    }

    const body = await request.json()
    const validated = FeedbackFolderSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '폴더 입력값을 확인해 주세요.')
    }

    const employee = await getAdminEmployee(session.user.id)
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const folder = await prisma.feedbackFolder.create({
      data: {
        orgId: employee.department.orgId,
        name: validated.data.name,
        description: validated.data.description || null,
        color: validated.data.color || null,
        sortOrder: validated.data.sortOrder,
        createdById: session.user.id,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_FOLDER_CREATED',
      entityType: 'FeedbackFolder',
      entityId: folder.id,
      newValue: {
        name: folder.name,
        description: folder.description,
        color: folder.color,
      },
      ...getClientInfo(request),
    })

    return successResponse(folder)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '리뷰 폴더는 관리자만 관리할 수 있습니다.')
    }

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const validated = FeedbackFolderSchema.safeParse(body)
    if (!id) {
      throw new AppError(400, 'FOLDER_ID_REQUIRED', '수정할 폴더를 선택해 주세요.')
    }
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '폴더 입력값을 확인해 주세요.')
    }

    const employee = await getAdminEmployee(session.user.id)
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const existing = await prisma.feedbackFolder.findUnique({
      where: { id },
    })
    if (!existing) {
      throw new AppError(404, 'FOLDER_NOT_FOUND', '리뷰 폴더를 찾을 수 없습니다.')
    }
    if (existing.orgId !== employee.department.orgId) {
      throw new AppError(403, 'FORBIDDEN', '현재 조직에서 관리할 수 없는 리뷰 폴더입니다.')
    }

    const folder = await prisma.feedbackFolder.update({
      where: { id },
      data: {
        name: validated.data.name,
        description: validated.data.description || null,
        color: validated.data.color || null,
        sortOrder: validated.data.sortOrder,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_FOLDER_UPDATED',
      entityType: 'FeedbackFolder',
      entityId: folder.id,
      oldValue: {
        name: existing.name,
        description: existing.description,
        color: existing.color,
      },
      newValue: {
        name: folder.name,
        description: folder.description,
        color: folder.color,
      },
      ...getClientInfo(request),
    })

    return successResponse(folder)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '리뷰 폴더는 관리자만 관리할 수 있습니다.')
    }

    const employee = await getAdminEmployee(session.user.id)
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const { searchParams } = new URL(request.url)
    const body = await request.json().catch(() => null)
    const id = resolveFeedbackFolderId({
      searchParamId: searchParams.get('id'),
      body,
    })
    if (!id) {
      throw new AppError(400, 'FOLDER_ID_REQUIRED', '삭제할 폴더를 선택해 주세요.')
    }

    const existing = await prisma.feedbackFolder.findUnique({
      where: { id },
    })
    if (!existing) {
      throw new AppError(404, 'FOLDER_NOT_FOUND', '리뷰 폴더를 찾을 수 없습니다.')
    }
    if (existing.orgId !== employee.department.orgId) {
      throw new AppError(403, 'FORBIDDEN', '현재 조직에서 관리할 수 없는 리뷰 폴더입니다.')
    }

    await prisma.multiFeedbackRound.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    })

    await prisma.feedbackFolder.delete({
      where: { id },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_FOLDER_DELETED',
      entityType: 'FeedbackFolder',
      entityId: existing.id,
      oldValue: {
        name: existing.name,
        description: existing.description,
        color: existing.color,
      },
      ...getClientInfo(request),
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
