import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

run('org KPI copy makes personal linkage and denominator semantics explicit', () => {
  const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.equal(source.includes('연결된 개인 KPI'), true)
  assert.equal(source.includes('대상 인원 연결률'), true)
  assert.equal(source.includes('승인 완료 개인 KPI'), true)
  assert.equal(source.includes('대상 인원 기준으로 계산됩니다.'), true)
  assert.equal(source.includes('개인 KPI 연결 2/4'), false)
  assert.equal(source.includes('coverage '), false)
})

run('personal monthly and goal alignment copy explains units and bases', () => {
  const personalSource = read('src/components/kpi/PersonalKpiManagementClient.tsx')
  const monthlySource = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
  const alignmentSource = read('src/components/admin/GoalAlignmentClient.tsx')

  assert.equal(personalSource.includes('조직 KPI 연결 비율'), true)
  assert.equal(personalSource.includes('최근 월간 실적 반영 비율'), true)
  assert.equal(personalSource.includes("formatRateBaseCopy('전체 개인 KPI')"), true)

  assert.equal(monthlySource.includes('제출 완료 비율'), true)
  assert.equal(monthlySource.includes('위험 신호 KPI'), true)
  assert.equal(monthlySource.includes('증빙 항목'), true)
  assert.equal(monthlySource.includes("formatRateBaseCopy('전체 KPI')"), true)

  assert.equal(alignmentSource.includes('개인 목표 수립 비율'), true)
  assert.equal(alignmentSource.includes('조직 KPI 연결 비율'), true)
  assert.equal(alignmentSource.includes('체크인 완료 비율'), true)
  assert.equal(alignmentSource.includes("formatRateBaseCopy('대상 인원')"), true)
  assert.equal(alignmentSource.includes("formatRateBaseCopy('전체 체크인')"), true)
})

run('statistics copy keeps denominator and entity type visible', () => {
  const serverSource = read('src/server/statistics-page.ts')
  const clientSource = read('src/components/statistics/ExecutiveStatisticsDashboardClient.tsx')
  const chartSource = read('src/components/statistics/StatisticsCharts.tsx')

  assert.equal(serverSource.includes('대상 평가 기준 예상 단계 진행 비율'), true)
  assert.equal(serverSource.includes('대상 평가 기준 최종 확정 비율'), true)
  assert.equal(serverSource.includes('대상 인원 기준 개인 목표 수립 비율'), true)
  assert.equal(serverSource.includes('전체 체크인 기준 완료 비율'), true)

  assert.equal(clientSource.includes('개인 목표 수립 비율'), true)
  assert.equal(clientSource.includes('조직 KPI 연결 비율'), true)
  assert.equal(clientSource.includes('체크인 완료 비율'), true)
  assert.equal(clientSource.includes('상위 등급 비율'), true)
  assert.equal(clientSource.includes('하위 등급 비율'), true)
  assert.equal(clientSource.includes('조정 적용 비율'), true)

  assert.equal(chartSource.includes('제출 완료 평가'), true)
  assert.equal(chartSource.includes('최종 확정 평가'), true)
  assert.equal(chartSource.includes('평균 달성률'), true)
})

run('evaluation and admin status labels name the correct entity', () => {
  const workbenchSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
  const assignmentSource = read('src/components/admin/PerformanceAssignmentAdminClient.tsx')
  const aiCompetencySource = read('src/components/evaluation/AiCompetencyAdminPanel.tsx')
  const upwardSource = read('src/components/evaluation/upward/UpwardReviewWorkspaceClient.tsx')
  const feedbackHeaderSource = read('src/components/evaluation/feedback360/MultiRaterCycleHeader.tsx')
  const wordCloudSource = read('src/components/evaluation/wordcloud360/WordCloud360WorkspaceClient.tsx')
  const feedbackServerSource = read('src/server/feedback-360.ts')

  assert.equal(workbenchSource.includes('제출 완료 평가'), true)
  assert.equal(assignmentSource.includes('제출 완료 평가'), true)
  assert.equal(aiCompetencySource.includes('제출 완료 인원'), true)
  assert.equal(upwardSource.includes('제출 완료 응답'), true)
  assert.equal(upwardSource.includes('내 제출 완료 응답'), true)
  assert.equal(feedbackHeaderSource.includes('내 제출 완료 응답'), true)
  assert.equal(wordCloudSource.includes('제출 완료 응답'), true)
  assert.equal(feedbackServerSource.includes('응답 제출 완료'), true)
})

run('ops and notification surfaces use Korean metric wording for failures and fallback states', () => {
  const notificationSource = read('src/components/notifications/NotificationOpsClient.tsx')
  const adminOpsSource = read('src/components/ops/AdminOpsClient.tsx')
  const dashboardSource = read('src/server/dashboard-page.ts')
  const deadLetterRouteSource = read('src/app/api/admin/notification-dead-letters/route.ts')

  assert.equal(notificationSource.includes('총 발송 알림'), true)
  assert.equal(notificationSource.includes('발송 성공 비율'), true)
  assert.equal(notificationSource.includes('실패함 알림'), true)
  assert.equal(notificationSource.includes('발송 제외 알림'), true)
  assert.equal(notificationSource.includes('미리보기 변수(JSON)'), true)
  assert.equal(notificationSource.includes('dead letter'), false)

  assert.equal(adminOpsSource.includes('24시간 실패 작업'), true)
  assert.equal(adminOpsSource.includes('실패함 알림'), true)
  assert.equal(adminOpsSource.includes('AI 대체 응답'), true)
  assert.equal(adminOpsSource.includes('예산 초과 시나리오'), true)
  assert.equal(adminOpsSource.includes('실패함 재처리'), true)
  assert.equal(adminOpsSource.includes('dead letter'), false)

  assert.equal(dashboardSource.includes('실패함 알림'), true)
  assert.equal(dashboardSource.includes('실패함과 재처리 현황 확인'), true)
  assert.equal(dashboardSource.includes('dead letter'), false)

  assert.equal(deadLetterRouteSource.includes('선택한 실패함 항목을 찾을 수 없습니다.'), true)
  assert.equal(deadLetterRouteSource.includes('선택한 dead letter 항목을 찾을 수 없습니다.'), false)
})

console.log('Semantic metric label tests completed')
