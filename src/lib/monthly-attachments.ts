export const MONTHLY_ATTACHMENT_TYPE_VALUES = ['FILE', 'LINK'] as const
export type MonthlyAttachmentType = (typeof MONTHLY_ATTACHMENT_TYPE_VALUES)[number]

export const MONTHLY_ATTACHMENT_KIND_VALUES = ['KPI', 'OUTPUT', 'REPORT', 'OTHER'] as const
export type MonthlyAttachmentKind = (typeof MONTHLY_ATTACHMENT_KIND_VALUES)[number]

export type MonthlyAttachmentItem = {
  id: string
  type: MonthlyAttachmentType
  name: string
  kind: MonthlyAttachmentKind
  comment?: string
  uploadedAt?: string
  uploadedBy?: string
  sizeLabel?: string
  dataUrl?: string
  url?: string
}

const MONTHLY_GOOGLE_DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export function isAllowedMonthlyEvidenceUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && MONTHLY_GOOGLE_DRIVE_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function getMonthlyLinkDisplayName(value: string) {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    const pathname = url.pathname.toLowerCase()

    if (hostname === 'docs.google.com') {
      if (pathname.startsWith('/document/')) return 'Google Docs 링크'
      if (pathname.startsWith('/spreadsheets/')) return 'Google Sheets 링크'
      if (pathname.startsWith('/presentation/')) return 'Google Slides 링크'
    }

    if (hostname === 'drive.google.com') {
      return 'Google Drive 링크'
    }
  } catch {
    return 'Google Drive 링크'
  }

  return 'Google Drive 링크'
}

export function getMonthlyAttachmentAuditSummary(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.flatMap((item, index) => {
    if (!isRecord(item)) return []

    const type = item.type === 'LINK' ? 'LINK' : 'FILE'
    const summary: Record<string, unknown> = {
      id: typeof item.id === 'string' ? item.id : `attachment-${index}`,
      type,
      name:
        typeof item.name === 'string' && item.name.trim().length > 0
          ? item.name.trim()
          : type === 'LINK' && typeof item.url === 'string'
            ? getMonthlyLinkDisplayName(item.url)
            : `첨부 ${index + 1}`,
      kind:
        item.kind === 'KPI' || item.kind === 'OUTPUT' || item.kind === 'REPORT'
          ? item.kind
          : 'OTHER',
    }

    if (typeof item.comment === 'string' && item.comment.trim().length > 0) {
      summary.comment = item.comment.trim()
    }
    if (typeof item.uploadedAt === 'string') {
      summary.uploadedAt = item.uploadedAt
    }
    if (typeof item.uploadedBy === 'string' && item.uploadedBy.trim().length > 0) {
      summary.uploadedBy = item.uploadedBy.trim()
    }
    if (type === 'FILE') {
      if (typeof item.sizeLabel === 'string' && item.sizeLabel.trim().length > 0) {
        summary.sizeLabel = item.sizeLabel.trim()
      }
      if (typeof item.dataUrl === 'string' && item.dataUrl.trim().length > 0) {
        summary.hasDataUrl = true
      }
    }
    if (type === 'LINK' && typeof item.url === 'string' && item.url.trim().length > 0) {
      summary.url = item.url.trim()
    }

    return [summary]
  })
}
