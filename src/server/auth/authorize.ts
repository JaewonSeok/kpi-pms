import type { Employee } from '@prisma/client'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError } from '@/lib/utils'
import { canAccessMenu } from '@/lib/auth/permissions'
import type { AuthRole, MenuKey } from '@/types/auth'

type AuthSession = Session | null

export async function authorize(requiredRoles: AuthRole[]) {
  const session = await getServerSession(authOptions)

  if (!session) {
    throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
  }

  if (!requiredRoles.includes(session.user.role as AuthRole)) {
    throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
  }

  return session
}

export async function authorizeMenu(menuKey: MenuKey) {
  const session = await getServerSession(authOptions)

  if (!session) {
    throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
  }

  if (!canAccessMenu(session.user.role, menuKey)) {
    throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
  }

  return session
}

export function canAccessDepartment(
  session: AuthSession,
  targetDeptId: string
) {
  if (!session) return false
  if (session.user.role === 'ROLE_ADMIN' || session.user.role === 'ROLE_CEO') return true
  const accessibleDepartmentIds = Array.isArray(session.user.accessibleDepartmentIds)
    ? session.user.accessibleDepartmentIds
    : []
  return accessibleDepartmentIds.includes(targetDeptId)
}

export function canAccessEmployee(
  session: AuthSession,
  targetEmployee: Pick<Employee, 'id' | 'deptId'>
) {
  if (!session) return false
  if (session.user.id === targetEmployee.id) return true
  return canAccessDepartment(session, targetEmployee.deptId)
}

export function withAuthorization<TArgs extends unknown[], TResult>(
  requiredRoles: AuthRole[],
  fn: (session: Session, ...args: TArgs) => Promise<TResult>
) {
  return async (...args: TArgs) => {
    const session = await authorize(requiredRoles)
    return fn(session, ...args)
  }
}
