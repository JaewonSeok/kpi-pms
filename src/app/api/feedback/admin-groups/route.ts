import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { FeedbackAdminGroupSchema } from '@/lib/validations'

async function getAdminEmployee(userId: string) {
  return prisma.employee.findUnique({
    where: { id: userId },
    include: {
      department: true,
    },
  })
}

async function resolveEligibleMembers(orgId: string, memberIds: string[]) {
  if (!memberIds.length) return []

  return prisma.employee.findMany({
    where: {
      id: { in: memberIds },
      status: 'ACTIVE',
      department: {
        orgId,
      },
    },
    select: {
      id: true,
      empName: true,
      gwsEmail: true,
    },
  })
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '리뷰 권한 그룹은 전역 관리자만 관리할 수 있습니다.')
    }

    const validated = FeedbackAdminGroupSchema.safeParse(await request.json())
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '권한 그룹 입력값을 확인해 주세요.'
      )
    }

    const employee = await getAdminEmployee(session.user.id)
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const memberIds = Array.from(new Set(validated.data.memberIds))
    const members = await resolveEligibleMembers(employee.department.orgId, memberIds)
    if (members.length !== memberIds.length) {
      throw new AppError(
        400,
        'INVALID_MEMBER',
        '같은 조직의 재직 구성원만 리뷰 권한 그룹에 추가할 수 있습니다.'
      )
    }

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.feedbackAdminGroup.create({
        data: {
          orgId: employee.department.orgId,
          groupName: validated.data.groupName,
          description: validated.data.description || null,
          reviewScope: validated.data.reviewScope,
          createdById: session.user.id,
        },
      })

      if (memberIds.length) {
        await tx.feedbackAdminGroupMember.createMany({
          data: memberIds.map((memberId) => ({
            groupId: created.id,
            employeeId: memberId,
            createdById: session.user.id,
          })),
          skipDuplicates: true,
        })
      }

      return created
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_ADMIN_GROUP_CREATED',
      entityType: 'FeedbackAdminGroup',
      entityId: group.id,
      newValue: {
        groupName: group.groupName,
        description: group.description,
        reviewScope: group.reviewScope,
        memberIds,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      id: group.id,
      groupName: group.groupName,
      description: group.description,
      reviewScope: group.reviewScope,
      memberIds,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '리뷰 권한 그룹은 전역 관리자만 관리할 수 있습니다.')
    }

    const validated = FeedbackAdminGroupSchema.safeParse(await request.json())
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '권한 그룹 입력값을 확인해 주세요.'
      )
    }
    if (!validated.data.id) {
      throw new AppError(400, 'GROUP_ID_REQUIRED', '수정할 권한 그룹을 선택해 주세요.')
    }

    const employee = await getAdminEmployee(session.user.id)
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const existing = await prisma.feedbackAdminGroup.findUnique({
      where: { id: validated.data.id },
      include: {
        members: {
          select: {
            employeeId: true,
          },
        },
      },
    })

    if (!existing) {
      throw new AppError(404, 'GROUP_NOT_FOUND', '리뷰 권한 그룹을 찾을 수 없습니다.')
    }
    if (existing.orgId !== employee.department.orgId) {
      throw new AppError(403, 'FORBIDDEN', '현재 조직에서 관리할 수 없는 리뷰 권한 그룹입니다.')
    }

    const memberIds = Array.from(new Set(validated.data.memberIds))
    const members = await resolveEligibleMembers(employee.department.orgId, memberIds)
    if (members.length !== memberIds.length) {
      throw new AppError(
        400,
        'INVALID_MEMBER',
        '같은 조직의 재직 구성원만 리뷰 권한 그룹에 추가할 수 있습니다.'
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.feedbackAdminGroup.update({
        where: { id: existing.id },
        data: {
          groupName: validated.data.groupName,
          description: validated.data.description || null,
          reviewScope: validated.data.reviewScope,
        },
      })

      await tx.feedbackAdminGroupMember.deleteMany({
        where: {
          groupId: existing.id,
        },
      })

      if (memberIds.length) {
        await tx.feedbackAdminGroupMember.createMany({
          data: memberIds.map((memberId) => ({
            groupId: existing.id,
            employeeId: memberId,
            createdById: session.user.id,
          })),
          skipDuplicates: true,
        })
      }

      return tx.feedbackAdminGroup.findUnique({
        where: { id: existing.id },
        select: {
          id: true,
          groupName: true,
          description: true,
          reviewScope: true,
        },
      })
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_ADMIN_GROUP_UPDATED',
      entityType: 'FeedbackAdminGroup',
      entityId: existing.id,
      oldValue: {
        groupName: existing.groupName,
        description: existing.description,
        reviewScope: existing.reviewScope,
        memberIds: existing.members.map((member) => member.employeeId),
      },
      newValue: {
        groupName: updated?.groupName ?? validated.data.groupName,
        description: updated?.description ?? validated.data.description ?? null,
        reviewScope: updated?.reviewScope ?? validated.data.reviewScope,
        memberIds,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      id: existing.id,
      groupName: updated?.groupName ?? validated.data.groupName,
      description: updated?.description ?? validated.data.description ?? null,
      reviewScope: updated?.reviewScope ?? validated.data.reviewScope,
      memberIds,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '리뷰 권한 그룹은 전역 관리자만 관리할 수 있습니다.')
    }

    const body = await request.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) {
      throw new AppError(400, 'GROUP_ID_REQUIRED', '삭제할 권한 그룹을 선택해 주세요.')
    }

    const employee = await getAdminEmployee(session.user.id)
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const existing = await prisma.feedbackAdminGroup.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            employeeId: true,
          },
        },
      },
    })

    if (!existing) {
      throw new AppError(404, 'GROUP_NOT_FOUND', '리뷰 권한 그룹을 찾을 수 없습니다.')
    }
    if (existing.orgId !== employee.department.orgId) {
      throw new AppError(403, 'FORBIDDEN', '현재 조직에서 관리할 수 없는 리뷰 권한 그룹입니다.')
    }

    await prisma.feedbackAdminGroup.delete({
      where: { id },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_ADMIN_GROUP_DELETED',
      entityType: 'FeedbackAdminGroup',
      entityId: existing.id,
      oldValue: {
        groupName: existing.groupName,
        description: existing.description,
        reviewScope: existing.reviewScope,
        memberIds: existing.members.map((member) => member.employeeId),
      },
      ...getClientInfo(request),
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
