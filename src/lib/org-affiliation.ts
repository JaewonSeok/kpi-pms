function normalizeOrgLabel(value?: string | null) {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? ''
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return null
  }

  return normalized
}

function toCompareKey(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ko-KR')
}

export function dedupeOrgPathLabels(labels: Array<string | null | undefined>) {
  const deduped: string[] = []

  for (const label of labels) {
    const normalized = normalizeOrgLabel(label)
    if (!normalized) continue

    const previous = deduped.at(-1)
    if (previous && toCompareKey(previous) === toCompareKey(normalized)) {
      continue
    }

    deduped.push(normalized)
  }

  return deduped
}

export function formatDepartmentPath(
  labels: Array<string | null | undefined>,
  options: { fallback?: string } = {},
) {
  const path = dedupeOrgPathLabels(labels).join(' / ')
  return path || options.fallback || '-'
}

export function normalizeLegacyTeamNameForDepartment(
  teamName?: string | null,
  departmentName?: string | null,
) {
  const normalizedTeamName = normalizeOrgLabel(teamName)
  if (!normalizedTeamName) return null

  const normalizedDepartmentName = normalizeOrgLabel(departmentName)
  if (
    normalizedDepartmentName &&
    toCompareKey(normalizedDepartmentName) === toCompareKey(normalizedTeamName)
  ) {
    return null
  }

  return normalizedTeamName
}

export function formatEmployeeOrgPath(params: {
  departmentName?: string | null
  departmentPath?: Array<string | null | undefined>
  teamName?: string | null
  jobTitle?: string | null
  includeJobTitle?: boolean
  fallback?: string
}) {
  const basePath = params.departmentPath?.length ? params.departmentPath : [params.departmentName]
  const baseLabels = dedupeOrgPathLabels(basePath)
  const lastDepartmentName = baseLabels.at(-1) ?? params.departmentName ?? null
  const teamName = normalizeLegacyTeamNameForDepartment(params.teamName, lastDepartmentName)
  const jobTitle = params.includeJobTitle ? normalizeOrgLabel(params.jobTitle) : null

  return formatDepartmentPath([...baseLabels, teamName, jobTitle], {
    fallback: params.fallback,
  })
}
