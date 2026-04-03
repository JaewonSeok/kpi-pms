import type { SystemRole } from '@prisma/client'

type MasterLoginEnvSource = Record<string, string | undefined>

type MasterLoginAccessInput = {
  role?: SystemRole | string | null
  email?: string | null
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

export function canUseMasterLogin(
  input: MasterLoginAccessInput,
  env: MasterLoginEnvSource = process.env
) {
  if (input.role !== 'ROLE_ADMIN') {
    return false
  }

  const email = normalizeEmail(input.email)
  if (!email) {
    return false
  }

  const config = readMasterLoginConfig(env)
  if (!config.enabled) {
    return false
  }

  return config.allowedEmailSet.has(email)
}

export function getMasterLoginActorLabel(input: MasterLoginAccessInput) {
  const email = normalizeEmail(input.email)
  if (!email) {
    return '권한 있는 관리자'
  }

  return email
}
