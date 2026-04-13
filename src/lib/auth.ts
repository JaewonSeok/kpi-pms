import type { Prisma, SystemRole } from '@prisma/client'
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createAuditLog } from '@/lib/audit'
import {
  isImpersonationExpired,
  type ImpersonationSessionState,
} from '@/lib/impersonation'
import { canUseMasterLoginForActor } from '@/lib/master-login'
import { prisma } from '@/lib/prisma'
import { buildOrgPath, getAccessibleDeptIds } from '@/server/auth/org-scope'
import {
  createImpersonationSessionRecord,
  endImpersonationSessionRecord,
  findActiveImpersonationSession,
} from '@/server/impersonation'
import {
  compressDepartmentScopeForToken,
  hasCoreAuthTokenClaims,
  resolveDepartmentAccessMode,
  type DepartmentAccessMode,
} from './auth-session'
import { normalizeGoogleWorkspaceEmail } from './google-workspace'
import { applyAuthRuntimeEnvironment, readAuthEnv } from './auth-env'
import { decideGoogleAccess, resolveAuthRedirect } from './auth-flow'

function buildGoogleCallbackUrl(baseUrl: string) {
  return new URL('/api/auth/callback/google', baseUrl).toString()
}

const authRuntimePolicy = applyAuthRuntimeEnvironment()
const authEnv = readAuthEnv()
const googleCallbackUrl = authRuntimePolicy.shouldTrustHost
  ? 'request-host/api/auth/callback/google'
  : buildGoogleCallbackUrl(authEnv.baseUrl)

function maskEmail(email?: string | null) {
  if (!email) {
    return null
  }

  const [localPart, domain] = email.split('@')
  if (!domain) {
    return email
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? '*'}*@${domain}`
  }

  return `${localPart.slice(0, 2)}***@${domain}`
}

function authLog(level: 'info' | 'warn' | 'error', event: string, metadata?: Record<string, unknown>) {
  const payload = {
    event,
    ...(metadata ?? {}),
  }

  const message = `[auth] ${event} ${JSON.stringify(payload)}`
  if (level === 'error') {
    console.error(message)
    return
  }

  if (level === 'warn') {
    console.warn(message)
    return
  }

  console.log(message)
}

type DepartmentScopeNode = {
  id: string
  deptCode: string
  parentDeptId: string | null
}

const authEmployeeSelect = {
  id: true,
  gwsEmail: true,
  empName: true,
  role: true,
  empId: true,
  position: true,
  deptId: true,
  status: true,
  department: {
    select: {
      deptName: true,
      deptCode: true,
    },
  },
} satisfies Prisma.EmployeeSelect

type AuthEmployeeRecord = Prisma.EmployeeGetPayload<{
  select: typeof authEmployeeSelect
}>

type AuthClaims = {
  id: string
  email: string
  name: string
  role: SystemRole
  empId: string
  position: string
  deptId: string
  deptName: string
  departmentCode: string
  managerId: string | null
  orgPath: string
  accessibleDepartmentIds: string[]
  departmentAccessMode: DepartmentAccessMode
}

type MasterLoginSessionState = ImpersonationSessionState

type MasterLoginTokenState = ImpersonationSessionState & {
  actor: AuthClaims
  target: {
    id: string
    email: string
    name: string
    role: SystemRole
    deptName: string
  }
}

type MasterLoginUpdatePayload =
  | {
      action: 'start'
      targetEmployeeId: string
      reason: string
    }
  | {
      action: 'stop'
    }

async function loadDepartmentScope() {
  return prisma.department.findMany({
    select: {
      id: true,
      deptCode: true,
      parentDeptId: true,
    },
  }) as Promise<DepartmentScopeNode[]>
}

async function loadAllDepartmentIds() {
  const departments = await prisma.department.findMany({
    select: {
      id: true,
    },
  })

  return departments.map((department) => department.id)
}

async function buildAuthClaims(employee: AuthEmployeeRecord): Promise<AuthClaims> {
  const departments = await loadDepartmentScope()

  return {
    id: employee.id,
    email: employee.gwsEmail,
    name: employee.empName,
    role: employee.role,
    empId: employee.empId,
    position: employee.position,
    deptId: employee.deptId,
    deptName: employee.department.deptName,
    departmentCode: employee.department.deptCode,
    managerId: null,
    orgPath: buildOrgPath(employee, departments),
    accessibleDepartmentIds: getAccessibleDeptIds(employee, departments),
    departmentAccessMode: resolveDepartmentAccessMode(employee.role),
  }
}

function isAuthClaimsUser(value: unknown): value is AuthClaims {
  return hasCoreAuthTokenClaims(value as Parameters<typeof hasCoreAuthTokenClaims>[0])
}

function applyAuthClaimsToToken(
  token: {
    sub?: string | null
    email?: string | null
    name?: string | null
    role?: SystemRole
    empId?: string
    position?: string
    deptId?: string
    deptName?: string
    departmentCode?: string
    managerId?: string | null
    orgPath?: string
    accessibleDepartmentIds?: string[]
    departmentAccessMode?: DepartmentAccessMode
  },
  claims: AuthClaims
) {
  const scope = compressDepartmentScopeForToken({
    role: claims.role,
    accessibleDepartmentIds: claims.accessibleDepartmentIds,
  })

  token.sub = claims.id
  token.email = claims.email
  token.name = claims.name
  token.role = claims.role
  token.empId = claims.empId
  token.position = claims.position
  token.deptId = claims.deptId
  token.deptName = claims.deptName
  token.departmentCode = claims.departmentCode
  token.managerId = claims.managerId
  token.orgPath = claims.orgPath
  token.accessibleDepartmentIds = scope.accessibleDepartmentIds
  token.departmentAccessMode = scope.departmentAccessMode

  if (scope.departmentAccessMode === 'GLOBAL' && claims.accessibleDepartmentIds.length) {
    authLog('info', 'JWT_SCOPE_COMPRESSED', {
      employeeId: claims.id,
      role: claims.role,
      departmentCount: claims.accessibleDepartmentIds.length,
    })
  }
}

function extractAuthClaimsFromToken(token: {
  sub?: string | null
  email?: string | null
  name?: string | null
  role?: SystemRole
  empId?: string
  position?: string
  deptId?: string
  deptName?: string
  departmentCode?: string
  managerId?: string | null
  orgPath?: string
  accessibleDepartmentIds?: string[]
  departmentAccessMode?: DepartmentAccessMode
}) {
  if (!hasCoreAuthTokenClaims(token)) {
    return null
  }

  const departmentAccessMode = token.departmentAccessMode ?? resolveDepartmentAccessMode(token.role)

  return {
    id: token.sub,
    email: token.email,
    name: token.name,
    role: token.role,
    empId: token.empId,
    position: token.position,
    deptId: token.deptId,
    deptName: token.deptName,
    departmentCode: token.departmentCode,
    managerId: token.managerId ?? null,
    orgPath: token.orgPath,
    accessibleDepartmentIds: Array.isArray(token.accessibleDepartmentIds)
      ? token.accessibleDepartmentIds
      : [],
    departmentAccessMode,
  } satisfies AuthClaims
}

function isMasterLoginUpdatePayload(value: unknown): value is { masterLogin: MasterLoginUpdatePayload } {
  if (!value || typeof value !== 'object' || !('masterLogin' in value)) {
    return false
  }

  const masterLogin = (value as { masterLogin?: unknown }).masterLogin
  if (!masterLogin || typeof masterLogin !== 'object' || !('action' in masterLogin)) {
    return false
  }

  const action = (masterLogin as { action?: unknown }).action
  if (action === 'stop') {
    return true
  }

  if (action === 'start') {
    return (
      typeof (masterLogin as { targetEmployeeId?: unknown }).targetEmployeeId === 'string' &&
      typeof (masterLogin as { reason?: unknown }).reason === 'string'
    )
  }

  return false
}

function toSessionMasterLoginState(masterLogin: MasterLoginTokenState | null | undefined) {
  if (!masterLogin?.active) {
    return null
  }

  return {
    active: true,
    sessionId: masterLogin.sessionId,
    actorId: masterLogin.actor.id,
    actorName: masterLogin.actor.name,
    actorEmail: masterLogin.actor.email,
    targetId: masterLogin.target.id,
    startedAt: masterLogin.startedAt,
    expiresAt: masterLogin.expiresAt,
    reason: masterLogin.reason,
    targetName: masterLogin.target.name,
    targetEmail: masterLogin.target.email,
  } satisfies MasterLoginSessionState
}

function restoreActorClaims(
  token: {
    masterLogin?: MasterLoginTokenState | null
    sub?: string | null
    email?: string | null
    name?: string | null
    role?: SystemRole
    empId?: string
    position?: string
    deptId?: string
    deptName?: string
    departmentCode?: string
    managerId?: string | null
    orgPath?: string
    accessibleDepartmentIds?: string[]
    departmentAccessMode?: DepartmentAccessMode
  }
) {
  if (!token.masterLogin?.actor) {
    return null
  }

  const actorClaims = token.masterLogin.actor
  applyAuthClaimsToToken(token, actorClaims)
  token.masterLogin = null
  return actorClaims
}

async function findAuthEmployee(where: Prisma.EmployeeWhereUniqueInput) {
  return prisma.employee.findUnique({
    where,
    select: authEmployeeSelect,
  })
}

async function findEmployeeForToken(token: { sub?: string | null; email?: string | null }) {
  if (token.sub) {
    return findAuthEmployee({ id: token.sub })
  }

  if (token.email) {
    const normalizedEmail = normalizeGoogleWorkspaceEmail(token.email)
    return findAuthEmployee({ gwsEmail: normalizedEmail })
  }

  return null
}

async function hydrateTokenClaimsFromDirectory(
  token: Parameters<typeof extractAuthClaimsFromToken>[0],
  reason: 'jwt-rehydration' | 'session-rehydration'
) {
  const employee = await findEmployeeForToken(token)
  if (!employee) {
    authLog('warn', 'AUTH_EMPLOYEE_REHYDRATION_FAILED', {
      reason,
      tokenSub: token.sub ?? null,
      email: maskEmail(token.email),
    })
    return null
  }

  const claims = await buildAuthClaims(employee)
  applyAuthClaimsToToken(token, claims)
  authLog('info', 'AUTH_CLAIMS_REHYDRATED', {
    reason,
    employeeId: claims.id,
    email: maskEmail(claims.email),
    role: claims.role,
  })
  return claims
}

async function resolveSessionAccessibleDepartmentIds(claims: AuthClaims) {
  if (claims.departmentAccessMode === 'GLOBAL') {
    return loadAllDepartmentIds()
  }

  return claims.accessibleDepartmentIds
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      role: SystemRole
      empId: string
      position: string
      deptId: string
      deptName: string
      departmentCode: string
      managerId: string | null
      orgPath: string
      accessibleDepartmentIds: string[]
      departmentAccessMode?: DepartmentAccessMode
      masterLoginAvailable: boolean
      masterLogin: MasterLoginSessionState | null
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: SystemRole
    empId: string
    position: string
    deptId: string
    deptName: string
    departmentCode: string
    managerId: string | null
    orgPath: string
    accessibleDepartmentIds: string[]
    departmentAccessMode?: DepartmentAccessMode
    masterLoginAvailable?: boolean
    masterLogin?: MasterLoginSessionState | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: SystemRole
    empId: string
    position: string
    deptId: string
    deptName: string
    departmentCode: string
    managerId: string | null
    orgPath: string
    accessibleDepartmentIds: string[]
    departmentAccessMode?: DepartmentAccessMode
    masterLogin?: MasterLoginTokenState | null
  }
}

export const authOptions: NextAuthOptions = {
  secret: authEnv.secret,
  useSecureCookies: authRuntimePolicy.useSecureCookies,
  providers: [
    GoogleProvider({
      clientId: authEnv.googleClientId,
      clientSecret: authEnv.googleClientSecret,
      authorization: {
        params: {
          hd: authEnv.allowedDomain,
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    CredentialsProvider({
      id: 'admin-credentials',
      name: 'Admin Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        if (
          credentials.email === process.env.ADMIN_EMAIL &&
          credentials.password === process.env.ADMIN_PASSWORD
        ) {
          const employee = await findAuthEmployee({ gwsEmail: credentials.email })

          if (employee) {
            return buildAuthClaims(employee)
          }
        }

        return null
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = profile?.email || user.email
        authLog('info', 'GOOGLE_CALLBACK_RECEIVED', {
          provider: account.provider,
          email: maskEmail(email),
        })

        const normalizedEmail = email ? normalizeGoogleWorkspaceEmail(email) : null
        const employee = normalizedEmail
          ? await findAuthEmployee({ gwsEmail: normalizedEmail })
          : null

        authLog('info', 'GOOGLE_PROFILE_RESOLVED', {
          email: maskEmail(normalizedEmail),
          employeeId: employee?.id ?? null,
          employeeStatus: employee?.status ?? null,
          role: employee?.role ?? null,
        })

        const decision = decideGoogleAccess({
          email,
          allowedDomain: authEnv.allowedDomain,
          employeeStatus: employee?.status,
        })

        if (!decision.allowed) {
          authLog('warn', 'GOOGLE_SIGNIN_REJECTED', {
            reason: decision.errorCode,
            email: maskEmail(decision.normalizedEmail),
            provider: account.provider,
          })
          return `/login?error=${decision.errorCode}`
        }

        authLog('info', 'GOOGLE_SIGNIN_ALLOWED', {
          email: maskEmail(decision.normalizedEmail),
          employeeId: employee?.id,
          role: employee?.role,
        })

        return true
      }

      return true
    },

    async jwt({ token, user, account, profile, trigger, session }) {
      if (user && isAuthClaimsUser(user)) {
        applyAuthClaimsToToken(token, user)
        token.masterLogin = null
      } else if (user) {
        authLog('info', 'JWT_SKIPPED_NON_APP_USER', {
          provider: account?.provider ?? 'unknown',
          email: maskEmail(user.email),
        })
      }

      if (account?.provider === 'google' && profile?.email) {
        const normalizedEmail = normalizeGoogleWorkspaceEmail(profile.email)
        const employee = await findAuthEmployee({ gwsEmail: normalizedEmail })

        if (employee) {
          const claims = await buildAuthClaims(employee)
          applyAuthClaimsToToken(token, claims)
          token.masterLogin = null
          authLog('info', 'GOOGLE_JWT_CLAIMS_APPLIED', {
            employeeId: claims.id,
            email: maskEmail(claims.email),
            role: claims.role,
            departmentAccessMode: claims.departmentAccessMode,
          })
        } else {
          authLog('error', 'GOOGLE_JWT_EMPLOYEE_MISSING', {
            email: maskEmail(normalizedEmail),
          })
        }
      } else if (!account && (!hasCoreAuthTokenClaims(token) || !token.departmentAccessMode)) {
        await hydrateTokenClaimsFromDirectory(token, 'jwt-rehydration')
      }

      if (token.masterLogin?.active) {
        const currentMasterLogin = token.masterLogin
        const now = new Date()
        let expiredAction: 'MASTER_LOGIN_EXPIRED' | 'MASTER_LOGIN_FORCE_ENDED' | null = null

        if (isImpersonationExpired(currentMasterLogin, now)) {
          await endImpersonationSessionRecord(currentMasterLogin.sessionId, {
            endedBy: 'ttl',
            expiredAt: now.toISOString(),
          })
          expiredAction = 'MASTER_LOGIN_EXPIRED'
        } else {
          const persistedSession = await findActiveImpersonationSession(currentMasterLogin.sessionId)
          if (
            !persistedSession ||
            !persistedSession.isActive ||
            persistedSession.endedAt ||
            persistedSession.expiresAt.getTime() <= now.getTime()
          ) {
            if (persistedSession?.isActive) {
              await endImpersonationSessionRecord(currentMasterLogin.sessionId, {
                endedBy: 'server-check',
                expiredAt: now.toISOString(),
              })
            }
            expiredAction = 'MASTER_LOGIN_FORCE_ENDED'
          }
        }

        if (expiredAction) {
          const actorClaims = restoreActorClaims(token)
          if (actorClaims) {
            await createAuditLog({
              userId: actorClaims.id,
              action: expiredAction,
              entityType: 'ImpersonationSession',
              entityId: currentMasterLogin.sessionId,
              newValue: {
                actorEmail: actorClaims.email,
                targetEmail: currentMasterLogin.target.email,
                impersonationSessionId: currentMasterLogin.sessionId,
                expiredAt: now.toISOString(),
              },
            })
          }

          authLog('warn', expiredAction, {
            sessionId: currentMasterLogin.sessionId,
            actorEmail: maskEmail(currentMasterLogin.actor.email),
            targetEmail: maskEmail(currentMasterLogin.target.email),
          })
        }
      }

      if (trigger === 'update' && isMasterLoginUpdatePayload(session)) {
        const command = session.masterLogin

        if (command.action === 'stop') {
          if (token.masterLogin?.actor) {
            const currentMasterLogin = token.masterLogin
            const actorClaims = restoreActorClaims(token)

            await endImpersonationSessionRecord(currentMasterLogin.sessionId, {
              endedBy: 'actor',
              endedAt: new Date().toISOString(),
            })

            await createAuditLog({
              userId: actorClaims?.id ?? currentMasterLogin.actor.id,
              action: 'MASTER_LOGIN_ENDED',
              entityType: 'ImpersonationSession',
              entityId: currentMasterLogin.sessionId,
              newValue: {
                actorAdminId: currentMasterLogin.actor.id,
                actorEmail: currentMasterLogin.actor.email,
                impersonatedUserId: currentMasterLogin.target.id,
                targetEmail: currentMasterLogin.target.email,
                impersonationSessionId: currentMasterLogin.sessionId,
              },
            })

            authLog('info', 'MASTER_LOGIN_ENDED', {
              sessionId: currentMasterLogin.sessionId,
              actorEmail: maskEmail(currentMasterLogin.actor.email),
              targetEmail: maskEmail(currentMasterLogin.target.email),
            })
          }

          return token
        }

        if (token.masterLogin?.active) {
          authLog('warn', 'MASTER_LOGIN_ALREADY_ACTIVE', {
            actorEmail: maskEmail(token.masterLogin.actor.email),
            targetEmail: maskEmail(token.masterLogin.target.email),
          })
          return token
        }

        const actorClaims = extractAuthClaimsFromToken(token)
        const actorCanUseMasterLogin = actorClaims
          ? await canUseMasterLoginForActor({
              employeeId: actorClaims.id,
              role: actorClaims.role,
              email: actorClaims.email,
            })
          : false

        if (!actorClaims || !actorCanUseMasterLogin) {
          authLog('warn', 'MASTER_LOGIN_FORBIDDEN', {
            actorEmail: maskEmail(actorClaims?.email ?? token.email),
          })
          return token
        }

        if (command.targetEmployeeId === actorClaims.id) {
          authLog('warn', 'MASTER_LOGIN_SELF_TARGET', {
            actorEmail: maskEmail(actorClaims.email),
          })
          return token
        }

        const targetEmployee = await findAuthEmployee({ id: command.targetEmployeeId })
        if (!targetEmployee || targetEmployee.status !== 'ACTIVE') {
          authLog('warn', 'MASTER_LOGIN_TARGET_INVALID', {
            actorEmail: maskEmail(actorClaims.email),
            targetId: command.targetEmployeeId,
          })
          return token
        }

        const targetClaims = await buildAuthClaims(targetEmployee)
        const normalizedReason = command.reason.trim()
        const persistedActorClaims: AuthClaims = {
          ...actorClaims,
          ...compressDepartmentScopeForToken({
            role: actorClaims.role,
            accessibleDepartmentIds: actorClaims.accessibleDepartmentIds,
          }),
        }
        const impersonationSession = await createImpersonationSessionRecord({
          impersonatorAdminId: actorClaims.id,
          impersonatedUserId: targetClaims.id,
          reason: normalizedReason,
          metadata: {
            actorEmail: actorClaims.email,
            targetEmail: targetClaims.email,
          },
        })
        token.masterLogin = {
          active: true,
          sessionId: impersonationSession.id,
          actorId: actorClaims.id,
          actorName: actorClaims.name,
          actorEmail: actorClaims.email,
          targetId: targetClaims.id,
          targetName: targetClaims.name,
          targetEmail: targetClaims.email,
          reason: normalizedReason,
          startedAt: impersonationSession.startedAt.toISOString(),
          expiresAt: impersonationSession.expiresAt.toISOString(),
          actor: persistedActorClaims,
          target: {
            id: targetClaims.id,
            email: targetClaims.email,
            name: targetClaims.name,
            role: targetClaims.role,
            deptName: targetClaims.deptName,
          },
        }
        applyAuthClaimsToToken(token, targetClaims)

        await createAuditLog({
          userId: actorClaims.id,
          action: 'MASTER_LOGIN_STARTED',
          entityType: 'ImpersonationSession',
          entityId: impersonationSession.id,
          newValue: {
            impersonationSessionId: impersonationSession.id,
            actorAdminId: actorClaims.id,
            actorEmail: actorClaims.email,
            impersonatedUserId: targetClaims.id,
            targetEmail: targetClaims.email,
            reason: normalizedReason,
            expiresAt: impersonationSession.expiresAt.toISOString(),
          },
        })

        authLog('info', 'MASTER_LOGIN_STARTED', {
          sessionId: impersonationSession.id,
          actorEmail: maskEmail(actorClaims.email),
          targetEmail: maskEmail(targetClaims.email),
        })
      }

      return token
    },

    async redirect({ url, baseUrl }) {
      const resolvedUrl = resolveAuthRedirect(url, baseUrl)
      if (resolvedUrl !== url) {
        authLog('warn', 'REDIRECT_FALLBACK_APPLIED', {
          requestedUrl: url,
          resolvedUrl,
          baseUrl,
        })
      }

      return resolvedUrl
    },

    async session({ session, token }) {
      if (token) {
        let claims = extractAuthClaimsFromToken(token)

        if (!claims) {
          authLog('warn', 'SESSION_CLAIMS_INCOMPLETE', {
            tokenSub: token.sub ?? null,
            email: maskEmail(token.email),
          })
          claims = await hydrateTokenClaimsFromDirectory(token, 'session-rehydration')
        }

        if (!claims) {
          authLog('error', 'SESSION_RESOLUTION_FAILED', {
            tokenSub: token.sub ?? null,
            email: maskEmail(token.email),
          })
          return session
        }

        session.user.id = claims.id
        session.user.email = claims.email
        session.user.name = claims.name
        session.user.role = claims.role
        session.user.empId = claims.empId
        session.user.position = claims.position
        session.user.deptId = claims.deptId
        session.user.deptName = claims.deptName
        session.user.departmentCode = claims.departmentCode
        session.user.managerId = claims.managerId
        session.user.orgPath = claims.orgPath
        session.user.accessibleDepartmentIds = await resolveSessionAccessibleDepartmentIds(claims)
        session.user.departmentAccessMode = claims.departmentAccessMode
        session.user.masterLoginAvailable = token.masterLogin?.active
          ? true
          : await canUseMasterLoginForActor({
              employeeId: claims.id,
              role: claims.role,
              email: claims.email,
            })
        session.user.masterLogin = toSessionMasterLoginState(token.masterLogin)
      }

      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 60 * 60,
  },
  logger: {
    error(code, metadata) {
      console.error(
        `[auth] ${code}. Check ${authEnv.baseUrlSource}, ${authEnv.secretSource}, GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, and Google callback URL: ${googleCallbackUrl}`,
        metadata
      )
    },
    warn(code) {
      console.warn(`[auth] ${code}`)
    },
  },
}
