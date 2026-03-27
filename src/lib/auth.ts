import type { Prisma, SystemRole } from '@prisma/client'
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { buildOrgPath, getAccessibleDeptIds } from '@/server/auth/org-scope'
import { normalizeGoogleWorkspaceEmail } from './google-workspace'
import { readAuthEnv } from './auth-env'
import { decideGoogleAccess, resolveAuthRedirect } from './auth-flow'

function buildGoogleCallbackUrl(baseUrl: string) {
  return new URL('/api/auth/callback/google', baseUrl).toString()
}

const authEnv = readAuthEnv()
const googleCallbackUrl = buildGoogleCallbackUrl(authEnv.baseUrl)

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
  }
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
  }
}

export const authOptions: NextAuthOptions = {
  secret: authEnv.secret,
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

        const normalizedEmail = email ? normalizeGoogleWorkspaceEmail(email) : null
        const employee = normalizedEmail
          ? await findAuthEmployee({ gwsEmail: normalizedEmail })
          : null

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

    async jwt({ token, user, account, profile }) {
      if (user) {
        token.sub = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
        token.empId = user.empId
        token.position = user.position
        token.deptId = user.deptId
        token.deptName = user.deptName
        token.departmentCode = user.departmentCode
        token.managerId = user.managerId
        token.orgPath = user.orgPath
        token.accessibleDepartmentIds = user.accessibleDepartmentIds
      }

      if (account?.provider === 'google' && profile?.email) {
        const normalizedEmail = normalizeGoogleWorkspaceEmail(profile.email)
        const employee = await findAuthEmployee({ gwsEmail: normalizedEmail })

        if (employee) {
          const claims = await buildAuthClaims(employee)
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
          token.accessibleDepartmentIds = claims.accessibleDepartmentIds
        } else {
          authLog('error', 'GOOGLE_JWT_EMPLOYEE_MISSING', {
            email: maskEmail(normalizedEmail),
          })
        }
      } else if (!account && (!token.departmentCode || !token.orgPath)) {
        const employee = await findEmployeeForToken(token)
        if (employee) {
          const claims = await buildAuthClaims(employee)
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
          token.accessibleDepartmentIds = claims.accessibleDepartmentIds
        } else {
          authLog('warn', 'JWT_REHYDRATION_EMPLOYEE_MISSING', {
            tokenSub: token.sub ?? null,
            email: maskEmail(token.email),
          })
        }
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
        if (!token.sub || !token.role) {
          authLog('warn', 'SESSION_CLAIMS_INCOMPLETE', {
            tokenSub: token.sub ?? null,
            email: maskEmail(token.email),
          })
        }

        session.user.id = token.sub!
        session.user.email = token.email ?? session.user.email
        session.user.name = token.name ?? session.user.name
        session.user.role = token.role
        session.user.empId = token.empId
        session.user.position = token.position
        session.user.deptId = token.deptId
        session.user.deptName = token.deptName
        session.user.departmentCode = token.departmentCode
        session.user.managerId = token.managerId
        session.user.orgPath = token.orgPath
        session.user.accessibleDepartmentIds = token.accessibleDepartmentIds ?? []
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
