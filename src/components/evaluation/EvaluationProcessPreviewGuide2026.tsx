import type { ReactNode } from 'react'

const PROCESS_STEPS = [
  { order: 1, title: 'KPI/MBO 작성', description: '직원이 목표, 수행계획, 비중을 작성' },
  { order: 2, title: '월간 실적·증빙 축적', description: '수행 근거와 코멘트를 월별로 준비' },
  { order: 3, title: '수행결과 작성', description: '성과, 본인 기여, 주요 산출물 중심 작성' },
  { order: 4, title: 'HR 기본점수 부여', description: '조직 KPI 결과와 Target/Excellent 기준 반영' },
  { order: 5, title: '팀장 1차평가', description: '실제 기여 수준 검토, 필요 시 ±5점 조정' },
  { order: 6, title: 'HR 본부검수', description: '점수 분포, 가감점, 기준 미준수 여부 검토' },
  { order: 7, title: '최종평가 / 대표이사 보고', description: '최종 등급 preview와 조정 가능성 확인' },
  { order: 8, title: '공식 저장 차단', description: 'totalScore / gradeId 저장은 readiness gate 이후 별도 승인' },
]

function PreviewBadge(props: { tone?: 'warn' | 'neutral'; children: ReactNode }) {
  const palette = props.tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${palette}`}>{props.children}</span>
}

function ProcessStepCard(props: { order: number; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-white px-3 py-3">
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
          {props.order}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{props.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{props.description}</p>
        </div>
      </div>
    </div>
  )
}

export function EvaluationProcessPreviewGuide2026(props: { compact?: boolean }) {
  if (props.compact) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h5 className="text-sm font-semibold text-slate-900">2026 평가 과정 미리보기</h5>
          <PreviewBadge tone="warn">공식 저장 차단</PreviewBadge>
          <PreviewBadge>preview only</PreviewBadge>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          MBO/KPI 작성과 월간 실적·증빙 축적 이후 수행결과 작성, 1차평가, HR 본부검수, 최종평가로 이어집니다.
          공식 전환은 2027년 1월 phase에서 별도 readiness gate 이후 진행합니다.
        </p>
        <div className="mt-3 grid gap-2 text-xs leading-5 text-indigo-900 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-indigo-100 bg-white px-3 py-2">KPI/MBO 작성 → 월간 실적·증빙</div>
          <div className="rounded-xl border border-indigo-100 bg-white px-3 py-2">수행결과 작성 → 팀장 1차평가</div>
          <div className="rounded-xl border border-indigo-100 bg-white px-3 py-2">HR 기본점수 → HR 본부검수</div>
          <div className="rounded-xl border border-indigo-100 bg-white px-3 py-2">최종평가 → 점수·등급 preview</div>
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 px-5 py-4 shadow-sm sm:px-6 sm:py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">2026 평가 과정 미리보기</h2>
            <PreviewBadge tone="warn">공식 저장 차단</PreviewBadge>
            <PreviewBadge>preview only</PreviewBadge>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            목표 작성부터 최종 점수·등급 preview까지 이어지는 평가 흐름입니다. 공식 저장은 아직 차단되어 있습니다.
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-white p-3 text-xs leading-5 text-indigo-900">
          <p className="font-semibold">점수·등급 preview</p>
          <p>조직 성과 30% + 개인 성과 70%</p>
          <p>totalScore / gradeId 저장 없음</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {PROCESS_STEPS.map((step) => (
          <ProcessStepCard
            key={step.order}
            order={step.order}
            title={step.title}
            description={step.description}
          />
        ))}
      </div>

      <p className="mt-4 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs leading-5 text-indigo-900">
        점수·등급은 preview입니다. 조직 성과 30% + 개인 성과 70% 구조와 등급 기준을 보여주며,
        Evaluation.totalScore와 Evaluation.gradeId에는 저장하지 않습니다.
      </p>
    </section>
  )
}
