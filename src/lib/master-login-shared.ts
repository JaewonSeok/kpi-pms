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

export function getMasterLoginActorLabel(input: Pick<MasterLoginAccessInput, 'email'>) {
  const email = normalizeEmail(input.email)
  if (!email) {
    return '권한 있는 관리자'
  }

  return email
}
