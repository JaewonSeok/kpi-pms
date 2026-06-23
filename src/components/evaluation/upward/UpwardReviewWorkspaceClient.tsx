'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Info,
  Mail,
  ShieldCheck,
  ThumbsUp,
  UserRound,
} from 'lucide-react'
import type { UpwardReviewPageData } from '@/server/upward-review'
import { DEFAULT_LEADERSHIP_DIAGNOSIS_QUESTIONS } from '@/lib/upward-review'
import { Feedback360Avatar } from '../feedback360/ppt/Feedback360Avatar'
import { LeadershipDiagnosisAiCoachingPanel } from './LeadershipDiagnosisAiCoachingPanel'
import { LeadershipDiagnosisOpsDashboard } from './LeadershipDiagnosisOpsDashboard'
import { CeoDemoBanner } from '@/components/demo/CeoDemoBanner'
import { CeoDemoToast } from '@/components/demo/CeoDemoToast'
import {
  createDemoToastMessage,
  isCeoDemoMode,
  useCeoDemoLocalState,
} from '@/lib/demo/ceo-demo-mode'

type Notice =
  | {
      tone: 'success' | 'error'
      message: string
    }
  | null

const cardClassName = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'
const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-slate-400'
const textareaClassName = `${inputClassName} min-h-[120px] resize-y`
const primaryButtonClassName =
  'inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300'
const secondaryButtonClassName =
  'inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400'
const NEW_TEMPLATE_ID = '__new__'
const TARGET_TYPE_LABELS: Record<string, string> = {
  TEAM_LEADER: '팀장',
  SECTION_CHIEF: '실장',
  DIVISION_HEAD: '본부장/부문장',
  PM: 'PM',
  CUSTOM: '직접 지정',
}

const LEADERSHIP_SCALE_LABELS: Record<number, string> = {
  1: '매우 그렇지 않다',
  2: '그렇지 않다',
  3: '다소 그렇지 않다',
  4: '다소 그렇다',
  5: '그렇다',
  6: '매우 그렇다',
}

const LEADERSHIP_DEFAULT_CATEGORIES = [
  '바른생각 (커뮤니케이션)',
  '창의도전 (변화주도)',
  '비전공유 (조직관리)',
  '전략적 사고',
  '혁신',
]

function getLeadershipRelationshipLabel(relationship?: string | null) {
  switch (relationship) {
    case 'PEER':
      return 'PM/동료 리더 진단'
    case 'CROSS_DEPT':
      return '협업 리더 진단'
    case 'SUBORDINATE':
    default:
      return '리더십 진단'
  }
}

function getLeadershipStatusLabel(status?: string | null) {
  switch (status) {
    case 'SUBMITTED':
      return '완료'
    case 'IN_PROGRESS':
      return '진행 중'
    default:
      return '미평가'
  }
}

function getLeadershipStatusClassName(status?: string | null) {
  switch (status) {
    case 'SUBMITTED':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700'
    case 'IN_PROGRESS':
      return 'border-blue-100 bg-blue-50 text-blue-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function getQuestionScaleValues(question: {
  scaleMin?: number | null
  scaleMax?: number | null
}) {
  const min = question.scaleMin ?? 1
  const max = question.scaleMax ?? 6
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, offset) => min + offset)
}

function getLeadershipRoundDueLabel(round?: UpwardReviewPageData['availableRounds'][number], fallback?: string) {
  const dueDate = fallback ?? round?.endDate
  if (!dueDate) return '마감일 확인'
  return `${dueDate} 마감`
}

function getLeadershipRoundName(data: UpwardReviewPageData, roundId?: string) {
  return data.availableRounds.find((round) => round.id === roundId)?.roundName ?? data.availableRounds[0]?.roundName ?? '리더십 진단'
}

function buildLeadershipPeriodName(cycleName?: string) {
  const trimmed = cycleName?.trim()
  if (!trimmed) return '리더십 진단'
  return trimmed.includes('리더십') ? trimmed : `${trimmed} 리더십 진단`
}

function getLeadershipProgress(params: {
  total: number
  answered: number
}) {
  if (!params.total) return 0
  return Math.min(100, Math.round((params.answered / params.total) * 100))
}

function getLeadershipQuestionCategories(questions: NonNullable<UpwardReviewPageData['respond']>['questions']) {
  return Array.from(
    questions.reduce((set, question, index) => {
      set.add(question.category?.trim() || LEADERSHIP_DEFAULT_CATEGORIES[index % LEADERSHIP_DEFAULT_CATEGORIES.length])
      return set
    }, new Set<string>())
  )
}

function parseLeadershipSectionComments(
  comment: string,
  categories: string[]
) {
  const state = Object.fromEntries(categories.map((category) => [category, '']))
  const trimmedComment = comment.trim()
  if (!trimmedComment) return state

  const marker = '[리더십 진단 섹션 의견]'
  if (!trimmedComment.startsWith(marker)) {
    if (categories[0]) state[categories[0]] = trimmedComment
    return state
  }

  const categorySet = new Set(categories)
  let currentCategory = ''
  const buffered = new Map<string, string[]>()
  for (const rawLine of trimmedComment.slice(marker.length).split(/\r?\n/)) {
    const line = rawLine.trim()
    const matchedCategory = line.startsWith('[') && line.endsWith(']') ? line.slice(1, -1) : ''
    if (categorySet.has(matchedCategory)) {
      currentCategory = matchedCategory
      if (!buffered.has(currentCategory)) buffered.set(currentCategory, [])
      continue
    }
    if (currentCategory) {
      buffered.get(currentCategory)?.push(rawLine)
    }
  }

  for (const category of categories) {
    state[category] = (buffered.get(category) ?? []).join('\n').trim()
  }
  return state
}

function serializeLeadershipSectionComments(
  sectionComments: Record<string, string>,
  categories: string[]
) {
  const entries = categories
    .map((category) => [category, sectionComments[category]?.trim() ?? ''] as const)
    .filter(([, comment]) => comment.length > 0)

  if (!entries.length) return ''

  return [
    '[리더십 진단 섹션 의견]',
    ...entries.map(([category, comment]) => `[${category}]\n${comment}`),
  ].join('\n\n')
}

function getLeadershipProgressQuestions(questions: NonNullable<UpwardReviewPageData['respond']>['questions']) {
  const requiredActiveQuestions = questions.filter((question) => question.isRequired)
  return requiredActiveQuestions.length ? requiredActiveQuestions : questions
}

function isLeadershipQuestionAnswered(
  question: NonNullable<UpwardReviewPageData['respond']>['questions'][number],
  current?: { ratingValue: number | null; textValue: string; choiceValues: string[] }
) {
  if (!current) return false
  if (question.questionType === 'RATING_SCALE') {
    const min = question.scaleMin ?? 1
    const max = question.scaleMax ?? 6
    return typeof current.ratingValue === 'number' && current.ratingValue >= min && current.ratingValue <= max
  }
  if (question.questionType === 'MULTIPLE_CHOICE') {
    return current.choiceValues.length > 0
  }
  return current.textValue.trim().length > 0
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`
}

function getLeadershipAverageScore(results: NonNullable<UpwardReviewPageData['results']>) {
  const scores = results.questionSummaries
    .map((question) => question.averageScore)
    .filter((score): score is number => typeof score === 'number')
  if (!scores.length) return null
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
}

function getLeadershipResultCategories(results: NonNullable<UpwardReviewPageData['results']>) {
  return results.questionSummaries
    .filter((question) => question.averageScore != null)
    .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0))
}

function resolveTargetTypeFromLabel(label: string) {
  return (
    Object.entries(TARGET_TYPE_LABELS).find(([, value]) => value === label)?.[0] ??
    'TEAM_LEADER'
  )
}

function ActionLink(props: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={props.href}
      className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
        props.active
          ? 'bg-slate-950 text-white'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {props.label}
    </Link>
  )
}

function SectionCard(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className={cardClassName}>
      <h3 className="text-lg font-semibold text-slate-900">{props.title}</h3>
      {props.description ? <p className="mt-2 text-sm text-slate-500">{props.description}</p> : null}
      <div className="mt-5">{props.children}</div>
    </section>
  )
}

function LeadershipPptShell(props: {
  data: UpwardReviewPageData
  activeItem: 'respond' | 'report'
  title: string
  subtitle?: string
  statusLabel?: string | null
  roundLabel?: string
  dueLabel?: string
  children: ReactNode
}) {
  const inactiveClassName = 'text-slate-700 hover:bg-slate-50'

  return (
    <main className="min-w-0 w-full max-w-none bg-white px-5 py-8 sm:px-6 lg:px-6 xl:px-6">
      <div className="w-full min-w-0">
        <section className="min-w-0">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2 text-xs font-extrabold text-slate-400">
                <span>리더십 진단</span>
                <span>&gt;</span>
                <span>{props.activeItem === 'report' ? '내 진단 리포트' : '내가 평가할 사람'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-extrabold leading-tight text-blue-950">{props.title}</h1>
                {props.statusLabel ? (
                  <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
                    {props.statusLabel}
                  </span>
                ) : null}
              </div>
              {props.subtitle ? <p className="mt-3 text-sm font-bold text-slate-500">{props.subtitle}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
                  공식 평가 점수/등급을 자동 산정하지 않습니다
                </span>
                <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-extrabold text-slate-600">
                  성장 피드백 참고 자료
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-blue-950 shadow-sm">
                <CalendarDays className="h-5 w-5 text-blue-700" />
                {props.roundLabel ?? '평가 주기'}
                <ChevronDown className="h-4 w-4" />
              </div>
              <div className="min-w-[150px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                <div className="text-xs font-extrabold text-blue-950">종료일</div>
                <div className="mt-1 font-extrabold text-rose-600">{props.dueLabel ?? '마감일 확인'}</div>
              </div>
            </div>
          </header>

          <nav className="mt-8 flex flex-wrap gap-2 border-b border-slate-200 text-sm font-extrabold">
            <Link
              href="/evaluation/upward/respond"
              className={`border-b-2 px-2 pb-3 pt-1 ${
                props.activeItem === 'respond'
                  ? 'border-blue-600 text-blue-700'
                  : `border-transparent ${inactiveClassName}`
              }`}
            >
              내가 평가할 사람
            </Link>
            <Link
              href="/evaluation/upward/results"
              className={`border-b-2 px-2 pb-3 pt-1 ${
                props.activeItem === 'report'
                  ? 'border-blue-600 text-blue-700'
                  : `border-transparent ${inactiveClassName}`
              }`}
            >
              내 진단 리포트
            </Link>
            <span className="border-b-2 border-transparent px-2 pb-3 pt-1 text-slate-500">역량 변화 추이</span>
            {props.data.permissions?.canViewAdmin ? (
              <Link
                href="/evaluation/upward/admin"
                className="border-b-2 border-transparent px-2 pb-3 pt-1 text-slate-700 hover:bg-slate-50"
              >
                진단 운영
              </Link>
            ) : null}
          </nav>

          <div className="mt-7 min-w-0">{props.children}</div>
        </section>
      </div>
    </main>
  )
}

function LeadershipSummaryCard(props: {
  label: string
  value: string
  helper?: string
  tone?: 'blue' | 'green' | 'amber' | 'rose'
  icon?: ReactNode
}) {
  const toneClassName =
    props.tone === 'green'
      ? 'bg-emerald-50 text-emerald-700'
      : props.tone === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : props.tone === 'rose'
          ? 'bg-rose-50 text-rose-700'
          : 'bg-blue-50 text-blue-700'

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${toneClassName}`}>
          {props.icon}
        </span>
        <div>
          <div className="text-sm font-extrabold text-slate-600">{props.label}</div>
          <div className="mt-2 text-3xl font-extrabold text-blue-950">{props.value}</div>
          {props.helper ? <div className="mt-2 text-sm font-bold text-slate-500">{props.helper}</div> : null}
        </div>
      </div>
    </article>
  )
}

function SummaryLine(props: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-4">
      <span className="font-bold text-slate-500">{props.label}</span>
      <span className="text-right font-extrabold text-blue-950">{props.value}</span>
    </div>
  )
}

function LeadershipRadarLikeChart(props: {
  questions: NonNullable<UpwardReviewPageData['results']>['questionSummaries']
}) {
  const items = props.questions.filter((question) => question.averageScore != null).slice(0, 5)

  if (!items.length) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">
        표시할 점수 데이터가 없습니다.
      </div>
    )
  }

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-5">
      {items.map((question) => (
        <div key={question.questionId} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-4 text-center">
          <div className="text-sm font-extrabold text-blue-950">{question.averageScore?.toFixed(2)}</div>
          <div className="mt-2 line-clamp-2 text-xs font-bold text-blue-700">{question.category}</div>
        </div>
      ))}
    </div>
  )
}

function LeadershipOperationFlowCards() {
  const steps = [
    {
      index: 1,
      title: '문항 세트 작성',
      description: '기본 24문항을 저장한 뒤 조직 문항으로 수정합니다.',
    },
    {
      index: 2,
      title: '진단 기간 생성',
      description: '응답 시작일, 종료일, 익명 기준과 문항 세트를 연결합니다.',
    },
    {
      index: 3,
      title: '대상자 매핑',
      description: '팀원은 팀장/PM, 팀장은 실장 또는 본부장으로 연결합니다.',
    },
    {
      index: 4,
      title: '응답 및 결과 공개',
      description: '진단 기간 시작 후 메일을 발송하고, 익명 기준 충족 시 결과를 공개합니다.',
    },
  ]

  return (
    <section className="grid gap-3 lg:grid-cols-4">
      {steps.map((step) => (
        <article key={step.index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-700">
            {step.index}
          </div>
          <h3 className="mt-4 text-base font-extrabold text-blue-950">{step.title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{step.description}</p>
        </article>
      ))}
    </section>
  )
}

function LeadershipDefaultQuestionPreview(props: {
  compact?: boolean
}) {
  const groupedQuestions = DEFAULT_LEADERSHIP_DIAGNOSIS_QUESTIONS.reduce((map, question) => {
    const current = map.get(question.category) ?? []
    current.push(question.questionText)
    map.set(question.category, current)
    return map
  }, new Map<string, string[]>())

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-blue-950">기본 리더십 진단 문항 24개</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            새 문항 세트를 저장하면 아래 문항이 자동으로 들어갑니다. 이후 문항 직접 관리에서 전부 수정하거나 교체할 수 있습니다.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
          6점 척도
        </span>
      </div>

      <div className={`mt-5 grid gap-4 ${props.compact ? 'lg:grid-cols-2' : 'xl:grid-cols-2'}`}>
        {Array.from(groupedQuestions.entries()).map(([category, questions]) => (
          <div key={category} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-extrabold text-slate-950">{category}</h3>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-blue-700">
                {questions.length}문항
              </span>
            </div>
            <ol className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">
              {questions.map((question, index) => (
                <li key={`${category}:${index}`} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2">
                  <span className="font-extrabold text-blue-700">{index + 1}</span>
                  <span>{question}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}

function LeadershipDefaultQuestionSummary() {
  const categoryCounts = DEFAULT_LEADERSHIP_DIAGNOSIS_QUESTIONS.reduce((map, question) => {
    map.set(question.category, (map.get(question.category) ?? 0) + 1)
    return map
  }, new Map<string, number>())

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-extrabold text-blue-700">기본 문항 자동 추가</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-900">
            저장하면 기본 리더십 진단 문항 24개가 문항 직접 관리에 자동으로 생성됩니다.
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-extrabold text-blue-700">6점 척도</span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {Array.from(categoryCounts.entries()).map(([category, count]) => (
          <div key={category} className="rounded-xl bg-white px-3 py-3 text-sm">
            <div className="font-extrabold text-blue-950">{category}</div>
            <div className="mt-1 text-xs font-bold text-blue-600">{count}문항</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{props.value}</div>
      {props.hint ? <p className="mt-2 text-sm text-slate-500">{props.hint}</p> : null}
    </div>
  )
}

function formatForDateTimeInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60000)
  return adjusted.toISOString().slice(0, 16)
}

function parseChoiceText(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseStoredChoiceValue(value?: string | null) {
  if (!value) return [] as string[]
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string')
    }
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function CoachingTextList(props: { items: string[]; tone?: 'blue' | 'emerald' | 'amber' }) {
  const markerClassName =
    props.tone === 'emerald'
      ? 'bg-emerald-100 text-emerald-700'
      : props.tone === 'amber'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-blue-100 text-blue-700'

  return (
    <ul className="space-y-3">
      {props.items.map((item, index) => (
        <li key={`${index}:${item}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 text-sm font-semibold leading-6 text-slate-600">
          <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${markerClassName}`}>
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

async function readApiBody(response: Response) {
  const body = (await response.json()) as {
    success: boolean
    data?: Record<string, unknown>
    error?: { message?: string }
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? '요청을 처리하지 못했습니다.')
  }

  return body.data ?? {}
}

export function UpwardReviewWorkspaceClient(props: { data: UpwardReviewPageData }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ceoDemoMode = isCeoDemoMode(searchParams)
  const [, startTransition] = useTransition()
  const [notice, setNotice] = useState<Notice>(null)
  const [demoToast, setDemoToast] = useState('')
  const [, setLeadershipDemoState] = useCeoDemoLocalState('ceo-demo-leadership-diagnosis', {
    status: '대기',
    updatedAt: '',
  })
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [openLeadershipCategory, setOpenLeadershipCategory] = useState(LEADERSHIP_DEFAULT_CATEGORIES[0])

  const adminData = props.data.admin
  const respondData = props.data.respond
  const resultsData = props.data.results
  const respondReadOnly = Boolean(respondData?.readOnly && !ceoDemoMode)

  const [selectedTemplateId, setSelectedTemplateId] = useState(adminData?.selectedTemplateId ?? adminData?.templates[0]?.id ?? NEW_TEMPLATE_ID)
  const [templateDraft, setTemplateDraft] = useState({
    templateId: '',
    name: '리더십 진단 기본 문항 세트',
    description: '기본 문항 24개로 시작하고, 조직 기준에 맞게 문항을 교체할 수 있습니다.',
    isActive: true,
    defaultMinResponses: 3,
    defaultTargetTypes: ['TEAM_LEADER'] as string[],
  })
  const [questionDraft, setQuestionDraft] = useState({
    templateId: '',
    questionId: '',
    category: '리더십',
    questionText: '',
    description: '',
    questionType: 'RATING_SCALE' as 'TEXT' | 'RATING_SCALE' | 'MULTIPLE_CHOICE',
    scaleMin: 1,
    scaleMax: 6,
    isRequired: true,
    isActive: true,
    choiceOptionsText: '',
  })
  const [roundDraft, setRoundDraft] = useState({
    roundId: '',
    evalCycleId: props.data.selectedCycleId ?? props.data.availableCycles[0]?.id ?? '',
    roundName: buildLeadershipPeriodName(
      props.data.availableCycles.find((cycle) => cycle.id === props.data.selectedCycleId)?.name ?? props.data.availableCycles[0]?.name
    ),
    templateId: '',
    startDate: '',
    endDate: '',
    minRaters: 3,
    targetTypes: ['TEAM_LEADER'] as string[],
    resultViewerMode: 'TARGET_ONLY' as 'TARGET_ONLY' | 'TARGET_AND_PRIMARY_MANAGER',
    rawResponsePolicy: 'ADMIN_ONLY' as 'ADMIN_ONLY' | 'REVIEW_ADMIN_CONTENT',
  })
  const [assignmentDraft, setAssignmentDraft] = useState({
    evaluatorId: '',
    evaluateeId: '',
    relationship: 'SUBORDINATE' as 'SUBORDINATE' | 'PEER' | 'CROSS_DEPT',
  })
  const [suggestionTargetId, setSuggestionTargetId] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState('')
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED'>('ALL')
  const [sectionCommentState, setSectionCommentState] = useState<Record<string, string>>(() =>
    respondData
      ? parseLeadershipSectionComments(respondData.overallComment, getLeadershipQuestionCategories(respondData.questions))
      : {}
  )
  const [questionState, setQuestionState] = useState<
    Record<string, { ratingValue: number | null; textValue: string; choiceValues: string[] }>
  >({})

  const selectedTemplate = useMemo(
    () => (selectedTemplateId === NEW_TEMPLATE_ID ? null : adminData?.templates.find((template) => template.id === selectedTemplateId) ?? null),
    [adminData?.templates, selectedTemplateId]
  )

  const employeeDirectory = adminData?.employeeDirectory ?? []

  useEffect(() => {
    setNotice(null)
  }, [props.data.mode, props.data.selectedCycleId, props.data.selectedRoundId])

  useEffect(() => {
    if (!adminData) return
    if (selectedTemplateId === NEW_TEMPLATE_ID) return
    if (selectedTemplateId && adminData.templates.some((template) => template.id === selectedTemplateId)) return
    setSelectedTemplateId(adminData.selectedTemplateId ?? adminData.templates[0]?.id ?? NEW_TEMPLATE_ID)
  }, [adminData, selectedTemplateId])

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateDraft({
        templateId: selectedTemplate.id,
        name: selectedTemplate.name,
        description: selectedTemplate.description ?? '',
        isActive: selectedTemplate.isActive,
        defaultMinResponses: selectedTemplate.defaultMinResponses,
        defaultTargetTypes: selectedTemplate.defaultTargetTypes.map(resolveTargetTypeFromLabel),
      })
      setQuestionDraft((current) => ({
        ...current,
        templateId: selectedTemplate.id,
      }))
      return
    }

    setTemplateDraft({
      templateId: '',
      name: '리더십 진단 기본 문항 세트',
      description: '기본 문항 24개로 시작하고, 조직 기준에 맞게 문항을 교체할 수 있습니다.',
      isActive: true,
      defaultMinResponses: 3,
      defaultTargetTypes: ['TEAM_LEADER'],
    })
    setQuestionDraft({
      templateId: '',
      questionId: '',
      category: '리더십',
      questionText: '',
      description: '',
      questionType: 'RATING_SCALE',
      scaleMin: 1,
      scaleMax: 6,
      isRequired: true,
      isActive: true,
      choiceOptionsText: '',
    })
  }, [selectedTemplate])

  useEffect(() => {
    if (!adminData?.selectedRound) {
      setRoundDraft({
        roundId: '',
        evalCycleId: props.data.selectedCycleId ?? props.data.availableCycles[0]?.id ?? '',
        roundName: buildLeadershipPeriodName(
          props.data.availableCycles.find((cycle) => cycle.id === props.data.selectedCycleId)?.name ?? props.data.availableCycles[0]?.name
        ),
        templateId: selectedTemplate?.id ?? '',
        startDate: '',
        endDate: '',
        minRaters: 3,
        targetTypes: ['TEAM_LEADER'],
        resultViewerMode: 'TARGET_ONLY',
        rawResponsePolicy: 'ADMIN_ONLY',
      })
      return
    }

    setRoundDraft({
      roundId: adminData.selectedRound.id,
      evalCycleId: props.data.selectedCycleId ?? props.data.availableCycles[0]?.id ?? '',
      roundName: adminData.selectedRound.roundName,
      templateId: adminData.selectedRound.templateId ?? selectedTemplate?.id ?? '',
      startDate: formatForDateTimeInput(adminData.selectedRound.startDate),
      endDate: formatForDateTimeInput(adminData.selectedRound.endDate),
      minRaters:
        props.data.availableRounds.find((round) => round.id === adminData.selectedRound?.id)?.minRaters ?? 3,
      targetTypes: adminData.selectedRound.targetTypes.map(resolveTargetTypeFromLabel),
      resultViewerMode: adminData.selectedRound.resultViewerMode === '진단 대상자 + 1차 리더' ? 'TARGET_AND_PRIMARY_MANAGER' : 'TARGET_ONLY',
      rawResponsePolicy: adminData.selectedRound.rawResponsePolicy === '콘텐츠 열람 권한 운영자' ? 'REVIEW_ADMIN_CONTENT' : 'ADMIN_ONLY',
    })
  }, [adminData?.selectedRound, props.data.availableCycles, props.data.availableRounds, props.data.selectedCycleId, selectedTemplate?.id])

  useEffect(() => {
    if (!respondData) return

    setSectionCommentState(parseLeadershipSectionComments(respondData.overallComment, getLeadershipQuestionCategories(respondData.questions)))
    setQuestionState(
      Object.fromEntries(
        respondData.questions.map((question) => [
          question.id,
          {
            ratingValue: question.ratingValue ?? null,
            textValue: question.questionType === 'MULTIPLE_CHOICE' ? '' : question.textValue ?? '',
            choiceValues:
              question.questionType === 'MULTIPLE_CHOICE'
                ? parseStoredChoiceValue(question.textValue)
                : [],
          },
        ])
      )
    )
  }, [respondData])

  const filteredAssignments = useMemo(() => {
    const assignments = adminData?.selectedRound?.assignments ?? []
    return assignments.filter((assignment) => {
      const matchesStatus = assignmentStatusFilter === 'ALL' || assignment.status === assignmentStatusFilter
      const haystack = `${assignment.evaluateeName} ${assignment.evaluateeDepartment} ${assignment.evaluatorName} ${assignment.evaluatorDepartment}`.toLowerCase()
      const matchesText = assignmentFilter.trim() ? haystack.includes(assignmentFilter.trim().toLowerCase()) : true
      return matchesStatus && matchesText
    })
  }, [adminData?.selectedRound?.assignments, assignmentFilter, assignmentStatusFilter])

  const suggestionTargetOptions = useMemo(() => {
    const suggestions = adminData?.suggestions ?? []
    const optionMap = suggestions.reduce((map, suggestion) => {
      const current = map.get(suggestion.evaluateeId) ?? {
        id: suggestion.evaluateeId,
        name: suggestion.evaluateeName,
        count: 0,
        relationships: new Set<string>(),
      }
      current.count += 1
      current.relationships.add(getLeadershipRelationshipLabel(suggestion.relationship))
      map.set(suggestion.evaluateeId, current)
      return map
    }, new Map<string, { id: string; name: string; count: number; relationships: Set<string> }>())

    return Array.from(optionMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [adminData?.suggestions])

  const visibleSuggestions = useMemo(() => {
    const suggestions = adminData?.suggestions ?? []
    return suggestionTargetId
      ? suggestions.filter((suggestion) => suggestion.evaluateeId === suggestionTargetId)
      : suggestions
  }, [adminData?.suggestions, suggestionTargetId])

  useEffect(() => {
    if (!suggestionTargetId) return
    if (suggestionTargetOptions.some((option) => option.id === suggestionTargetId)) return
    setSuggestionTargetId('')
  }, [suggestionTargetId, suggestionTargetOptions])

  function updateSearch(params: Record<string, string | undefined | null>) {
    const search = new URLSearchParams()
    const hasCycleId = Object.prototype.hasOwnProperty.call(params, 'cycleId')
    const hasRoundId = Object.prototype.hasOwnProperty.call(params, 'roundId')
    const hasEmpId = Object.prototype.hasOwnProperty.call(params, 'empId')
    const cycleId = hasCycleId ? params.cycleId : props.data.selectedCycleId
    const roundId = hasRoundId ? params.roundId : props.data.selectedRoundId
    const empId = hasEmpId ? params.empId : resultsData?.selectedTargetId
    if (cycleId) search.set('cycleId', cycleId)
    if (roundId) search.set('roundId', roundId)
    if (empId && props.data.mode === 'results') search.set('empId', empId)
    return search.toString()
  }

  async function runAdminAction(action: string, payload: unknown, successMessage?: string) {
    if (ceoDemoMode) {
      const message = successMessage ?? createDemoToastMessage('save-draft')
      setLeadershipDemoState({ status: action, updatedAt: new Date().toISOString() })
      setDemoToast(message)
      setNotice({ tone: 'success', message: `${message} 시연 환경에서는 운영 데이터에 반영되지 않습니다.` })
      return null
    }

    setBusyKey(action)
    setNotice(null)
    try {
      const result = await readApiBody(
        await fetch('/api/feedback/upward/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload }),
        })
      )
      setNotice({
        tone: 'success',
        message: successMessage ?? String(result.message ?? '작업이 저장되었습니다.'),
      })
      return result
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '작업을 처리하지 못했습니다.',
      })
      return null
    } finally {
      setBusyKey(null)
    }
  }

  async function handleSaveTemplate() {
    const payload = {
      ...templateDraft,
      defaultMinResponses: Number(templateDraft.defaultMinResponses),
    }
    const result = await runAdminAction(templateDraft.templateId ? 'updateTemplate' : 'createTemplate', payload)
    if (!result) return
    if (typeof result.templateId === 'string') {
      setSelectedTemplateId(result.templateId)
    }
    startTransition(() => router.refresh())
  }

  function handleStartNewTemplate() {
    setSelectedTemplateId(NEW_TEMPLATE_ID)
    setTemplateDraft({
      templateId: '',
      name: '리더십 진단 기본 문항 세트',
      description: '기본 문항 24개로 시작하고, 조직 기준에 맞게 문항을 교체할 수 있습니다.',
      isActive: true,
      defaultMinResponses: 3,
      defaultTargetTypes: ['TEAM_LEADER'],
    })
    setQuestionDraft({
      templateId: '',
      questionId: '',
      category: '리더십',
      questionText: '',
      description: '',
      questionType: 'RATING_SCALE',
      scaleMin: 1,
      scaleMax: 6,
      isRequired: true,
      isActive: true,
      choiceOptionsText: '',
    })
    setNotice({
      tone: 'success',
      message: '새 문항 세트 작성 화면입니다. 저장하면 기본 문항 24개가 자동으로 추가됩니다.',
    })
  }

  async function handleSeedDefaultQuestions() {
    if (!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID) return
    const result = await runAdminAction('seedDefaultQuestions', { templateId: selectedTemplateId })
    if (!result) return
    startTransition(() => router.refresh())
  }

  async function handleDuplicateTemplate() {
    if (!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID) return
    const result = await runAdminAction('duplicateTemplate', { templateId: selectedTemplateId })
    if (!result) return
    if (typeof result.templateId === 'string') {
      setSelectedTemplateId(result.templateId)
    }
    startTransition(() => router.refresh())
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID) return
    const result = await runAdminAction('deleteTemplate', { templateId: selectedTemplateId })
    if (!result) return
    setSelectedTemplateId(NEW_TEMPLATE_ID)
    startTransition(() => router.refresh())
  }

  async function handleSaveQuestion() {
    if (!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID) return
    const payload = {
      ...questionDraft,
      templateId: selectedTemplateId,
      choiceOptions: questionDraft.questionType === 'MULTIPLE_CHOICE' ? parseChoiceText(questionDraft.choiceOptionsText) : [],
    }
    const result = await runAdminAction('saveQuestion', payload)
    if (!result) return
    setQuestionDraft({
      templateId: selectedTemplateId,
      questionId: '',
      category: '리더십',
      questionText: '',
      description: '',
      questionType: 'RATING_SCALE',
      scaleMin: 1,
      scaleMax: 6,
      isRequired: true,
      isActive: true,
      choiceOptionsText: '',
    })
    startTransition(() => router.refresh())
  }

  async function handleRoundSave() {
    // 가드 — 빈 값/invalid date 시 toISOString 호출 전에 차단(RangeError: Invalid time value 방지).
    const start = roundDraft.startDate ? new Date(roundDraft.startDate) : null
    const end = roundDraft.endDate ? new Date(roundDraft.endDate) : null
    const cycleName = props.data.availableCycles.find((cycle) => cycle.id === roundDraft.evalCycleId)?.name
    if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
      setNotice({ tone: 'error', message: '시작일과 종료일을 모두 입력해 주세요.' })
      return
    }
    const result = await runAdminAction('saveRound', {
      ...roundDraft,
      roundName: buildLeadershipPeriodName(cycleName),
      minRaters: Number(roundDraft.minRaters),
      templateId: roundDraft.templateId || selectedTemplateId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    })
    if (!result) return
    if (typeof result.roundId === 'string') {
      router.push(`/evaluation/upward/admin?${updateSearch({ roundId: result.roundId, cycleId: roundDraft.evalCycleId })}`)
      return
    }
    startTransition(() => router.refresh())
  }

  function handleStartNewRound() {
    const cycleId = roundDraft.evalCycleId || props.data.selectedCycleId || props.data.availableCycles[0]?.id || ''
    const cycleName = props.data.availableCycles.find((cycle) => cycle.id === cycleId)?.name
    const defaultTemplateId =
      selectedTemplate?.id ?? (selectedTemplateId !== NEW_TEMPLATE_ID ? selectedTemplateId : adminData?.templates[0]?.id ?? '')

    setRoundDraft({
      roundId: '',
      evalCycleId: cycleId,
      roundName: buildLeadershipPeriodName(cycleName),
      templateId: defaultTemplateId,
      startDate: '',
      endDate: '',
      minRaters: selectedTemplate?.defaultMinResponses ?? 3,
      targetTypes: selectedTemplate?.defaultTargetTypes.map(resolveTargetTypeFromLabel) ?? ['TEAM_LEADER'],
      resultViewerMode: 'TARGET_ONLY',
      rawResponsePolicy: 'ADMIN_ONLY',
    })

    if (props.data.selectedRoundId) {
      router.push(`/evaluation/upward/admin?${updateSearch({ roundId: undefined, cycleId })}`)
    }
  }

  async function handleSaveDraft() {
    if (!respondData) return
    const responseCategories = getLeadershipQuestionCategories(respondData.questions)
    const overallComment = serializeLeadershipSectionComments(sectionCommentState, responseCategories)
    if (overallComment.length > 1000) {
      setNotice({ tone: 'error', message: '섹션 의견은 저장 형식 포함 1000자 이내로 작성해 주세요.' })
      return
    }
    if (ceoDemoMode) {
      const message = createDemoToastMessage('save-draft')
      setLeadershipDemoState({ status: '작성중', updatedAt: new Date().toISOString() })
      setDemoToast(message)
      setNotice({ tone: 'success', message: `${message} 시연 환경에서는 운영 데이터에 반영되지 않습니다.` })
      return
    }
    setBusyKey('draft')
    setNotice(null)
    try {
      const responsePayload = {
        overallComment,
        responses: respondData.questions.map((question) => ({
          questionId: question.id,
          ratingValue: questionState[question.id]?.ratingValue ?? null,
          textValue:
            question.questionType === 'MULTIPLE_CHOICE'
              ? JSON.stringify(questionState[question.id]?.choiceValues ?? [])
              : questionState[question.id]?.textValue ?? '',
        })),
      }

      const result = await readApiBody(
        await fetch(`/api/feedback/upward/responses/${encodeURIComponent(respondData.feedbackId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responsePayload),
        })
      )

      setNotice({ tone: 'success', message: String(result.message ?? '초안이 저장되었습니다.') })
      startTransition(() => router.refresh())
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '임시 저장에 실패했습니다.' })
    } finally {
      setBusyKey(null)
    }
  }

  async function handleFinalSubmit() {
    if (!respondData) return
    const responseCategories = getLeadershipQuestionCategories(respondData.questions)
    const progressQuestions = getLeadershipProgressQuestions(respondData.questions)
    const missingRequiredQuestions = progressQuestions.filter(
      (question) => !isLeadershipQuestionAnswered(question, questionState[question.id])
    )
    if (missingRequiredQuestions.length) {
      const firstMissingQuestion = missingRequiredQuestions[0]
      const missingCategory =
        firstMissingQuestion.category?.trim() ||
        responseCategories.find((category) => category) ||
        LEADERSHIP_DEFAULT_CATEGORIES[0]
      setOpenLeadershipCategory(missingCategory)
      setNotice({
        tone: 'error',
        message: `필수 문항 ${missingRequiredQuestions.length}개가 아직 응답되지 않았습니다. ${missingCategory} 섹션을 확인해 주세요.`,
      })
      return
    }
    const overallComment = serializeLeadershipSectionComments(sectionCommentState, responseCategories)
    if (overallComment.length > 1000) {
      setNotice({ tone: 'error', message: '섹션 의견은 저장 형식 포함 1000자 이내로 작성해 주세요.' })
      return
    }
    if (ceoDemoMode) {
      const message = createDemoToastMessage('submit')
      setLeadershipDemoState({ status: '제출완료', updatedAt: new Date().toISOString() })
      setDemoToast(message)
      setNotice({ tone: 'success', message: `${message} 시연 환경에서는 운영 데이터에 반영되지 않습니다.` })
      return
    }
    setBusyKey('submit')
    setNotice(null)
    try {
      const responsePayload = {
        overallComment,
        responses: respondData.questions.map((question) => ({
          questionId: question.id,
          ratingValue: questionState[question.id]?.ratingValue ?? null,
          textValue:
            question.questionType === 'MULTIPLE_CHOICE'
              ? JSON.stringify(questionState[question.id]?.choiceValues ?? [])
              : questionState[question.id]?.textValue ?? '',
        })),
      }

      const result = await readApiBody(
        await fetch(`/api/feedback/upward/responses/${encodeURIComponent(respondData.feedbackId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responsePayload),
        })
      )

      setNotice({ tone: 'success', message: String(result.message ?? '제출이 완료되었습니다.') })
      startTransition(() => router.refresh())
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '제출에 실패했습니다.' })
    } finally {
      setBusyKey(null)
    }
  }

  async function handleSendLeadershipReminder() {
    if (!adminData?.selectedRound) return
    const targetIds = Array.from(
      new Set(
        adminData.selectedRound.assignments
          .filter((assignment) => assignment.status !== 'SUBMITTED')
          .map((assignment) => assignment.evaluatorId)
      )
    )

    if (!targetIds.length) {
      setNotice({ tone: 'success', message: '메일을 보낼 미제출자가 없습니다.' })
      return
    }

    if (ceoDemoMode) {
      const message = createDemoToastMessage('prepare-reminder')
      setDemoToast(message)
      setNotice({ tone: 'success', message: `${message} 시연 환경에서는 실제 메일/알림을 발송하지 않습니다.` })
      return
    }

    setBusyKey('sendLeadershipReminder')
    setNotice(null)
    try {
      const result = await readApiBody(
        await fetch(`/api/feedback/rounds/${encodeURIComponent(adminData.selectedRound.id)}/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-review-reminder',
            roundId: adminData.selectedRound.id,
            targetIds,
            subject: `[리더십 진단] ${adminData.selectedRound.roundName} 응답 요청`,
            body: `
              <p>안녕하세요.</p>
              <p>${adminData.selectedRound.roundName} 리더십 진단 응답이 배정되었습니다.</p>
              <p>기한 내 리더십 진단 화면에서 응답을 작성해 주세요.</p>
            `,
          }),
        })
      )

      setNotice({
        tone: 'success',
        message: String(result.message ?? '리더십 진단 메일 발송을 예약했습니다.'),
      })
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '리더십 진단 메일 발송에 실패했습니다.',
      })
    } finally {
      setBusyKey(null)
    }
  }

  async function handleAddSuggestedAssignments(evaluateeId?: string) {
    if (!adminData?.selectedRound) return
    const result = await runAdminAction('addSuggestedAssignments', {
      roundId: adminData.selectedRound.id,
      evaluateeId: evaluateeId || undefined,
    })
    if (!result) return
    startTransition(() => router.refresh())
  }

  const selectedRound = props.data.availableRounds.find((round) => round.id === props.data.selectedRoundId)
  const overviewAssignments = props.data.overview?.assignments ?? []
  const overviewSubmittedCount = overviewAssignments.filter((assignment) => assignment.status === 'SUBMITTED').length
  const overviewInProgressCount = overviewAssignments.filter((assignment) => assignment.status === 'IN_PROGRESS').length
  const overviewPendingCount = overviewAssignments.filter((assignment) => assignment.status === 'PENDING').length
  const progressQuestions = respondData ? getLeadershipProgressQuestions(respondData.questions) : []
  const answeredQuestionCount = progressQuestions.filter((question) =>
    isLeadershipQuestionAnswered(question, questionState[question.id])
  ).length
  const responseQuestionTotal = progressQuestions.length
  const responseProgress = respondData
    ? getLeadershipProgress({ total: responseQuestionTotal, answered: answeredQuestionCount })
    : 0
  const responseQuestionGroups = respondData
    ? Array.from(
        respondData.questions.reduce((map, question, index) => {
          const fallbackCategory = LEADERSHIP_DEFAULT_CATEGORIES[index % LEADERSHIP_DEFAULT_CATEGORIES.length]
          const category = question.category?.trim() || fallbackCategory
          const current = map.get(category) ?? []
          current.push(question)
          map.set(category, current)
          return map
        }, new Map<string, NonNullable<UpwardReviewPageData['respond']>['questions']>())
      )
    : []
  const activeResponseQuestionGroups = responseQuestionGroups.length
    ? responseQuestionGroups
    : LEADERSHIP_DEFAULT_CATEGORIES.map((category) => [category, []] as const)
  const leadershipResultAverage = resultsData ? getLeadershipAverageScore(resultsData) : null
  const leadershipResultSubmittedRate = resultsData?.feedbackCount
    ? getLeadershipProgress({ total: Math.max(resultsData.feedbackCount, resultsData.minRaters), answered: resultsData.feedbackCount })
    : 0
  const leadershipResultCategories = resultsData ? getLeadershipResultCategories(resultsData) : []
  const leadershipStrengthTop3 = resultsData?.strengths.slice(0, 3) ?? []
  const leadershipImprovementTop3 = resultsData?.improvements.slice(0, 3) ?? []
  const leadershipCheckInQuestions = [
    '최근 한 달 동안 구성원이 가장 자주 막힌 지점은 무엇이었나요?',
    '강점 행동을 팀 운영 루틴으로 유지하려면 어떤 약속이 필요할까요?',
    '보완 영역을 개선하기 위해 다음 체크인 전까지 관찰할 행동은 무엇인가요?',
  ]
  const leadershipGrowthActions = [
    '가장 낮게 나타난 영역을 한 가지 행동 기준으로 바꿔 팀과 공유합니다.',
    '강점 영역은 회의, 1:1, 업무 배분 중 반복 가능한 루틴으로 고정합니다.',
    '다음 체크인에서 구성원이 체감한 변화와 추가 지원 요청을 함께 확인합니다.',
  ]

  if (props.data.mode !== 'admin') {
    return (
      <LeadershipPptShell
        data={props.data}
        activeItem={props.data.mode === 'results' ? 'report' : 'respond'}
        title={
          props.data.mode === 'results'
            ? '리더십 진단 리포트'
            : props.data.mode === 'respond' && respondData
              ? `${respondData.receiverName} ${respondData.receiverPosition} 리더십 진단`
              : '리더십 진단'
        }
        subtitle={
          props.data.mode === 'results'
            ? `${selectedRound?.roundName ?? getLeadershipRoundName(props.data, props.data.selectedRoundId)} · 평가기간: ${selectedRound?.startDate ?? '-'} ~ ${selectedRound?.endDate ?? '-'}`
            : props.data.mode === 'respond' && respondData
              ? '각 문항을 읽고 리더십 수준에 가장 적합하다고 생각하는 번호를 선택해 주세요.'
              : '내가 평가해야 하는 리더 목록입니다.'
        }
        statusLabel={
          props.data.mode === 'results'
            ? resultsData?.released ? '완료' : '준비 중'
            : respondData ? getLeadershipStatusLabel(respondData.status) : selectedRound?.statusLabel
        }
        roundLabel={selectedRound?.roundName ?? getLeadershipRoundName(props.data, props.data.selectedRoundId)}
        dueLabel={respondData ? getLeadershipRoundDueLabel(selectedRound, respondData.dueDate) : getLeadershipRoundDueLabel(selectedRound)}
      >
        {ceoDemoMode ? <CeoDemoBanner /> : null}
        <CeoDemoToast message={demoToast} onClose={() => setDemoToast('')} />
        {notice ? (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
              notice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        {props.data.state !== 'ready' ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-xl font-extrabold text-slate-950">리더십 진단 상태 안내</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{props.data.message}</p>
              {props.data.permissions?.canViewAdmin ? (
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link
                    href={`/evaluation/upward/admin?${updateSearch({})}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-extrabold text-white"
                  >
                    리더십 진단 운영 열기
                  </Link>
                  <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600">
                    운영 화면에서 문항 세트 작성 → 진단 기간 생성 → 대상자 매핑 순서로 진행합니다.
                  </span>
                </div>
              ) : null}
            </section>
            <LeadershipOperationFlowCards />
            <LeadershipDefaultQuestionPreview compact />
          </div>
        ) : null}

        {props.data.state === 'ready' && props.data.mode === 'overview' && props.data.overview ? (
          <div className="space-y-5">
            <section className="grid gap-4 md:grid-cols-4">
              <LeadershipSummaryCard label="전체 진단 대상" value={`${overviewAssignments.length}명`} helper="배정된 리더 수" icon={<UserRound className="h-5 w-5" />} />
              <LeadershipSummaryCard label="평가 완료" value={`${overviewSubmittedCount}명`} helper="제출 완료" tone="green" icon={<CheckCircle2 className="h-5 w-5" />} />
              <LeadershipSummaryCard label="진행 중" value={`${overviewInProgressCount}명`} helper="작성 중" tone="amber" icon={<ClipboardCheck className="h-5 w-5" />} />
              <LeadershipSummaryCard label="미평가" value={`${overviewPendingCount}명`} helper="아직 작성하지 않음" tone="rose" icon={<ShieldCheck className="h-5 w-5" />} />
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-blue-700">내가 평가할 사람 ({overviewAssignments.length})</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <input className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none lg:w-72" placeholder="이름, 부서 검색" readOnly />
                  <select className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none" value="ALL" disabled>
                    <option>전체 상태</option>
                  </select>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="hidden grid-cols-[minmax(220px,1.2fr)_minmax(140px,0.8fr)_120px_160px_120px_130px] bg-slate-50 px-5 py-3 text-xs font-extrabold text-slate-500 xl:grid">
                  <span>진단 대상자</span>
                  <span>소속</span>
                  <span>직급</span>
                  <span>진단 기간</span>
                  <span>상태</span>
                  <span>진단하기</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {overviewAssignments.length ? (
                    overviewAssignments.map((assignment) => (
                      <div
                        key={assignment.feedbackId}
                        className="grid gap-3 px-5 py-4 text-sm xl:grid-cols-[minmax(220px,1.2fr)_minmax(140px,0.8fr)_120px_160px_120px_130px] xl:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Feedback360Avatar
                            person={{ name: assignment.receiverName, profileImageUrl: assignment.receiverProfileImageUrl }}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="truncate font-extrabold text-slate-950">{assignment.receiverName}</div>
                            <div className="truncate text-xs font-semibold text-slate-400">
                              {assignment.receiverEmail ?? getLeadershipRelationshipLabel(assignment.relationship)}
                            </div>
                          </div>
                        </div>
                        <div className="text-slate-700">{assignment.receiverDepartment}</div>
                        <div className="text-slate-700">{assignment.receiverPosition}</div>
                        <div className="text-slate-600">{assignment.roundName}</div>
                        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-extrabold ${getLeadershipStatusClassName(assignment.status)}`}>
                          {assignment.statusLabel}
                        </span>
                        <Link href={assignment.href} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-3 text-sm font-extrabold text-blue-700 transition hover:bg-blue-50">
                          {assignment.status === 'SUBMITTED' ? '결과 보기' : assignment.status === 'IN_PROGRESS' ? '진단 계속하기' : '진단하기'}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-5 px-5 py-10">
                      <div className="text-center">
                        <h3 className="text-lg font-extrabold text-slate-950">현재 배정된 리더십 진단이 없습니다.</h3>
                        <p className="mt-2 text-sm font-semibold text-slate-500">
                          진단 운영에서 진단 기간을 만들고 대상자 매핑을 완료하면 이 목록에 평가할 리더가 표시됩니다.
                        </p>
                        {props.data.permissions?.canViewAdmin ? (
                          <Link
                            href={`/evaluation/upward/admin?${updateSearch({})}`}
                            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-extrabold text-white"
                          >
                            리더십 진단 운영 열기
                          </Link>
                        ) : null}
                      </div>
                      <LeadershipDefaultQuestionPreview compact />
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {props.data.state === 'ready' && props.data.mode === 'respond' && respondData ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="grid flex-1 gap-3 lg:grid-cols-[120px_minmax(180px,1fr)_110px_120px] lg:items-center">
                    <div className="text-sm font-extrabold text-slate-800">진단 진행률</div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${responseProgress}%` }} />
                    </div>
                    <div className="text-sm font-extrabold text-blue-700">{formatPercent(responseProgress)} ({answeredQuestionCount}/{responseQuestionTotal})</div>
                    <div className="text-sm font-bold text-slate-500">총 문항 {respondData.questions.length}개</div>
                  </div>
                  {!respondReadOnly ? (
                    <div className="flex gap-2">
                      <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-extrabold text-blue-700" disabled={busyKey != null} onClick={handleSaveDraft}>
                        {busyKey === 'draft' ? '저장 중...' : '임시 저장'}
                      </button>
                      <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-extrabold text-white shadow-sm" disabled={busyKey != null} onClick={handleFinalSubmit}>
                        {busyKey === 'submit' ? '제출 중...' : '제출하기'}
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm font-extrabold ${
                        respondData.readOnlyReason === 'SUBMITTED'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      <span>{respondData.readOnlyMessage ?? '현재 응답을 수정할 수 없는 상태입니다.'}</span>
                      {respondData.readOnlyReason && respondData.readOnlyReason !== 'SUBMITTED' && props.data.permissions?.canViewAdmin ? (
                        <Link
                          href={`/evaluation/upward/admin?${updateSearch({ roundId: respondData.roundId })}`}
                          className="ml-3 inline-flex min-h-8 items-center justify-center rounded-lg bg-amber-600 px-3 text-xs font-extrabold text-white"
                        >
                          진단 운영에서 시작하기
                        </Link>
                      ) : null}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-semibold leading-6 text-blue-900">
                <div className="flex gap-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <p>
                    각 문항을 읽고, {respondData.receiverName} {respondData.receiverPosition}의 리더십 역량 수준에 가장 적합하다고 생각하는 번호를 선택해 주세요.
                    1점(매우 그렇지 않다) ~ 6점(매우 그렇다) 중 선택하실 수 있습니다.
                  </p>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-blue-950">문항 카테고리</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">카테고리를 선택하면 해당 문항 묶음으로 바로 이동합니다.</p>
                  </div>
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
                    {answeredQuestionCount}/{responseQuestionTotal} 응답 완료
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeResponseQuestionGroups.map(([category, questions]) => {
                    const answeredInCategory = questions.filter((question) =>
                      isLeadershipQuestionAnswered(question, questionState[question.id])
                    ).length
                    const active = openLeadershipCategory === category
                    return (
                      <button
                        key={category}
                        type="button"
                        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-extrabold transition ${
                          active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                        onClick={() => setOpenLeadershipCategory(category)}
                      >
                        <span>{category}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {answeredInCategory}/{questions.length}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-3">
                {activeResponseQuestionGroups.map(([category, questions], groupIndex) => {
                  const open = openLeadershipCategory === category
                  const sectionComment = sectionCommentState[category] ?? ''
                  return (
                    <div key={category} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                        onClick={() => setOpenLeadershipCategory(open ? '' : category)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-blue-700">
                            <ChevronRight className={`h-4 w-4 transition ${open ? 'rotate-90' : ''}`} />
                          </span>
                          <span className="text-lg font-extrabold text-slate-950">{groupIndex + 1}. {category}</span>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">{questions.length}문항</span>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-blue-900 transition ${open ? 'rotate-180' : ''}`} />
                      </button>

                      {open ? (
                        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            {questions.map((question) => {
                              const currentState = questionState[question.id] ?? { ratingValue: null, textValue: '', choiceValues: [] }
                              return (
                                <div key={question.id} className="rounded-xl border border-slate-200 bg-white p-4">
                                  <div className="text-sm font-extrabold text-slate-950">
                                    [{question.category || category}]
                                  </div>
                                  <p className="mt-2 min-h-10 text-sm font-semibold leading-6 text-slate-700">
                                    {question.questionText}
                                    {question.isRequired ? <span className="ml-1 text-rose-500">*</span> : null}
                                  </p>
                                  {question.questionType === 'RATING_SCALE' ? (
                                    <div className="mt-5">
                                      <div className="grid grid-cols-[100px_minmax(0,1fr)_86px] items-end gap-3">
                                        <span className="text-xs font-bold text-slate-500">{LEADERSHIP_SCALE_LABELS[getQuestionScaleValues(question)[0]] ?? '낮음'}</span>
                                        <div>
                                          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${getQuestionScaleValues(question).length}, minmax(0, 1fr))` }}>
                                            {getQuestionScaleValues(question).map((value) => (
                                              <label
                                                key={value}
                                                className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-transparent px-2 py-2 text-xs font-extrabold text-slate-600 transition hover:border-blue-100 hover:bg-blue-50"
                                              >
                                                <span>{value}</span>
                                                <input
                                                  type="radio"
                                                  name={question.id}
                                                  className="h-5 w-5 cursor-pointer accent-blue-600"
                                                  checked={currentState.ratingValue === value}
                                                  disabled={respondReadOnly}
                                                  onChange={() =>
                                                    setQuestionState((current) => {
                                                      const previous = current[question.id] ?? currentState
                                                      return {
                                                        ...current,
                                                        [question.id]: {
                                                          ...previous,
                                                          ratingValue: value,
                                                        },
                                                      }
                                                    })
                                                  }
                                                />
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                        <span className="text-right text-xs font-bold text-slate-500">{LEADERSHIP_SCALE_LABELS[getQuestionScaleValues(question).at(-1) ?? 6] ?? '높음'}</span>
                                      </div>
                                    </div>
                                  ) : null}
                                  {question.questionType === 'TEXT' ? (
                                    <textarea
                                      className="mt-4 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                                      value={currentState.textValue}
                                      onChange={(event) =>
                                        setQuestionState((current) => {
                                          const previous = current[question.id] ?? currentState
                                          return {
                                            ...current,
                                            [question.id]: {
                                              ...previous,
                                              textValue: event.target.value,
                                            },
                                          }
                                        })
                                      }
                                      disabled={respondReadOnly}
                                      placeholder="의견을 입력해 주세요."
                                    />
                                  ) : null}
                                  {question.questionType === 'MULTIPLE_CHOICE' ? (
                                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                      {question.choiceOptions.map((choice) => {
                                        const checked = currentState.choiceValues.includes(choice)
                                        return (
                                          <label key={choice} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              disabled={respondReadOnly}
                                              onChange={(event) =>
                                                setQuestionState((current) => {
                                                  const previous = current[question.id] ?? currentState
                                                  return {
                                                    ...current,
                                                    [question.id]: {
                                                      ...previous,
                                                      choiceValues: event.target.checked
                                                        ? Array.from(new Set([...previous.choiceValues, choice]))
                                                        : previous.choiceValues.filter((item) => item !== choice),
                                                    },
                                                  }
                                                })
                                              }
                                            />
                                            {choice}
                                          </label>
                                        )
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>

                          <label className="block text-sm font-extrabold text-slate-900">
                            {groupIndex + 1}. {category} 섹션에 대한 추가 의견이 있다면 작성해 주세요. (선택)
                            <textarea
                              className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                              value={sectionComment}
                              onChange={(event) =>
                                setSectionCommentState((current) => ({
                                  ...current,
                                  [category]: event.target.value,
                                }))
                              }
                              disabled={respondReadOnly}
                              placeholder="의견을 입력해 주세요."
                            />
                            <span className="mt-1 block text-right text-xs text-slate-400">{sectionComment.length}자</span>
                          </label>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col items-center text-center">
                  <Feedback360Avatar
                    person={{ name: respondData.receiverName, profileImageUrl: respondData.receiverProfileImageUrl }}
                    size="lg"
                  />
                  <div className="mt-3 text-base font-extrabold text-slate-950">{respondData.receiverName} {respondData.receiverPosition}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-500">{respondData.receiverDepartment}</div>
                  <button type="button" className="mt-4 min-h-10 rounded-lg border border-slate-200 px-5 text-sm font-extrabold text-slate-700">
                    프로필 보기
                  </button>
                </div>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-extrabold text-slate-950">제출 요약</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <SummaryLine label="전체 문항" value={`${responseQuestionTotal}개`} />
                  <SummaryLine label="응답 완료" value={`${answeredQuestionCount}개`} />
                  <SummaryLine label="미응답" value={`${Math.max(0, responseQuestionTotal - answeredQuestionCount)}개`} />
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${responseProgress}%` }} />
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                  임시 저장은 작성 중인 응답을 보관하고, 제출 후에는 읽기 전용으로 전환됩니다.
                </p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-extrabold text-slate-950">진단 안내</h3>
                <ul className="mt-4 list-disc space-y-3 pl-5 text-sm font-semibold leading-6 text-slate-600">
                  {respondData.guidance.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-extrabold text-slate-950">진단 척도 안내</h3>
                <div className="mt-3 space-y-2">
                  {Object.entries(LEADERSHIP_SCALE_LABELS).map(([value, label]) => (
                    <div key={value} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 text-sm font-semibold text-slate-600">
                      <span className="rounded bg-blue-50 text-center font-extrabold text-blue-700">{value}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        ) : null}

        {props.data.state === 'ready' && props.data.mode === 'results' && resultsData ? (
          <div className="space-y-5">
            <section className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-900">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                <div className="space-y-1">
                  <p>본 보고서는 다수의 평가자가 참여한 리더십 진단 결과를 기반으로 작성되었습니다.</p>
                  <p>리더십 진단은 리더의 운영 방식과 개선 방향을 이해하기 위한 참고 자료입니다. 공식 평가 점수나 등급을 자동 산정하지 않으며, 개별 평가자 정보는 공개되지 않습니다.</p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)_260px]">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-4">
                  <Feedback360Avatar
                    person={{ name: resultsData.targetEmployee.name, profileImageUrl: resultsData.targetEmployee.profileImageUrl }}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xl font-extrabold text-blue-950">{resultsData.targetEmployee.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {resultsData.targetEmployee.department} · {resultsData.targetEmployee.position}
                    </p>
                    <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                      공식 평가 점수/등급 미산정
                    </span>
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <SummaryLine label="진단 기간" value={selectedRound ? `${selectedRound.startDate} ~ ${selectedRound.endDate}` : resultsData.roundName} />
                  <SummaryLine label="참여 현황" value={`${resultsData.feedbackCount}명 참여`} />
                  <SummaryLine label="익명 기준" value={resultsData.thresholdMet ? '충족' : `${resultsData.minRaters}명 필요`} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-950">카테고리별 응답 요약</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">공식 점수가 아닌 리더십 행동 관찰 요약입니다.</p>
                  </div>
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
                    참고 평균 {leadershipResultAverage?.toFixed(2) ?? '-'}
                  </span>
                </div>
                <LeadershipRadarLikeChart questions={resultsData.questionSummaries} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
                <h3 className="text-left text-sm font-extrabold text-slate-950">참여/공개 상태</h3>
                <div className="mx-auto mt-8 flex h-32 w-32 items-center justify-center rounded-full border-[12px] border-emerald-500 text-2xl font-extrabold text-emerald-700">
                  {formatPercent(resultsData.thresholdMet ? 100 : leadershipResultSubmittedRate)}
                </div>
                <div className="mt-6 text-sm font-semibold text-slate-500">응답 참여</div>
                <div className="mt-1 text-lg font-extrabold text-slate-950">{resultsData.feedbackCount}명</div>
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-600">
                  {resultsData.visible ? '결과 열람 가능' : '익명 기준 확인 필요'}
                </div>
              </div>
            </section>

            {!resultsData.visible ? (
              <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <h3 className="text-lg font-extrabold text-slate-950">결과 비공개</h3>
                <p className="mt-2 text-sm font-semibold text-slate-500">{resultsData.hiddenReason}</p>
              </section>
            ) : (
              <>
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-extrabold text-slate-950">카테고리별 응답 분포</h3>
                    <div className="mt-5 space-y-4">
                      {leadershipResultCategories.slice(0, 8).map((question) => (
                        <div key={question.questionId} className="grid grid-cols-[140px_minmax(0,1fr)_54px] items-center gap-3 text-sm">
                          <span className="truncate font-bold text-slate-700">{question.category}</span>
                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, ((question.averageScore ?? 0) / 6) * 100)}%` }} />
                          </div>
                          <span className="text-right font-extrabold text-blue-700">{question.averageScore?.toFixed(2)}</span>
                        </div>
                      ))}
                      {!leadershipResultCategories.length ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-500">
                          표시할 카테고리 응답 데이터가 없습니다.
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-extrabold text-slate-950">강점 Top 3 / 보완 Top 3</h3>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                        <div className="mb-2 flex items-center gap-2 font-extrabold"><ThumbsUp className="h-4 w-4" />강점 Top 3</div>
                        {(leadershipStrengthTop3.length ? leadershipStrengthTop3 : ['리더십 강점 데이터가 충분히 쌓이면 표시됩니다.']).map((item) => (
                          <p key={item} className="mt-2">{item}</p>
                        ))}
                      </div>
                      <div className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                        <div className="mb-2 font-extrabold">보완 Top 3</div>
                        {(leadershipImprovementTop3.length ? leadershipImprovementTop3 : ['보완 영역 데이터가 충분히 쌓이면 표시됩니다.']).map((item) => (
                          <p key={item} className="mt-2">{item}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <LeadershipDiagnosisAiCoachingPanel
                  cycleId={props.data.selectedCycleId}
                  roundId={resultsData.roundId}
                  targetEmployeeId={resultsData.selectedTargetId}
                  providerConfigured={props.data.aiCoachingReadiness?.providerConfigured ?? false}
                  canUseAi={resultsData.visible || resultsData.canViewRaw}
                  disabledReason={props.data.aiCoachingReadiness?.disabledReason ?? null}
                  criteriaSatisfied={resultsData.thresholdMet}
                  anonymitySatisfied={resultsData.thresholdMet}
                  responseCount={resultsData.feedbackCount}
                  anonymityThreshold={resultsData.minRaters}
                  mode={props.data.permissions?.canViewAdmin ? 'HR' : props.data.permissions?.canViewRaw ? 'MANAGER' : 'SELF'}
                  showManagerGuide={Boolean(props.data.permissions?.canViewAdmin || props.data.permissions?.canViewRaw)}
                />

                <section className="grid gap-5 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-extrabold text-slate-950">리더십 행동 요약</h3>
                    <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-slate-600">
                      {(resultsData.rawResponses.flatMap((response) => response.overallComment ? [response.overallComment] : []).slice(0, 3).length
                        ? resultsData.rawResponses.flatMap((response) => response.overallComment ? [response.overallComment] : []).slice(0, 3)
                        : ['전반적으로 리더십 진단 의견이 집계되면 이 영역에 표시됩니다.']
                      ).map((comment, index) => (
                        <p key={`${index}:${comment}`} className="rounded-xl bg-slate-50 px-4 py-3">{comment}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-extrabold text-slate-950">다음 체크인 질문</h3>
                    <CoachingTextList items={leadershipCheckInQuestions} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-extrabold text-slate-950">성장 액션 / 후속 액션</h3>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {leadershipGrowthActions.map((action, index) => (
                      <div key={action} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-extrabold text-white">
                          {index + 1}
                        </span>
                        <p className="mt-3">{action}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        ) : null}
      </LeadershipPptShell>
    )
  }

  return (
    <div className="space-y-6">
      {ceoDemoMode ? <CeoDemoBanner /> : null}
      <CeoDemoToast message={demoToast} onClose={() => setDemoToast('')} />
      <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">리더십 진단</p>
            <h1 className="text-3xl font-semibold text-slate-950">
              {props.data.mode === 'admin'
                ? '리더십 진단 운영'
                : props.data.mode === 'results'
                  ? '리더십 진단 결과'
                  : '리더십 진단'}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {props.data.mode === 'admin'
                ? '문항 세트, 진단 기간, 평가자-진단 대상자 매핑, 익명 기준, 공개 정책까지 한 흐름으로 운영합니다.'
                : props.data.mode === 'results'
                  ? '집계 결과와 공개 가능 여부를 확인하고, 관리자 권한에 따라 원문 응답 열람 여부가 달라집니다.'
                  : '배정된 리더별로 임시 저장과 제출을 진행할 수 있습니다.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionLink
              href={`/evaluation/upward/respond?${updateSearch({ roundId: undefined, empId: undefined })}`}
              label="내 리더십 진단"
              active={false}
            />
            {props.data.permissions?.canViewAdmin ? (
              <ActionLink
                href={`/evaluation/upward/admin?${updateSearch({})}`}
                label="리더십 진단 운영"
                active={props.data.mode === 'admin'}
              />
            ) : null}
          </div>
        </div>
      </section>

      {notice ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      {props.data.state !== 'ready' ? (
        <SectionCard title="상태 안내" description={props.data.message}>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="진행 중 진단 기간" value={`${props.data.summary.activeRounds}개`} />
            <StatCard label="미제출 응답" value={`${props.data.summary.pendingAssignments}건`} />
            <StatCard label="제출 완료 응답" value={`${props.data.summary.submittedAssignments}건`} />
            <StatCard label="공개 가능 대상자" value={`${props.data.summary.releasedTargets}명`} />
          </div>
        </SectionCard>
      ) : null}

      {props.data.mode === 'admin' && adminData ? (
        <div className="space-y-6">
          <LeadershipDiagnosisOpsDashboard data={props.data} admin={adminData} />
          <section className="grid gap-4 md:grid-cols-4">
            {adminData.selectedRound?.summaryCards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} />
            ))}
          </section>
          <SectionCard title="문항 세트" description="기본 리더십 진단 문항 24개로 시작하고, 우리 조직 문항으로 직접 수정할 수 있습니다.">
            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                <button
                  type="button"
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-extrabold transition ${
                    selectedTemplateId === NEW_TEMPLATE_ID
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={handleStartNewTemplate}
                >
                  새 문항 세트
                </button>
                <div className="space-y-2">
                  {adminData.templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedTemplateId === template.id
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold">{template.name}</div>
                      <div className={`mt-1 text-xs ${selectedTemplateId === template.id ? 'text-slate-200' : 'text-slate-500'}`}>
                        문항 {template.questionCount}개 · 익명 기준 {template.defaultMinResponses}명
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input className={inputClassName} value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="문항 세트 이름" />
                  <input className={inputClassName} type="number" min={1} max={10} value={templateDraft.defaultMinResponses} onChange={(event) => setTemplateDraft((current) => ({ ...current, defaultMinResponses: Number(event.target.value) }))} placeholder="익명 기준" />
                </div>
                <textarea className={textareaClassName} value={templateDraft.description} onChange={(event) => setTemplateDraft((current) => ({ ...current, description: event.target.value }))} placeholder="문항 세트 설명" />
                {selectedTemplateId === NEW_TEMPLATE_ID ? (
                  <LeadershipDefaultQuestionSummary />
                ) : selectedTemplate && selectedTemplate.questions.length === 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-extrabold text-amber-900">이 문항 세트는 아직 0문항입니다.</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
                      기존에 만들어진 빈 문항 세트라면 기본 24문항을 바로 채울 수 있습니다. 이후 문항 직접 관리에서 수정하거나 삭제하세요.
                    </p>
                    <button
                      type="button"
                      className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-extrabold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-200"
                      disabled={busyKey != null}
                      onClick={handleSeedDefaultQuestions}
                    >
                      {busyKey === 'seedDefaultQuestions' ? '추가 중...' : '기본 24문항 채우기'}
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {['TEAM_LEADER', 'SECTION_CHIEF', 'DIVISION_HEAD', 'PM', 'CUSTOM'].map((type) => {
                    const active = templateDraft.defaultTargetTypes.includes(type)
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`rounded-2xl border px-4 py-2 text-sm font-medium ${
                          active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'
                        }`}
                        onClick={() =>
                          setTemplateDraft((current) => ({
                            ...current,
                            defaultTargetTypes: active
                              ? current.defaultTargetTypes.filter((item) => item !== type)
                              : [...current.defaultTargetTypes, type],
                          }))
                        }
                      >
                        {TARGET_TYPE_LABELS[type]}
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={primaryButtonClassName} disabled={busyKey != null} onClick={handleSaveTemplate}>
                    {busyKey === 'createTemplate' || busyKey === 'updateTemplate'
                      ? '저장 중...'
                      : selectedTemplateId === NEW_TEMPLATE_ID
                        ? '기본 24문항으로 문항 세트 생성'
                        : '문항 세트 저장'}
                  </button>
                  <button type="button" className={secondaryButtonClassName} disabled={!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID || busyKey != null} onClick={handleDuplicateTemplate}>
                    문항 세트 복사
                  </button>
                  <button type="button" className={secondaryButtonClassName} disabled={!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID || busyKey != null} onClick={handleDeleteTemplate}>
                    문항 세트 삭제
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="문항 직접 관리" description="질문 추가, 수정, 삭제, 순서 변경, 활성/비활성을 직접 관리합니다.">
            {selectedTemplateId === NEW_TEMPLATE_ID ? (
              <div className="space-y-5 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-6">
                <div>
                  <h4 className="text-lg font-extrabold text-blue-950">먼저 문항 세트를 생성하세요.</h4>
                  <p className="mt-2 text-sm font-semibold leading-6 text-blue-900">
                    새 문항 세트는 아직 저장 전 상태입니다. 아래 버튼으로 생성하면 기본 24문항이 자동으로 들어가고, 그 다음 이 영역에서 직접 수정할 수 있습니다.
                  </p>
                </div>
                <LeadershipDefaultQuestionSummary />
                <button type="button" className={primaryButtonClassName} disabled={busyKey != null} onClick={handleSaveTemplate}>
                  {busyKey === 'createTemplate' ? '생성 중...' : '기본 24문항으로 문항 세트 생성'}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedTemplate && selectedTemplate.questions.length === 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <h4 className="text-base font-extrabold text-amber-950">선택한 문항 세트가 비어 있습니다.</h4>
                    <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
                      기본 24문항을 채워 시작하거나, 아래 큰 입력 영역에서 직접 문항을 하나씩 추가할 수 있습니다.
                    </p>
                    <button
                      type="button"
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-600 px-5 text-sm font-extrabold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-200"
                      disabled={busyKey != null}
                      onClick={handleSeedDefaultQuestions}
                    >
                      {busyKey === 'seedDefaultQuestions' ? '추가 중...' : '기본 24문항 채우기'}
                    </button>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h4 className="text-lg font-extrabold text-slate-950">{questionDraft.questionId ? '문항 수정' : '문항 추가'}</h4>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        문항 내용과 척도를 한 화면에서 넓게 입력합니다. 저장 후 아래 문항 목록에서 순서를 조정할 수 있습니다.
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-extrabold text-blue-700">직접 입력</span>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <label className="space-y-2">
                      <span className="text-sm font-extrabold text-slate-700">카테고리</span>
                      <input className={inputClassName} value={questionDraft.category} onChange={(event) => setQuestionDraft((current) => ({ ...current, category: event.target.value }))} placeholder="예: 바른생각 (커뮤니케이션)" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-extrabold text-slate-700">문항 내용</span>
                      <input className={inputClassName} value={questionDraft.questionText} onChange={(event) => setQuestionDraft((current) => ({ ...current, questionText: event.target.value }))} placeholder="예: 나의 리더는 목표와 요구사항을 명확하게 설명한다." />
                    </label>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-extrabold text-slate-700">문항 설명/가이드</span>
                    <textarea className={`${textareaClassName} min-h-[96px]`} value={questionDraft.description} onChange={(event) => setQuestionDraft((current) => ({ ...current, description: event.target.value }))} placeholder="응답자가 문항을 이해하는 데 필요한 설명을 입력해 주세요." />
                  </label>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[260px_180px_180px_minmax(260px,1fr)]">
                    <label className="space-y-2">
                      <span className="text-sm font-extrabold text-slate-700">응답 방식</span>
                      <select className={inputClassName} value={questionDraft.questionType} onChange={(event) => setQuestionDraft((current) => ({ ...current, questionType: event.target.value as typeof current.questionType }))}>
                        <option value="RATING_SCALE">6점 척도형</option>
                        <option value="TEXT">서술형</option>
                        <option value="MULTIPLE_CHOICE">선택형</option>
                      </select>
                    </label>
                    {questionDraft.questionType === 'RATING_SCALE' ? (
                      <>
                        <label className="space-y-2">
                          <span className="text-sm font-extrabold text-slate-700">최소 점수</span>
                          <input className={inputClassName} type="number" min={1} max={5} value={questionDraft.scaleMin} onChange={(event) => setQuestionDraft((current) => ({ ...current, scaleMin: Number(event.target.value) }))} placeholder="1" />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-extrabold text-slate-700">최대 점수</span>
                          <input className={inputClassName} type="number" min={1} max={10} value={questionDraft.scaleMax} onChange={(event) => setQuestionDraft((current) => ({ ...current, scaleMax: Number(event.target.value) }))} placeholder="6" />
                        </label>
                      </>
                    ) : (
                      <div className="hidden lg:block" />
                    )}
                    <div className="flex flex-wrap items-end gap-4 pb-2 text-sm font-semibold text-slate-600">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={questionDraft.isRequired} onChange={(event) => setQuestionDraft((current) => ({ ...current, isRequired: event.target.checked }))} />
                        필수 문항
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={questionDraft.isActive} onChange={(event) => setQuestionDraft((current) => ({ ...current, isActive: event.target.checked }))} />
                        활성 상태
                      </label>
                    </div>
                  </div>

                  {questionDraft.questionType === 'MULTIPLE_CHOICE' ? (
                    <label className="mt-4 block space-y-2">
                      <span className="text-sm font-extrabold text-slate-700">선택지</span>
                      <textarea className={textareaClassName} value={questionDraft.choiceOptionsText} onChange={(event) => setQuestionDraft((current) => ({ ...current, choiceOptionsText: event.target.value }))} placeholder={'선택지를 한 줄에 하나씩 입력해 주세요.'} />
                    </label>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" className={primaryButtonClassName} disabled={!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID || busyKey != null} onClick={handleSaveQuestion}>
                      {busyKey === 'saveQuestion' ? '저장 중...' : questionDraft.questionId ? '문항 저장' : '문항 추가'}
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() =>
                        setQuestionDraft({
                          templateId: selectedTemplateId,
                          questionId: '',
                          category: '리더십',
                          questionText: '',
                          description: '',
                          questionType: 'RATING_SCALE',
                          scaleMin: 1,
                          scaleMax: 6,
                          isRequired: true,
                          isActive: true,
                          choiceOptionsText: '',
                        })
                      }
                    >
                      입력 초기화
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h4 className="text-lg font-extrabold text-slate-950">등록된 문항</h4>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {selectedTemplate?.questions.length ?? 0}개 문항이 이 문항 세트에 등록되어 있습니다.
                      </p>
                    </div>
                  </div>

                  {selectedTemplate?.questions.length ? (
                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      {selectedTemplate.questions.map((question, index) => (
                        <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 space-y-1">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                {question.category || '리더십'} · {question.questionType}
                              </div>
                              <div className="text-base font-semibold leading-6 text-slate-900">{question.questionText}</div>
                              {question.description ? <p className="text-sm leading-6 text-slate-500">{question.description}</p> : null}
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                onClick={() =>
                                  setQuestionDraft({
                                    templateId: selectedTemplate.id,
                                    questionId: question.id,
                                    category: question.category || '',
                                    questionText: question.questionText,
                                    description: question.description ?? '',
                                    questionType: question.questionType,
                                    scaleMin: question.scaleMin ?? 1,
                                    scaleMax: question.scaleMax ?? 6,
                                    isRequired: question.isRequired,
                                    isActive: question.isActive,
                                    choiceOptionsText: question.choiceOptions.join('\n'),
                                  })
                                }
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                disabled={busyKey != null}
                                onClick={async () => {
                                  const result = await runAdminAction('moveQuestion', {
                                    templateId: selectedTemplate.id,
                                    questionId: question.id,
                                    direction: 'up',
                                  })
                                  if (!result) return
                                  startTransition(() => router.refresh())
                                }}
                              >
                                위로
                              </button>
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                disabled={busyKey != null}
                                onClick={async () => {
                                  const result = await runAdminAction('moveQuestion', {
                                    templateId: selectedTemplate.id,
                                    questionId: question.id,
                                    direction: 'down',
                                  })
                                  if (!result) return
                                  startTransition(() => router.refresh())
                                }}
                              >
                                아래로
                              </button>
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                disabled={busyKey != null}
                                onClick={async () => {
                                  const result = await runAdminAction('deleteQuestion', { questionId: question.id })
                                  if (!result) return
                                  startTransition(() => router.refresh())
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-slate-100 px-2 py-1">{question.isRequired ? '필수' : '선택'}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1">{question.isActive ? '활성' : '비활성'}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1">순서 {index + 1}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm font-semibold text-slate-500">
                      아직 등록된 문항이 없습니다. 기본 24문항을 채우거나 위 입력 영역에서 직접 문항을 추가해 주세요.
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="진단 기간 설정" description="평가 주기, 응답 기간, 익명 기준, 공개 정책과 문항 세트 연결을 관리합니다.">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <select
                className={inputClassName}
                value={roundDraft.evalCycleId}
                onChange={(event) => {
                  const cycleName = props.data.availableCycles.find((cycle) => cycle.id === event.target.value)?.name
                  setRoundDraft((current) => ({
                    ...current,
                    evalCycleId: event.target.value,
                    roundName: current.roundId ? current.roundName : buildLeadershipPeriodName(cycleName),
                  }))
                }}
              >
                {props.data.availableCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </option>
                ))}
              </select>
              {props.data.availableRounds.length ? (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <select
                    className={inputClassName}
                    value={props.data.selectedRoundId ?? ''}
                    aria-label="기존 진단 기간 불러오기"
                    onChange={(event) => router.push(`/evaluation/upward/admin?${updateSearch({ roundId: event.target.value || undefined })}`)}
                  >
                    <option value="">새 진단 기간 작성</option>
                    {props.data.availableRounds.map((round) => (
                      <option key={round.id} value={round.id}>
                        {round.startDate} ~ {round.endDate} · {round.statusLabel} · 배정 {round.assignmentCount}건
                      </option>
                    ))}
                  </select>
                  <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={handleStartNewRound}>
                    새로 작성
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-extrabold text-blue-950">새 진단 기간 생성</p>
                  <p className="mt-1 text-sm font-semibold text-blue-800">
                    저장된 진단 기간이 없습니다. 아래 항목을 입력하면 바로 첫 진단 기간을 만들 수 있습니다.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-xs font-extrabold text-slate-500">문항 세트</span>
                <select className={inputClassName} value={roundDraft.templateId || selectedTemplateId} onChange={(event) => setRoundDraft((current) => ({ ...current, templateId: event.target.value }))}>
                  <option value="">문항 세트 선택</option>
                  {adminData.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-xs font-extrabold text-slate-500">익명 기준</span>
                <select className={inputClassName} value={roundDraft.minRaters} onChange={(event) => setRoundDraft((current) => ({ ...current, minRaters: Number(event.target.value) }))}>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count}명 이상 응답 시 결과 공개
                    </option>
                  ))}
                </select>
                <span className="block text-xs font-semibold text-slate-500">
                  진단 대상자별 응답자가 이 기준보다 적으면 결과를 공개하지 않습니다.
                </span>
              </label>
              <label className="space-y-2">
                <span className="block text-xs font-extrabold text-slate-500">응답 시작일</span>
                <input className={inputClassName} type="datetime-local" value={roundDraft.startDate} onChange={(event) => setRoundDraft((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="block text-xs font-extrabold text-slate-500">응답 종료일</span>
                <input className={inputClassName} type="datetime-local" value={roundDraft.endDate} onChange={(event) => setRoundDraft((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="block text-xs font-extrabold text-slate-500">결과 공개 대상</span>
                <select className={inputClassName} value={roundDraft.resultViewerMode} onChange={(event) => setRoundDraft((current) => ({ ...current, resultViewerMode: event.target.value as typeof current.resultViewerMode }))}>
                  <option value="TARGET_ONLY">진단 대상자만 결과 확인</option>
                  <option value="TARGET_AND_PRIMARY_MANAGER">진단 대상자와 1차 리더가 결과 확인</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-xs font-extrabold text-slate-500">원문 응답 열람 권한</span>
                <select className={inputClassName} value={roundDraft.rawResponsePolicy} onChange={(event) => setRoundDraft((current) => ({ ...current, rawResponsePolicy: event.target.value as typeof current.rawResponsePolicy }))}>
                  <option value="ADMIN_ONLY">관리자만 원문 응답 열람</option>
                  <option value="REVIEW_ADMIN_CONTENT">콘텐츠 열람 권한 운영자도 열람</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['TEAM_LEADER', 'SECTION_CHIEF', 'DIVISION_HEAD', 'PM', 'CUSTOM'].map((type) => {
                const active = roundDraft.targetTypes.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    className={`rounded-2xl border px-4 py-2 text-sm font-medium ${
                      active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'
                    }`}
                    onClick={() =>
                      setRoundDraft((current) => ({
                        ...current,
                        targetTypes: active
                          ? current.targetTypes.filter((item) => item !== type)
                          : [...current.targetTypes, type],
                      }))
                    }
                  >
                    {TARGET_TYPE_LABELS[type]}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className={primaryButtonClassName} disabled={busyKey != null || !roundDraft.startDate || !roundDraft.endDate} onClick={handleRoundSave}>
                {busyKey === 'saveRound' ? '저장 중...' : roundDraft.roundId ? '진단 기간 저장' : '진단 기간 생성'}
              </button>
              {adminData.selectedRound ? (
                <>
                  <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={async () => { const result = await runAdminAction('syncRoundQuestions', { roundId: adminData.selectedRound?.id }); if (!result) return; startTransition(() => router.refresh()) }}>
                    문항 세트 다시 적용
                  </button>
                  <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={async () => { const result = await runAdminAction('updateRoundStatus', { roundId: adminData.selectedRound?.id, action: adminData.selectedRound?.status === 'IN_PROGRESS' ? 'CLOSE' : 'START' }); if (!result) return; startTransition(() => router.refresh()) }}>
                    {adminData.selectedRound.status === 'IN_PROGRESS' ? '진단 기간 마감' : '진단 기간 시작'}
                  </button>
                  <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={async () => { const result = await runAdminAction('setRelease', { roundId: adminData.selectedRound?.id, released: !adminData.selectedRound?.released }); if (!result) return; startTransition(() => router.refresh()) }}>
                    {adminData.selectedRound.released ? '결과 비공개 전환' : '결과 공개'}
                  </button>
                  <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={handleSendLeadershipReminder}>
                    <Mail className="mr-2 h-4 w-4" />
                    {busyKey === 'sendLeadershipReminder' ? '메일 예약 중...' : '미제출자 메일 발송'}
                  </button>
                </>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="대상자 매핑" description="평가자와 진단 대상자를 직접 연결하고, 조직도 기준 추천 매핑을 한 번에 생성합니다.">
            <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h4 className="text-base font-extrabold text-blue-950">조직도 추천 매핑</h4>
                  <p className="mt-2 text-sm font-semibold leading-6 text-blue-900">
                    조직도 추천은 현재 직원 조직도에서 팀원은 팀장/PM, 팀장은 실장 또는 본부장, 실장은 본부장으로 평가 관계를 자동 연결합니다.
                    이미 추가된 매핑은 제외됩니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-extrabold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-200"
                    disabled={!adminData.selectedRound || visibleSuggestions.length === 0 || busyKey != null}
                    onClick={() => handleAddSuggestedAssignments(suggestionTargetId)}
                  >
                    {busyKey === 'addSuggestedAssignments'
                      ? '추천 추가 중...'
                      : suggestionTargetId
                        ? '선택 대상 추천 추가'
                        : '전체 추천 매핑 추가'}
                  </button>
                  <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 text-sm font-extrabold text-blue-700">
                    추천 가능 {visibleSuggestions.length}건
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[minmax(240px,1fr)_220px]">
                  <input className={inputClassName} value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)} placeholder="대상자/평가자 검색" />
                  <select className={inputClassName} value={assignmentStatusFilter} onChange={(event) => setAssignmentStatusFilter(event.target.value as typeof assignmentStatusFilter)}>
                    <option value="ALL">전체 상태</option>
                    <option value="PENDING">예정</option>
                    <option value="IN_PROGRESS">진행중</option>
                    <option value="SUBMITTED">제출완료</option>
                  </select>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="grid grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_150px_110px] gap-3 bg-slate-50 px-4 py-3 text-xs font-extrabold text-slate-500">
                    <span>진단 대상자</span>
                    <span>평가자</span>
                    <span>관계</span>
                    <span>관리</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {filteredAssignments.length ? (
                      filteredAssignments.map((assignment) => (
                        <div key={assignment.id} className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_150px_110px] lg:items-center">
                          <div className="min-w-0">
                            <div className="truncate font-extrabold text-slate-950">{assignment.evaluateeName}</div>
                            <div className="truncate text-xs font-semibold text-slate-500">{assignment.evaluateeDepartment}</div>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-800">{assignment.evaluatorName}</div>
                            <div className="truncate text-xs font-semibold text-slate-500">{assignment.evaluatorDepartment}</div>
                            {assignment.submittedAt ? <div className="mt-1 text-xs text-slate-500">제출 {assignment.submittedAt}</div> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700">{getLeadershipRelationshipLabel(assignment.relationship)}</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{assignment.statusLabel}</span>
                          </div>
                          <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={async () => { const result = await runAdminAction('removeAssignment', { assignmentId: assignment.id }); if (!result) return; startTransition(() => router.refresh()) }}>
                            삭제
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                        아직 등록된 매핑이 없습니다. 조직도 추천 매핑을 추가하거나 수동으로 평가자와 진단 대상자를 연결해 주세요.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h4 className="text-base font-extrabold text-slate-950">추천 미리보기</h4>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    전체 추천을 먼저 확인하거나, 추천 대상 리더를 선택해 해당 리더에게 들어갈 평가자만 좁혀 볼 수 있습니다.
                  </p>
                  <select className={`${inputClassName} mt-4`} value={suggestionTargetId} onChange={(event) => setSuggestionTargetId(event.target.value)}>
                    <option value="">전체 추천 보기 · {adminData.suggestions.length}건</option>
                    {suggestionTargetOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} · 추천 {option.count}건 · {Array.from(option.relationships).join(', ')}
                      </option>
                    ))}
                  </select>
                  <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                    {visibleSuggestions.length ? (
                      visibleSuggestions.slice(0, 12).map((suggestion) => (
                        <div key={`${suggestion.evaluatorId}:${suggestion.evaluateeId}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          <div className="font-extrabold text-slate-950">
                            {suggestion.evaluateeName} ← {suggestion.evaluatorName}
                          </div>
                          <div className="mt-1 text-xs font-bold text-blue-700">{getLeadershipRelationshipLabel(suggestion.relationship)}</div>
                          <div className="mt-1 leading-6">{suggestion.reason}</div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm font-semibold text-slate-500">
                        추천할 매핑이 없습니다. 이미 매핑이 추가되었거나 조직도상 팀장/PM/실장/본부장 연결 정보가 비어 있을 수 있습니다.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <h4 className="text-base font-extrabold text-slate-950">수동 매핑 추가</h4>
                <select className={inputClassName} value={assignmentDraft.evaluateeId} onChange={(event) => setAssignmentDraft((current) => ({ ...current, evaluateeId: event.target.value }))}>
                  <option value="">진단 대상자 선택</option>
                  {employeeDirectory.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.empName} · {employee.deptName} · {employee.position}
                    </option>
                  ))}
                </select>
                <select className={inputClassName} value={assignmentDraft.evaluatorId} onChange={(event) => setAssignmentDraft((current) => ({ ...current, evaluatorId: event.target.value }))}>
                  <option value="">평가자 선택</option>
                  {employeeDirectory.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.empName} · {employee.deptName} · {employee.position}
                    </option>
                  ))}
                </select>
                <select className={inputClassName} value={assignmentDraft.relationship} onChange={(event) => setAssignmentDraft((current) => ({ ...current, relationship: event.target.value as typeof current.relationship }))}>
                  <option value="SUBORDINATE">리더십 진단</option>
                  <option value="PEER">동료 리더 진단</option>
                  <option value="CROSS_DEPT">교차 조직 진단</option>
                </select>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    disabled={!adminData.selectedRound || !assignmentDraft.evaluateeId || !assignmentDraft.evaluatorId || busyKey != null}
                    onClick={async () => {
                      if (!adminData.selectedRound) return
                      const result = await runAdminAction('addAssignment', {
                        roundId: adminData.selectedRound.id,
                        evaluatorId: assignmentDraft.evaluatorId,
                        evaluateeId: assignmentDraft.evaluateeId,
                        relationship: assignmentDraft.relationship,
                      })
                      if (!result) return
                      startTransition(() => router.refresh())
                    }}
                  >
                    수동 매핑 추가
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={!adminData.selectedRound || !assignmentDraft.evaluateeId || busyKey != null}
                    onClick={() => handleAddSuggestedAssignments(assignmentDraft.evaluateeId)}
                  >
                    이 대상자 추천 추가
                  </button>
                </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  )
}
