import type { SystemRole } from '@prisma/client'

type MasterLoginEnvSource = Record<string, string | undefined>

export const MASTER_LOGIN_PERMISSION_KEY = 'MASTER_LOGIN_ALLOWED' as const

export type MasterLoginAccessSource =
  | 'owner'
  | 'legacy_admin'
  | 'granted_hr_admin'
  | 'none'

export type MasterLoginPermissionManagementReason =
  | 'AUTH_REQUIRED'
  | 'MASTER_LOGIN_ACTIVE'
  | 'FIXED_ACCESS_SOURCE'
  | 'PENDING'
  | 'NONE'

export type MasterLoginAccessInput = {
  role?: SystemRole | string | null
  email?: string | null
  employeeId?: string | null
  masterLoginPermissionGranted?: boolean | null
}

type MasterLoginActorRecord = {
  role: SystemRole
  masterLoginPermissionGranted: boolean
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null
}

function splitEmails(value?: string | null) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter((item): item is string => Boolean(item))
}

export function readMasterLoginConfig(env: MasterLoginEnvSource = process.env) {
  const ownerEmail =
    normalizeEmail(env.MASTER_LOGIN_OWNER_EMAIL) ?? normalizeEmail(env.ADMIN_EMAIL)
  const allowedEmails = splitEmails(env.MASTER_LOGIN_ALLOWED_EMAILS)
  const allowedEmailSet = new Set<string>()

  if (ownerEmail) {
    allowedEmailSet.add(ownerEmail)
  }

  for (const email of allowedEmails) {
    allowedEmailSet.add(email)
  }

  return {
    ownerEmail,
    allowedEmails,
    allowedEmailSet,
    enabled: allowedEmailSet.size > 0,
  }
}

export function resolveMasterLoginAccess(
  input: Pick<MasterLoginAccessInput, 'role' | 'email' | 'masterLoginPermissionGranted'>,
  env: MasterLoginEnvSource = process.env
) {
  if (input.role !== 'ROLE_ADMIN') {
    return {
      allowed: false,
      source: 'none' as MasterLoginAccessSource,
    }
  }

  const email = normalizeEmail(input.email)
  if (!email) {
    return {
      allowed: false,
      source: 'none' as MasterLoginAccessSource,
    }
  }

  const config = readMasterLoginConfig(env)

  if (config.ownerEmail && email === config.ownerEmail) {
    return {
      allowed: true,
      source: 'owner' as MasterLoginAccessSource,
    }
  }

  if (config.allowedEmailSet.has(email)) {
    return {
      allowed: true,
      source: 'legacy_admin' as MasterLoginAccessSource,
    }
  }

  if (input.masterLoginPermissionGranted) {
    return {
      allowed: true,
      source: 'granted_hr_admin' as MasterLoginAccessSource,
    }
  }

  return {
    allowed: false,
    source: 'none' as MasterLoginAccessSource,
  }
}

export function canUseMasterLogin(
  input: Pick<MasterLoginAccessInput, 'role' | 'email' | 'masterLoginPermissionGranted'>,
  env: MasterLoginEnvSource = process.env
) {
  return resolveMasterLoginAccess(input, env).allowed
}

export function isFixedMasterLoginAccessSource(source: MasterLoginAccessSource) {
  return source === 'owner' || source === 'legacy_admin'
}

export function resolveMasterLoginPermissionManagementState(input: {
  isAuthenticated: boolean
  hasActiveMasterLogin: boolean
}) {
  if (!input.isAuthenticated) {
    return {
      allowed: false,
      reason: 'AUTH_REQUIRED' as MasterLoginPermissionManagementReason,
      message: '세션을 확인한 뒤 다시 시도해 주세요.',
    }
  }

  if (input.hasActiveMasterLogin) {
    return {
      allowed: false,
      reason: 'MASTER_LOGIN_ACTIVE' as MasterLoginPermissionManagementReason,
      message:
        '마스터 로그인 진행 중에는 권한을 변경할 수 없습니다. 먼저 현재 세션을 종료해 주세요.',
    }
  }

  return {
    allowed: true,
    reason: 'NONE' as MasterLoginPermissionManagementReason,
    message: null,
  }
}

export function resolveMasterLoginPermissionToggleState(input: {
  isAuthenticated: boolean
  hasActiveMasterLogin: boolean
  accessSource: MasterLoginAccessSource
  pending: boolean
}) {
  if (input.pending) {
    return {
      disabled: true,
      reason: 'PENDING' as MasterLoginPermissionManagementReason,
      message: '권한 변경을 저장하는 중입니다.',
    }
  }

  const management = resolveMasterLoginPermissionManagementState({
    isAuthenticated: input.isAuthenticated,
    hasActiveMasterLogin: input.hasActiveMasterLogin,
  })

  if (!management.allowed) {
    return {
      disabled: true,
      reason: management.reason,
      message: management.message,
    }
  }

  if (isFixedMasterLoginAccessSource(input.accessSource)) {
    return {
      disabled: true,
      reason: 'FIXED_ACCESS_SOURCE' as MasterLoginPermissionManagementReason,
      message: '소유자 또는 기본 허용 HR 관리자 계정은 여기에서 변경할 수 없습니다.',
    }
  }

  return {
    disabled: false,
    reason: 'NONE' as MasterLoginPermissionManagementReason,
    message: null,
  }
}

async function loadMasterLoginActorRecord(employeeId: string) {
  const { prisma } = await import('@/lib/prisma')
  return prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      role: true,
      masterLoginPermissionGranted: true,
    },
  }) as Promise<MasterLoginActorRecord | null>
}

export async function resolveMasterLoginAvailability(
  input: Pick<MasterLoginAccessInput, 'employeeId' | 'role' | 'email'>,
  env: MasterLoginEnvSource = process.env
) {
  const directAccess = resolveMasterLoginAccess(
    {
      role: input.role,
      email: input.email,
      masterLoginPermissionGranted: false,
    },
    env
  )

  if (directAccess.allowed) {
    return directAccess
  }

  if (input.role !== 'ROLE_ADMIN' || !input.employeeId) {
    return directAccess
  }

  const actor = await loadMasterLoginActorRecord(input.employeeId)
  return resolveMasterLoginAccess(
    {
      role: actor?.role ?? input.role,
      email: input.email,
      masterLoginPermissionGranted: actor?.masterLoginPermissionGranted ?? false,
    },
    env
  )
}

export async function canUseMasterLoginForActor(
  input: Pick<MasterLoginAccessInput, 'employeeId' | 'role' | 'email'>,
  env: MasterLoginEnvSource = process.env
) {
  return (await resolveMasterLoginAvailability(input, env)).allowed
}

export function getMasterLoginActorLabel(input: Pick<MasterLoginAccessInput, 'email'>) {
  const email = normalizeEmail(input.email)
  if (!email) {
    return '권한 있는 관리자'
  }

  return email
}
