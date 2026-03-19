import type { Employee, SystemRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const CHECKIN_OPERATOR_ROLES: SystemRole[] = [
  'ROLE_TEAM_LEADER',
  'ROLE_SECTION_CHIEF',
  'ROLE_DIV_HEAD',
  'ROLE_CEO',
  'ROLE_ADMIN',
]

export function canOperateCheckinRole(role: SystemRole) {
  return CHECKIN_OPERATOR_ROLES.includes(role)
}

export async function getManagedEmployees(userId: string, role: SystemRole) {
  if (role === 'ROLE_TEAM_LEADER') {
    return prisma.employee.findMany({
      where: { teamLeaderId: userId, status: 'ACTIVE' },
      select: {
        id: true,
        empId: true,
        empName: true,
        position: true,
        role: true,
        deptId: true,
        department: { select: { deptName: true } },
      },
      orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
    })
  }

  if (role === 'ROLE_SECTION_CHIEF') {
    return prisma.employee.findMany({
      where: { sectionChiefId: userId, status: 'ACTIVE' },
      select: {
        id: true,
        empId: true,
        empName: true,
        position: true,
        role: true,
        deptId: true,
        department: { select: { deptName: true } },
      },
      orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
    })
  }

  if (role === 'ROLE_DIV_HEAD') {
    return prisma.employee.findMany({
      where: { divisionHeadId: userId, status: 'ACTIVE' },
      select: {
        id: true,
        empId: true,
        empName: true,
        position: true,
        role: true,
        deptId: true,
        department: { select: { deptName: true } },
      },
      orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
    })
  }

  if (role === 'ROLE_CEO' || role === 'ROLE_ADMIN') {
    return prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        empId: true,
        empName: true,
        position: true,
        role: true,
        deptId: true,
        department: { select: { deptName: true } },
      },
      orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
    })
  }

  return []
}

export async function canAccessCheckin(
  sessionUserId: string,
  sessionRole: SystemRole,
  checkin: {
    ownerId: string
    managerId: string
    owner?: Pick<Employee, 'teamLeaderId' | 'sectionChiefId' | 'divisionHeadId'>
  }
) {
  if (checkin.ownerId === sessionUserId || checkin.managerId === sessionUserId) {
    return true
  }

  if (sessionRole === 'ROLE_ADMIN' || sessionRole === 'ROLE_CEO') {
    return true
  }

  const owner = checkin.owner
  if (!owner) return false

  return (
    owner.teamLeaderId === sessionUserId ||
    owner.sectionChiefId === sessionUserId ||
    owner.divisionHeadId === sessionUserId
  )
}
