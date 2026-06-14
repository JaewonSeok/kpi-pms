'use client'

import { useMemo, useState } from 'react'
import { calculateOrganizationPerformanceFromIntake2026 } from '@/lib/preview-2026-organization-score'
import { calculateAbsoluteGrade2026 } from '@/server/evaluation-grade-2026'
import { EVALUATION_POLICY_2026 } from '@/lib/evaluation-policy-2026'
import type { EvaluationPolicyGradeCode, ScoreBand } from '@/lib/evaluation-policy-2026'
import type { Preview2026Persona } from '@/lib/preview-2026-personas'
import type { Preview2026GradePageViewModel } from '@/server/preview-2026-grade-page'

type Props = {
  viewModel: Preview2026GradePageViewModel
  personas: readonly Preview2026Persona[]
}

type PersonaScoreState = {
  teamScore?: number
  parentScore: number
  personalScore: number
}

const GRADE_BADGE_CLASS: Record<EvaluationPolicyGradeCode, string> = {
  SUPER: 'bg-blue-100 text-blue-800 border-blue-300',
  OUTSTANDING: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  EXCELLENT: 'bg-amber-100 text-amber-800 border-amber-300',
  GOOD: 'bg-orange-100 text-orange-800 border-orange-300',
  NEED_IMPROVEMENT: 'bg-red-100 text-red-800 border-red-300',
  UNSATISFACTORY: 'bg-gray-200 text-gray-800 border-gray-300',
}

function formatWeightPct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function formatScoreBand(
  band: { minInclusive?: number; maxExclusive?: number } | undefined
): string {
  if (!band) return '—'
  const min = band.minInclusive
  const max = band.maxExclusive
  if (typeof min === 'number' && typeof max === 'number') return `[${min}, ${max})`
  if (typeof min === 'number') return `≥${min}`
  if (typeof max === 'number') return `<${max}`
  return '—'
}

export function Preview2026GradeAdminClient({ viewModel, personas }: Props) {
  const [scoreStates, setScoreStates] = useState<PersonaScoreState[]>(() =>
    personas.map((p) => ({ ...p.initial }))
  )

  const updateScore = (
    index: number,
    key: keyof PersonaScoreState,
    value: number
  ) => {
    setScoreStates((prev) =>
      prev.map((state, i) => (i === index ? { ...state, [key]: value } : state))
    )
  }

  const resetPersona = (index: number) => {
    setScoreStates((prev) =>
      prev.map((state, i) => (i === index ? { ...personas[i].initial } : state))
    )
  }

  const computed = useMemo(
    () =>
      personas.map((persona, idx) => {
        const state = scoreStates[idx]
        const previewScore = calculateOrganizationPerformanceFromIntake2026({
          roleGroup: persona.roleGroup,
          teamScore: state.teamScore,
          parentScore: state.parentScore,
          personalScore: state.personalScore,
          parentLevel: persona.parentLevel,
          weights: viewModel.weights,
        })
        const grade = calculateAbsoluteGrade2026({
          score: previewScore.finalScore,
          thresholdGroup: persona.thresholdGroup,
        })
        return { previewScore, grade }
      }),
    [scoreStates, personas, viewModel.weights]
  )

  const cycleHeader =
    viewModel.cycleName === null
      ? '활성 사이클 없음 — DEFAULT 가중치'
      : `${viewModel.cycleName} · ${viewModel.cycleStatus ?? '—'}`

  const weights = viewModel.weights

  return (
    <div className="space-y-5">
      {/* sticky 노란 배지 */}
      <div className="sticky top-0 z-10 -mx-4 border-y border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900 shadow-sm sm:-mx-6 sm:px-6">
        미리보기 전용 · 저장되지 않음 · DB 변경 없음
      </div>

      {/* 헤더 — 뷰모델 동적 표시 */}
      <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-6 sm:py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">
          2026 평가 미리보기
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          점수·등급 자동산정
        </h1>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm leading-6 text-slate-700 sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="font-semibold text-slate-500">회사</dt>
            <dd>{viewModel.companyName ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-slate-500">사이클</dt>
            <dd>{cycleHeader}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-slate-500">가중치(withSection)</dt>
            <dd>
              본부 {formatWeightPct(weights.withSection.division)} · 실{' '}
              {formatWeightPct(weights.withSection.section)} · 팀{' '}
              {formatWeightPct(weights.withSection.team)} · 개인{' '}
              {formatWeightPct(weights.personal)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-slate-500">가중치(withoutSection)</dt>
            <dd>
              본부 {formatWeightPct(weights.withoutSection.division)} · 팀{' '}
              {formatWeightPct(weights.withoutSection.team)} · 개인{' '}
              {formatWeightPct(weights.personal)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-slate-500">본부장 특례</dt>
            <dd>본부 30% · 개인 70% (코드 상수 · 정책 schema 미반영 [확인 필요])</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-slate-500">가중치 출처</dt>
            <dd>
              <span
                className={
                  viewModel.preloadSource === 'stored'
                    ? 'rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800'
                    : 'rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700'
                }
              >
                {viewModel.preloadSource === 'stored' ? 'STORED (사이클 저장값)' : 'DEFAULT'}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* 페르소나 카드 5장 */}
      <section className="grid gap-3 md:grid-cols-2">
        {personas.map((persona, idx) => {
          const state = scoreStates[idx]
          const { previewScore, grade } = computed[idx]
          const isDivisionHead = persona.roleGroup === 'DIVISION_HEAD'

          const gradeOk = grade.ok
          const finalGradeCode = gradeOk ? grade.value.finalGrade.code : null
          const finalGradeLabel = gradeOk ? grade.value.finalGrade.label : null
          const bandText = gradeOk ? formatScoreBand(grade.value.finalGrade.band) : null

          const isAmbiguous =
            !gradeOk && grade.errors.some((e) => e.code === 'AMBIGUOUS_THRESHOLD_MATCH')

          return (
            <div
              key={persona.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {persona.thresholdGroup} · {persona.salesGroup}
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{persona.label}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => resetPersona(idx)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  원래대로
                </button>
              </div>

              {/* 입력 컨트롤 */}
              <div className="mt-3 space-y-2 text-sm">
                {!isDivisionHead && persona.range.teamMax !== undefined && (
                  <ScoreRow
                    label="팀 점수"
                    value={state.teamScore ?? 0}
                    min={0}
                    max={persona.range.teamMax}
                    onChange={(v) => updateScore(idx, 'teamScore', v)}
                  />
                )}
                <ScoreRow
                  label={`${persona.parentLabel} 점수`}
                  value={state.parentScore}
                  min={0}
                  max={persona.range.parentMax}
                  onChange={(v) => updateScore(idx, 'parentScore', v)}
                />
                <ScoreRow
                  label="개인 점수"
                  value={state.personalScore}
                  min={0}
                  max={persona.range.personalMax}
                  onChange={(v) => updateScore(idx, 'personalScore', v)}
                />
              </div>

              {/* 산식 풀이 */}
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {isDivisionHead ? (
                  <div>
                    산식: {state.parentScore} × 30% + {state.personalScore} × 70% ={' '}
                    {previewScore.breakdown.divisionScoreWeighted} +{' '}
                    {previewScore.breakdown.personalScoreWeighted}
                  </div>
                ) : (
                  <div>
                    산식: {state.teamScore ?? 0} ×{' '}
                    {formatWeightPct(previewScore.breakdown.appliedWeights.team ?? 0)} +{' '}
                    {state.parentScore} ×{' '}
                    {formatWeightPct(previewScore.breakdown.appliedWeights.parent ?? 0)} +{' '}
                    {state.personalScore} ×{' '}
                    {formatWeightPct(previewScore.breakdown.appliedWeights.personal)} ={' '}
                    {previewScore.breakdown.teamScoreWeighted} +{' '}
                    {previewScore.breakdown.parentScoreWeighted} +{' '}
                    {previewScore.breakdown.personalScoreWeighted}
                  </div>
                )}
              </div>

              {/* 최종 점수 + 등급 */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">최종 점수</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {previewScore.finalScore.toFixed(1)}
                  </div>
                </div>
                <div className="flex-1 text-right">
                  {isAmbiguous ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      정책 담당자 확정 대기 (SUPER / OUTSTANDING 임계 중첩)
                    </div>
                  ) : finalGradeCode ? (
                    <>
                      <span
                        className={`inline-block rounded-full border px-3 py-1 text-sm font-bold ${GRADE_BADGE_CLASS[finalGradeCode]}`}
                      >
                        {finalGradeLabel} ({finalGradeCode})
                      </span>
                      <div className="mt-1 text-[11px] text-slate-500">근거: {bandText}</div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500">등급 산정 불가</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* 정책 안내 패널 */}
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">정책 안내</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
          <li>최종 점수 산식: 조직 30% + 개인 70% (finalScoreFormula)</li>
          <li>
            팀원/팀장: 팀 × 20% + 직속상위(실 또는 본부) × 10% + 개인 × 70%
          </li>
          <li>
            본부장 데모 특례: 본부 × 30% + 개인 × 70% (팀·실 없음 — 정책 schema 미반영{' '}
            <span className="font-semibold text-amber-700">[확인 필요]</span>)
          </li>
          <li>
            dormant 안내: 본 화면의 점수·등급은 라이브 공식 점수가 아닙니다.
            `finalScoreFormula.active = false` (cutover 이전).
          </li>
        </ul>

        {/* 임계 그룹 5종 표 */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-2 py-2 text-left">그룹</th>
                <th className="px-2 py-2 text-left">라벨</th>
                {EVALUATION_POLICY_2026.grades.map((g) => (
                  <th key={g.code} className="px-2 py-2 text-left">
                    {g.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVALUATION_POLICY_2026.gradeThresholdGroups.map((policy) => (
                <tr key={policy.group} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-mono text-[10px] text-slate-500">
                    {policy.group}
                  </td>
                  <td className="px-2 py-2 text-slate-700">{policy.label}</td>
                  {EVALUATION_POLICY_2026.grades.map((g) => {
                    const band = policy.thresholds[g.code] as ScoreBand | undefined
                    return (
                      <td key={g.code} className="px-2 py-2 text-slate-600">
                        {band?.selectionOnly ? '선발형' : formatScoreBand(band)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

type ScoreRowProps = {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

function ScoreRow({ label, value, min, max, onChange }: ScoreRowProps) {
  const clamp = (v: number) => {
    if (Number.isNaN(v)) return min
    if (v < min) return min
    if (v > max) return max
    return v
  }
  return (
    <div className="flex items-center gap-3">
      <label className="w-16 shrink-0 text-xs font-medium text-slate-600">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="flex-1 accent-emerald-600"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-sm tabular-nums"
      />
      <span className="w-12 text-right text-[10px] text-slate-400">
        {min}–{max}
      </span>
    </div>
  )
}
