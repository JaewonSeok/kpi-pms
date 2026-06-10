import Link from 'next/link'

import { requireProtectedPageSession } from '@/server/auth/protected-page'

export const dynamic = 'force-dynamic'

const openingLinks = [
  {
    title: 'HR 평가 운영 대시보드',
    href: '/evaluation/performance',
    description: 'MBO/KPI 작성, 리더 검토, 정책 분류, 평가자 배정 blocker를 매일 확인합니다.',
  },
  {
    title: '평가자 배정 관리',
    href: '/admin/performance-assignments',
    description: 'FIRST / SECOND / FINAL 평가자 누락과 routing blocker를 확인합니다.',
  },
  {
    title: '평가 일정 관리',
    href: '/admin/performance-calendar',
    description: '7/1 MBO 오픈, 월간 실적, 리더 검토 일정을 확인합니다.',
  },
  {
    title: '개인 KPI/MBO',
    href: '/kpi/personal',
    description: '구성원 KPI 작성, 제출, 팀장 검토/확정 흐름을 확인합니다.',
  },
  {
    title: '월간 실적',
    href: '/kpi/monthly',
    description: '월간 결과, 증빙, 코멘트 준비 상태를 확인합니다.',
  },
  {
    title: '평가 과정 미리보기',
    href: '/evaluation/workbench',
    description: '평가 워크벤치에서 자기평가, 1차평가, 본부검수, 최종평가, 점수·등급 preview를 확인합니다.',
  },
]

const advancedLinks = [
  {
    title: '공식 전환 준비(고급)',
    href: '/admin/evaluation-readiness',
    description: 'Baseline 내보내기, policyCategory 정리, 공식 저장 차단 상태를 읽기 전용으로 확인합니다.',
  },
  {
    title: '조직 점수 입력(고급)',
    href: '/admin/department-score-intake',
    description: '부서/조직 점수 입력 준비 화면입니다. 공식 점수 반영과는 분리되어 있습니다.',
  },
  {
    title: '360/리더십',
    href: '/evaluation/360/admin',
    description: '다면 피드백과 리더십 준비 상태 흐름을 확인합니다.',
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
          7/1 MBO 오픈 운영
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">2026 MBO/KPI 운영 허브</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          HR/인사 관리자가 7/1 MBO/KPI 오픈 때 자주 쓰는 화면을 먼저 모았습니다. 이 화면은 화면 이동 전용이며 저장,
          제출, 확정, 사전 실행 검토, 실제 반영, 기존 데이터 채우기, 공식 점수/등급 반영을 실행하지 않습니다.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {openingLinks.map((item) => (
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

      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          고급 / 공식 전환 준비 화면
        </summary>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          공식 전환, 조직 점수, 360/리더십, AI 역량 관리는 7/1 MBO 오픈 이후 단계까지 함께 점검할 때 사용합니다.
          여기에도 실행 버튼은 없고, 각 화면의 권한과 안전 경계를 그대로 따릅니다.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {advancedLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="text-sm font-semibold text-slate-900">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              <div className="mt-3 text-xs font-semibold text-slate-600">화면 열기</div>
            </Link>
          ))}
        </div>
      </details>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        안전 경계: 이 허브에는 기존 데이터 채우기 실제 반영, 사전 실행 검토 실행, 공식 점수 반영, 공식 등급 반영,
        AI 점수 제외 활성화, 공식 저장 점수(totalScore) 쓰기, 공식 저장 등급(gradeId) 쓰기, 기능 활성화 스위치 변경 버튼이 없습니다.
      </section>
    </div>
  )
}
