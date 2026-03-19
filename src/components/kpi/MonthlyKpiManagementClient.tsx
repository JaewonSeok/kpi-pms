'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Bot,
  FileText,
  Paperclip,
  Save,
  ShieldAlert,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react'
import type { MonthlyPageData } from '@/server/monthly-kpi-page'

type ClientProps = MonthlyPageData & { initialTab?: string; initialRecordId?: string }
type TabKey = 'entry' | 'trend' | 'review' | 'evidence' | 'ai'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'entry', label: '\uC785\uB825' },
  { key: 'trend', label: '\uB204\uC801 \uCD94\uC774' },
  { key: 'review', label: '\uB9AC\uBDF0/\uD53C\uB4DC\uBC31' },
  { key: 'evidence', label: '\uC99D\uBE59' },
  { key: 'ai', label: 'AI \uBCF4\uC870' },
]

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: '\uBBF8\uC2DC\uC791',
  DRAFT: '\uC784\uC2DC\uC800\uC7A5',
  SUBMITTED: '\uC81C\uCD9C\uB428',
  REVIEWED: '\uB9AC\uBDF0 \uC644\uB8CC',
  LOCKED: '\uC7A0\uAE08',
  MIXED: '\uD63C\uD569',
}

const percent = (value?: number | null) =>
  typeof value === 'number' && !Number.isNaN(value) ? `${Math.round(value * 10) / 10}%` : '-'

const monthLabel = (value: string) => (/^\d{4}-\d{2}$/.test(value) ? value.replace('-', '.') : value)

const statusTone = (status: string) =>
  status === 'LOCKED'
    ? 'bg-slate-900 text-white'
    : status === 'REVIEWED'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'SUBMITTED'
        ? 'bg-blue-100 text-blue-700'
        : status === 'DRAFT'
          ? 'bg-amber-100 text-amber-700'
          : status === 'MIXED'
            ? 'bg-violet-100 text-violet-700'
            : 'bg-slate-100 text-slate-600'

export function MonthlyKpiManagementClient({
  initialTab,
  initialRecordId,
  ...props
}: ClientProps) {
  const [tab, setTab] = useState<TabKey>(
    TABS.some((item) => item.key === initialTab) ? (initialTab as TabKey) : 'entry'
  )
  const [selectedId, setSelectedId] = useState(initialRecordId ?? props.records[0]?.id ?? '')
  const selected = useMemo(
    () => props.records.find((item) => item.id === selectedId) ?? props.records[0] ?? null,
    [props.records, selectedId]
  )

  if (props.state !== 'ready') {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <ShieldAlert className="h-6 w-6 text-slate-600" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-slate-950">
            {props.state === 'permission-denied'
              ? '\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'
              : props.state === 'empty'
                ? '\uC6D4\uAC04 \uC2E4\uC801 \uB300\uC0C1 KPI\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
                : '\uC6D4\uAC04 \uC2E4\uC801\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {props.message ?? '\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header />

      <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-200">
                MONTHLY PERFORMANCE
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(props.summary.overallStatus)}`}>
                {STATUS_LABELS[props.summary.overallStatus] ?? props.summary.overallStatus}
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                {'\uC6D4\uAC04 \uC2E4\uC801 \uC6B4\uC601 \uC6CC\uD06C\uBCA4\uCE58'}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                {props.actor.name}
                {'\uB2D8\uC758 '}
                {monthLabel(props.selectedMonth)}
                {' \uC2E4\uC801 \uD604\uD669\uC785\uB2C8\uB2E4. \uC785\uB825, \uB9AC\uBDF0, \uC99D\uBE59, \uCD94\uC774\uB97C \uD55C \uD654\uBA74\uC5D0\uC11C \uAD00\uB9AC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroMetric label={'\uC5F0\uB3C4'} value={`${props.selectedYear}\uB144`} />
              <HeroMetric label={'\uC6D4'} value={monthLabel(props.selectedMonth)} />
              <HeroMetric label={'\uC81C\uCD9C\uB960'} value={`${props.summary.submissionRate}%`} />
              <HeroMetric label={'\uD3C9\uADE0 \uB2EC\uC131\uB960'} value={percent(props.summary.averageAchievementRate)} />
            </div>
          </div>
          <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
            <HeroMetric label={'\uC704\uD5D8 KPI \uC218'} value={`${props.summary.riskyCount}\uAC74`} />
            <HeroMetric label={'\uC99D\uBE59 \uCCA8\uBD80 \uC218'} value={`${props.summary.attachmentCount}\uAC74`} />
            <HeroMetric label={'\uBBF8\uC785\uB825 KPI \uC218'} value={`${props.summary.missingCount}\uAC1C`} />
            <HeroMetric label={'\uB9AC\uBDF0 \uB300\uAE30 \uC218'} value={`${props.summary.reviewPendingCount}\uAC1C`} />
            <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
              <Button>
                <Save className="h-4 w-4" />
                {'\uC784\uC2DC\uC800\uC7A5'}
              </Button>
              <Button secondary>
                <FileText className="h-4 w-4" />
                {'\uC81C\uCD9C'}
              </Button>
              <Button secondary>
                <Upload className="h-4 w-4" />
                {'\uC99D\uBE59 \uCCA8\uBD80'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-7">
        <Metric label={'\uC774\uBC88 \uB2EC KPI \uC218'} value={`${props.summary.totalKpiCount}\uAC1C`} />
        <Metric label={'\uC81C\uCD9C \uC644\uB8CC KPI'} value={`${props.summary.submittedCount}\uAC1C`} />
        <Metric label={'\uBBF8\uC785\uB825 KPI'} value={`${props.summary.missingCount}\uAC1C`} />
        <Metric label={'\uC704\uD5D8 KPI'} value={`${props.summary.riskyCount}\uAC1C`} />
        <Metric label={'\uC0C1\uC0AC \uB9AC\uBDF0 \uB300\uAE30'} value={`${props.summary.reviewPendingCount}\uAC1C`} />
        <Metric label={'\uD3C9\uADE0 \uB2EC\uC131\uB960'} value={percent(props.summary.averageAchievementRate)} />
        <div className="rounded-[1.75rem] border border-blue-200 bg-blue-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
            {'\uB2E4\uC74C \uD589\uB3D9'}
          </p>
          <div className="mt-3 space-y-2 text-sm text-blue-900">
            <p>{'\u2022 \uBBF8\uC785\uB825 KPI\uB97C \uBA3C\uC800 \uCC44\uC6CC \uC8FC\uC138\uC694.'}</p>
            <p>{'\u2022 \uC704\uD5D8 KPI \uCF54\uBA58\uD2B8\uC640 \uC99D\uBE59\uC744 \uBCF4\uAC15\uD574 \uC8FC\uC138\uC694.'}</p>
            <p>{'\u2022 \uB9AC\uBDF0 \uB300\uAE30 \uAC74\uC740 \uB9AC\uB354 \uD655\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.'}</p>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-sm">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-[1rem] px-4 py-3 text-sm font-medium transition ${
                tab === item.key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <Section
            title={
              tab === 'entry'
                ? '\uC6D4\uAC04 \uC785\uB825'
                : tab === 'trend'
                  ? '\uB204\uC801 \uCD94\uC774'
                  : tab === 'review'
                    ? '\uB9AC\uBDF0/\uD53C\uB4DC\uBC31'
                    : tab === 'evidence'
                      ? '\uC99D\uBE59'
                      : 'AI \uBCF4\uC870'
            }
            desc={
              tab === 'entry'
                ? '\uC815\uB7C9 KPI\uB294 \uC2E4\uC801\uAC12\uACFC \uB2EC\uC131\uB960, \uC815\uC131 KPI\uB294 \uC2E4\uD589 \uC694\uC57D\uACFC \uB9AC\uC2A4\uD06C\uB97C \uD568\uAED8 \uAE30\uB85D\uD569\uB2C8\uB2E4.'
                : tab === 'trend'
                  ? '\uCD5C\uADFC 12\uAC1C\uC6D4 \uCD94\uC774\uC640 \uD3B8\uCC28\uB97C \uD655\uC778\uD569\uB2C8\uB2E4.'
                  : tab === 'review'
                    ? '\uB9AC\uB354 \uD53C\uB4DC\uBC31\uACFC \uBCF4\uC644 \uC694\uCCAD\uC744 \uD55C \uACF3\uC5D0\uC11C \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.'
                    : tab === 'evidence'
                      ? '\uD3C9\uAC00 \uACB0\uACFC\uB97C \uC124\uBA85\uD558\uB294 \uD30C\uC77C \uADFC\uAC70 \uC800\uC7A5\uC18C\uC785\uB2C8\uB2E4.'
                      : '\uC2E4\uC801 \uC694\uC57D, \uC704\uD5D8 KPI \uC124\uBA85, \uB9AC\uB354 \uB9AC\uBDF0 \uCD08\uC548\uC744 \uC548\uC804\uD558\uAC8C \uBCF4\uC870\uD569\uB2C8\uB2E4.'
            }
          />

          {tab === 'entry' ? (
            <div className="mt-5 space-y-3">
              {props.records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                    selected?.id === record.id
                      ? 'border-slate-900 bg-slate-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(record.status)}`}>
                          {STATUS_LABELS[record.status] ?? record.status}
                        </span>
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {record.type === 'QUANTITATIVE'
                            ? '\uC815\uB7C9 KPI'
                            : '\uC815\uC131 KPI'}
                        </span>
                      </div>
                      <p className="text-base font-semibold text-slate-900">{record.kpiTitle}</p>
                      <p className="text-sm text-slate-500">
                        {'\uBAA9\uD45C\uAC12 '}
                        {record.targetValue ?? '-'} {record.unit ?? ''} {' \u00B7 \uC2E4\uC801\uAC12 '}
                        {record.actualValue ?? '-'} {' \u00B7 \uB2EC\uC131\uB960 '}
                        {percent(record.achievementRate)}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <Pill label={'\uC870\uC9C1 KPI'} value={record.orgKpiTitle ?? '\uBBF8\uC5F0\uACB0'} />
                      <Pill label={'\uCD5C\uADFC \uCCB4\uD06C\uC778'} value={record.linkedCheckins[0]?.summary ?? '\uC5C6\uC74C'} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {tab === 'trend' ? (
            <div className="mt-5 space-y-3">
              {props.trends.map((trend) => (
                <div key={trend.personalKpiId} className="rounded-[1.5rem] border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{trend.kpiTitle}</p>
                      <p className="mt-1 text-sm text-slate-500">{percent(trend.average)}</p>
                    </div>
                    <p className="text-sm text-slate-500">
                      {'\uCD5C\uC2E0 '} {percent(trend.latest)}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-6 gap-2 xl:grid-cols-12">
                    {trend.points.map((point) => {
                      const ratio = Math.min(Math.max(point.achievementRate ?? 0, 0), 140)
                      return (
                        <div key={point.month} className="space-y-2">
                          <div className="flex h-24 items-end rounded-full bg-slate-100 p-1">
                            <div
                              className={`w-full rounded-full ${
                                ratio >= 100 ? 'bg-emerald-400' : ratio >= 80 ? 'bg-amber-400' : 'bg-rose-400'
                              }`}
                              style={{ height: `${Math.max(12, (ratio / 140) * 100)}%` }}
                            />
                          </div>
                          <p className="text-center text-[11px] text-slate-500">{point.month.slice(5)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'review' ? (
            <div className="mt-5 space-y-3">
              {props.reviews.length ? (
                props.reviews.map((review) => (
                  <div key={review.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {review.status === 'REVIEWED' ? '\uB9AC\uBDF0 \uC644\uB8CC' : '\uBCF4\uC644 \uC694\uCCAD'}
                      </span>
                      <p className="text-sm text-slate-500">{review.reviewerName}</p>
                    </div>
                    <p className="mt-3 text-base font-semibold text-slate-900">{review.kpiTitle}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{review.comment}</p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title={'\uC544\uC9C1 \uB4F1\uB85D\uB41C \uB9AC\uBDF0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}
                  description={'\uC81C\uCD9C\uB41C \uC6D4\uAC04 \uC2E4\uC801\uC744 \uAE30\uC900\uC73C\uB85C \uB9AC\uB354 \uB9AC\uBDF0\uAC00 \uB204\uC801\uB418\uBA74 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.'}
                />
              )}
            </div>
          ) : null}

          {tab === 'evidence' ? (
            <div className="mt-5 space-y-3">
              {props.evidence.length ? (
                props.evidence.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.kpiTitle} {' \u00B7 '} {item.kind}
                      </p>
                    </div>
                    {item.dataUrl ? (
                      <a
                        href={item.dataUrl}
                        download={item.name}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                      >
                        <Paperclip className="h-4 w-4" />
                        {'\uB2E4\uC6B4\uB85C\uB4DC'}
                      </a>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  title={'\uB4F1\uB85D\uB41C \uC99D\uBE59\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}
                  description={'\uC2E4\uD589 \uADFC\uAC70\uAC00 \uB0A8\uB3C4\uB85D \uC0B0\uCD9C\uBB3C\uC774\uB098 \uBCF4\uACE0\uC11C\uB97C \uCCA8\uBD80\uD574 \uB450\uC138\uC694.'}
                />
              )}
            </div>
          ) : null}

          {tab === 'ai' ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                '\uC6D4\uAC04 \uC2E4\uC801 \uCF54\uBA58\uD2B8 \uCD08\uC548',
                '\uC704\uD5D8 KPI \uC124\uBA85 \uBCF4\uC870',
                '\uC0C1\uC0AC \uB9AC\uBDF0 \uCD08\uC548',
                '\uC99D\uBE59 \uC694\uC57D',
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {'Preview \uD655\uC778 \uD6C4 \uC0AC\uB78C\uC774 \uC801\uC6A9\uD574\uC57C \uD569\uB2C8\uB2E4.'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <Section
            title={selected ? selected.kpiTitle : 'KPI \uC0C1\uC138'}
            desc={'\uC2E4\uC801\uAC12, \uBA54\uBAA8, \uB9AC\uBDF0, \uC5F0\uACB0 \uC815\uBCF4\uB97C \uD55C \uACF3\uC5D0\uC11C \uD655\uC778\uD569\uB2C8\uB2E4.'}
          />
          {selected ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Pill label={'\uC0C1\uD0DC'} value={STATUS_LABELS[selected.status] ?? selected.status} />
                <Pill label={'\uC870\uC9C1 KPI \uC5F0\uACB0'} value={selected.orgKpiTitle ?? '\uBBF8\uC5F0\uACB0'} />
                <Pill label={'\uBAA9\uD45C\uAC12'} value={`${selected.targetValue ?? '-'} ${selected.unit ?? ''}`} />
                <Pill label={'\uB2EC\uC131\uB960'} value={percent(selected.achievementRate)} />
              </div>
              <Box
                title={'\uD65C\uB3D9 \uC694\uC57D'}
                body={selected.activityNote ?? '\uC544\uC9C1 \uAE30\uB85D\uB41C \uD65C\uB3D9 \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}
              />
              <Box
                title={'\uC7A5\uC560\uC694\uC778'}
                body={selected.blockerNote ?? '\uAE30\uB85D\uB41C \uC7A5\uC560\uC694\uC778\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}
              />
              <Box
                title={'\uB9AC\uB354 \uB9AC\uBDF0 / \uBCF4\uC644 \uC694\uCCAD'}
                body={selected.reviewComment ?? selected.reviewRequestComment ?? '\uC544\uC9C1 \uB4F1\uB85D\uB41C \uB9AC\uBDF0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}
              />
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">AI preview</p>
                <p className="mt-2 text-sm text-slate-600">
                  {'\uC6D4\uAC04 \uC2E4\uC801 \uC694\uC57D, \uC704\uD5D8 KPI \uC124\uBA85, \uCCB4\uD06C\uC778 \uC544\uC820\uB2E4 \uCD94\uCC9C, \uD3C9\uAC00 \uADFC\uAC70 \uC694\uC57D\uC744 \uC5EC\uAE30\uC5D0\uC11C preview \uD6C4 \uC801\uC6A9\uD558\uB294 \uD750\uB984\uC73C\uB85C \uC5F0\uACB0\uD569\uB2C8\uB2E4.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button>
                    <Sparkles className="h-4 w-4" />
                    AI preview
                  </Button>
                  <Link
                    href="/evaluation/assistant"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    <Wand2 className="h-4 w-4" />
                    {'AI \uBCF4\uC870 \uC791\uC131'}
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title={'\uC120\uD0DD\uB41C KPI\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}
              description={'\uC67C\uCABD\uC5D0\uC11C KPI\uB97C \uC120\uD0DD\uD558\uBA74 \uC785\uB825 \uC0C1\uC138\uC640 \uB9AC\uBDF0 \uC815\uBCF4\uB97C \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
            />
          )}
        </section>
      </div>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <Section
          title={'\uC5F0\uACB0\uB41C \uB2E4\uC74C \uD654\uBA74'}
          desc={'\uC6D4\uAC04 \uC2E4\uC801\uC740 KPI, \uCCB4\uD06C\uC778, \uD3C9\uAC00 \uACB0\uACFC\uC640 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC774\uC5B4\uC838\uC57C \uD569\uB2C8\uB2E4.'}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              href: '/kpi/personal',
              label: '\uAC1C\uC778 KPI',
              description: '\uAE30\uC900 KPI\uC640 \uAC00\uC911\uCE58\uB97C \uB2E4\uC2DC \uD655\uC778\uD569\uB2C8\uB2E4.',
            },
            {
              href: '/checkin',
              label: '\uCCB4\uD06C\uC778 \uC77C\uC815',
              description: '\uC6D4\uAC04 \uD68C\uACE0\uC640 \uC561\uC158\uC544\uC774\uD15C\uC744 1:1\uB85C \uC5F0\uACB0\uD569\uB2C8\uB2E4.',
            },
            {
              href: '/evaluation/results',
              label: '\uD3C9\uAC00 \uACB0\uACFC',
              description: '\uB204\uC801\uB41C \uC6D4\uAC04 \uC2E4\uC801\uC774 \uD3C9\uAC00 \uADFC\uAC70\uB85C \uC5B4\uB5BB\uAC8C \uC4F0\uC774\uB294\uC9C0 \uBD05\uB2C8\uB2E4.',
            },
            {
              href: '/evaluation/assistant',
              label: 'AI \uBCF4\uC870 \uC791\uC131',
              description: '\uD3C9\uAC00 \uCF54\uBA58\uD2B8 \uCD08\uC548\uACFC \uC131\uC7A5 \uC81C\uC548\uC744 \uC774\uC5B4\uAC11\uB2C8\uB2E4.',
            },
            {
              href: '/notifications',
              label: '\uC54C\uB9BC',
              description: '\uB9AC\uBDF0 \uC644\uB8CC, \uBCF4\uC644 \uC694\uCCAD, \uC81C\uCD9C \uC0C1\uD0DC\uB97C \uD655\uC778\uD569\uB2C8\uB2E4.',
            },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[1.5rem] border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="font-semibold text-slate-900">{link.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{link.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function Header() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Performance Record</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {'\uC6D4\uAC04 \uC2E4\uC801'}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {'\uC6D4\uBCC4 KPI \uC2E4\uD589 \uAE30\uB85D, \uC0C1\uC0AC \uB9AC\uBDF0, \uC99D\uBE59 \uC790\uB8CC\uB97C \uB204\uC801\uD574 \uD3C9\uAC00 \uADFC\uAC70\uB85C \uC5F0\uACB0\uD558\uB294 \uC6B4\uC601 \uD654\uBA74\uC785\uB2C8\uB2E4.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/kpi/personal" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
          {'\uAC1C\uC778 KPI \uBCF4\uAE30'}
        </Link>
        <Link href="/checkin" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
          {'\uCCB4\uD06C\uC778 \uC77C\uC815'}
        </Link>
      </div>
    </div>
  )
}

function Section({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">{desc}</p>
    </div>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}

function Button({ children, secondary }: { children: React.ReactNode; secondary?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
        secondary ? 'border border-slate-200 text-slate-700' : 'bg-slate-900 text-white'
      }`}
    >
      {children}
    </button>
  )
}

function Box({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">{body}</p>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}
