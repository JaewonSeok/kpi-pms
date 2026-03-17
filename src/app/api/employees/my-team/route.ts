import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'

// GET /api/employees/my-team
// 내 팀원 목록 조회 (팀장 역할)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const role = session.user.role

    let teamMembers: any[] = []

    if (role === 'ROLE_TEAM_LEADER') {
      // 팀장: teamLeaderId가 본인인 팀원
      teamMembers = await prisma.employee.findMany({
        where: { teamLeaderId: session.user.id, status: 'ACTIVE' },
        select: {
          id: true, empId: true, empName: true, position: true,
          department: { select: { deptName: true } },
          profileImageUrl: true,
        },
        orderBy: { empName: 'asc' },
      })
    } else if (role === 'ROLE_SECTION_CHIEF') {
      // 실장: sectionChiefId가 본인인 직원
      teamMembers = await prisma.employee.findMany({
        where: { sectionChiefId: session.user.id, status: 'ACTIVE' },
        select: {
          id: true, empId: true, empName: true, position: true,
          department: { select: { deptName: true } },
        },
        orderBy: { empName: 'asc' },
      })
    } else if (role === 'ROLE_DIV_HEAD') {
      teamMembers = await prisma.employee.findMany({
        where: { divisionHeadId: session.user.id, status: 'ACTIVE' },
        select: {
          id: true, empId: true, empName: true, position: true,
          department: { select: { deptName: true } },
        },
        orderBy: { empName: 'asc' },
      })
    } else if (role === 'ROLE_ADMIN' || role === 'ROLE_CEO') {
      teamMembers = await prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true, empId: true, empName: true, position: true,
          department: { select: { deptName: true } },
        },
        orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
      })
    }

    return successResponse(teamMembers)
  } catch (error) {
    return errorResponse(error)
  }
}
