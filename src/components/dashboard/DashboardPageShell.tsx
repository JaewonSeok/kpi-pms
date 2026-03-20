import Link from 'next/link'
import { AlertTriangle, ArrowRight, Bell, ClipboardList, ShieldCheck, TrendingUp } from 'lucide-react'
import { MonthlyTrendChart } from './DashboardCharts'
import type { DashboardPageData, DashboardTone } from '@/server/dashboard-page'

export function DashboardPageShell({ data }: { data: DashboardPageData }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">Performance Operating System</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">대시보드</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">{data.description}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">{data.title}</div>
            <div className="mt-1">{data.year}년 기준 / {data.userName}</div>
            <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClass(data.statusTone)}`}>{data.statusLabel}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.summary.map((card) => (
          <Link
            key={card.label}
            href={card.href ?? '#'}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{card.label}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{card.value}</div>
            <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass(card.tone)}`}>
              {card.description}
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">달성률 추이</h2>
              <p className="mt-1 text-sm text-slate-500">최근 6개월 기준 평균 달성률 흐름입니다.</p>
            </div>
            <Link href="/kpi/monthly" className="inline-flex items-center text-sm font-semibold text-blue-600">
              월간 실적으로 이동
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 h-[220px]">
            {data.trend.length ? (
              <MonthlyTrendChart data={data.trend} />
            ) : (
              <EmptyState icon={<TrendingUp className="h-6 w-6" />} message="최근 달성률 데이터가 충분하지 않습니다." />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">다음 행동</h2>
              <p className="mt-1 text-sm text-slate-500">지금 바로 가야 하는 화면만 추렸습니다.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4 space-y-3">
            {data.actions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="text-sm font-semibold text-slate-900">{action.label}</div>
                <div className="mt-1 text-sm text-slate-500">{action.description}</div>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="중점 확인 항목" description="전략-실행-평가 흐름에서 가장 먼저 봐야 할 신호입니다.">
          {data.focusItems.length ? data.focusItems.map((item) => <ListCard key={item.title} {...item} />) : <EmptyState icon={<ClipboardList className="h-6 w-6" />} message="중점 확인 항목이 없습니다." />}
        </Panel>
        <Panel title="평가 / 검토 큐" description="내가 지금 작성하거나 검토해야 하는 평가입니다.">
          {data.reviewQueue.length ? data.reviewQueue.map((item) => <ListCard key={item.title + item.description} {...item} tone="neutral" />) : <EmptyState icon={<ClipboardList className="h-6 w-6" />} message="대기 중인 평가가 없습니다." />}
        </Panel>
        <Panel title="체크인 / 알림" description="예정된 면담과 읽지 않은 알림을 함께 봅니다.">
          {data.checkins.length ? data.checkins.map((item) => <ListCard key={item.title + item.description} {...item} tone="neutral" />) : null}
          {data.notifications.length ? data.notifications.map((item) => <SimpleCard key={item.title + item.description} {...item} />) : null}
          {!data.checkins.length && !data.notifications.length ? <EmptyState icon={<Bell className="h-6 w-6" />} message="확인할 체크인이나 알림이 없습니다." /> : null}
        </Panel>
      </section>

      <Panel title="리스크 / 주의 신호" description="지금 놓치면 다음 단계에 영향을 주는 항목입니다.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.risks.length ? data.risks.map((risk) => <ListCard key={risk.title} {...risk} />) : <EmptyState icon={<AlertTriangle className="h-6 w-6" />} message="현재 확인된 리스크가 없습니다." />}
        </div>
      </Panel>
    </div>
  )
}

function Panel(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{props.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{props.description}</p>
      <div className="mt-4 space-y-3">{props.children}</div>
    </section>
  )
}

function ListCard(props: {
  title: string
  description: string
  badge?: string
  href?: string
  tone: DashboardTone
}) {
  const content = (
    <div className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
        {props.badge ? <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass(props.tone)}`}>{props.badge}</span> : null}
      </div>
      <div className="mt-2 text-sm text-slate-500">{props.description}</div>
    </div>
  )

  if (props.href) {
    return <Link href={props.href}>{content}</Link>
  }

  return content
}

function SimpleCard(props: { title: string; description: string; href?: string }) {
  const content = (
    <div className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-2 text-sm text-slate-500">{props.description}</div>
    </div>
  )

  if (props.href) {
    return <Link href={props.href}>{content}</Link>
  }

  return content
}

function EmptyState(props: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
      {props.icon}
      <p className="mt-3">{props.message}</p>
    </div>
  )
}

function toneClass(tone: DashboardTone) {
  if (tone === 'success') return 'bg-emerald-100 text-emerald-700'
  if (tone === 'warn') return 'bg-amber-100 text-amber-700'
  if (tone === 'error') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}
