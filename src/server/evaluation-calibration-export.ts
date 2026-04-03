import * as XLSX from 'xlsx'
import type { Session } from 'next-auth'
import { AppError } from '@/lib/utils'
import { getEvaluationCalibrationPageData } from '@/server/evaluation-calibration'

export type CalibrationExportMode = 'basic' | 'all'

export async function buildCalibrationExportWorkbook(params: {
  session: Session
  cycleId: string
  scopeId?: string
  mode: CalibrationExportMode
}) {
  const pageData = await getEvaluationCalibrationPageData({
    userId: params.session.user.id,
    role: params.session.user.role,
    cycleId: params.cycleId,
    scopeId: params.scopeId,
  })

  if (pageData.state !== 'ready' || !pageData.viewModel) {
    throw new AppError(400, 'CALIBRATION_EXPORT_NOT_READY', pageData.message ?? '내보낼 캘리브레이션 데이터가 없습니다.')
  }

  const { viewModel } = pageData
  const workbook = XLSX.utils.book_new()
  const baseRows = viewModel.candidates.map((candidate) => {
    const baseRow: Record<string, string | number> = {
      사번: candidate.employeeId,
      이름: candidate.employeeName,
      조직: candidate.department,
      직군: candidate.jobGroup ?? '',
      기준단계: candidate.sourceStage,
      병합반영: candidate.hasMergedCalibration ? '예' : '아니오',
      원점수: candidate.rawScore,
      원등급: candidate.originalGrade,
      최종등급: candidate.adjustedGrade ?? candidate.originalGrade,
      조정여부: candidate.adjusted ? '조정됨' : '미조정',
      검토우선: candidate.needsAttention ? '예' : '아니오',
      조정사유: candidate.reason ?? '',
      성과점수: candidate.performanceScore ?? '',
      역량점수: candidate.competencyScore ?? '',
      평가코멘트: candidate.evaluationComment ?? '',
      상위평가코멘트: candidate.reviewerComment ?? '',
    }

    if (params.mode === 'all') {
      baseRow.월간실적요약 = candidate.monthlySummary
        .map((item) => `${item.month}:${item.achievementRate?.toFixed(1) ?? '-'}% ${item.comment ?? ''}`.trim())
        .join(' | ')
      baseRow.체크인요약 = candidate.checkins
        .map((item) => `${item.type}/${item.status}:${item.summary}`)
        .join(' | ')
      baseRow.KPI요약 = candidate.kpiSummary
        .map(
          (item) =>
            `${item.title} (목표 ${item.target ?? '-'} / 실적 ${item.actual ?? '-'} / 달성률 ${
              item.achievementRate !== undefined ? `${item.achievementRate.toFixed(1)}%` : '-'
            })`
        )
        .join(' | ')

      for (const external of candidate.externalData) {
        baseRow[`외부:${external.label}`] = external.value
      }
    }

    return baseRow
  })

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(baseRows), 'calibration')

  const summaryRows = [
    {
      평가주기: viewModel.cycle.name,
      상태: viewModel.cycle.status,
      전체대상자: viewModel.summary.totalCount,
      조정건수: viewModel.summary.adjustedCount,
      검토필요: viewModel.summary.pendingCount,
      조정률: Number(viewModel.summary.adjustedRate.toFixed(1)),
      외부컬럼수: viewModel.sessionConfig.externalColumns.length,
      마지막병합:
        viewModel.sessionConfig.lastMergeSummary
          ? `${viewModel.sessionConfig.lastMergeSummary.mergedAt} / ${viewModel.sessionConfig.lastMergeSummary.mergedBy}`
          : '',
    },
  ]

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'summary')

  return {
    body: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
    fileName: `calibration-${viewModel.cycle.year}-${params.mode}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
}
