'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  DepartmentScoreIntakePageData,
  DepartmentScoreIntakePageDepartment,
  DepartmentScoreIntakePageIntake,
} from '@/server/admin/department-score-intake-page'

// M1-B2 Round 2 / ADMIN '조직 점수 입력' 화면.
// 외부 전략기획팀이 채점한 본부/실/팀 점수를 cycle별로 받아 upsert. CEO 시연용.
// ★ levelTag enum(본부/실/팀)만 사용 — numeric level 헬퍼 사용 금지.

type LevelTag = NonNullable<DepartmentScoreIntakePageDepartment['levelTag']>

const LEVEL_LABEL: Record<LevelTag, string> = {
  DIVISION: '본부',
  SECTION: '실',
  TEAM: '팀',
}

const LEVEL_BADGE: Record<LevelTag, string> = {
  DIVISION: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  SECTION: 'bg-teal-100 text-teal-800 border-teal-200',
  TEAM: 'bg-slate-100 text-slate-700 border-slate-200',
}

const LEVEL_INDENT: Record<LevelTag, number> = {
  DIVISION: 0,
  SECTION: 1,
  TEAM: 2,
}

type IntakeMap = Record<string, DepartmentScoreIntakePageIntake>

type DraftState = {
  scoreText: string
  noteText: string
}

type DraftMap = Record<string, DraftState>

type SavingMap = Record<string, boolean>

type ErrorMap = Record<string, string | null>

function buildIntakeMap(items: DepartmentScoreIntakePageIntake[]): IntakeMap {
  const map: IntakeMap = {}
  for (const item of items) {
    map[item.deptId] = item
  }
  return map
}

// parentDeptId로 부서 트리 구성. 루트(parentDeptId null)부터 DFS.
// 같은 부모 아래 순서: levelTag 정렬(DIVISION → SECTION → TEAM) → deptCode asc.
function buildOrderedTree(
  departments: DepartmentScoreIntakePageDepartment[]
): DepartmentScoreIntakePageDepartment[] {
  const byParent = new Map<string | null, DepartmentScoreIntakePageDepartment[]>()
  for (const dept of departments) {
    const key = dept.parentDeptId ?? null
    const list = byParent.get(key) ?? []
    list.push(dept)
    byParent.set(key, list)
  }

  const levelOrder: Record<LevelTag | 'UNKNOWN', number> = {
    DIVISION: 0,
    SECTION: 1,
    TEAM: 2,
    UNKNOWN: 3,
  }
  for (const list of byParent.values()) {
    list.sort((left, right) => {
      const leftRank = levelOrder[left.levelTag ?? 'UNKNOWN']
      const rightRank = levelOrder[right.levelTag ?? 'UNKNOWN']
      if (leftRank !== rightRank) return leftRank - rightRank
      return left.deptCode.localeCompare(right.deptCode)
    })
  }

  const ordered: DepartmentScoreIntakePageDepartment[] = []
  const visited = new Set<string>()

  function visit(parent: string | null) {
    const children = byParent.get(parent) ?? []
    for (const child of children) {
      if (visited.has(child.id)) continue
      visited.add(child.id)
      ordered.push(child)
      visit(child.id)
    }
  }
  visit(null)

  // 사이클 방지 fallback — visited 안 된 부서가 있으면 코드 순으로 추가.
  if (ordered.length < departments.length) {
    for (const dept of departments) {
      if (!visited.has(dept.id)) {
        ordered.push(dept)
      }
    }
  }

  return ordered
}

export function DepartmentScoreIntakeAdminClient(props: DepartmentScoreIntakePageData) {
  const router = useRouter()
  const [intakes, setIntakes] = useState<IntakeMap>(() => buildIntakeMap(props.intakes))
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [saving, setSaving] = useState<SavingMap>({})
  const [errors, setErrors] = useState<ErrorMap>({})

  const orderedDepartments = useMemo(() => buildOrderedTree(props.departments), [props.departments])
  const inputCount = Object.keys(intakes).length
  const totalCount = props.departments.length

  function handleCycleChange(nextCycleId: string) {
    if (!nextCycleId) return
    router.push(`/admin/department-score-intake?evalCycleId=${encodeURIComponent(nextCycleId)}`)
  }

  function updateDraft(deptId: string, patch: Partial<DraftState>) {
    setDrafts((current) => ({
      ...current,
      [deptId]: {
        scoreText: patch.scoreText ?? current[deptId]?.scoreText ?? '',
        noteText: patch.noteText ?? current[deptId]?.noteText ?? '',
      },
    }))
  }

  async function handleSave(dept: DepartmentScoreIntakePageDepartment) {
    if (!props.selectedCycleId) {
      setErrors((current) => ({ ...current, [dept.id]: '평가 사이클을 먼저 선택해 주세요.' }))
      return
    }

    const draft = drafts[dept.id]
    const existing = intakes[dept.id]
    const scoreText = (draft?.scoreText ?? (existing ? String(existing.score) : '')).trim()
    const noteText = (draft?.noteText ?? existing?.note ?? '').trim()

    if (!scoreText) {
      setErrors((current) => ({ ...current, [dept.id]: '점수를 입력해 주세요.' }))
      return
    }

    const scoreValue = Number(scoreText)
    if (Number.isNaN(scoreValue)) {
      setErrors((current) => ({ ...current, [dept.id]: '점수는 숫자로 입력해 주세요.' }))
      return
    }
    if (scoreValue < 0 || scoreValue > 130) {
      setErrors((current) => ({ ...current, [dept.id]: '점수는 0 이상 130 이하여야 합니다.' }))
      return
    }

    setSaving((current) => ({ ...current, [dept.id]: true }))
    setErrors((current) => ({ ...current, [dept.id]: null }))

    try {
      const response = await fetch('/api/admin/department-score-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evalCycleId: props.selectedCycleId,
          deptId: dept.id,
          score: scoreValue,
          note: noteText ? noteText : undefined,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '저장에 실패했습니다.')
      }

      const saved = json.data as {
        deptId: string
        score: number
        note: string | null
        receivedAt: string
        receivedById: string
      }

      setIntakes((current) => ({
        ...current,
        [dept.id]: {
          deptId: saved.deptId,
          score: saved.score,
          note: saved.note,
          receivedAt: new Date(saved.receivedAt),
          receivedById: saved.receivedById,
        },
      }))
      setDrafts((current) => {
        const next = { ...current }
        delete next[dept.id]
        return next
      })
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [dept.id]: error instanceof Error ? error.message : '저장에 실패했습니다.',
      }))
    } finally {
      setSaving((current) => ({ ...current, [dept.id]: false }))
    }
  }

  return (
    <div className="space-y-5 p-5">
      <div className="sticky top-0 z-10 -mx-5 border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">조직 점수 입력</h1>
            <p className="mt-1 text-xs text-slate-500">
              외부 전략기획팀이 채점한 본부/실/팀 점수를 사이클별로 입력합니다. 같은 부서를 다시 입력하면 갱신됩니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="font-medium">평가 사이클</span>
              <select
                value={props.selectedCycleId ?? ''}
                onChange={(event) => handleCycleChange(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {props.cycles.length === 0 ? <option value="">선택 가능한 사이클 없음</option> : null}
                {props.cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.evalYear}년 · {cycle.cycleName} ({cycle.status})
                  </option>
                ))}
              </select>
            </label>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {inputCount}/{totalCount} 입력됨
            </span>
          </div>
        </div>
      </div>

      {!props.selectedCycleId ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          평가 사이클을 먼저 선택해 주세요.
        </div>
      ) : props.departments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          등록된 부서가 없습니다.
        </div>
      ) : (
        <div className="grid gap-3">
          {orderedDepartments.map((dept) => {
            const existing = intakes[dept.id]
            const draft = drafts[dept.id]
            const isSaving = Boolean(saving[dept.id])
            const errorMessage = errors[dept.id]
            const levelTag = dept.levelTag
            const indent = levelTag ? LEVEL_INDENT[levelTag] : 0
            const badgeClass = levelTag ? LEVEL_BADGE[levelTag] : 'bg-slate-50 text-slate-500 border-slate-200'
            const levelLabel = levelTag ? LEVEL_LABEL[levelTag] : '미분류'

            const scoreText =
              draft?.scoreText ??
              (existing ? String(existing.score) : '')
            const noteText = draft?.noteText ?? existing?.note ?? ''

            return (
              <div
                key={dept.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                style={{ marginLeft: `${indent * 1.25}rem` }}
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                      >
                        {levelLabel}
                      </span>
                      <h3 className="truncate text-sm font-semibold text-slate-900">{dept.deptName}</h3>
                      {existing ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <span>✅</span>
                          입력됨
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          <span>❌</span>
                          미입력
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      코드: {dept.deptCode}
                      {existing ? (
                        <>
                          {' · '}최근 입력 {existing.receivedAt instanceof Date
                            ? existing.receivedAt.toLocaleString('ko-KR')
                            : String(existing.receivedAt)}
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      점수 (0~130)
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={130}
                        step="0.1"
                        value={scoreText}
                        onChange={(event) => updateDraft(dept.id, { scoreText: event.target.value })}
                        disabled={isSaving}
                        placeholder={existing ? String(existing.score) : '예: 95'}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">
                      비고
                      <input
                        type="text"
                        value={noteText}
                        onChange={(event) => updateDraft(dept.id, { noteText: event.target.value })}
                        disabled={isSaving}
                        placeholder="선택 입력 (예: 1차 채점)"
                        maxLength={1000}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 disabled:bg-slate-100"
                      />
                    </label>
                    {errorMessage ? (
                      <p className="text-xs font-medium text-red-600">{errorMessage}</p>
                    ) : null}
                  </div>

                  <div className="flex items-start justify-end lg:items-center">
                    <button
                      type="button"
                      onClick={() => handleSave(dept)}
                      disabled={isSaving || !props.selectedCycleId}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isSaving ? '저장 중...' : existing ? '갱신' : '저장'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
