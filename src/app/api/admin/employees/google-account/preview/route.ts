import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeMenu } from '@/server/auth/authorize'
import { previewEmployeeLeadershipLinks } from '@/server/admin/employeeHierarchy'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

const PreviewRoleSchema = z.enum([
  'ROLE_MEMBER',
  'ROLE_TEAM_LEADER',
  'ROLE_SECTION_CHIEF',
  'ROLE_DIV_HEAD',
  'ROLE_CEO',
  'ROLE_ADMIN',
])

const PreviewStatusSchema = z.enum(['ACTIVE', 'ON_LEAVE', 'RESIGNED'])

const PreviewEmployeeSchema = z.object({
  id: z.string().optional(),
  empId: z.string().min(1),
  empName: z.string().min(1),
  deptId: z.string().min(1),
  role: PreviewRoleSchema,
  status: PreviewStatusSchema,
  joinDate: z.string().optional(),
})

const PreviewBodySchema = z.object({
  contextLabel: z.string().max(100).optional(),
  updates: z.array(PreviewEmployeeSchema).optional(),
  creates: z.array(PreviewEmployeeSchema).optional(),
})

export async function POST(request: Request) {
  try {
    await authorizeMenu('SYSTEM_SETTING')

    const body = await request.json()
    const validated = PreviewBodySchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '미리보기 요청이 올바르지 않습니다.'
      )
    }

    const deptIds = [
      ...(validated.data.updates ?? []).map((item) => item.deptId),
      ...(validated.data.creates ?? []).map((item) => item.deptId),
    ]

    if (deptIds.length > 0) {
      const departments = await prisma.department.findMany({
        where: {
          id: { in: [...new Set(deptIds)] },
        },
        select: { id: true },
      })

      if (departments.length !== new Set(deptIds).size) {
        throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '미리보기에 사용할 부서를 찾을 수 없습니다.')
      }
    }

    const preview = await previewEmployeeLeadershipLinks({
      updates: (validated.data.updates ?? []).map((item) => ({
        ...item,
        joinDate: item.joinDate ? new Date(item.joinDate) : undefined,
      })),
      creates: (validated.data.creates ?? []).map((item) => ({
        ...item,
        joinDate: item.joinDate ? new Date(item.joinDate) : undefined,
      })),
    })

    return successResponse({
      contextLabel: validated.data.contextLabel ?? '조직장 체계 미리보기',
      ...preview,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
