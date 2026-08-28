'use client'

import type { KpiProgressPageData } from '@/server/kpi-progress-page'

const JOB_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: '일반',
  SALES: '영업',
}

export function KpiProgressClient({ data }: { data: KpiProgressPageData }) {
  if (data.state === 'permission-denied') {
    return <div className="p-8 text-sm text-slate-500">이 페이지는 관리자만 접근할 수 있습니다.</div>
  }

  if (data.state === 'empty') {
    return <div className="p-8 text-sm text-slate-500">해당 조건의 재직 팀원이 없습니다.</div>
  }

  const { summary, tracks, departments } = data

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">개인 KPI 수립 현황</h1>
        <p className="mt-1 text-sm text-slate-500">모집단: 재직 팀원 · 연구개발본부 제외</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <div className="text-3xl font-bold tabular-nums text-slate-900">{summary.completionRate}%</div>
          <div className="mt-0.5 text-sm text-slate-500">
            완료 {summary.completedCount}명 / 전체 {summary.targetCount}명 · 잔여 {summary.remainingCount}명
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-100">
          <div
            className="h-3 rounded-full bg-slate-900 transition-all"
            style={{ width: `${summary.completionRate}%` }}
          />
        </div>
      </div>

      {tracks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">잔여 인원 분해 (업무 트랙별)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-2 font-medium">트랙</th>
                  <th className="pb-2 text-right font-medium">미착수</th>
                  <th className="pb-2 text-right font-medium">진행 중</th>
                  <th className="pb-2 text-right font-medium">소계</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <tr key={track.jobCategory} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-900">{JOB_CATEGORY_LABELS[track.jobCategory] ?? track.jobCategory}</td>
                    <td className="py-2 text-right tabular-nums text-slate-700">{track.notStartedCount}명</td>
                    <td className="py-2 text-right tabular-nums text-slate-700">{track.inProgressCount}명</td>
                    <td className="py-2 text-right tabular-nums font-semibold text-slate-900">
                      {track.notStartedCount + track.inProgressCount}명
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {departments.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">부서별 잔여 인원</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-2 font-medium">부서</th>
                  <th className="pb-2 text-right font-medium">잔여</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.deptName} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-900">{dept.deptName}</td>
                    <td className="py-2 text-right tabular-nums text-slate-700">{dept.remainingCount}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
