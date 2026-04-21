'use client'

import Link from 'next/link'
import {
  getEvaluationPerformanceBriefingAlignmentLabel,
  getEvaluationPerformanceBriefingAlignmentTone,
  getEvaluationPerformanceBriefingEvidenceLevelLabel,
  getEvaluationPerformanceBriefingSourceLabel,
  getEvaluationPerformanceBriefingSourceTypeLabel,
  type EvaluationPerformanceBriefingEvidenceItem,
  type EvaluationPerformanceBriefingSnapshot,
  type EvaluationPerformanceBriefingStatement,
} from '@/lib/evaluation-performance-briefing'

type EvaluationPerformanceBriefingPanelProps = {
  targetName: string
  snapshot: EvaluationPerformanceBriefingSnapshot | null
  busy: boolean
  canGenerate: boolean
  onGenerate: () => void
}

function toneClasses(tone: 'success' | 'warn' | 'error' | 'neutral') {
  switch (tone) {
    case 'success':
      return 'bg-emerald-100 text-emerald-700'
    case 'warn':
      return 'bg-amber-100 text-amber-700'
    case 'error':
      return 'bg-rose-100 text-rose-700'
    case 'neutral':
      return 'bg-slate-100 text-slate-600'
  }
}

function Badge(props: { tone: 'success' | 'warn' | 'error' | 'neutral'; children: React.ReactNode }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClasses(props.tone)}`}>{props.children}</span>
}

function Section(props: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{props.title}</h3>
        {props.description ? <p className="mt-1 text-sm text-slate-500">{props.description}</p> : null}
      </div>
      {props.children}
    </section>
  )
}

function EmptyState(props: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">{props.message}</div>
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function EvidenceLinks(props: {
  evidenceMap: Map<string, EvaluationPerformanceBriefingEvidenceItem>
  evidenceIds: string[]
}) {
  const linkedEvidence = props.evidenceIds
    .map((evidenceId) => props.evidenceMap.get(evidenceId))
    .filter((item): item is EvaluationPerformanceBriefingEvidenceItem => Boolean(item))

  if (!linkedEvidence.length) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {linkedEvidence.map((item) => (
        <a
          key={item.id}
          href={`#briefing-evidence-${item.id}`}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          근거 보기 · {item.title}
        </a>
      ))}
    </div>
  )
}

function StatementList(props: {
  title: string
  description?: string
  statements: EvaluationPerformanceBriefingStatement[]
  evidenceMap: Map<string, EvaluationPerformanceBriefingEvidenceItem>
}) {
  return (
    <Section title={props.title} description={props.description}>
      <div className="space-y-4">
        {props.statements.map((statement, index) => (
          <article key={`${props.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm leading-6 text-slate-800">{statement.text}</p>
            <EvidenceLinks evidenceMap={props.evidenceMap} evidenceIds={statement.evidenceIds} />
          </article>
        ))}
      </div>
    </Section>
  )
}

export function EvaluationPerformanceBriefingPanel(props: EvaluationPerformanceBriefingPanelProps) {
  const snapshot = props.snapshot
  const evidenceMap = new Map(snapshot?.evidence.map((item) => [item.id, item]) ?? [])

  return (
    <div className="space-y-6">
      <Section title="AI 성과 브리핑" description="최근 12개월 성과 근거를 바탕으로 팀장 평가와 실제 근거의 정합성을 빠르게 검토합니다.">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          AI 브리핑은 최종 평가를 대체하지 않으며, 등록된 성과 근거를 요약해 검토를 지원합니다.
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={props.onGenerate}
            disabled={!props.canGenerate || props.busy}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {snapshot ? (props.busy ? '브리핑 다시 생성 중...' : '브리핑 다시 생성') : props.busy ? '브리핑 생성 중...' : '브리핑 생성'}
          </button>
          {snapshot ? (
            <>
              <Badge tone={getEvaluationPerformanceBriefingAlignmentTone(snapshot.alignment.status)}>
                {getEvaluationPerformanceBriefingAlignmentLabel(snapshot.alignment.status)}
              </Badge>
              <Badge tone={snapshot.evidenceCoverage.evidenceLevel === 'STRONG' ? 'success' : snapshot.evidenceCoverage.evidenceLevel === 'PARTIAL' ? 'warn' : 'error'}>
                {getEvaluationPerformanceBriefingEvidenceLevelLabel(snapshot.evidenceCoverage.evidenceLevel)}
              </Badge>
              <Badge tone="neutral">{getEvaluationPerformanceBriefingSourceLabel(snapshot.source)}</Badge>
              {snapshot.stale ? <Badge tone="warn">갱신 필요</Badge> : null}
            </>
          ) : null}
        </div>

        {snapshot ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">브리핑 생성 시각</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(snapshot.generatedAt)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">근거 수</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{snapshot.evidenceCoverage.evidenceCount}건</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">월간 실적</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{snapshot.evidenceCoverage.monthlyRecordCount}건</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">체크인 / 피드백</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {snapshot.evidenceCoverage.checkinCount} / {snapshot.evidenceCoverage.feedbackRoundCount}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState message={`${props.targetName}님의 최근 12개월 근거를 바탕으로 한 브리핑이 아직 없습니다. 생성 버튼을 눌러 근거 기반 요약을 준비하세요.`} />
          </div>
        )}
      </Section>

      {snapshot ? (
        <>
          <Section title="한 줄 요약" description="핵심 판단을 먼저 확인하고, 아래 섹션에서 근거를 따라 내려가세요.">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-base font-semibold leading-7 text-slate-900">{snapshot.headline}</p>
              <EvidenceLinks evidenceMap={evidenceMap} evidenceIds={snapshot.headlineEvidenceIds} />
            </div>
          </Section>

          <StatementList title="핵심 성과" description="성과가 분명하게 드러나는 근거를 요약했습니다." statements={snapshot.strengths} evidenceMap={evidenceMap} />
          <StatementList title="KPI / 목표 달성 요약" description="가중치가 큰 목표와 최근 달성 흐름을 중심으로 정리했습니다." statements={snapshot.kpiSummary} evidenceMap={evidenceMap} />
          <StatementList title="협업 / 조직 기여 요약" description="다면 피드백, 체크인, 조직 목표 연결을 중심으로 정리했습니다." statements={snapshot.contributionSummary} evidenceMap={evidenceMap} />
          <StatementList title="리스크 / 아쉬운 점" description="과대 해석을 피하기 위해 추가 확인이 필요한 지점을 분리했습니다." statements={snapshot.risks} evidenceMap={evidenceMap} />

          <Section title="팀장 평가와 근거의 정합성 검토" description="점수와 의견을 그대로 수용하지 않고 근거 수준과 차이를 함께 봅니다.">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={getEvaluationPerformanceBriefingAlignmentTone(snapshot.alignment.status)}>
                  {getEvaluationPerformanceBriefingAlignmentLabel(snapshot.alignment.status)}
                </Badge>
                <Badge tone="neutral">{getEvaluationPerformanceBriefingEvidenceLevelLabel(snapshot.evidenceCoverage.evidenceLevel)}</Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-800">{snapshot.alignment.reason}</p>
              <EvidenceLinks evidenceMap={evidenceMap} evidenceIds={snapshot.alignment.evidenceIds} />
            </div>
          </Section>

          <Section title="추가 확인 질문" description="최종 판단 전에 꼭 확인해 볼 질문만 추렸습니다.">
            <div className="space-y-3">
              {snapshot.questions.map((question, index) => (
                <div key={`question-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                  {index + 1}. {question}
                </div>
              ))}
            </div>
          </Section>

          <Section title="근거 보기 / 원문 링크" description="각 요약 문장은 아래 원문 근거와 연결됩니다.">
            <div className="space-y-3">
              {snapshot.evidence.map((item) => (
                <article
                  id={`briefing-evidence-${item.id}`}
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{getEvaluationPerformanceBriefingSourceTypeLabel(item.sourceType)}</Badge>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      </div>
                      {item.snippet ? <p className="mt-3 text-sm leading-6 text-slate-700">{item.snippet}</p> : null}
                    </div>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        원문 보기
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </Section>
        </>
      ) : null}
    </div>
  )
}

