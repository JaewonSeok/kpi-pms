import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import type { EvaluationResultViewModel } from './evaluation-results'

type PdfLineItem = {
  label: string
  value: string
}

type PdfDetailRow = {
  group: '성과' | '역량'
  title: string
  metrics: string
  comment: string
}

export function buildEvaluationResultPdfSections(viewModel: EvaluationResultViewModel) {
  const detailRows: PdfDetailRow[] = [
    ...viewModel.scoreBreakdown.performance.map((item) => ({
      group: '성과' as const,
      title: item.title,
      metrics: buildMetricLine(item),
      comment: item.comment?.trim() || '등록된 상세 코멘트가 없습니다.',
    })),
    ...viewModel.scoreBreakdown.competency.map((item) => ({
      group: '역량' as const,
      title: item.title,
      metrics: buildMetricLine(item),
      comment: item.comment?.trim() || '등록된 상세 코멘트가 없습니다.',
    })),
  ]

  return {
    title: '성과 평가 결과지',
    fileName: sanitizeFileName(`evaluation-result-${viewModel.cycle.year}-${viewModel.employee.name}.pdf`),
    headerLines: [
      `${viewModel.employee.name} · ${viewModel.employee.department} · ${viewModel.employee.title}`,
      `${viewModel.cycle.year} ${viewModel.cycle.name}`,
    ],
    summaryRows: [
      { label: '최종 등급', value: viewModel.summary.finalGrade },
      { label: '총점', value: `${viewModel.summary.totalScore.toFixed(1)}점` },
      { label: '성과 점수', value: `${viewModel.summary.performanceScore.toFixed(1)}점` },
      { label: '역량 점수', value: `${viewModel.summary.competencyScore.toFixed(1)}점` },
      {
        label: '캘리브레이션 반영',
        value: viewModel.summary.calibrationAdjusted ? '반영됨' : '반영 없음',
      },
    ] satisfies PdfLineItem[],
    interpretation: viewModel.overview.interpretation,
    detailRows,
    strengths: viewModel.growth.strengths,
    improvements: viewModel.growth.improvements,
    discussionQuestions: viewModel.growth.discussionQuestions,
  }
}

export async function buildEvaluationResultPdf(viewModel: EvaluationResultViewModel) {
  const sections = buildEvaluationResultPdfSections(viewModel)
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

  cursorY -= 12
  drawSectionTitle('종합 점수')
  sections.summaryRows.forEach((row) =>
    drawTextBlock({
      text: `${row.label}: ${row.value}`,
      size: 11,
      color: rgb(0.15, 0.23, 0.33),
    })
  )
  drawTextBlock({
    text: `결과 해석: ${sections.interpretation}`,
    size: 11,
    color: rgb(0.15, 0.23, 0.33),
  })

  cursorY -= 8
  drawSectionTitle('평가 항목')
  sections.detailRows.forEach((row) => {
    drawTextBlock({
      text: `${row.group} · ${row.title}`,
      font: boldFont,
      size: 12,
      lineHeight: 20,
      color: rgb(0.07, 0.1, 0.18),
    })
    drawTextBlock({
      text: row.metrics,
      size: 10,
      color: rgb(0.36, 0.43, 0.52),
      indent: 6,
    })
    drawTextBlock({
      text: row.comment,
      size: 10,
      color: rgb(0.15, 0.23, 0.33),
      indent: 6,
    })
    cursorY -= 8
  })

  drawSectionTitle('강점 및 개선 포인트')
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
    title: '1:1 대화 질문',
    items: sections.discussionQuestions,
  })

  return pdf.save({ useObjectStreams: false })
}

function buildMetricLine(item: {
  weight?: number
  selfScore?: number
  managerScore?: number
  reviewerScore?: number
  finalScore?: number
}) {
  return [
    `가중치 ${item.weight?.toFixed(0) ?? '-'}%`,
    `자기 ${formatScore(item.selfScore)}`,
    `1차 ${formatScore(item.managerScore)}`,
    `2차 ${formatScore(item.reviewerScore)}`,
    `최종 ${formatScore(item.finalScore)}`,
  ].join(' · ')
}

function formatScore(value?: number) {
  return typeof value === 'number' ? `${value.toFixed(1)}점` : '-'
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
    for (const word of trimmedLine.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
        continue
      }

      if (current) {
        lines.push(current)
        current = word
        continue
      }

      let chunk = ''
      for (const char of word) {
        const chunkCandidate = chunk + char
        if (font.widthOfTextAtSize(chunkCandidate, size) <= maxWidth) {
          chunk = chunkCandidate
        } else {
          if (chunk) lines.push(chunk)
          chunk = char
        }
      }
      current = chunk
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
  setCursorY: (value: number) => void
  ensureSpace: (height: number) => void
  title: string
  items: string[]
}) {
  params.ensureSpace(24)
  params.getPage().drawText(params.title, {
    x: params.marginX,
    y: params.cursorYRef(),
    size: 12,
    font: params.boldFont,
    color: rgb(0.07, 0.1, 0.18),
  })
  params.setCursorY(params.cursorYRef() - 20)

  const source = params.items.length ? params.items : ['등록된 내용이 없습니다.']
  for (const item of source) {
    const lines = wrapText(item, params.regularFont, 10.5, params.contentWidth - 20)
    params.ensureSpace(lines.length * 16)
    params.getPage().drawText('•', {
      x: params.marginX + 4,
      y: params.cursorYRef(),
      size: 12,
      font: params.boldFont,
      color: rgb(0.21, 0.32, 0.57),
    })
    for (const line of lines) {
      params.getPage().drawText(line, {
        x: params.marginX + 18,
        y: params.cursorYRef(),
        size: 10.5,
        font: params.regularFont,
        color: rgb(0.15, 0.23, 0.33),
      })
      params.setCursorY(params.cursorYRef() - 16)
    }
    params.setCursorY(params.cursorYRef() - 4)
  }
}
