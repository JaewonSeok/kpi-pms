'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { BarChart3, Hash, ShieldCheck, Target, TrendingUp, Users } from 'lucide-react'
import { Feedback360Avatar, type Feedback360AvatarPerson } from './Feedback360Avatar'

export type Feedback360HubResultsCategory = {
  id: string
  label: string
  positiveCount?: number
  improvementCount?: number
}

type Feedback360HubResultsPptProps = {
  profile: Feedback360AvatarPerson & {
    department?: string | null
    position?: string | null
  }
  quarterLabel: string
  roundName?: string | null
  detailHref?: string
  targetCount: number
  submittedCount: number
  responseRate: number
  minRaters: number
  anonymityMet: boolean
  anonymityReadyCount: number
  categoryCount: number
  positiveTagCount: number
  improvementTagCount: number
  categories: Feedback360HubResultsCategory[]
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function GuideBadge(props: { children: ReactNode; tone?: 'blue' | 'emerald' | 'amber' | 'slate' }) {
  const tone = props.tone ?? 'slate'
  const className =
    tone === 'blue'
      ? 'border-blue-100 bg-blue-50 text-blue-700'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
        : tone === 'amber'
          ? 'border-amber-100 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-slate-50 text-slate-600'

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {props.children}
    </span>
  )
}

function MetricPill(props: { label: string; value: string; helper?: string; tone?: 'blue' | 'emerald' | 'amber' | 'slate' }) {
  const tone = props.tone ?? 'slate'
  const className =
    tone === 'blue'
      ? 'border-blue-100 bg-blue-50'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50'
          : 'border-slate-200 bg-white'

  return (
    <div className={`rounded-[18px] border px-4 py-3 ${className}`}>
      <div className="text-xs font-bold text-slate-500">{props.label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{props.value}</div>
      {props.helper ? <div className="mt-1 text-xs font-semibold text-slate-500">{props.helper}</div> : null}
    </div>
  )
}

function ProgressBar(props: { value: number; label: string }) {
  const value = clampPercent(props.value)

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
        <span>{props.label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function ResultSkeleton(props: { title: string; description?: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
      <div className="font-bold text-slate-900">{props.title}</div>
      <p className="mt-1">
        {props.description ?? '응답 수와 익명 기준이 충족되면 태그 분포와 반복 패턴이 표시됩니다.'}
      </p>
    </div>
  )
}

function EmptyResultNotice(props: { minRaters: number; submittedCount: number }) {
  return (
    <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
      <div className="font-bold">아직 결과를 표시할 수 없습니다.</div>
      <p className="mt-1">
        제출 응답 {props.submittedCount}건, 익명 기준 {props.minRaters}명 기준입니다. 응답 수와 익명 기준이
        충족되면 태그 분포와 반복 패턴이 표시됩니다.
      </p>
    </div>
  )
}

function PentagonSkeleton() {
  const outer = '86,14 154,63 128,144 44,144 18,63'
  const middle = '86,38 130,70 113,122 59,122 42,70'
  const inner = '86,62 106,77 98,102 74,102 66,77'

  return (
    <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
      <svg viewBox="0 0 172 172" className="h-52 w-full">
        <polygon points={outer} fill="white" stroke="#cbd5e1" strokeWidth="1.2" />
        <polygon points={middle} fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.1" />
        <polygon points={inner} fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.1" />
        {[outer, middle, inner].map((points) =>
          points.split(' ').map((point) => {
            const [x, y] = point.split(',')
            return <line key={`${points}:${point}`} x1="86" y1="86" x2={x} y2={y} stroke="#e2e8f0" strokeWidth="0.8" />
          })
        )}
      </svg>
      <div className="space-y-3">
        {['팀워크', '소통', '책임감', '문제해결', '피드백 수용'].map((label) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <ProgressBar value={0} label={`${label} · 데이터 대기`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Feedback360HubResultsPpt(props: Feedback360HubResultsPptProps) {
  const hasRound = Boolean(props.roundName)
  const responseRate = clampPercent(props.responseRate)
  const remainingForAnonymity = Math.max(props.minRaters - props.submittedCount, 0)
  const resultReadyLabel = props.anonymityMet ? '익명 기준 충족' : '익명 기준 대기'
  const maxCategoryCount = Math.max(
    1,
    ...props.categories.map((c) => (c.positiveCount ?? 0) + (c.improvementCount ?? 0))
  )

  return (
    <section id="feedback360-results" className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Feedback360Avatar person={props.profile} size="xl" />
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">다면평가 리포트</div>
                <h2 className="mt-2 truncate text-2xl font-extrabold tracking-tight text-slate-950">
                  {props.profile.name ?? '구성원'}
                </h2>
                <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                  {props.profile.department ?? '소속 확인 필요'} · {props.profile.position ?? '직책 확인 필요'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <GuideBadge tone={props.anonymityMet ? 'emerald' : 'amber'}>{resultReadyLabel}</GuideBadge>
              <GuideBadge tone="slate">공식 점수 아님</GuideBadge>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <MetricPill label="평가 기간" value={props.roundName ?? '결과 데이터 없음'} helper={props.quarterLabel} />
            <MetricPill label="전체 평가자 수" value={`${props.targetCount}명`} helper="배정 기준" tone="blue" />
            <MetricPill label="참여자 수" value={`${props.submittedCount}명`} helper="제출 응답 기준" tone="emerald" />
            <MetricPill
              label="익명성 보장"
              value={props.anonymityMet ? '충족' : '대기'}
              helper={props.anonymityMet ? '결과 확인 가능' : `${remainingForAnonymity}명 더 필요`}
              tone={props.anonymityMet ? 'emerald' : 'amber'}
            />
          </div>

          <div className="mt-5 rounded-[18px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              결과 준비 상태
            </div>
            <p className="mt-1">
              실제 제출 데이터와 익명 기준이 확인된 뒤 결과 리포트에 강점, 보완점, 관계별 반복 신호가 표시됩니다.
              임의 점수, 임의 순위, 임의 태그 분포는 표시하지 않습니다.
            </p>
          </div>
        </section>

        <aside className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <Users className="h-4 w-4 text-blue-600" />
            참여 현황
          </div>
          <div className="mt-4 space-y-4">
            <ProgressBar value={responseRate} label={`응답률 ${responseRate}%`} />
            <MetricPill label="익명 기준 충족 여부" value={resultReadyLabel} helper={`기준 ${props.minRaters}명`} />
            <MetricPill label="결과 공개 준비 상태" value={props.anonymityReadyCount ? '준비 확인 가능' : '대기'} helper={props.quarterLabel} />
          </div>
          {props.detailHref && hasRound ? (
            <Link
              href={props.detailHref}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              내 리포트 보기
            </Link>
          ) : null}
        </aside>
      </div>

      {!props.anonymityMet ? <EmptyResultNotice minRaters={props.minRaters} submittedCount={props.submittedCount} /> : null}

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-extrabold text-slate-950">종합 요약</div>
              <p className="mt-1 text-sm font-semibold text-slate-500">익명 기준 충족 후 실제 응답 패턴으로 채워집니다.</p>
            </div>
            <GuideBadge tone="blue">공식 점수 아님</GuideBadge>
          </div>
          <div className="mt-5">
            <PentagonSkeleton />
          </div>
        </section>

        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-base font-extrabold text-slate-950">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            전체 평가 결과
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">태그 카테고리별 강점/보완 신호를 실제 빈도로 표시합니다.</p>
          <div className="mt-4 space-y-3">
            {props.categories.slice(0, 6).map((category) => (
              <div key={category.id} className="rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-900">{category.label}</span>
                  <span className="text-xs font-bold text-slate-500">
                    강점 {category.positiveCount ?? 0} · 보완 {category.improvementCount ?? 0}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <ProgressBar value={((category.positiveCount ?? 0) / maxCategoryCount) * 100} label={`강점 ${category.positiveCount ?? 0}`} />
                  <ProgressBar value={((category.improvementCount ?? 0) / maxCategoryCount) * 100} label={`보완 ${category.improvementCount ?? 0}`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-base font-extrabold text-slate-950">
            <Hash className="h-5 w-5 text-blue-600" />
            태그 분포 / 결과 요약
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            해시태그 선택과 정성 의견이 충분히 모이면 결과 리포트 안에서 긍정 태그, 보완 태그, 관계별 응답 신호를 함께 확인합니다.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MetricPill label="태그 카테고리" value={`${props.categoryCount}개`} />
            <MetricPill label="긍정 태그" value={`${props.positiveTagCount}개`} tone="emerald" />
            <MetricPill label="보완 태그" value={`${props.improvementTagCount}개`} tone="amber" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ResultSkeleton title="반복 관찰된 강점 태그" />
            <ResultSkeleton title="반복 관찰된 보완 태그" />
            <ResultSkeleton title="상위 카테고리" description="반복 선택된 카테고리를 실제 응답 기준으로 보여줍니다." />
            <ResultSkeleton title="협업 강점" description="업무 맥락에서 관찰 가능한 행동 기준으로 강점을 요약합니다." />
            <ResultSkeleton title="보완 필요 행동" description="다음 협업에서 바꿔볼 수 있는 짧은 행동 단위로 정리합니다." />
            <ResultSkeleton title="리더/HR 참고 메모" description="익명성이 깨지지 않는 범위에서 운영자가 참고할 요약만 제공합니다." />
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
              <TrendingUp className="h-4 w-4" />
              강점 Top 3
            </div>
            <div className="mt-3">
              <ResultSkeleton title="데이터 없음 상태 안내" description="강점 태그가 실제 응답에서 반복 확인되면 이 영역에 표시됩니다." />
            </div>
          </section>
          <section className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
              <Target className="h-4 w-4" />
              보완 Top 3
            </div>
            <div className="mt-3">
              <ResultSkeleton title="데이터 없음 상태 안내" description="보완 태그가 실제 응답에서 반복 확인되면 이 영역에 표시됩니다." />
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <ResultSkeleton title="평가자 그룹별 비교" description="익명 기준을 충족한 그룹별 반복 신호만 비교합니다." />
          <ResultSkeleton title="주요 의견 요약" description="정성 의견이 충분할 때 핵심 문장을 요약합니다." />
          <ResultSkeleton title="후속 액션" description="다음 체크인에서 실행할 수 있는 행동 단위로 정리합니다." />
        </div>
      </section>
    </section>
  )
}
