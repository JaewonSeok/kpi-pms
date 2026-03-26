'use client'

import type { ReactNode } from 'react'
import type {
  AiCompetencyDifficulty,
  AiCompetencyDomain,
  AiCompetencyQuestionType,
  AiCompetencyTrack,
} from '@prisma/client'

export const TRACK_OPTIONS: Array<{ value: AiCompetencyTrack; label: string }> = [
  { value: 'HR_SUPPORT', label: 'HR/경영지원' },
  { value: 'FINANCE_OPERATIONS', label: '재무/운영' },
  { value: 'SALES_CS', label: '영업/CS' },
  { value: 'MARKETING_PLANNING', label: '마케팅/기획' },
]

export const QUESTION_TYPE_OPTIONS: Array<{ value: AiCompetencyQuestionType; label: string }> = [
  { value: 'SINGLE_CHOICE', label: '단일 선택' },
  { value: 'MULTIPLE_CHOICE', label: '복수 선택' },
  { value: 'SCENARIO_JUDGEMENT', label: '시나리오 판단' },
  { value: 'SHORT_ANSWER', label: '서술형' },
  { value: 'PRACTICAL', label: '실무형' },
]

export const DIFFICULTY_OPTIONS: Array<{ value: AiCompetencyDifficulty; label: string }> = [
  { value: 'BASIC', label: '기초' },
  { value: 'INTERMEDIATE', label: '중급' },
  { value: 'ADVANCED', label: '고급' },
]

export const DOMAIN_OPTIONS: Array<{ value: AiCompetencyDomain; label: string }> = [
  { value: 'AI_FOUNDATION', label: 'AI 기본 이해' },
  { value: 'PROMPT_CONTEXT_DESIGN', label: '프롬프트/맥락 설계' },
  { value: 'VERIFICATION_HALLUCINATION', label: '검증/환각 대응' },
  { value: 'SECURITY_ETHICS', label: '보안/개인정보/저작권/윤리' },
  { value: 'BUSINESS_JUDGEMENT', label: '업무 활용 판단' },
]

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: '초안',
  ACTIVE: '활성',
  ARCHIVED: '아카이브',
  PUBLISHED: '공개',
  CLOSED: '종료',
  NOT_STARTED: '미응시',
  IN_PROGRESS: '진행 중',
  SUBMITTED: '제출 완료',
  SCORED: '채점 완료',
  PASSED: '합격',
  FAILED: '불합격',
  REVISE_REQUESTED: '재검토 필요',
  UNDER_REVIEW: '심사 중',
  APPROVED: '승인',
  REJECTED: '반려',
  EXPIRED: '만료',
  INACTIVE: '비활성',
  INTERNAL_CERTIFIED: '내부 인증',
  EXTERNAL_RECOGNIZED: '외부 자격 인정',
  INTERNAL_AND_EXTERNAL: '내부+외부 인정',
  NOT_CERTIFIED: '미인증',
  SYNCED: 'PMS 반영 완료',
  PENDING: '반영 대기',
  PASS: '합격',
  FAIL: '불합격',
  REVISE: '보완 요청',
}

export const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200'

export const primaryButtonClassName =
  'inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300'

export const secondaryButtonClassName =
  'inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300'

export function labelForTrack(track: AiCompetencyTrack) {
  return TRACK_OPTIONS.find((option) => option.value === track)?.label ?? track
}

export function questionTypeLabel(type: AiCompetencyQuestionType) {
  return QUESTION_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
}

export function difficultyLabel(value: AiCompetencyDifficulty) {
  return DIFFICULTY_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function domainLabel(value: AiCompetencyDomain) {
  return DOMAIN_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function formatDateTime(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR')
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes}B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`
}

export function toLocalDateTimeInput(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export function toIsoFromLocal(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

export function toLineText(values?: string[]) {
  return values?.join('\n') ?? ''
}

export function fromLineText(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function SectionCard(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-950">{props.title}</h2>
        {props.description ? <p className="mt-1 text-sm text-slate-500">{props.description}</p> : null}
      </div>
      {props.children}
    </section>
  )
}

export function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{props.label}</span>
      {props.children}
    </label>
  )
}

export function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-medium text-slate-500">{props.label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{props.value}</p>
    </div>
  )
}

export function StatusPill(props: { value: string; customLabel?: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
      {props.customLabel ?? STATUS_LABELS[props.value] ?? props.value}
    </span>
  )
}

export function EmptyBox(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
      {props.message}
    </div>
  )
}

export function InfoRow(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{props.label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{props.value}</p>
    </div>
  )
}

export function DataTable(props: { title?: string; columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      {props.title ? (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
          {props.title}
        </div>
      ) : null}
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {props.columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left font-medium text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {props.rows.length ? (
              props.rows.map((row, index) => (
                <tr key={`${row.join('-')}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`} className="px-4 py-3 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={props.columns.length} className="px-4 py-8 text-center text-slate-500">
                  표시할 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StateScreen(props: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-950">{props.title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{props.description}</p>
    </div>
  )
}
