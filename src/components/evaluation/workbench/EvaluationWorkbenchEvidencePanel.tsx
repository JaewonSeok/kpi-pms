import { AlertTriangle } from 'lucide-react'
import {
  getEvaluationAssistEvidenceLevelLabel,
  type EvaluationAssistEvidenceView,
} from '@/lib/evaluation-ai-assist'
import type {
  EvaluationGuideExample,
  EvaluationGuideSection,
  EvaluationQualityWarning,
} from '@/lib/evaluation-writing-guide'
import type { EvaluationWorkbenchPageData } from '@/server/evaluation-workbench'
import {
  Badge,
  EmptyBlock,
  Panel,
} from '@/components/evaluation/workbench/EvaluationWorkbenchShell'
import type {
  EditableWorkbenchItem,
  EvidenceSectionKey,
} from '@/components/evaluation/workbench/EvaluationWorkbenchTypes'
export function GoalContextBlock(props: {
  item: EditableWorkbenchItem
  expanded: boolean
  onToggle: () => void
}) {
  const { goalContext } = props.item
  const progressTone =
    typeof goalContext.progressRate === 'number'
      ? goalContext.progressRate < 70
        ? 'error'
        : goalContext.progressRate < 90
          ? 'warn'
          : 'success'
      : 'neutral'
  const approvalTone =
    goalContext.approvalStatusKey === 'CONFIRMED'
      ? 'success'
      : goalContext.approvalStatusKey === 'ARCHIVED'
        ? 'warn'
        : goalContext.approvalStatusKey === 'DRAFT'
          ? 'neutral'
          : 'error'

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">연결 목표 맥락</div>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {goalContext.linkedGoalLabel ?? props.item.linkedOrgKpiTitle ?? '연결 목표 맥락'}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {goalContext.achievementSummary ?? '주요 성과 기술이 아직 등록되지 않았습니다.'}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onToggle}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          {props.expanded ? '접기' : '상세 보기'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={progressTone}>{goalContext.progressLabel}</Badge>
        <Badge tone={approvalTone}>{goalContext.approvalStatusLabel}</Badge>
        <Badge tone="neutral">{goalContext.weightLabel}</Badge>
      </div>

      {props.expanded ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <GoalContextField label="기간" value={goalContext.periodLabel} />
          <GoalContextField
            label="협업한 동료"
            value={
              goalContext.collaborators.length
                ? goalContext.collaborators.join(', ')
                : '협업 정보 없음'
            }
          />
          <GoalContextField
            label="진행률"
            value={
              typeof goalContext.progressRate === 'number'
                ? `${goalContext.progressRate}%`
                : '진행률 미집계'
            }
          />
          <GoalContextField label="승인 상태" value={goalContext.approvalStatusLabel.replace('승인 상태: ', '')} />
          <GoalContextField label="성과 가중치" value={goalContext.weightLabel.replace('성과 가중치 ', '')} />
          <GoalContextField
            label="연결 목표"
            value={goalContext.linkedGoalLabel ?? props.item.linkedOrgKpiTitle ?? '연결 없음'}
          />
          <div className="md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">주요 성과 기술</div>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {goalContext.achievementSummary ?? '등록된 성과 기술이 없습니다.'}
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">관련 링크</div>
            {goalContext.links.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {goalContext.links.map((link) => (
                  <div key={link.id} className="inline-flex flex-col rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold transition hover:text-slate-900"
                    >
                      {link.label}
                      {link.uploadedBy ? <span className="ml-1 text-slate-400">· {link.uploadedBy}</span> : null}
                    </a>
                    {link.comment ? <span className="mt-1 text-[11px] text-slate-500">{link.comment}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">연결된 링크가 없습니다.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function GoalContextField(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.label}</div>
      <p className="mt-2 text-sm text-slate-700">{props.value}</p>
    </div>
  )
}


export function EvidencePanel(props: {
  selected: NonNullable<EvaluationWorkbenchPageData['selected']>
  evidence: EvaluationAssistEvidenceView
  selectedSection: EvidenceSectionKey
  onSelectSection: (section: EvidenceSectionKey) => void
}) {
  const sections: Array<{ key: EvidenceSectionKey; label: string }> = [
    { key: 'highlights', label: '핵심 근거' },
    { key: 'kpi', label: 'KPI / 월간 실적' },
    { key: 'notes', label: '피드백 / 메모' },
    { key: 'warnings', label: '품질 경고' },
  ]

  return (
    <Panel
      title="근거 패널"
      description="KPI, 월간 실적, 피드백, 체크인 메모 중 현재 확인 가능한 자료를 기반으로 초안을 검토합니다."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => props.onSelectSection(section.key)}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
              props.selectedSection === section.key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={props.evidence.sufficiency === 'strong' ? 'success' : props.evidence.sufficiency === 'partial' ? 'warn' : 'error'}>
            {getEvaluationAssistEvidenceLevelLabel(props.evidence.sufficiency)}
          </Badge>
          <span className="text-sm text-slate-600">
            {props.selected.target.name}님의 현재 평가 근거와 코멘트 초안 품질을 함께 검토합니다.
          </span>
        </div>
        {props.evidence.alerts.length ? (
          <div className="mt-3 space-y-2">
            {props.evidence.alerts.map((alert) => (
              <div key={alert} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {alert}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {props.selectedSection === 'highlights' ? (
        <PreviewList
          title="AI 작성에 사용한 핵심 포인트"
          items={props.evidence.keyPoints.length ? props.evidence.keyPoints : ['확인 가능한 핵심 포인트가 아직 없습니다.']}
        />
      ) : null}

      {props.selectedSection === 'kpi' ? (
        <div className="space-y-3">
          {props.evidence.kpiSummaries.length ? (
            props.evidence.kpiSummaries.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                {item}
              </div>
            ))
          ) : (
            <EmptyBlock message="연결된 KPI 근거가 부족합니다." />
          )}
          {props.evidence.monthlySummaries.length ? (
            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">월간 실적 상세 펼치기</summary>
              <div className="mt-3 space-y-3">
                {props.evidence.monthlySummaries.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {props.selectedSection === 'notes' ? (
        <div className="space-y-3">
          {props.evidence.noteSummaries.length ? (
            props.evidence.noteSummaries.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                {item}
              </div>
            ))
          ) : (
            <EmptyBlock message="최근 피드백과 메모가 부족합니다." />
          )}
        </div>
      ) : null}

      {props.selectedSection === 'warnings' ? (
        <PreviewList
          title="품질 경고"
          items={
            props.evidence.warnings.length
              ? props.evidence.warnings
              : ['현재 확인된 근거 범위에서는 별도 품질 경고가 없습니다.']
          }
        />
      ) : null}
    </Panel>
  )
}

export function PreviewList(props: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.title}</div>
      <ul className="mt-2 space-y-2">
        {props.items.map((item) => (
          <li key={`${props.title}-${item}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function QualityWarningPanel(props: {
  title: string
  description: string
  warnings: EvaluationQualityWarning[]
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-900">{props.title}</h4>
        <p className="mt-1 text-sm text-slate-500">{props.description}</p>
      </div>
      {props.warnings.length ? (
        <div className="space-y-3">
          {props.warnings.map((warning) => (
            <div key={warning.key} className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span>{warning.title}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{warning.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800">
          현재 입력과 근거 기준으로는 추가 품질 경고가 없습니다.
        </div>
      )}
    </div>
  )
}

export function GuideSectionCard(props: { section: EvaluationGuideSection }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-900">{props.section.title}</h4>
      <p className="mt-1 text-sm text-slate-500">{props.section.description}</p>
      <ul className="mt-3 space-y-2">
        {props.section.items.map((item) => (
          <li key={`${props.section.id}-${item}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function GuideExampleCard(props: { example: EvaluationGuideExample }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{props.example.title}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">주의 문장</div>
          <p className="mt-2 text-sm text-slate-700">{props.example.bad}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">권장 문장</div>
          <p className="mt-2 text-sm text-slate-700">{props.example.good}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{props.example.takeaway}</p>
    </div>
  )
}


