import type { SystemRole } from '@prisma/client'

export type DepartmentAccessMode = 'GLOBAL' | 'SCOPED'

type TokenLike = {
  sub?: string | null
  email?: string | null
  name?: string | null
  role?: SystemRole | string | null
  empId?: string | null
  position?: string | null
  deptId?: string | null
  deptName?: string | null
  departmentCode?: string | null
  orgPath?: string | null
  accessibleDepartmentIds?: string[] | null
  departmentAccessMode?: DepartmentAccessMode | null
}

type CoreAuthTokenClaimKey =
  | 'sub'
  | 'email'
  | 'name'
  | 'role'
  | 'empId'
  | 'position'
  | 'deptId'
  | 'deptName'
  | 'departmentCode'
  | 'orgPath'

export type CoreAuthTokenClaims = TokenLike &
  {
    [K in CoreAuthTokenClaimKey]-?: NonNullable<TokenLike[K]>
  }

function normalizeDepartmentIds(accessibleDepartmentIds?: string[] | null) {
  if (!Array.isArray(accessibleDepartmentIds)) {
    return []
  }

  return [...new Set(accessibleDepartmentIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
}

export function resolveDepartmentAccessMode(role?: SystemRole | string | null): DepartmentAccessMode {
  return role === 'ROLE_ADMIN' || role === 'ROLE_CEO' ? 'GLOBAL' : 'SCOPED'
}

export function compressDepartmentScopeForToken(params: {
  role?: SystemRole | string | null
  accessibleDepartmentIds?: string[] | null
}) {
  const departmentAccessMode = resolveDepartmentAccessMode(params.role)
  const accessibleDepartmentIds = normalizeDepartmentIds(params.accessibleDepartmentIds)

  if (departmentAccessMode === 'GLOBAL') {
    return {
      departmentAccessMode,
      accessibleDepartmentIds: [] as string[],
    }
  }

  return {
    departmentAccessMode,
    accessibleDepartmentIds,
  }
}

export function hasCoreAuthTokenClaims(token?: TokenLike | null): token is CoreAuthTokenClaims {
  if (!token) {
    return false
  }

  return Boolean(
    token.sub &&
      token.email &&
      token.name &&
      token.role &&
      token.empId &&
      token.position &&
      token.deptId &&
      token.deptName &&
      token.departmentCode &&
      token.orgPath
  )
}

export function hasRecoverableAuthTokenIdentity(token?: TokenLike | null) {
  if (!token) {
    return false
  }

  return Boolean(
    (typeof token.sub === 'string' && token.sub.trim().length > 0) ||
      (typeof token.email === 'string' && token.email.trim().length > 0)
  )
}

export function estimateSerializedPayloadBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length
}
