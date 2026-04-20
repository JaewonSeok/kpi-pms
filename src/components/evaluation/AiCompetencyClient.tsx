'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { AiCompetencyGateEvidenceType, AiCompetencyGateTrack } from '@prisma/client'
import type { AiCompetencyGateEmployeePageData } from '@/server/ai-competency-gate'
import {
  buildAiCompetencyAdminHref,
  buildAiCompetencyEmployeeReturnTarget,
} from '@/lib/ai-competency-gate-navigation'
import {
  EmptyBox,
  Field,
  formatDateOnly,
  formatDateTime,
  formatFileSize,
  inputClassName,
  MetricCard,
  NoticeBanner,
  PageShell,
  primaryButtonClassName,
  secondaryButtonClassName,
  SectionCard,
  StateScreen,
  StatusPill,
  textareaClassName,
} from './AiCompetencyShared'

type NoticeState =
  | {
      tone: 'success' | 'error' | 'warning' | 'info'
      title: string
      description?: string
    }
  | null

type EvidenceFormState = {
  evidenceType: AiCompetencyGateEvidenceType
  title: string
  description: string
  linkUrl: string
  textNote: string
  file: File | null
}

const COPY = {
  pageTitle: 'AI 역량평가',
  pageDescription:
    '승진 요건으로 운영되는 AI 역량평가입니다. 연간 평가 점수와 별도로 실제 업무 문제 해결과 조직 확산 성과를 Pass / 보완 요청 / Fail 방식으로 검토합니다.',
  adminCta: '관리자/검토자 화면',
  noPermissionTitle: '접근 권한이 없습니다.',
  loadErrorTitle: 'AI 역량평가 화면을 불러오지 못했습니다.',
  saveDraft: '작성 내용 저장',
  preview: '제출 전 미리보기',
  submit: '제출하기',
  resubmit: '보완 후 재제출',
  assignedEmptyTitle: '현재 회차에서 아직 AI 역량평가 대상자로 배정되지 않았습니다.',
  assignedEmptyDescription: '관리자가 대상자와 검토자를 배정하면 제출서를 작성할 수 있습니다.',
  evidenceTitle: '증빙 자료',
  evidenceEmptyTitle: '등록된 증빙 자료가 없습니다.',
  evidenceEmptyDescription: '제출 전까지 실제 근거 자료를 최소 1건 이상 등록해 주세요.',
  historyTitle: '이력 / 결정 내역',
  historyDescription: '제출, 보완 요청, 최종 결과가 시간순으로 기록됩니다.',
  historyEmptyTitle: '아직 기록이 없습니다.',
  historyEmptyDescription: '초안을 저장하거나 제출하면 이력과 결정 내역이 여기에 표시됩니다.',
}

const TRACK_OPTIONS: Array<{ value: AiCompetencyGateTrack; label: string; description: string }> = [
  {
    value: 'AI_PROJECT_EXECUTION',
    label: 'AI 기반 프로젝트 수행',
    description: '실제 업무 문제를 해결하기 위해 AI 기반 개선 프로젝트를 주도한 사례를 제출합니다.',
  },
  {
    value: 'AI_USE_CASE_EXPANSION',
    label: 'AI 활용 사례 확산',
    description: '개인 활용을 넘어 팀이나 조직에 확산된 재사용 가능한 AI 활용 사례를 제출합니다.',
  },
]

const EVIDENCE_TYPE_OPTIONS: Array<{ value: AiCompetencyGateEvidenceType; label: string }> = [
  { value: 'BEFORE', label: 'Before 근거' },
  { value: 'AFTER', label: 'After 근거' },
  { value: 'METRIC_PROOF', label: '효과 측정 근거' },
  { value: 'REUSE_ARTIFACT', label: '재사용 산출물' },
  { value: 'ADOPTION_PROOF', label: '적용/확산 근거' },
  { value: 'SHARING_PROOF', label: '공유 활동 근거' },
  { value: 'SECURITY_PROOF', label: '보안/윤리 대응 근거' },
  { value: 'OTHER', label: '기타' },
]

const COMMON_FIELDS = [
  ['title', '과제명', true],
  ['problemStatement', '해결하려는 업무 문제', true],
  ['importanceReason', '왜 중요한가', false],
  ['goalStatement', '목표', true],
  ['scopeDescription', '적용 범위', false],
  ['ownerRoleDescription', '본인 역할(Owner/PM 역할)', true],
  ['beforeWorkflow', '기존 방식(Before)', true],
  ['afterWorkflow', 'AI 적용 후 방식(After)', true],
  ['impactSummary', '측정 지표 / 효과 요약', true],
  ['teamOrganizationAdoption', '팀/조직 적용 또는 확산 근거', true],
  ['reusableOutputSummary', '재사용 가능한 산출물/가이드/템플릿', false],
  ['humanReviewControl', '사람의 최종 검토/판단 방식', true],
  ['factCheckMethod', '사실 확인 / 검증 방법', false],
  ['securityEthicsPrivacyHandling', '보안/윤리/개인정보 대응', true],
  ['sharingExpansionActivity', '공유/세미나/확산 활동', false],
  ['toolList', '사용한 AI 도구', false],
  ['approvedToolBasis', '승인된 도구 사용 근거', false],
  ['sensitiveDataHandling', '민감/기밀/개인정보 처리 방식', false],
  ['maskingAnonymizationHandling', '마스킹/익명화 처리 방식', false],
] as const

function createEmptyMetric(index: number) {
  return {
    metricName: '',
    beforeValue: '',
    afterValue: '',
    unit: '',
    verificationMethod: '',
    displayOrder: index,
  }
}

function createEmptyEvidenceForm(): EvidenceFormState {
  return { evidenceType: 'BEFORE', title: '', description: '', linkUrl: '', textNote: '', file: null }
}

async function readActionResponse(response: Response) {
  const body = (await response.json()) as { success: boolean; data?: unknown; error?: { message?: string } }
  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? '요청 처리 중 문제가 발생했습니다.')
  }
  return body.data
}

export function AiCompetencyClient(props: AiCompetencyGateEmployeePageData) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [notice, setNotice] = useState<NoticeState>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [form, setForm] = useState(props.caseForm)
  const [evidenceForm, setEvidenceForm] = useState<EvidenceFormState>(createEmptyEvidenceForm)

  useEffect(() => {
    setForm(props.caseForm)
    setEvidenceForm(createEmptyEvidenceForm())
  }, [props.caseForm])

  const isEditable = Boolean(props.statusCard?.canEdit && props.assignmentId)
  const hasAssignment = Boolean(props.assignmentId)
  const metricCountLabel = useMemo(() => `${form.metrics.length}개`, [form.metrics.length])
  const employeeReturnTarget = useMemo(
    () =>
      buildAiCompetencyEmployeeReturnTarget({
        pathname,
        searchParams,
      }),
    [pathname, searchParams]
  )
  const adminHref = useMemo(
    () => buildAiCompetencyAdminHref({ returnTo: employeeReturnTarget }),
    [employeeReturnTarget]
  )

  const callJsonAction = async (action: string, payload: unknown) => {
    const response = await fetch('/api/evaluation/ai-competency/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })
    return readActionResponse(response)
  }

  const runMutation = (work: () => Promise<void>) => {
    startTransition(() => {
      void work().catch((error) => {
        setNotice({ tone: 'error', title: error instanceof Error ? error.message : '처리 중 문제가 발생했습니다.' })
      })
    })
  }

  const updateField = (key: keyof typeof form, value: string | boolean | typeof form.metrics) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  if (props.state === 'permission-denied') {
    return <StateScreen title={COPY.noPermissionTitle} description={props.message ?? 'AI 역량평가 페이지에 접근할 수 없습니다.'} />
  }

  if (props.state === 'error') {
    return <StateScreen title={COPY.loadErrorTitle} description={props.message ?? '잠시 후 다시 시도해 주세요.'} />
  }

  return (
    <PageShell
      title={COPY.pageTitle}
      description={COPY.pageDescription}
      actions={
        <>
          <select
            className={inputClassName}
            value={props.selectedCycleId ?? ''}
            onChange={(event) => router.push(`/evaluation/ai-competency?cycleId=${encodeURIComponent(event.target.value)}`)}
          >
            {props.cycleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.year}년 · {option.name}
              </option>
            ))}
          </select>
          {props.canOpenAdmin ? (
            <button type="button" className={secondaryButtonClassName} onClick={() => router.push(adminHref)}>
              {COPY.adminCta}
            </button>
          ) : null}
        </>
      }
    >
      {notice ? <NoticeBanner tone={notice.tone} title={notice.title} description={notice.description} /> : null}
      {props.statusCard ? (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="현재 상태" value={props.statusCard.statusLabel} />
          <MetricCard label="현재 회차" value={props.selectedCycle?.cycleName ?? '-'} />
          <MetricCard label="검토자" value={props.statusCard.reviewerName ?? '미지정'} />
          <MetricCard
            label="제출 상태"
            value={props.statusCard.submittedAt ? formatDateOnly(props.statusCard.submittedAt) : '미제출'}
            hint={props.selectedCycle?.submissionWindowLabel ? `제출 기간 ${props.selectedCycle.submissionWindowLabel}` : undefined}
          />
        </div>
      ) : null}

      {props.latestReview?.overallDecision === 'REVISION_REQUIRED' ? (
        <NoticeBanner tone="warning" title="보완 요청이 도착했습니다." description={props.reviewerComment ?? '보완 요청 내용을 반영한 뒤 다시 제출해 주세요.'} />
      ) : null}

      <SectionCard title="안내" description="평가 기준과 예시를 확인한 뒤 제출서를 작성해 주세요.">
        <div className="grid gap-4 md:grid-cols-2">
          {props.guideLibrary.guides.map((guide) => (
            <article key={guide.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <StatusPill value={guide.trackApplicability === 'COMMON' ? '공통 안내' : guide.trackApplicability === 'PROJECT_ONLY' ? '프로젝트형 안내' : '확산형 안내'} />
              <h3 className="mt-3 text-base font-semibold text-slate-950">{guide.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{guide.body}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      {!hasAssignment ? (
        <EmptyBox title={COPY.assignedEmptyTitle} description={props.message ?? COPY.assignedEmptyDescription} />
      ) : (
        <SectionCard
          title="제출서 작성"
          description="실제 업무 문제를 해결한 AI 활용 사례를 구조적으로 정리해 주세요. 저장 후 제출 전까지 계속 수정할 수 있습니다."
          action={
            isEditable ? (
              <div className="flex flex-wrap gap-3">
                <button type="button" className={secondaryButtonClassName} onClick={() => setIsPreviewOpen(true)}>
                  {COPY.preview}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={isPending}
                  onClick={() =>
                    runMutation(async () => {
                      await callJsonAction('saveDraft', { assignmentId: props.assignmentId, ...form })
                      setNotice({ tone: 'success', title: '작성 중인 AI 역량평가 초안을 저장했습니다.' })
                      router.refresh()
                    })
                  }
                >
                  {COPY.saveDraft}
                </button>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={isPending}
                  onClick={() =>
                    runMutation(async () => {
                      await callJsonAction('submitCase', { assignmentId: props.assignmentId })
                      setNotice({
                        tone: 'success',
                        title: props.statusCard?.canResubmit ? '보완한 내용을 다시 제출했습니다.' : 'AI 역량평가 제출을 완료했습니다.',
                      })
                      setIsPreviewOpen(false)
                      router.refresh()
                    })
                  }
                >
                  {props.statusCard?.canResubmit ? COPY.resubmit : COPY.submit}
                </button>
              </div>
            ) : null
          }
        >
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {TRACK_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!isEditable}
                  className={`rounded-3xl border p-5 text-left transition ${form.track === option.value ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'} ${!isEditable ? 'cursor-default opacity-80' : ''}`}
                  onClick={() => updateField('track', option.value)}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className={`mt-2 text-sm leading-6 ${form.track === option.value ? 'text-slate-200' : 'text-slate-600'}`}>{option.description}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {COMMON_FIELDS.map(([key, label, required]) => (
                <Field key={key} label={label} required={required}>
                  <textarea
                    className={key === 'title' || key === 'scopeDescription' ? inputClassName : textareaClassName}
                    value={String(form[key as keyof typeof form] ?? '')}
                    disabled={!isEditable}
                    onChange={(event) => updateField(key as keyof typeof form, event.target.value)}
                  />
                </Field>
              ))}
            </div>

            {form.track === 'AI_PROJECT_EXECUTION' ? (
              <TrackSection
                title="프로젝트 수행 상세"
                fields={[
                  ['projectBackground', '프로젝트 배경', true],
                  ['stakeholders', '이해관계자', false],
                  ['executionSteps', '실행 단계', true],
                  ['deliverables', '산출물', true],
                  ['ownerPmRoleDetail', 'PM/Owner 역할 구체 설명', true],
                  ['contributionSummary', '성과 기여 요약', false],
                ]}
                values={form.projectDetail}
                editable={isEditable}
                onChange={(key, value) =>
                  setForm((current) => ({ ...current, projectDetail: { ...current.projectDetail, [key]: value } }))
                }
              />
            ) : null}

            {form.track === 'AI_USE_CASE_EXPANSION' ? (
              <TrackSection
                title="활용 사례 확산 상세"
                fields={[
                  ['useCaseDescription', '실제 활용 사례 설명', true],
                  ['teamDivisionScope', '팀/본부 적용 범위', true],
                  ['repeatedUseExamples', '반복 사용 사례', false],
                  ['measuredEffectDetail', '측정 가능한 효과 상세', true],
                  ['seminarSharingEvidence', '세미나/공유 근거', true],
                  ['organizationExpansionDetail', '조직 확산 내용', false],
                ]}
                values={form.adoptionDetail}
                editable={isEditable}
                onChange={(key, value) =>
                  setForm((current) => ({ ...current, adoptionDetail: { ...current.adoptionDetail, [key]: value } }))
                }
              />
            ) : null}

            <SectionCard
              title="측정 지표 / 효과"
              description="Before / After 비교와 검증 방법이 드러나도록 작성해 주세요."
              action={
                isEditable ? (
                  <button type="button" className={secondaryButtonClassName} onClick={() => updateField('metrics', [...form.metrics, createEmptyMetric(form.metrics.length)])}>
                    지표 추가
                  </button>
                ) : (
                  <MetricCard label="등록 지표" value={metricCountLabel} />
                )
              }
            >
              <div className="space-y-4">
                {form.metrics.length ? (
                  form.metrics.map((metric, index) => (
                    <article key={metric.id ?? `metric-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label={`지표명 ${index + 1}`}><input className={inputClassName} value={metric.metricName} disabled={!isEditable} onChange={(event) => setForm((current) => ({ ...current, metrics: current.metrics.map((item, itemIndex) => itemIndex === index ? { ...item, metricName: event.target.value } : item) }))} /></Field>
                        <Field label="단위"><input className={inputClassName} value={metric.unit} disabled={!isEditable} onChange={(event) => setForm((current) => ({ ...current, metrics: current.metrics.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value } : item) }))} /></Field>
                        <Field label="Before 값"><input className={inputClassName} value={metric.beforeValue} disabled={!isEditable} onChange={(event) => setForm((current) => ({ ...current, metrics: current.metrics.map((item, itemIndex) => itemIndex === index ? { ...item, beforeValue: event.target.value } : item) }))} /></Field>
                        <Field label="After 값"><input className={inputClassName} value={metric.afterValue} disabled={!isEditable} onChange={(event) => setForm((current) => ({ ...current, metrics: current.metrics.map((item, itemIndex) => itemIndex === index ? { ...item, afterValue: event.target.value } : item) }))} /></Field>
                        <Field label="검증 방법"><textarea className={textareaClassName} value={metric.verificationMethod} disabled={!isEditable} onChange={(event) => setForm((current) => ({ ...current, metrics: current.metrics.map((item, itemIndex) => itemIndex === index ? { ...item, verificationMethod: event.target.value } : item) }))} /></Field>
                      </div>
                      {isEditable ? <button type="button" className={`${secondaryButtonClassName} mt-4`} onClick={() => updateField('metrics', form.metrics.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, displayOrder: itemIndex })))}>지표 삭제</button> : null}
                    </article>
                  ))
                ) : (
                  <EmptyBox title="등록된 지표가 없습니다." description="효과를 확인할 수 있는 지표를 최소 1개 이상 입력해 주세요." />
                )}
              </div>
            </SectionCard>

            <SectionCard title={COPY.evidenceTitle} description="파일, 링크, 설명 메모 중 하나 이상으로 실제 근거를 남겨 주세요.">
              <div className="space-y-4">
                {props.evidenceItems.length ? (
                  props.evidenceItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill value={EVIDENCE_TYPE_OPTIONS.find((option) => option.value === item.evidenceType)?.label ?? item.evidenceType} />
                            <span className="text-sm text-slate-500">{formatDateTime(item.createdAt)}</span>
                          </div>
                          <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                          {item.description ? <p className="text-sm leading-6 text-slate-600">{item.description}</p> : null}
                          {item.linkUrl ? <a className="text-sm font-medium text-slate-900 underline" href={item.linkUrl} target="_blank" rel="noreferrer">링크 열기</a> : null}
                          {item.textNote ? <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.textNote}</p> : null}
                          {item.hasFile ? <a className={secondaryButtonClassName} href={`/api/evaluation/ai-competency/evidence/${item.id}`}>{item.fileName} ({formatFileSize(item.sizeBytes)})</a> : null}
                        </div>
                        {isEditable ? <button type="button" className={secondaryButtonClassName} onClick={() => runMutation(async () => { await callJsonAction('deleteEvidence', { assignmentId: props.assignmentId, evidenceId: item.id }); setNotice({ tone: 'success', title: '증빙 자료를 삭제했습니다.' }); router.refresh() })}>삭제</button> : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyBox title={COPY.evidenceEmptyTitle} description={COPY.evidenceEmptyDescription} />
                )}

                {isEditable ? (
                  <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                    <Field label="증빙 유형"><select className={inputClassName} value={evidenceForm.evidenceType} onChange={(event) => setEvidenceForm((current) => ({ ...current, evidenceType: event.target.value as AiCompetencyGateEvidenceType }))}>{EVIDENCE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                    <Field label="증빙 제목" required><input className={inputClassName} value={evidenceForm.title} onChange={(event) => setEvidenceForm((current) => ({ ...current, title: event.target.value }))} /></Field>
                    <Field label="설명"><textarea className={textareaClassName} value={evidenceForm.description} onChange={(event) => setEvidenceForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                    <Field label="관련 링크"><input className={inputClassName} value={evidenceForm.linkUrl} onChange={(event) => setEvidenceForm((current) => ({ ...current, linkUrl: event.target.value }))} /></Field>
                    <Field label="메모"><textarea className={textareaClassName} value={evidenceForm.textNote} onChange={(event) => setEvidenceForm((current) => ({ ...current, textNote: event.target.value }))} /></Field>
                    <Field label="파일 첨부"><input className={inputClassName} type="file" onChange={(event) => setEvidenceForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} /></Field>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        className={primaryButtonClassName}
                        disabled={isPending}
                        onClick={() =>
                          runMutation(async () => {
                            const formData = new FormData()
                            formData.set('action', 'uploadEvidence')
                            formData.set('payload', JSON.stringify({ assignmentId: props.assignmentId, evidenceType: evidenceForm.evidenceType, title: evidenceForm.title, description: evidenceForm.description, linkUrl: evidenceForm.linkUrl, textNote: evidenceForm.textNote }))
                            if (evidenceForm.file) formData.set('file', evidenceForm.file)
                            const response = await fetch('/api/evaluation/ai-competency/actions', { method: 'POST', body: formData })
                            await readActionResponse(response)
                            setNotice({ tone: 'success', title: '증빙 자료를 등록했습니다.' })
                            setEvidenceForm(createEmptyEvidenceForm())
                            router.refresh()
                          })
                        }
                      >
                        증빙 자료 등록
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="최종 자기 점검 / 서약" description="AI가 금지된 최종 자동 의사결정을 대신하지 않았고, 승인된 도구와 검증 절차를 거쳤는지 확인해 주세요.">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"><input type="checkbox" checked={form.prohibitedAutomationAcknowledged} disabled={!isEditable} onChange={(event) => updateField('prohibitedAutomationAcknowledged', event.target.checked)} /><span>채용, HR 징계, 법률 최종 판단, 재무 최종 승인 등 금지된 최종 자동 의사결정에 AI를 사용하지 않았습니다.</span></label>
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"><input type="checkbox" checked={form.finalDeclarationAccepted} disabled={!isEditable} onChange={(event) => updateField('finalDeclarationAccepted', event.target.checked)} /><span>제출 내용은 사실에 기반하며, 필요 시 재현 가능한 근거와 설명을 제공할 수 있음을 확인합니다.</span></label>
              </div>
            </SectionCard>
          </div>
        </SectionCard>
      )}

      <SectionCard title={COPY.historyTitle} description={COPY.historyDescription}>
        <div className="space-y-3">
          {props.timeline.length ? props.timeline.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={item.tone === 'success' ? '통과 관련' : item.tone === 'warning' ? '주의 / 보완' : '기록'} tone={item.tone === 'success' ? 'success' : item.tone === 'warning' ? 'warning' : 'neutral'} />
                <span className="text-sm text-slate-500">{formatDateTime(item.createdAt)}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          )) : <EmptyBox title={COPY.historyEmptyTitle} description={COPY.historyEmptyDescription} />}
        </div>
      </SectionCard>

      {isPreviewOpen ? <PreviewDialog form={form} onClose={() => setIsPreviewOpen(false)} /> : null}
    </PageShell>
  )
}

function TrackSection(props: { title: string; fields: ReadonlyArray<readonly [string, string, boolean]>; values: Record<string, string>; editable: boolean; onChange: (key: string, value: string) => void }) {
  return (
    <SectionCard title={props.title}>
      <div className="grid gap-5 md:grid-cols-2">
        {props.fields.map(([key, label, required]) => (
          <Field key={key} label={label} required={required}>
            <textarea className={textareaClassName} value={props.values[key] ?? ''} disabled={!props.editable} onChange={(event) => props.onChange(key, event.target.value)} />
          </Field>
        ))}
      </div>
    </SectionCard>
  )
}

function PreviewDialog(props: { form: AiCompetencyGateEmployeePageData['caseForm']; onClose: () => void }) {
  const previewRows = [
    ['트랙', TRACK_OPTIONS.find((item) => item.value === props.form.track)?.label ?? '미선택'],
    ['과제명', props.form.title || '미입력'],
    ['업무 문제', props.form.problemStatement || '미입력'],
    ['목표', props.form.goalStatement || '미입력'],
    ['본인 역할', props.form.ownerRoleDescription || '미입력'],
    ['Before', props.form.beforeWorkflow || '미입력'],
    ['After', props.form.afterWorkflow || '미입력'],
    ['효과 요약', props.form.impactSummary || '미입력'],
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-semibold text-slate-950">제출 전 미리보기</h2><p className="mt-1 text-sm text-slate-600">현재 작성한 내용을 한 번 더 확인해 주세요.</p></div>
          <button type="button" className={secondaryButtonClassName} onClick={props.onClose}>닫기</button>
        </div>
        <div className="mt-6 space-y-4">
          {previewRows.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{value}</p></div>)}
        </div>
      </div>
    </div>
  )
}
