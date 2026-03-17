import type { Department, Employee, SystemRole } from '@prisma/client'
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { buildOrgPath, getAccessibleDeptIds, resolveManagerId } from '@/server/auth/org-scope'

const PLACEHOLDER_ENV_VALUES = new Set([
  'your-google-client-id',
  'your-google-client-secret',
  'your-nextauth-secret-change-in-production',
  'change-me',
])

function readRequiredAuthEnv(key: string) {
  const value = process.env[key]?.trim()

  if (!value) {
    throw new Error(
      `[auth] Missing required environment variable: ${key}. ` +
        'This project uses GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXTAUTH_URL / NEXTAUTH_SECRET / ALLOWED_DOMAIN.'
    )
  }

  if (
    (key === 'GOOGLE_CLIENT_ID' || key === 'GOOGLE_CLIENT_SECRET' || key === 'NEXTAUTH_SECRET') &&
    PLACEHOLDER_ENV_VALUES.has(value)
  ) {
    throw new Error(
      `[auth] ${key} is still set to a placeholder value. ` +
        'Replace it with the real Google OAuth credential or NextAuth secret before starting the app.'
    )
  }

  return value
}

function readRequiredNextAuthUrl() {
  const value = readRequiredAuthEnv('NEXTAUTH_URL')

  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol')
    }
  } catch {
    throw new Error(
      `[auth] NEXTAUTH_URL must be a valid absolute URL. ` +
        'Example local callback: http://localhost:3000/api/auth/callback/google'
    )
  }

  return value
}

function buildGoogleCallbackUrl(baseUrl: string) {
  return new URL('/api/auth/callback/google', baseUrl).toString()
}

const nextAuthUrl = readRequiredNextAuthUrl()
readRequiredAuthEnv('NEXTAUTH_SECRET')

const googleClientId = readRequiredAuthEnv('GOOGLE_CLIENT_ID')
const googleClientSecret = readRequiredAuthEnv('GOOGLE_CLIENT_SECRET')
const allowedDomain = readRequiredAuthEnv('ALLOWED_DOMAIN')
const googleCallbackUrl = buildGoogleCallbackUrl(nextAuthUrl)

type EmployeeWithDepartment = Employee & {
  department: Department
}

type DepartmentScopeNode = {
  id: string
  deptCode: string
  parentDeptId: string | null
}

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

async function buildAuthClaims(employee: EmployeeWithDepartment): Promise<AuthClaims> {
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
    managerId: resolveManagerId(employee),
    orgPath: buildOrgPath(employee, departments),
    accessibleDepartmentIds: getAccessibleDeptIds(employee, departments),
  }
}

async function findEmployeeForToken(token: { sub?: string | null; email?: string | null }) {
  if (token.sub) {
    return prisma.employee.findUnique({
      where: { id: token.sub },
      include: { department: true },
    })
  }

  if (token.email) {
    return prisma.employee.findUnique({
      where: { gwsEmail: token.email },
      include: { department: true },
    })
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
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          hd: allowedDomain,
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
          const employee = await prisma.employee.findUnique({
            where: { gwsEmail: credentials.email },
            include: { department: true },
          })

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
        if (!email) return false

        if (!email.endsWith(`@${allowedDomain}`)) {
          return '/login?error=InvalidDomain'
        }

        const employee = await prisma.employee.findUnique({
          where: { gwsEmail: email },
          include: { department: true },
        })

        if (!employee) {
          return '/login?error=NotRegistered'
        }

        if (employee.status !== 'ACTIVE') {
          return '/login?error=InactiveAccount'
        }

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
        const employee = await prisma.employee.findUnique({
          where: { gwsEmail: profile.email },
          include: { department: true },
        })

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
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
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
        `[auth] ${code}. Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and Google callback URL: ${googleCallbackUrl}`,
        metadata
      )
    },
  },
}
