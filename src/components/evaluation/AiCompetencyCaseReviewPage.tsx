'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AiCompetencyGateDecision } from '@prisma/client'
import type { AiCompetencyGateCaseReviewPageData } from '@/server/ai-competency-gate-admin'
import {
  EmptyBox,
  Field,
  formatDateTime,
  inputClassName,
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
      tone: 'success' | 'error' | 'warning'
      title: string
      description?: string
    }
  | null

type ReviewDraftState = NonNullable<AiCompetencyGateCaseReviewPageData['reviewDraft']>

async function readActionResponse(response: Response) {
  const body = (await response.json()) as { success: boolean; error?: { message?: string } }
  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? '요청 처리 중 문제가 발생했습니다.')
  }
}

export function AiCompetencyCaseReviewPage(props: { pageData: AiCompetencyGateCaseReviewPageData }) {
  const { pageData } = props
  const router = useRouter()
  const [notice, setNotice] = useState<NoticeState>(null)
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState<ReviewDraftState | undefined>(pageData.reviewDraft)

  useEffect(() => {
    setDraft(pageData.reviewDraft)
  }, [pageData.reviewDraft])

  const runMutation = (work: () => Promise<void>) => {
    startTransition(() => {
      void work().catch((error) => {
        setNotice({ tone: 'error', title: error instanceof Error ? error.message : '처리 중 문제가 발생했습니다.' })
      })
    })
  }

  const callJsonAction = async (action: string, payload: unknown) => {
    const response = await fetch('/api/evaluation/ai-competency/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })
    await readActionResponse(response)
  }

  if (pageData.state === 'permission-denied') {
    return <StateScreen title="접근 권한이 없습니다." description={pageData.message ?? '배정된 검토자 또는 관리자만 접근할 수 있습니다.'} />
  }

  if (pageData.state === 'error' || !pageData.assignment || !pageData.caseId || !pageData.caseForm || !draft) {
    return <StateScreen title="제출서 상세를 불러오지 못했습니다." description={pageData.message ?? '잠시 후 다시 시도해 주세요.'} />
  }

  return (
    <PageShell
      title="AI 역량평가 제출서 검토"
      description="제출 내용을 확인하고 항목별 판단을 기록한 뒤 보완 요청, 통과, Fail을 결정합니다."
      actions={<button type="button" className={secondaryButtonClassName} onClick={() => router.push('/evaluation/ai-competency/admin')}>대시보드로 돌아가기</button>}
    >
      {notice ? <NoticeBanner tone={notice.tone} title={notice.title} description={notice.description} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <SectionCard title="제출서 요약" description="직원이 제출한 내용을 검토합니다.">
            <div className="grid gap-4 md:grid-cols-2">
              <Info label="대상자" value={pageData.assignment.employeeName} />
              <Info label="소속" value={pageData.assignment.departmentName} />
              <Info label="상태" value={pageData.assignment.statusLabel} />
              <Info label="검토자" value={pageData.assignment.reviewerName ?? '미지정'} />
              <Info label="회차" value={pageData.assignment.cycleName} />
              <Info label="제출일" value={pageData.assignment.submittedAt ? formatDateTime(pageData.assignment.submittedAt) : '미제출'} />
            </div>
          </SectionCard>

          <SectionCard title="제출 내용">
            <div className="space-y-3">
              {Object.entries({
                과제명: pageData.caseForm.title,
                문제정의: pageData.caseForm.problemStatement,
                목표: pageData.caseForm.goalStatement,
                본인역할: pageData.caseForm.ownerRoleDescription,
                Before: pageData.caseForm.beforeWorkflow,
                After: pageData.caseForm.afterWorkflow,
                효과요약: pageData.caseForm.impactSummary,
                사람의최종검토: pageData.caseForm.humanReviewControl,
                보안윤리개인정보대응: pageData.caseForm.securityEthicsPrivacyHandling,
                팀조직적용: pageData.caseForm.teamOrganizationAdoption,
              }).map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{value || '미입력'}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="증빙 자료">
            <div className="space-y-3">
              {pageData.evidenceItems.length ? (
                pageData.evidenceItems.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill value={item.evidenceType} />
                      <span className="text-sm text-slate-500">{formatDateTime(item.createdAt)}</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-950">{item.title}</h3>
                    {item.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p> : null}
                    {item.linkUrl ? <a className="mt-2 inline-flex text-sm font-medium text-slate-900 underline" href={item.linkUrl} target="_blank" rel="noreferrer">링크 열기</a> : null}
                    {item.hasFile ? <a className={`mt-3 ${secondaryButtonClassName}`} href={`/api/evaluation/ai-competency/evidence/${item.id}`}>첨부 파일 보기</a> : null}
                  </article>
                ))
              ) : (
                <EmptyBox title="등록된 증빙이 없습니다." description="제출서에는 최소 1건 이상의 증빙이 필요합니다." />
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="검토 입력" description="항목별 판단을 입력한 뒤 최종 결정을 확정합니다.">
          <div className="space-y-4">
            {pageData.reviewCriteria.map((criterion, index) => (
              <article key={criterion.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={`${index + 1}`} />
                  {criterion.knockout ? <StatusPill value="Knockout" tone="danger" /> : null}
                  {criterion.mandatory ? <StatusPill value="필수" tone="warning" /> : null}
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-950">{criterion.name}</h3>
                {criterion.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{criterion.description}</p> : null}
                <div className="mt-4 grid gap-3">
                  <Field label="판단">
                    <select className={inputClassName} value={draft.items[index]?.decision ?? 'PASS'} onChange={(event) => setDraft((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, decision: event.target.value as AiCompetencyGateDecision } : item) } : current)}>
                      <option value="PASS">Pass</option>
                      <option value="REVISION_REQUIRED">보완 요청</option>
                      <option value="FAIL">Fail</option>
                    </select>
                  </Field>
                  <Field label="검토 의견">
                    <textarea className={textareaClassName} value={draft.items[index]?.comment ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, comment: event.target.value } : item) } : current)} />
                  </Field>
                  <Field label="보완 요청 사항">
                    <textarea className={textareaClassName} value={draft.items[index]?.requiredFix ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, requiredFix: event.target.value } : item) } : current)} />
                  </Field>
                </div>
              </article>
            ))}

            <Field label="종합 의견">
              <textarea className={textareaClassName} value={draft.overallComment} onChange={(event) => setDraft((current) => current ? { ...current, overallComment: event.target.value } : current)} />
            </Field>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <input type="checkbox" checked={draft.nonRemediable} onChange={(event) => setDraft((current) => current ? { ...current, nonRemediable: event.target.checked } : current)} />
              <span>보완으로 해결하기 어려운 중대한 사유가 있어 Fail 검토가 필요합니다.</span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button type="button" className={secondaryButtonClassName} disabled={isPending} onClick={() => runMutation(async () => { await callJsonAction('saveReviewDraft', { caseId: pageData.caseId, ...draft }); setNotice({ tone: 'success', title: '검토 초안을 저장했습니다.' }); router.refresh() })}>검토 초안 저장</button>
              <button type="button" className={secondaryButtonClassName} disabled={isPending} onClick={() => runMutation(async () => { await callJsonAction('finalizeDecision', { caseId: pageData.caseId, action: 'REVISION_REQUIRED', overallComment: draft.overallComment, nonRemediable: draft.nonRemediable, items: draft.items }); setNotice({ tone: 'warning', title: '보완 요청을 등록했습니다.' }); router.refresh() })}>보완 요청</button>
              <button type="button" className={primaryButtonClassName} disabled={isPending} onClick={() => runMutation(async () => { await callJsonAction('finalizeDecision', { caseId: pageData.caseId, action: 'PASS', overallComment: draft.overallComment, nonRemediable: draft.nonRemediable, items: draft.items }); setNotice({ tone: 'success', title: 'AI 역량평가를 통과 처리했습니다.' }); router.refresh() })}>통과</button>
              <button type="button" className={secondaryButtonClassName} disabled={isPending} onClick={() => runMutation(async () => { await callJsonAction('finalizeDecision', { caseId: pageData.caseId, action: 'FAIL', overallComment: draft.overallComment, nonRemediable: draft.nonRemediable, items: draft.items }); setNotice({ tone: 'warning', title: 'AI 역량평가를 Fail 처리했습니다.' }); router.refresh() })}>Fail</button>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  )
}

function Info(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-medium text-slate-500">{props.label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{props.value}</p>
    </div>
  )
}
