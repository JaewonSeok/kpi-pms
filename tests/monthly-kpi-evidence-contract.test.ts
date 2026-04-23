import 'dotenv/config'
import assert from 'node:assert/strict'
import {
  MonthlyRecordSchema,
  UpdateMonthlyRecordSchema,
} from '../src/lib/validations'
import {
  getMonthlyAttachmentAuditSummary,
  getMonthlyLinkDisplayName,
  isAllowedMonthlyEvidenceUrl,
} from '../src/lib/monthly-attachments'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('file evidence with comment passes monthly record validation', () => {
    const parsed = MonthlyRecordSchema.safeParse({
      personalKpiId: 'pk-1',
      yearMonth: '2026-04',
      actualValue: 42,
      attachments: [
        {
          id: 'file-1',
          type: 'FILE',
          name: '실적 보고서.pdf',
          kind: 'REPORT',
          comment: '월간 실적 보고서',
          uploadedAt: '2026-04-05T09:00:00.000Z',
          uploadedBy: '구성원',
          sizeLabel: '1.2MB',
          dataUrl: 'data:application/pdf;base64,AAAA',
        },
      ],
    })

    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.attachments?.[0]?.type, 'FILE')
    assert.equal(parsed.data.attachments?.[0]?.comment, '월간 실적 보고서')
  })

  await run('google docs link evidence with comment passes update validation', () => {
    const parsed = UpdateMonthlyRecordSchema.safeParse({
      evidenceComment: '이번 점검에 참고할 외부 문서입니다.',
      attachments: [
        {
          id: 'link-1',
          type: 'LINK',
          name: 'Google Docs 링크',
          kind: 'OTHER',
          comment: '상세 설명 문서',
          uploadedAt: '2026-04-06T09:00:00.000Z',
          uploadedBy: '구성원',
          url: 'https://docs.google.com/document/d/123456789/edit',
        },
      ],
    })

    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.evidenceComment, '이번 점검에 참고할 외부 문서입니다.')
    assert.equal(parsed.data.attachments?.[0]?.type, 'LINK')
    assert.equal(parsed.data.attachments?.[0]?.comment, '상세 설명 문서')
  })

  await run('non-google links are rejected server-side', () => {
    const parsed = UpdateMonthlyRecordSchema.safeParse({
      attachments: [
        {
          id: 'link-2',
          type: 'LINK',
          name: '외부 링크',
          kind: 'OTHER',
          url: 'https://example.com/evidence',
        },
      ],
    })

    assert.equal(parsed.success, false)
  })

  await run('evidence comment is accepted on create and update payloads', () => {
    const createParsed = MonthlyRecordSchema.safeParse({
      personalKpiId: 'pk-1',
      yearMonth: '2026-04',
      evidenceComment: '이번 달 근거를 묶어 점검합니다.',
      attachments: [],
    })
    const updateParsed = UpdateMonthlyRecordSchema.safeParse({
      evidenceComment: '수정된 증빙 코멘트',
    })

    assert.equal(createParsed.success, true)
    assert.equal(updateParsed.success, true)
    if (!createParsed.success || !updateParsed.success) return
    assert.equal(createParsed.data.evidenceComment, '이번 달 근거를 묶어 점검합니다.')
    assert.equal(updateParsed.data.evidenceComment, '수정된 증빙 코멘트')
  })

  await run('legacy file evidence without type remains valid and is normalized to FILE', () => {
    const parsed = UpdateMonthlyRecordSchema.safeParse({
      attachments: [
        {
          id: 'legacy-file',
          name: '기존 첨부',
          kind: 'OUTPUT',
          uploadedAt: '2026-04-07T09:00:00.000Z',
          uploadedBy: '구성원',
          sizeLabel: '900KB',
          dataUrl: 'data:text/plain;base64,QQ==',
        },
      ],
    })

    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.attachments?.[0]?.type, 'FILE')
  })

  await run('google drive helper accepts only allowed hosts and derives link display names', () => {
    assert.equal(isAllowedMonthlyEvidenceUrl('https://drive.google.com/file/d/123/view'), true)
    assert.equal(isAllowedMonthlyEvidenceUrl('https://docs.google.com/spreadsheets/d/123/edit'), true)
    assert.equal(isAllowedMonthlyEvidenceUrl('http://drive.google.com/file/d/123/view'), false)
    assert.equal(isAllowedMonthlyEvidenceUrl('https://example.com/file/d/123/view'), false)
    assert.equal(getMonthlyLinkDisplayName('https://docs.google.com/spreadsheets/d/123/edit'), 'Google Sheets 링크')
    assert.equal(getMonthlyLinkDisplayName('https://docs.google.com/presentation/d/123/edit'), 'Google Slides 링크')
    assert.equal(getMonthlyLinkDisplayName('https://drive.google.com/file/d/123/view'), 'Google Drive 링크')
  })

  await run('audit summary strips raw file payloads and preserves link metadata', () => {
    const summary = getMonthlyAttachmentAuditSummary([
      {
        id: 'file-1',
        type: 'FILE',
        name: '실적 보고서.pdf',
        kind: 'REPORT',
        comment: '월간 실적 보고서',
        dataUrl: 'data:application/pdf;base64,AAAA',
      },
      {
        id: 'link-1',
        type: 'LINK',
        name: 'Google Docs 링크',
        kind: 'OTHER',
        comment: '실적 상세 설명 문서',
        url: 'https://docs.google.com/document/d/123456789/edit',
      },
    ]) as Array<Record<string, unknown>>

    assert.equal(Array.isArray(summary), true)
    assert.equal(summary[0]?.hasDataUrl, true)
    assert.equal('dataUrl' in summary[0], false)
    assert.equal(summary[1]?.url, 'https://docs.google.com/document/d/123456789/edit')
    assert.equal(summary[1]?.comment, '실적 상세 설명 문서')
  })

  console.log('Monthly KPI evidence contract tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
