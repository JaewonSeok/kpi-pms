import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { FEEDBACK_RESULT_PROFILE_LABELS } from '@/lib/feedback-result-presentation'
import type { Feedback360PageData } from './feedback-360'

export type Feedback360ResultPdfModel = NonNullable<Feedback360PageData['results']>

type PdfSummaryRow = {
  label: string
  value: string
}

export function buildFeedback360ResultPdfSections(viewModel: Feedback360ResultPdfModel) {
  return {
    title: '360 리뷰 결과지',
    fileName: sanitizeFileName(
      `feedback360-result-${viewModel.targetEmployee.name}-${viewModel.recipientProfile}.pdf`
    ),
    headerLines: [
      `${viewModel.targetEmployee.name} · ${viewModel.targetEmployee.department} · ${viewModel.targetEmployee.position}`,
      `${viewModel.roundName} · ${FEEDBACK_RESULT_PROFILE_LABELS[viewModel.recipientProfile]}`,
    ],
    summaryRows: [
      { label: '결과지 버전', value: FEEDBACK_RESULT_PROFILE_LABELS[viewModel.recipientProfile] },
      { label: '라운드 가중치', value: `${viewModel.roundWeight}%` },
      { label: '익명 공개 기준', value: `${viewModel.anonymityThreshold}명` },
      { label: '현재 응답 수', value: `${viewModel.feedbackCount}건` },
    ] satisfies PdfSummaryRow[],
    summaryCards: viewModel.summaryCards.map((card) => ({
      title: card.title,
      relationshipLabel: card.relationshipLabel,
      reviewerName: card.reviewerName ?? '평가자 정보 없음',
      totalScore:
        card.showScore && typeof card.totalScore === 'number' ? `${card.totalScore.toFixed(1)}점` : '비공개',
      comment:
        card.showComment ? card.comment?.trim() || '등록된 코멘트가 없습니다.' : '비공개 설정으로 코멘트를 표시하지 않습니다.',
    })),
    categoryRows: viewModel.categoryScores.map((item) => ({
      label: item.category,
      value: `평균 ${item.average} / 응답 ${item.count}`,
    })),
    strengths: viewModel.strengths,
    improvements: viewModel.improvements,
    warnings: viewModel.warnings,
    groupedResponses: viewModel.groupedResponses.map((group) => ({
      category: group.category,
      questionText: group.questionText,
      answers: group.answers.map((answer) => ({
        label: answer.authorLabel,
        metrics:
          typeof answer.ratingValue === 'number'
            ? `점수 ${answer.ratingValue}`
            : '점수 정보 없음',
        comment: answer.textValue?.trim() || '작성된 코멘트가 없습니다.',
      })),
    })),
  }
}

export async function buildFeedback360ResultPdf(viewModel: Feedback360ResultPdfModel) {
  const sections = buildFeedback360ResultPdfSections(viewModel)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)

  const [regularFontBytes, boldFontBytes] = await Promise.all([
    readFile(resolveFontPath('noto-sans-kr-0-400-normal.woff')),
    readFile(resolveFontPath('noto-sans-kr-0-700-normal.woff')),
  ])

  const regularFont = await pdf.embedFont(regularFontBytes)
  const boldFont = await pdf.embedFont(boldFontBytes)

  let page = pdf.addPage([595.28, 841.89])
  let cursorY = page.getHeight() - 48
  const marginX = 42
  const contentWidth = page.getWidth() - marginX * 2

  const ensureSpace = (height: number) => {
    if (cursorY - height < 52) {
      page = pdf.addPage([595.28, 841.89])
      cursorY = page.getHeight() - 48
    }
  }

  const drawTextBlock = (params: {
    text: string
    font?: PDFFont
    size?: number
    color?: ReturnType<typeof rgb>
    lineHeight?: number
    indent?: number
  }) => {
    const font = params.font ?? regularFont
    const size = params.size ?? 11
    const lineHeight = params.lineHeight ?? size * 1.65
    const indent = params.indent ?? 0
    const lines = wrapText(params.text, font, size, contentWidth - indent)
    ensureSpace(lines.length * lineHeight)

    for (const line of lines) {
      page.drawText(line, {
        x: marginX + indent,
        y: cursorY,
        size,
        font,
        color: params.color ?? rgb(0.15, 0.23, 0.33),
      })
      cursorY -= lineHeight
    }
  }

  const drawSectionTitle = (title: string) => {
    ensureSpace(30)
    page.drawText(title, {
      x: marginX,
      y: cursorY,
      size: 15,
      font: boldFont,
      color: rgb(0.07, 0.1, 0.18),
    })
    cursorY -= 24
  }

  drawTextBlock({
    text: sections.title,
    font: boldFont,
    size: 20,
    lineHeight: 30,
    color: rgb(0.07, 0.1, 0.18),
  })
  sections.headerLines.forEach((line) =>
    drawTextBlock({
      text: line,
      size: 11,
      color: rgb(0.36, 0.43, 0.52),
    })
  )

  cursorY -= 10
  drawSectionTitle('공유 요약')
  sections.summaryRows.forEach((row) =>
    drawTextBlock({
      text: `${row.label}: ${row.value}`,
      size: 11,
      color: rgb(0.15, 0.23, 0.33),
    })
  )

  cursorY -= 8
  drawSectionTitle('단계별 평가 / 종합 결과')
  if (sections.summaryCards.length) {
    sections.summaryCards.forEach((card) => {
      drawTextBlock({
        text: `${card.title} · ${card.relationshipLabel}`,
        font: boldFont,
        size: 12,
        lineHeight: 20,
        color: rgb(0.07, 0.1, 0.18),
      })
      drawTextBlock({
        text: `평가자: ${card.reviewerName}`,
        size: 10,
        color: rgb(0.36, 0.43, 0.52),
        indent: 6,
      })
      drawTextBlock({
        text: `총점: ${card.totalScore}`,
        size: 10,
        color: rgb(0.15, 0.23, 0.33),
        indent: 6,
      })
      drawTextBlock({
        text: card.comment,
        size: 10,
        color: rgb(0.15, 0.23, 0.33),
        indent: 6,
      })
      cursorY -= 8
    })
  } else {
    drawTextBlock({
      text: '현재 결과지 버전에서 공개되는 단계별 요약 카드가 없습니다.',
      size: 11,
      color: rgb(0.36, 0.43, 0.52),
    })
  }

  drawSectionTitle('카테고리별 점수')
  if (sections.categoryRows.length) {
    sections.categoryRows.forEach((row) =>
      drawTextBlock({
        text: `${row.label}: ${row.value}`,
        size: 11,
        color: rgb(0.15, 0.23, 0.33),
      })
    )
  } else {
    drawTextBlock({
      text: '익명 공개 기준을 충족하면 카테고리별 점수가 표시됩니다.',
      size: 11,
      color: rgb(0.36, 0.43, 0.52),
    })
  }

  drawBulletList({
    getPage: () => page,
    regularFont,
    boldFont,
    marginX,
    contentWidth,
    cursorYRef: () => cursorY,
    setCursorY: (next) => {
      cursorY = next
    },
    ensureSpace,
    title: '강점',
    items: sections.strengths,
  })

  drawBulletList({
    getPage: () => page,
    regularFont,
    boldFont,
    marginX,
    contentWidth,
    cursorYRef: () => cursorY,
    setCursorY: (next) => {
      cursorY = next
    },
    ensureSpace,
    title: '보완 포인트',
    items: sections.improvements,
  })

  if (sections.warnings.length) {
    drawBulletList({
      getPage: () => page,
      regularFont,
      boldFont,
      marginX,
      contentWidth,
      cursorYRef: () => cursorY,
      setCursorY: (next) => {
        cursorY = next
      },
      ensureSpace,
      title: '주의 / 운영 메모',
      items: sections.warnings,
    })
  }

  drawSectionTitle('문항별 코멘트')
  if (sections.groupedResponses.length) {
    sections.groupedResponses.forEach((group) => {
      drawTextBlock({
        text: `${group.category} · ${group.questionText}`,
        font: boldFont,
        size: 12,
        lineHeight: 20,
        color: rgb(0.07, 0.1, 0.18),
      })

      if (group.answers.length) {
        group.answers.forEach((answer) => {
          drawTextBlock({
            text: `${answer.label} · ${answer.metrics}`,
            size: 10,
            color: rgb(0.36, 0.43, 0.52),
            indent: 6,
          })
          drawTextBlock({
            text: answer.comment,
            size: 10,
            color: rgb(0.15, 0.23, 0.33),
            indent: 6,
          })
          cursorY -= 6
        })
      } else {
        drawTextBlock({
          text: '표시 가능한 응답이 없습니다.',
          size: 10,
          color: rgb(0.36, 0.43, 0.52),
          indent: 6,
        })
      }

      cursorY -= 8
    })
  } else {
    drawTextBlock({
      text: '현재 공개 가능한 문항별 응답이 없습니다.',
      size: 11,
      color: rgb(0.36, 0.43, 0.52),
    })
  }

  return pdf.save({ useObjectStreams: false })
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-')
}

function resolveFontPath(fileName: string) {
  return path.resolve(process.cwd(), 'node_modules', '@fontsource', 'noto-sans-kr', 'files', fileName)
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const source = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []

  for (const rawLine of source) {
    const trimmedLine = rawLine.trim()
    if (!trimmedLine) {
      lines.push('')
      continue
    }

    let current = ''
    for (const token of trimmedLine.split(/\s+/)) {
      const next = current ? `${current} ${token}` : token
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next
        continue
      }

      if (current) {
        lines.push(current)
      }
      current = token
    }

    if (current) {
      lines.push(current)
    }
  }

  return lines.length ? lines : ['']
}

function drawBulletList(params: {
  getPage: () => PDFPage
  regularFont: PDFFont
  boldFont: PDFFont
  marginX: number
  contentWidth: number
  cursorYRef: () => number
  setCursorY: (next: number) => void
  ensureSpace: (height: number) => void
  title: string
  items: string[]
}) {
  params.ensureSpace(24)
  params.getPage().drawText(params.title, {
    x: params.marginX,
    y: params.cursorYRef(),
    size: 14,
    font: params.boldFont,
    color: rgb(0.07, 0.1, 0.18),
  })
  params.setCursorY(params.cursorYRef() - 24)

  const items = params.items.length ? params.items : ['등록된 내용이 없습니다.']
  for (const item of items) {
    const lines = wrapText(item, params.regularFont, 10, params.contentWidth - 16)
    params.ensureSpace(lines.length * 16 + 6)
    params.getPage().drawText('•', {
      x: params.marginX + 4,
      y: params.cursorYRef(),
      size: 12,
      font: params.boldFont,
      color: rgb(0.15, 0.23, 0.33),
    })

    let cursorY = params.cursorYRef()
    for (const line of lines) {
      params.getPage().drawText(line, {
        x: params.marginX + 16,
        y: cursorY,
        size: 10,
        font: params.regularFont,
        color: rgb(0.15, 0.23, 0.33),
      })
      cursorY -= 16
    }

    params.setCursorY(cursorY - 4)
  }
}
