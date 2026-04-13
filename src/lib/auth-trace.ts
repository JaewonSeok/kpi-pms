type AuthTraceLevel = 'info' | 'warn' | 'error'

export function maskAuthEmail(email?: string | null) {
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

export function authTrace(level: AuthTraceLevel, event: string, metadata?: Record<string, unknown>) {
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
