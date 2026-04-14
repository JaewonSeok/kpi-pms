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

type SessionUserLike = {
  id?: string | null
  email?: string | null
  name?: string | null
  role?: SystemRole | string | null
  empId?: string | null
  position?: string | null
  deptId?: string | null
  deptName?: string | null
  departmentCode?: string | null
  orgPath?: string | null
}

type SessionStateLike = {
  user?: SessionUserLike | null
  authState?: string | null
  authErrorCode?: string | null
  authErrorReason?: string | null
}

type TokenShellLike = TokenLike & {
  authState?: string | null
  authErrorCode?: string | null
  authErrorReason?: string | null
}

export type AuthenticatedSessionShell = {
  authState: 'AUTHENTICATED_BUT_CLAIMS_MISSING'
  authErrorCode: 'AuthenticatedButClaimsMissing' | 'CLAIMS_REHYDRATION_FAILED'
  authErrorReason: string | null
  user: {
    id: string
    email: string
    name: string
  }
}

export type ProtectedSessionAccessDecision =
  | {
      action: 'allow'
    }
  | {
      action: 'redirect-pending'
      reason: 'AuthenticatedButClaimsMissing' | 'CLAIMS_REHYDRATION_FAILED'
      authErrorReason: string | null
      source: 'session' | 'token'
    }
  | {
      action: 'redirect-login'
      reason: 'SessionRequired'
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

function resolveSessionIdentityUser(
  sessionOrUser?: SessionStateLike | SessionUserLike | null
): SessionUserLike | null {
  if (!sessionOrUser) {
    return null
  }

  if ('user' in sessionOrUser) {
    return sessionOrUser.user ?? null
  }

  return sessionOrUser as SessionUserLike
}

function normalizePendingErrorCode(
  errorCode?: string | null
): AuthenticatedSessionShell['authErrorCode'] {
  return errorCode === 'CLAIMS_REHYDRATION_FAILED'
    ? 'CLAIMS_REHYDRATION_FAILED'
    : 'AuthenticatedButClaimsMissing'
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

export function hasFullAppSessionUserClaims(user?: SessionUserLike | null) {
  if (!user) {
    return false
  }

  return Boolean(
    user.id &&
      user.email &&
      user.name &&
      user.role &&
      user.empId &&
      user.position &&
      user.deptId &&
      user.deptName &&
      user.departmentCode &&
      user.orgPath
  )
}

export function hasAuthenticatedSessionIdentity(
  sessionOrUser?: SessionStateLike | SessionUserLike | null
) {
  const user = resolveSessionIdentityUser(sessionOrUser)

  if (!user) {
    return false
  }

  return Boolean(
    (typeof user.id === 'string' && user.id.trim().length > 0) ||
      (typeof user.email === 'string' && user.email.trim().length > 0)
  )
}

export function buildAuthenticatedSessionShellFromToken(
  token?: TokenShellLike | null,
  options?: {
    authErrorCode?: string | null
    authErrorReason?: string | null
  }
): AuthenticatedSessionShell | null {
  if (!token) {
    return null
  }

  const id = typeof token.sub === 'string' ? token.sub.trim() : ''
  const email = typeof token.email === 'string' ? token.email.trim() : ''
  if (!id && !email) {
    return null
  }

  return {
    authState: 'AUTHENTICATED_BUT_CLAIMS_MISSING',
    authErrorCode: normalizePendingErrorCode(options?.authErrorCode ?? token.authErrorCode),
    authErrorReason: options?.authErrorReason ?? token.authErrorReason ?? null,
    user: {
      id,
      email,
      name: typeof token.name === 'string' ? token.name : '',
    },
  }
}

export function resolveProtectedSessionAccess(params: {
  session?: SessionStateLike | null
  fallbackToken?: TokenShellLike | null
}): ProtectedSessionAccessDecision {
  if (hasFullAppSessionUserClaims(params.session?.user)) {
    return {
      action: 'allow',
    }
  }

  if (
    params.session?.authState === 'AUTHENTICATED_BUT_CLAIMS_MISSING' ||
    hasAuthenticatedSessionIdentity(params.session)
  ) {
    return {
      action: 'redirect-pending',
      reason: normalizePendingErrorCode(params.session?.authErrorCode),
      authErrorReason: params.session?.authErrorReason ?? null,
      source: 'session',
    }
  }

  const fallbackShell = buildAuthenticatedSessionShellFromToken(params.fallbackToken)
  if (fallbackShell) {
    return {
      action: 'redirect-pending',
      reason: fallbackShell.authErrorCode,
      authErrorReason: fallbackShell.authErrorReason,
      source: 'token',
    }
  }

  return {
    action: 'redirect-login',
    reason: 'SessionRequired',
  }
}

export function estimateSerializedPayloadBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length
}
