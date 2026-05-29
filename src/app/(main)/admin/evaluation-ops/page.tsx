import Link from 'next/link'

import { requireProtectedPageSession } from '@/server/auth/protected-page'

export const dynamic = 'force-dynamic'

const operationLinks = [
  {
    title: '성과평가 운영',
    href: '/evaluation/performance',
    description: '일일 HR 운영 요약, 오늘 할 일, 공식 전환 상태 요약을 확인합니다.',
  },
  {
    title: '평가 Workbench',
    href: '/evaluation/workbench',
    description: '실제 평가 흐름을 preview-only로 확인합니다.',
  },
  {
    title: '공식 전환 준비',
    href: '/admin/evaluation-readiness',
    description: 'Gate, readiness 상세, dry-run 준비 도구, Go/No-Go를 읽기 전용으로 확인합니다.',
  },
  {
    title: '평가자 배정 관리',
    href: '/admin/performance-assignments',
    description: '평가자 배정과 routing 상태를 관리합니다.',
  },
  {
    title: '평가 일정 관리',
    href: '/admin/performance-calendar',
    description: '평가 운영 일정과 단계별 기간을 확인합니다.',
  },
  {
    title: '개인 KPI',
    href: '/kpi/personal',
    description: '구성원 개인 KPI 작성/제출 현황을 확인합니다.',
  },
  {
    title: '월간 실적',
    href: '/kpi/monthly',
    description: '월간 실적 입력과 근거 현황을 확인합니다.',
  },
  {
    title: '360/리더십',
    href: '/evaluation/360/admin',
    description: '다면 피드백과 리더십 readiness 흐름을 확인합니다.',
  },
  {
    title: 'AI 역량 관리',
    href: '/evaluation/ai-competency/admin',
    description: 'AI Pass/Fail 역량평가 운영 화면으로 이동합니다.',
  },
]

export default async function EvaluationOpsPage() {
  await requireProtectedPageSession({
    route: '/admin/evaluation-ops',
    pathname: '/admin/evaluation-ops',
  })

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-6 sm:py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">
          HR evaluation operations
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">2026 평가 운영 허브</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          HR/admin이 자주 쓰는 평가 운영 화면을 역할별로 모았습니다. 이 화면은 navigation-only이며 저장, 제출,
          확정, dry-run, apply, backfill, 공식 점수/등급 반영을 실행하지 않습니다.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {operationLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <div className="text-sm font-semibold text-slate-900">{item.title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            <div className="mt-3 text-xs font-semibold text-emerald-700">화면 열기</div>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        안전 경계: 이 허브에는 backfill --apply, dry-run 실행, official scoring, official grade, AI score exclusion,
        Evaluation.totalScore write, Evaluation.gradeId write, feature flag 변경 버튼이 없습니다.
      </section>
    </div>
  )
}
