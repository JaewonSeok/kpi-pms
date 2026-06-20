'use client'

import type { ChangeEvent } from 'react'

export type Feedback360RelationshipUploadPreviewRow = {
  key: string
  title: string
  divisionLabel: string
  teamLabel: string
  collaboratorLabel: string
  relationTypeLabel: string
  manualScoreLabel: string
  validationLabel: string
  errors: string[]
}

type Feedback360RelationshipTemplatePanelProps = {
  fileName: string
  validCount: number
  totalCount: number
  errors: string[]
  previewRows: Feedback360RelationshipUploadPreviewRow[]
  onDownloadTemplate: () => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
}

function buildRelationshipPreviewKey(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => String(part ?? 'none').trim() || 'none')
    .join(':')
}

export function Feedback360RelationshipTemplatePanel(props: Feedback360RelationshipTemplatePanelProps) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-blue-950">AI/관계 점수 추천</div>
            <p className="mt-1 text-sm leading-6 text-blue-900">
              조직 정보와 업로드 관계 데이터를 함께 사용해 관계 점수가 높은 평가자 후보를 우선 보여줍니다.
              신규 AI 호출 없이 기존 후보 데이터와 미리보기 데이터만 사용합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onDownloadTemplate}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
          >
            관계 데이터 양식 다운로드
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">관계 데이터 업로드 미리보기</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={props.onUpload}
              className="mt-3 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            사번, 협업자사번 또는 상위관리자사번, 관계유형, 수동관계점수를 검증합니다.
            업로드 데이터는 현재 추천 미리보기에만 사용됩니다.
          </p>
          {props.fileName ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              업로드 파일: {props.fileName} · 유효 행 {props.validCount}건 / 전체 {props.totalCount}건
            </div>
          ) : null}
          {props.errors.length ? (
            <div className="mt-3 space-y-2">
              {props.errors.slice(0, 5).map((message, index) => (
                <div
                  key={buildRelationshipPreviewKey(['relationship-upload-error', message, index])}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
                >
                  {message}
                </div>
              ))}
              {props.errors.length > 5 ? (
                <div className="text-xs font-semibold text-amber-700">
                  외 {props.errors.length - 5}개 오류가 더 있습니다.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">업로드 미리보기</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          저장 없이 화면에서만 관계 점수와 추천 근거를 확인합니다.
        </p>
        <div className="mt-3 space-y-2">
          {props.previewRows.length ? (
            props.previewRows.slice(0, 5).map((row) => (
              <div
                key={row.key}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  row.errors.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold text-slate-900">
                  {row.title} · {row.divisionLabel} · {row.teamLabel}
                </div>
                <div className="mt-1 leading-5">
                  협업자 {row.collaboratorLabel} · 관계유형 {row.relationTypeLabel} · 수동관계점수 {row.manualScoreLabel} · 검증 상태 {row.validationLabel}
                </div>
                {row.errors.length ? <div className="mt-1">{row.errors.join(', ')}</div> : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              업로드된 관계 데이터가 없습니다. 양식을 내려받아 CSV를 선택하면 미리보기가 표시됩니다.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
