'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  LineChart,
  ShieldAlert,
  Users,
} from 'lucide-react'
import type { StatisticsPageData } from '@/server/statistics-page'
import {
  StatisticsComparisonChart,
  StatisticsDistributionChart,
  StatisticsHorizontalBarChart,
  StatisticsStageStatusChart,
  StatisticsTrendChart,
} from './StatisticsCharts'

type StatisticsSections = NonNullable<StatisticsPageData['sections']>

export function ExecutiveStatisticsDashboardClient({ data }: { data: StatisticsPageData }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams?.toString())
    if (!value || value === 'ALL') {
      next.delete(key)
    } else {
      next.set(key, value)
    }

    if (key !== 'cycleId' && !next.get('cycleId') && data.filters.selectedCycleId) {
      next.set('cycleId', data.filters.selectedCycleId)
    }

    startTransition(() => {
      router.push(next.toString() ? `${pathname}?${next.toString()}` : pathname)
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
              Executive Statistics
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">통계</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              성과평가, KPI 실행, 리스크, 공정성, 준비도 신호를 한 화면에서 확인할 수 있는 CEO 보고용 통계입니다.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">
              {data.selectedCycle?.label ?? '통계 기준 정보 없음'}
            </div>
            <div className="mt-1">
              {data.actor?.organizationName ?? '-'} / {data.actor?.name ?? '-'}
            </div>
            <div className="mt-2 text-xs text-slate-500">기준 시각 {formatDateTime(data.generatedAt)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">필터</h2>
            <p className="mt-1 text-sm text-slate-500">
              평가 주기와 조직 범위를 바꾸면 모든 섹션이 같은 기준으로 다시 계산됩니다.
            </p>
          </div>
          {isPending ? <div className="text-sm font-medium text-blue-600">불러오는 중...</div> : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <FilterField label="평가 주기">
            <select
              value={data.filters.selectedCycleId ?? ''}
              onChange={(event) => updateFilter('cycleId', event.target.value)}
              className={selectClassName}
            >
              {data.filters.cycleOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="기간">
            <select
              value={data.filters.selectedPeriod}
              onChange={(event) => updateFilter('period', event.target.value)}
              className={selectClassName}
            >
              {data.filters.periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          {data.filters.showOrgFilter ? (
            <FilterField label="회사">
              <select
                value={data.filters.selectedOrgId ?? ''}
                onChange={(event) => updateFilter('orgId', event.target.value)}
                className={selectClassName}
              >
                {data.filters.orgOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </FilterField>
          ) : null}
          <FilterField label="조직">
            <select
              value={data.filters.selectedDepartmentId}
              onChange={(event) => updateFilter('departmentId', event.target.value)}
              className={selectClassName}
            >
              {data.filters.departmentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {`${'ㆍ'.repeat(option.level)}${option.name}`}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="직위">
            <select
              value={data.filters.selectedPosition}
              onChange={(event) => updateFilter('position', event.target.value)}
              className={selectClassName}
            >
              {data.filters.positionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
        </div>
      </section>

      {data.alerts.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            일부 통계를 불러오지 못해 가능한 범위의 데이터만 표시합니다.
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.alerts.map((alert) => (
              <div
                key={`${alert.title}-${alert.description}`}
                className="rounded-2xl border border-amber-200 bg-white/80 p-4"
              >
                <div className="text-sm font-semibold text-slate-900">{alert.title}</div>
                <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.state !== 'ready' || !data.sections ? (
        <StateCard
          title={
            data.state === 'permission-denied'
              ? '접근 권한이 없습니다.'
              : data.state === 'error'
                ? '통계 페이지를 불러오는 중 오류가 발생했습니다.'
                : '표시할 통계가 없습니다.'
          }
          description={
            data.message ??
            (data.state === 'error'
              ? '잠시 후 다시 시도해 주세요.'
              : '선택한 조건에 맞는 통계 데이터를 찾지 못했습니다.')
          }
        />
      ) : (
        <>
          <section id="overview-section" className="space-y-4">
            <SectionHeader
              icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
              title="경영 한눈 보기"
              description="대표가 가장 먼저 확인해야 할 핵심 신호만 요약했습니다."
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.summaryCards.map((card) => (
                <MetricCard key={card.label} card={card} />
              ))}
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <EvaluationOperationsPanel section={data.sections.evaluationOperations} />
            <PerformanceDistributionPanel section={data.sections.performanceDistribution} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <KpiExecutionPanel section={data.sections.kpiExecution} />
            <OrganizationRiskPanel section={data.sections.organizationRisk} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ReadinessPanel section={data.sections.readinessProxy} />
            <FairnessPanel section={data.sections.fairness} />
          </div>
        </>
      )}
    </div>
  )
}

function EvaluationOperationsPanel(props: { section: StatisticsSections['evaluationOperations'] }) {
  const { section } = props

  return (
    <Panel
      id="evaluation-section"
      title="성과평가 운영 현황"
      description="실제 단계 체인을 기준으로 진행률과 병목을 보여줍니다."
    >
      <SectionGuard
        state={section.state}
        message={section.message}
        emptyMessage="선택한 조건의 성과평가 진행 데이터가 아직 없습니다."
        icon={<Users className="h-6 w-6" />}
      >
        {section.stageStatus.length ? (
          <StatisticsStageStatusChart data={section.stageStatus} />
        ) : (
          <EmptyState icon={<Users className="h-6 w-6" />} message="표시할 평가 단계 데이터가 없습니다." />
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {section.exceptionCards.map((card) => (
            <MetricCard key={card.label} card={card} compact />
          ))}
        </div>
        <SectionTable
          headers={['조직', '대상 평가', '평가 진행률', '반려 평가', '지연 평가', '최종 확정 평가']}
          rows={section.departmentRows.map((row) => [
            <SmartLink key={`${row.departmentId}-name`} href={row.filterHref} className="font-semibold text-slate-900 hover:text-blue-600">
              {row.departmentName}
            </SmartLink>,
            String(row.targetCount),
            formatPercentValue(row.progressRate),
            String(row.returnedCount),
            String(row.overdueCount),
            String(row.finalizedCount),
          ])}
        />
      </SectionGuard>
    </Panel>
  )
}

function PerformanceDistributionPanel(props: { section: StatisticsSections['performanceDistribution'] }) {
  const { section } = props

  return (
    <Panel
      id="distribution-section"
      title="성과 수준 및 분포"
      description="최종 반영 기준 분포와 조직별 편차를 함께 확인합니다."
    >
      <SectionGuard
        state={section.state}
        message={section.message}
        emptyMessage="선택한 조건의 성과 수준과 분포 데이터가 아직 없습니다."
        icon={<LineChart className="h-6 w-6" />}
      >
        {section.companyDistribution.length ? (
          <StatisticsDistributionChart
            data={section.companyDistribution.map((item) => ({
              label: item.grade,
              ratio: item.ratio,
              count: item.count,
            }))}
            leftLabel="비율"
          />
        ) : (
          <EmptyState icon={<LineChart className="h-6 w-6" />} message="표시할 성과 분포가 없습니다." />
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {section.cards.map((card) => (
            <MetricCard key={card.label} card={card} compact />
          ))}
        </div>
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900">보정 전후 분포 비교</h3>
          <div className="mt-3">
            {section.beforeAfterDistribution.length ? (
              <StatisticsComparisonChart
                data={section.beforeAfterDistribution.map((item) => ({
                  label: item.grade,
                  first: item.before,
                  second: item.after,
                }))}
                firstLabel="보정 전"
                secondLabel="보정 후"
              />
            ) : (
              <EmptyState icon={<LineChart className="h-6 w-6" />} message="비교할 보정 분포가 없습니다." />
            )}
          </div>
        </div>
        {section.notice ? (
          <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{section.notice}</p>
        ) : null}
        <SectionTable
          headers={['조직', '평균 점수', '상위 등급 비율', '하위 등급 비율', '조정 적용 비율', '주의']}
          rows={section.departmentRows.map((row) => [
            <SmartLink key={`${row.departmentId}-name`} href={row.href} className="font-semibold text-slate-900 hover:text-blue-600">
              {row.departmentName}
            </SmartLink>,
            row.averageScore ? `${row.averageScore}점` : '-',
            formatPercentValue(row.highGradeRatio),
            formatPercentValue(row.lowGradeRatio),
            formatPercentValue(row.adjustedRate),
            <StatusPill key={`${row.departmentId}-outlier`} tone={row.isOutlier ? 'warn' : 'neutral'}>
              {row.isOutlier ? '분포 이상' : '정상 범위'}
            </StatusPill>,
          ])}
        />
      </SectionGuard>
    </Panel>
  )
}

function KpiExecutionPanel(props: { section: StatisticsSections['kpiExecution'] }) {
  const { section } = props

  return (
    <Panel
      id="kpi-section"
      title="KPI 실행력"
      description="목표 정렬과 월간 실행 discipline이 실제 성과로 이어지는지 봅니다."
    >
      <SectionGuard
        state={section.state}
        message={section.message}
        emptyMessage="선택한 기간의 KPI 실행 데이터가 아직 없습니다."
        icon={<LineChart className="h-6 w-6" />}
      >
        {section.trend.length ? (
          <StatisticsTrendChart data={section.trend} />
        ) : (
          <EmptyState icon={<LineChart className="h-6 w-6" />} message="추세를 그릴 월간 KPI 데이터가 없습니다." />
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {section.cards.map((card) => (
            <MetricCard key={card.label} card={card} compact />
          ))}
        </div>
        <SectionTable
          headers={['조직', '대상 인원', '개인 목표 수립 비율', '조직 KPI 연결 비율', '체크인 완료 비율', '평균 달성률', '리스크 KPI 수']}
          rows={section.departmentRows.map((row) => [
            <SmartLink key={`${row.departmentId}-name`} href={row.href} className="font-semibold text-slate-900 hover:text-blue-600">
              {row.departmentName}
            </SmartLink>,
            String(row.activeEmployeeCount),
            formatPercentValue(row.personalGoalSetupRate),
            formatPercentValue(row.alignmentRate),
            formatPercentValue(row.completedCheckInRate),
            formatPercentValue(row.averageProgressRate),
            String(row.riskCount),
          ])}
        />
      </SectionGuard>
    </Panel>
  )
}

function OrganizationRiskPanel(props: { section: StatisticsSections['organizationRisk'] }) {
  const { section } = props

  return (
    <Panel
      id="risk-section"
      title="조직 건강 / 리스크"
      description="실적 저하, 증빙 부족, 반려, 이의제기처럼 바로 개입해야 할 예외 신호를 묶었습니다."
    >
      <SectionGuard
        state={section.state}
        message={section.message}
        emptyMessage="선택한 조건의 조직 리스크 데이터가 아직 없습니다."
        icon={<ShieldAlert className="h-6 w-6" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {section.cards.map((card) => (
            <MetricCard key={card.label} card={card} compact />
          ))}
        </div>
        <div className="mt-5">
          {section.departmentRows.length ? (
            <StatisticsHorizontalBarChart
              data={section.departmentRows.slice(0, 6).map((row) => ({
                label: row.departmentName,
                value: row.riskScore,
              }))}
              valueLabel="리스크 점수"
            />
          ) : (
            <EmptyState icon={<ShieldAlert className="h-6 w-6" />} message="리스크 조직 데이터가 없습니다." />
          )}
        </div>
        <SectionTable
          headers={['조직', '80% 미만 실적 KPI', '증빙 부족 KPI', '반려 평가', '활성 이의 신청', '리스크 점수']}
          rows={section.departmentRows.map((row) => [
            <SmartLink key={`${row.departmentId}-name`} href={row.href} className="font-semibold text-slate-900 hover:text-blue-600">
              {row.departmentName}
            </SmartLink>,
            String(row.lowAchievementCount),
            String(row.missingEvidenceCount),
            String(row.rejectedEvaluationCount),
            String(row.activeAppealCount),
            String(row.riskScore),
          ])}
        />
      </SectionGuard>
    </Panel>
  )
}

function ReadinessPanel(props: { section: StatisticsSections['readinessProxy'] }) {
  const { section } = props

  return (
    <Panel
      id="readiness-section"
      title="핵심인재 / 준비도(프록시)"
      description="현재 성과와 AI 역량 결과를 결합한 준비도 프록시입니다."
    >
      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{section.notice}</p>
      <SectionGuard
        state={section.state}
        message={section.message}
        emptyMessage="준비도 데이터를 표시할 수 없습니다."
        icon={<BriefcaseBusiness className="h-6 w-6" />}
        className="mt-4"
      >
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {section.cards.map((card) => (
            <MetricCard key={card.label} card={card} compact />
          ))}
        </div>
        <div className="mt-5">
          {section.trackDistribution.length ? (
            <StatisticsHorizontalBarChart
              data={section.trackDistribution.map((item) => ({
                label: item.label,
                value: item.averageScore,
              }))}
              valueLabel="평균 점수"
            />
          ) : null}
        </div>
        <SectionTable
          headers={['조직', '평균 점수', '대상 인원']}
          rows={section.departmentRows.map((row) => [row.departmentName, `${row.averageScore}점`, String(row.count)])}
        />
        {section.feederPool.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {section.feederPool.map((row) => (
              <StatusPill key={row.positionLabel} tone="neutral">
                {row.positionLabel} {row.count}명
              </StatusPill>
            ))}
          </div>
        ) : null}
      </SectionGuard>
    </Panel>
  )
}

function FairnessPanel(props: { section: StatisticsSections['fairness'] }) {
  const { section } = props

  return (
    <Panel
      id="fairness-section"
      title="공정성 / 보정 필요 신호"
      description="보정, 정합성, 평가 품질 경고를 함께 보고 리뷰 리스크를 확인합니다."
    >
      <SectionGuard
        state={section.state}
        message={section.message}
        emptyMessage="선택한 조건의 공정성 통계 데이터가 아직 없습니다."
        icon={<Building2 className="h-6 w-6" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {section.cards.map((card) => (
            <MetricCard key={card.label} card={card} compact />
          ))}
        </div>
        <div className="mt-5">
          {section.alignmentDistribution.some((item) => item.count > 0) ? (
            <StatisticsDistributionChart
              data={section.alignmentDistribution.map((item) => ({
                label: item.label,
                ratio: item.count,
              }))}
              leftLabel="건수"
            />
          ) : (
            <EmptyState icon={<Building2 className="h-6 w-6" />} message={section.coverageLabel} />
          )}
        </div>
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {section.coverageLabel}
        </p>
        <SectionTable
          headers={['경고 유형', '발생 건수']}
          rows={section.qualityWarnings.map((item) => [item.label, String(item.count)])}
        />
        <div className="mt-4">
          <SmartLink
            href={section.detailHref}
            className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            보정 화면으로 이동
            <ArrowRight className="ml-1 h-4 w-4" />
          </SmartLink>
        </div>
      </SectionGuard>
    </Panel>
  )
}

function FilterField(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-700">{props.label}</span>
      {props.children}
    </label>
  )
}

function SectionHeader(props: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-slate-900">
        {props.icon}
        <h2 className="text-lg font-semibold">{props.title}</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">{props.description}</p>
    </div>
  )
}

function Panel(props: { id?: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={props.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{props.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{props.description}</p>
      <div className="mt-4 space-y-4">{props.children}</div>
    </section>
  )
}

function SectionGuard(props: {
  state?: 'ready' | 'empty' | 'error'
  message?: string
  emptyMessage: string
  icon: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const state = props.state ?? 'ready'

  if (state === 'error') {
    return (
      <SectionStateCard
        className={props.className}
        icon={props.icon}
        title="이 섹션의 통계를 불러오지 못했습니다."
        message={props.message ?? '잠시 후 다시 시도해 주세요.'}
      />
    )
  }

  if (state === 'empty') {
    return (
      <SectionStateCard
        className={props.className}
        icon={props.icon}
        title="표시할 데이터가 없습니다."
        message={props.message ?? props.emptyMessage}
      />
    )
  }

  return <div className={props.className}>{props.children}</div>
}

function MetricCard(props: { card: StatisticsPageData['summaryCards'][number]; compact?: boolean }) {
  const content = (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md ${
        props.compact ? 'h-full' : ''
      }`}
    >
      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{props.card.label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{props.card.value}</div>
      <div className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass(props.card.tone)}`}>
        {props.card.description}
      </div>
    </div>
  )

  if (props.card.href) {
    return <SmartLink href={props.card.href}>{content}</SmartLink>
  }

  return content
}

function SectionTable(props: {
  headers: string[]
  rows: React.ReactNode[][]
}) {
  if (!props.rows.length) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {props.headers.map((header) => (
                <th key={header} className="px-4 py-3 text-left font-semibold text-slate-700">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {props.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="align-top">
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-600">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StateCard(props: { title: string; description: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">{props.title}</h2>
      <p className="mt-2 text-sm text-slate-500">{props.description}</p>
    </section>
  )
}

function SectionStateCard(props: {
  icon: React.ReactNode
  title: string
  message: string
  className?: string
}) {
  return (
    <div
      className={`flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center ${props.className ?? ''}`}
    >
      <div className="text-slate-500">{props.icon}</div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{props.title}</h3>
      <p className="mt-2 text-sm text-slate-500">{props.message}</p>
    </div>
  )
}

function EmptyState(props: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
      {props.icon}
      <p className="mt-3">{props.message}</p>
    </div>
  )
}

function StatusPill(props: { children: React.ReactNode; tone: 'warn' | 'neutral' | 'success' }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass(props.tone)}`}>
      {props.children}
    </span>
  )
}

function SmartLink(props: { href: string; children: React.ReactNode; className?: string }) {
  if (props.href.startsWith('#')) {
    return (
      <a href={props.href} className={props.className}>
        {props.children}
      </a>
    )
  }

  return (
    <Link href={props.href} className={props.className}>
      {props.children}
    </Link>
  )
}

function toneClass(tone: 'success' | 'warn' | 'error' | 'neutral') {
  if (tone === 'success') return 'bg-emerald-100 text-emerald-700'
  if (tone === 'warn') return 'bg-amber-100 text-amber-700'
  if (tone === 'error') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatPercentValue(value: number) {
  return `${Math.round(value * 10) / 10}%`
}

const selectClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
