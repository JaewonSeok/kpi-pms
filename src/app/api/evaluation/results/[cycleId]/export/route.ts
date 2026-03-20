import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvaluationResultsPageData } from '@/server/evaluation-results'
import { AppError, errorResponse } from '@/lib/utils'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      cycleId: string
    }>
  }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { cycleId } = await context.params
    const data = await getEvaluationResultsPageData({
      userId: session.user.id,
      cycleId,
    })

    if (data.state !== 'ready' || !data.viewModel) {
      throw new AppError(404, 'RESULT_NOT_READY', '다운로드할 평가 결과를 찾지 못했습니다.')
    }

    const viewModel = data.viewModel
    const filename = `evaluation-result-${viewModel.cycle.year}-${viewModel.employee.name}.html`
    const detailItems = [
      ...viewModel.scoreBreakdown.performance,
      ...viewModel.scoreBreakdown.competency,
    ]

    const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(viewModel.employee.name)} 평가 결과</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; color: #0f172a; }
      h1, h2 { margin: 0 0 12px; }
      .meta, .card { margin-bottom: 20px; }
      .card { border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 14px; }
      th { background: #f8fafc; }
      ul { margin: 8px 0 0 18px; }
      .muted { color: #475569; }
    </style>
  </head>
  <body>
    <h1>평가 결과 리포트</h1>
    <div class="meta muted">${escapeHtml(viewModel.cycle.name)} / ${viewModel.cycle.year}</div>

    <div class="card">
      <h2>요약</h2>
      <p>최종 등급: <strong>${escapeHtml(viewModel.summary.finalGrade)}</strong></p>
      <p>총점: <strong>${viewModel.summary.totalScore.toFixed(1)}점</strong></p>
      <p>성과 점수: ${viewModel.summary.performanceScore.toFixed(1)}점 / 역량 점수: ${viewModel.summary.competencyScore.toFixed(1)}점</p>
      <p>캘리브레이션 반영: ${viewModel.summary.calibrationAdjusted ? '예' : '아니오'}</p>
      <p>결과 해석: ${escapeHtml(viewModel.overview.interpretation)}</p>
    </div>

    <div class="card">
      <h2>세부 점수</h2>
      <table>
        <thead>
          <tr>
            <th>항목</th>
            <th>가중치</th>
            <th>자기평가</th>
            <th>1차/2차</th>
            <th>최종값</th>
          </tr>
        </thead>
        <tbody>
          ${detailItems
            .map(
              (item) => `<tr>
                <td>${escapeHtml(item.title)}</td>
                <td>${item.weight?.toFixed(0) ?? '-'}</td>
                <td>${item.selfScore?.toFixed(1) ?? '-'}</td>
                <td>${item.managerScore?.toFixed(1) ?? item.reviewerScore?.toFixed(1) ?? '-'}</td>
                <td>${item.finalScore?.toFixed(1) ?? '-'}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>강점 / 개선 포인트</h2>
      <div>
        <strong>강점</strong>
        <ul>${viewModel.growth.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
      <div style="margin-top: 12px;">
        <strong>개선 포인트</strong>
        <ul>${viewModel.growth.improvements.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
    </div>
  </body>
</html>`

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error)
    }
    return errorResponse(new AppError(500, 'EXPORT_FAILED', '평가 결과 리포트를 생성하지 못했습니다.'))
  }
}
