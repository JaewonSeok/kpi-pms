import { AppError } from './utils'

export function getAllowedGoogleWorkspaceDomain() {
  const domain = process.env.ALLOWED_DOMAIN?.trim().toLowerCase()

  if (!domain) {
    throw new AppError(
      500,
      'ALLOWED_DOMAIN_MISSING',
      'Google Workspace 허용 도메인 설정이 없습니다.'
    )
  }

  return domain
}

export function normalizeGoogleWorkspaceEmail(email: string) {
  return email.trim().toLowerCase()
}

export function assertAllowedGoogleWorkspaceEmail(email: string, allowedDomain?: string) {
  const normalizedEmail = normalizeGoogleWorkspaceEmail(email)
  const domain = (allowedDomain ?? getAllowedGoogleWorkspaceDomain()).toLowerCase()

  if (!normalizedEmail.endsWith(`@${domain}`)) {
    throw new AppError(
      400,
      'INVALID_GOOGLE_WORKSPACE_EMAIL',
      `허용된 Google Workspace 도메인(@${domain}) 이메일만 등록할 수 있습니다.`
    )
  }

  return normalizedEmail
}
