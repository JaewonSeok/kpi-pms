import {
  getMonthlyLinkDisplayName,
  type MonthlyAttachmentItem,
} from './monthly-attachments'

export async function readEvidenceFiles(files: FileList, uploaderName: string) {
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<MonthlyAttachmentItem>((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`))
          reader.onload = () =>
            resolve({
              id: `${file.name}-${file.lastModified}`,
              type: 'FILE',
              name: file.name,
              kind: file.name.toLowerCase().includes('report')
                ? 'REPORT'
                : file.name.toLowerCase().includes('output')
                  ? 'OUTPUT'
                  : 'OTHER',
              comment: undefined,
              uploadedAt: new Date().toISOString(),
              uploadedBy: uploaderName,
              sizeLabel:
                file.size > 1024 * 1024
                  ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                  : `${Math.max(1, Math.round(file.size / 1024))}KB`,
              dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
            })
          reader.readAsDataURL(file)
        })
    )
  )
}

export function createEvidenceLinkAttachment(params: {
  url: string
  comment: string
  uploaderName: string
}): MonthlyAttachmentItem {
  const trimmedUrl = params.url.trim()
  const trimmedComment = params.comment.trim()

  return {
    id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'LINK',
    name: getMonthlyLinkDisplayName(trimmedUrl),
    kind: 'OTHER',
    comment: trimmedComment || undefined,
    uploadedAt: new Date().toISOString(),
    uploadedBy: params.uploaderName,
    url: trimmedUrl,
  }
}

export function downloadEvidenceAttachment(
  attachment: Pick<MonthlyAttachmentItem, 'dataUrl' | 'name'>,
  onMissing: (message: string) => void
) {
  if (!attachment.dataUrl) {
    onMissing('이 증빙은 메타데이터만 남아 있어 브라우저에서 직접 다운로드할 수 없습니다.')
    return
  }

  const anchor = document.createElement('a')
  anchor.href = attachment.dataUrl
  anchor.download = attachment.name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function openEvidenceLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
