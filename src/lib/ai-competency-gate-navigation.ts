export const AI_COMPETENCY_EMPLOYEE_PATH = '/evaluation/ai-competency'
export const AI_COMPETENCY_ADMIN_PATH = '/evaluation/ai-competency/admin'

type SearchParamsInput = URLSearchParams | { toString(): string } | string | null | undefined

function toSearchParams(input?: SearchParamsInput) {
  if (!input) return new URLSearchParams()
  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input.toString())
  }

  const serialized = input.toString().replace(/^\?/, '')
  return new URLSearchParams(serialized)
}

function buildHref(pathname: string, params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value)
  }

  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function isSafeInternalReturnPath(value?: string | null) {
  if (!value) return false

  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return false
  if (trimmed.startsWith('//')) return false
  if (trimmed.includes('\\')) return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false

  try {
    const url = new URL(trimmed, 'https://internal.local')
    return url.origin === 'https://internal.local' && url.pathname.startsWith('/')
  } catch {
    return false
  }
}

export function resolveSafeReturnTo(
  value?: string | null,
  fallback = AI_COMPETENCY_EMPLOYEE_PATH
) {
  if (!isSafeInternalReturnPath(value)) {
    return fallback
  }

  const url = new URL(value!, 'https://internal.local')
  const href = `${url.pathname}${url.search}${url.hash}`
  return href || fallback
}

export function buildAiCompetencyEmployeeReturnTarget(params?: {
  pathname?: string
  searchParams?: SearchParamsInput
}) {
  const pathname = params?.pathname || AI_COMPETENCY_EMPLOYEE_PATH
  const searchParams = toSearchParams(params?.searchParams)
  searchParams.delete('returnTo')

  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function buildAiCompetencyAdminHref(params?: {
  returnTo?: string | null
}) {
  return buildHref(AI_COMPETENCY_ADMIN_PATH, {
    returnTo: resolveSafeReturnTo(params?.returnTo),
  })
}

export function buildAiCompetencyAdminListHref(params?: {
  cycleId?: string | null
  returnTo?: string | null
}) {
  return buildHref(AI_COMPETENCY_ADMIN_PATH, {
    cycleId: params?.cycleId ?? undefined,
    returnTo: resolveSafeReturnTo(params?.returnTo),
  })
}

export function buildAiCompetencyAdminCaseHref(params: {
  caseId: string
  cycleId?: string | null
  returnTo?: string | null
}) {
  return buildHref(`${AI_COMPETENCY_ADMIN_PATH}/${params.caseId}`, {
    cycleId: params.cycleId ?? undefined,
    returnTo: resolveSafeReturnTo(params.returnTo),
  })
}
