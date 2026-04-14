export type AdminGoogleAccessTab =
  | 'manage'
  | 'upload'
  | 'org-chart'
  | 'evaluator'
  | 'master-login'

const VALID_ADMIN_GOOGLE_ACCESS_TABS = new Set<AdminGoogleAccessTab>([
  'manage',
  'upload',
  'org-chart',
  'evaluator',
  'master-login',
])

export function resolveAdminGoogleAccessTab(
  value: string | null | undefined
): AdminGoogleAccessTab {
  if (value && VALID_ADMIN_GOOGLE_ACCESS_TABS.has(value as AdminGoogleAccessTab)) {
    return value as AdminGoogleAccessTab
  }

  return 'manage'
}

export function buildAdminGoogleAccessHref(
  tab: AdminGoogleAccessTab,
  options: {
    search?: string | null
    status?: string | null
    departmentId?: string | null
  } = {}
) {
  const params = new URLSearchParams()
  params.set('tab', tab)

  const shouldKeepDirectoryFilters = tab === 'manage' || tab === 'org-chart'
  if (shouldKeepDirectoryFilters) {
    const search = options.search?.trim()
    if (search) {
      params.set('q', search)
    }

    const status = options.status?.trim()
    if (status && status !== 'ALL') {
      params.set('status', status)
    }

    const departmentId = options.departmentId?.trim()
    if (departmentId) {
      params.set('departmentId', departmentId)
    }
  }

  return `/admin/google-access?${params.toString()}`
}
