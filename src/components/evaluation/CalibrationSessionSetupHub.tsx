'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Flag, ShieldCheck, Users } from 'lucide-react'
import {
  buildCalibrationSetupReadiness,
  CALIBRATION_DECISION_POLICY_OPTIONS,
  CALIBRATION_MEMO_COMMENT_POLICY_OPTIONS,
  CALIBRATION_REFERENCE_DISTRIBUTION_USE_OPTIONS,
  CALIBRATION_REFERENCE_DISTRIBUTION_VISIBILITY_OPTIONS,
  CALIBRATION_SCOPE_MODE_OPTIONS,
  CALIBRATION_SESSION_TYPE_OPTIONS,
  type CalibrationSessionSetupValue,
  type CalibrationVisibleColumnKey,
} from '@/lib/calibration-session-setup'
import type { CalibrationViewModel } from '@/server/evaluation-calibration'

type CalibrationSessionSetupHubProps = {
  viewModel: CalibrationViewModel
  isSubmitting: boolean
  onSave: (config: Partial<CalibrationViewModel['sessionConfig']>) => void
  onStartSession: () => void
}

export function CalibrationSessionSetupHub(props: CalibrationSessionSetupHubProps) {
  const [draft, setDraft] = useState<CalibrationViewModel['sessionConfig']>(() =>
    cloneSessionConfig(props.viewModel.sessionConfig)
  )

  const readiness = useMemo(
    () =>
      buildCalibrationSetupReadiness({
        setup: draft.setup as CalibrationSessionSetupValue,
        participantIds: draft.participantIds,
      }),
    [draft]
  )

  const hasUnsavedChanges = JSON.stringify(draft) !== JSON.stringify(props.viewModel.sessionConfig)
  const peopleOptions = props.viewModel.sessionOptions.people.map((person) => ({
    id: person.id,
    label: `${person.name} · ${person.department} · ${person.role}`,
  }))
  const leaderGroupOptions = peopleOptions
  const departmentOptions = props.viewModel.sessionOptions.departments
  const targetOptions = props.viewModel.sessionOptions.targets.map((target) => ({
    id: target.id,
    label: `${target.name} · ${target.department}`,
  }))

  function updateSetup<K extends keyof CalibrationViewModel['sessionConfig']['setup']>(
    key: K,
    value: CalibrationViewModel['sessionConfig']['setup'][K]
  ) {
    setDraft((current) => ({
      ...current,
      setup: {
        ...current.setup,
        [key]: value,
      },
    }))
  }

  function toggleIdList(
    key: 'participantIds' | 'evaluatorIds' | 'observerIds',
    value: string,
    checked: boolean
  ) {
    setDraft((current) => {
      const nextValues = checked
        ? Array.from(new Set([...current[key], value]))
        : current[key].filter((item) => item !== value)

      return {
        ...current,
        [key]: nextValues,
        setup:
          key === 'observerIds'
            ? {
                ...current.setup,
                observerIds: nextValues,
              }
            : current.setup,
      }
    })
  }

  function toggleSetupList(
    key: 'scopeDepartmentIds' | 'scopeLeaderIds' | 'visibleDataColumns',
    value: string,
    checked: boolean
  ) {
    setDraft((current) => {
      const currentValues = current.setup[key] as string[]
      const nextValues = checked
        ? Array.from(new Set([...currentValues, value]))
        : currentValues.filter((item) => item !== value)

      return {
        ...current,
        setup: {
          ...current.setup,
          [key]: nextValues,
        },
      }
    })
  }

  function updateGroundRule(
    ruleKey: string,
    patch: Partial<CalibrationViewModel['sessionConfig']['setup']['groundRules'][number]>
  ) {
    setDraft((current) => ({
      ...current,
      setup: {
        ...current.setup,
        groundRules: current.setup.groundRules.map((rule) =>
          rule.key === ruleKey
            ? {
                ...rule,
                ...patch,
              }
            : rule
        ),
      },
    }))
  }

  function updateReferenceRatio(gradeId: string, gradeLabel: string, ratio: number) {
    setDraft((current) => {
      const existing = current.setup.referenceDistributionRatios.find((item) => item.gradeId === gradeId)
      const nextRatios = existing
        ? current.setup.referenceDistributionRatios.map((item) =>
            item.gradeId === gradeId
              ? {
                  ...item,
                  ratio,
                }
              : item
          )
        : [...current.setup.referenceDistributionRatios, { gradeId, gradeLabel, ratio }]

      return {
        ...current,
        setup: {
          ...current.setup,
          referenceDistributionRatios: nextRatios,
        },
      }
    })
  }

  function addRatingGuideLink() {
    setDraft((current) => ({
      ...current,
      setup: {
        ...current.setup,
        ratingGuideLinks: [
          ...current.setup.ratingGuideLinks,
          {
            id: `guide-link-${current.setup.ratingGuideLinks.length + 1}`,
            scopeType: 'POSITION',
            scopeValue: '',
            memo: '',
          },
        ],
      },
    }))
  }

  function updateRatingGuideLink(
    linkId: string,
    patch: Partial<CalibrationViewModel['sessionConfig']['setup']['ratingGuideLinks'][number]>
  ) {
    setDraft((current) => ({
      ...current,
      setup: {
        ...current.setup,
        ratingGuideLinks: current.setup.ratingGuideLinks.map((link) =>
          link.id === linkId
            ? {
                ...link,
                ...patch,
              }
            : link
        ),
      },
    }))
  }

  function removeRatingGuideLink(linkId: string) {
    setDraft((current) => ({
      ...current,
      setup: {
        ...current.setup,
        ratingGuideLinks: current.setup.ratingGuideLinks.filter((link) => link.id !== linkId),
      },
    }))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <HubSection
          title="세션 기본 정보"
          description="D-365부터 기대 관리, 등급 체계, 운영 책임을 정렬하고 D-7 준비를 위해 기본 운영값을 세팅합니다."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="세션 이름">
              <input
                value={draft.setup.sessionName}
                onChange={(event) => updateSetup('sessionName', event.target.value)}
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder={`${props.viewModel.cycle.name} 캘리브레이션`}
              />
            </Field>
            <Field label="연결 리뷰 사이클">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                {props.viewModel.cycle.name}
              </div>
            </Field>
            <Field label="세션 유형">
              <select
                value={draft.setup.sessionType}
                onChange={(event) =>
                  updateSetup(
                    'sessionType',
                    event.target.value as CalibrationViewModel['sessionConfig']['setup']['sessionType']
                  )
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                {CALIBRATION_SESSION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="세션 범위 기준">
              <select
                value={draft.setup.scopeMode}
                onChange={(event) =>
                  updateSetup(
                    'scopeMode',
                    event.target.value as CalibrationViewModel['sessionConfig']['setup']['scopeMode']
                  )
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                {CALIBRATION_SCOPE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="세션 owner">
              <select
                value={draft.setup.ownerId ?? ''}
                onChange={(event) => updateSetup('ownerId', event.target.value || null)}
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택해 주세요.</option>
                {peopleOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="facilitator">
              <select
                value={draft.setup.facilitatorId ?? ''}
                onChange={(event) => updateSetup('facilitatorId', event.target.value || null)}
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택해 주세요.</option>
                {peopleOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="note taker / recorder">
              <select
                value={draft.setup.recorderId ?? ''}
                onChange={(event) => updateSetup('recorderId', event.target.value || null)}
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택해 주세요.</option>
                {peopleOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="pre-read deadline">
              <input
                type="datetime-local"
                value={toDateTimeLocalValue(draft.setup.preReadDeadline)}
                onChange={(event) => updateSetup('preReadDeadline', fromDateTimeLocalValue(event.target.value))}
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="세션 시작 / 종료">
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(draft.setup.scheduledStart)}
                  onChange={(event) => updateSetup('scheduledStart', fromDateTimeLocalValue(event.target.value))}
                  className="min-h-11 rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(draft.setup.scheduledEnd)}
                  onChange={(event) => updateSetup('scheduledEnd', fromDateTimeLocalValue(event.target.value))}
                  className="min-h-11 rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </Field>
            <Field label="1인당 timebox(분)">
              <input
                type="number"
                min={5}
                max={10}
                value={draft.setup.timeboxMinutes}
                onChange={(event) => updateSetup('timeboxMinutes', Number(event.target.value) || 5)}
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="follow-up owner">
              <select
                value={draft.setup.followUpOwnerId ?? ''}
                onChange={(event) => updateSetup('followUpOwnerId', event.target.value || null)}
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택해 주세요.</option>
                {peopleOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </HubSection>

        <HubSection
          title="세션 범위 / 참여자 구성"
          description="작은 범위부터 시작할 수 있도록 조직 단위, 리뷰 사이클 단위, 리더 그룹 단위를 구분해 세션 대상을 설정합니다."
        >
          <div className="grid gap-6 xl:grid-cols-3">
            <SelectionPanel
              title="대상 범위"
              description="세션 범위 기준에 따라 조직 또는 리더 그룹을 선택하세요."
            >
              {draft.setup.scopeMode === 'ORGANIZATION' ? (
                <CheckboxList
                  options={departmentOptions}
                  selectedIds={draft.setup.scopeDepartmentIds}
                  onToggle={(id, checked) => toggleSetupList('scopeDepartmentIds', id, checked)}
                />
              ) : draft.setup.scopeMode === 'LEADER_GROUP' ? (
                <CheckboxList
                  options={leaderGroupOptions}
                  selectedIds={draft.setup.scopeLeaderIds}
                  onToggle={(id, checked) => toggleSetupList('scopeLeaderIds', id, checked)}
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  현재 리뷰 사이클 전체를 기준으로 세션을 엽니다. 대상자 범위는 participant와 evaluator 구성에서 세부 조정할 수 있습니다.
                </div>
              )}
            </SelectionPanel>

            <SelectionPanel
              title="participants"
              description="실제 토론에 참여하는 핵심 참석자를 지정합니다."
            >
              <CheckboxList
                options={peopleOptions}
                selectedIds={draft.participantIds}
                onToggle={(id, checked) => toggleIdList('participantIds', id, checked)}
              />
            </SelectionPanel>

            <SelectionPanel
              title="evaluator / observer"
              description="평가자와 observer를 분리해 저장합니다. observer는 선택 사항입니다."
            >
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-800">평가자 그룹</div>
                  <CheckboxList
                    options={peopleOptions}
                    selectedIds={draft.evaluatorIds}
                    onToggle={(id, checked) => toggleIdList('evaluatorIds', id, checked)}
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-800">observer</div>
                  <CheckboxList
                    options={peopleOptions}
                    selectedIds={draft.observerIds}
                    onToggle={(id, checked) => toggleIdList('observerIds', id, checked)}
                  />
                </div>
              </div>
            </SelectionPanel>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            세션 owner는 조직장 중심으로 지정하고, HR은 facilitator 또는 recorder 역할로 참여할 수 있습니다.
          </div>
        </HubSection>

        <HubSection
          title="운영 정책"
          description="D-7 사전 정렬을 위해 의사결정 방식, 메모/코멘트 정책, 이의제기 창구를 세션 단위로 고정합니다."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="decision policy">
              <select
                value={draft.setup.decisionPolicy}
                onChange={(event) =>
                  updateSetup(
                    'decisionPolicy',
                    event.target.value as CalibrationViewModel['sessionConfig']['setup']['decisionPolicy']
                  )
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                {CALIBRATION_DECISION_POLICY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="memo / comment policy">
              <select
                value={draft.setup.memoCommentPolicyPreset}
                onChange={(event) =>
                  updateSetup(
                    'memoCommentPolicyPreset',
                    event.target.value as CalibrationViewModel['sessionConfig']['setup']['memoCommentPolicyPreset']
                  )
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                {CALIBRATION_MEMO_COMMENT_POLICY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs leading-5 text-slate-500">
                {
                  CALIBRATION_MEMO_COMMENT_POLICY_OPTIONS.find(
                    (option) => option.value === draft.setup.memoCommentPolicyPreset
                  )?.description
                }
              </div>
            </Field>
            <Field label="objection window open">
              <input
                type="datetime-local"
                value={toDateTimeLocalValue(draft.setup.objectionWindowOpenAt)}
                onChange={(event) =>
                  updateSetup('objectionWindowOpenAt', fromDateTimeLocalValue(event.target.value))
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="objection window close">
              <input
                type="datetime-local"
                value={toDateTimeLocalValue(draft.setup.objectionWindowCloseAt)}
                onChange={(event) =>
                  updateSetup('objectionWindowCloseAt', fromDateTimeLocalValue(event.target.value))
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <input
              type="checkbox"
              checked={draft.setup.facilitatorCanFinalize}
              onChange={(event) => updateSetup('facilitatorCanFinalize', event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">facilitator final override 허용</div>
              <div className="mt-1 text-sm leading-6 text-slate-600">
                기본값은 꺼짐입니다. HR은 기본적으로 facilitator / standard keeper 역할만 하며, owner가 최종 결과 결정자입니다.
              </div>
            </div>
          </label>
        </HubSection>

        <HubSection
          title="Ground rules"
          description="Las Vegas Rule, Working as a team, Intellectual Honesty, Psychological Safety를 기본 preset으로 두고 세션별 문구를 조정할 수 있습니다."
        >
          <div className="grid gap-4">
            {draft.setup.groundRules.map((rule) => (
              <div key={rule.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) => updateGroundRule(rule.key, { enabled: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {rule.label}
                  </label>
                  <div className="text-xs text-slate-500">{rule.key}</div>
                </div>
                <textarea
                  value={rule.description}
                  onChange={(event) => updateGroundRule(rule.key, { description: event.target.value })}
                  rows={3}
                  className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="ground rule acknowledgement 정책">
              <select
                value={draft.setup.groundRuleAcknowledgementPolicy}
                onChange={(event) =>
                  updateSetup(
                    'groundRuleAcknowledgementPolicy',
                    event.target.value as CalibrationViewModel['sessionConfig']['setup']['groundRuleAcknowledgementPolicy']
                  )
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="NOT_SET">정책 미설정</option>
                <option value="REQUIRED">참가 전 필수 확인</option>
                <option value="OPTIONAL">안내만 표시</option>
              </select>
            </Field>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
              세션 시작 전 acknowledgement 화면에서 그대로 불러올 수 있도록 저장됩니다. 이번 범위에서는 데이터 구조만 준비하고,
              실제 acknowledgement 화면 구현은 제외합니다.
            </div>
          </div>
        </HubSection>

        <HubSection
          title="등급 체계 / 기대 정렬"
          description="D-365 기대 관리 항목으로, 세션에서 사용할 등급 체계와 기대 기준을 연결합니다."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <input
                type="checkbox"
                checked={draft.setup.ratingGuideUse}
                onChange={(event) => updateSetup('ratingGuideUse', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">rating guide 사용</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">
                  세션 준비 화면에서 직책/직군/레벨별 등급 가이드를 같이 확인합니다.
                </div>
              </div>
            </label>
            <Field label="최상/최하 기준 메모">
              <textarea
                value={draft.setup.expectationAlignmentMemo}
                onChange={(event) => updateSetup('expectationAlignmentMemo', event.target.value)}
                rows={5}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="예: 최상 등급은 일관된 기대 초과와 조직 기여가 동시에 확인된 경우에만 사용합니다."
              />
            </Field>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">직책 / 직군 / 레벨별 rating guide 연결</div>
                <div className="text-sm text-slate-500">세션 준비 화면에서 참가자가 참고할 기준입니다.</div>
              </div>
              <button
                type="button"
                onClick={addRatingGuideLink}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                기준 추가
              </button>
            </div>

            {draft.setup.ratingGuideLinks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                연결된 rating guide 기준이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {draft.setup.ratingGuideLinks.map((link) => (
                  <div key={link.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)_auto]">
                      <select
                        value={link.scopeType}
                        onChange={(event) =>
                          updateRatingGuideLink(link.id, {
                            scopeType: event.target.value as typeof link.scopeType,
                          })
                        }
                        className="min-h-11 rounded-xl border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="POSITION">직책</option>
                        <option value="JOB_GROUP">직군</option>
                        <option value="LEVEL">레벨</option>
                      </select>
                      <input
                        value={link.scopeValue}
                        onChange={(event) => updateRatingGuideLink(link.id, { scopeValue: event.target.value })}
                        className="min-h-11 rounded-xl border border-gray-300 px-3 py-2 text-sm"
                        placeholder="예: 팀장 / 연구 / Senior"
                      />
                      <button
                        type="button"
                        onClick={() => removeRatingGuideLink(link.id)}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
                      >
                        삭제
                      </button>
                    </div>
                    <textarea
                      value={link.memo ?? ''}
                      onChange={(event) => updateRatingGuideLink(link.id, { memo: event.target.value })}
                      rows={3}
                      className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                      placeholder="이 범위에서 참고할 등급 가이드 또는 기대 기준을 적어 주세요."
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">현재 사이클 등급 체계</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {props.viewModel.gradeOptions.map((grade) => (
                  <span
                    key={grade.id}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                  >
                    {grade.grade}
                    {grade.targetRatio != null ? ` · 참고 ${grade.targetRatio}%` : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </HubSection>

        <HubSection
          title="Reference distribution / visible data"
          description="D-1 기준에 맞춰 참고 분포는 hard block이 아닌 guideline / nudge로만 설정하고, 세션 노출 컬럼을 제한합니다."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="reference distribution 사용">
              <select
                value={draft.setup.referenceDistributionUse}
                onChange={(event) =>
                  updateSetup(
                    'referenceDistributionUse',
                    event.target.value as CalibrationViewModel['sessionConfig']['setup']['referenceDistributionUse']
                  )
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                {CALIBRATION_REFERENCE_DISTRIBUTION_USE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="reference distribution 노출 방식">
              <select
                value={draft.setup.referenceDistributionVisibility}
                onChange={(event) =>
                  updateSetup(
                    'referenceDistributionVisibility',
                    event.target.value as CalibrationViewModel['sessionConfig']['setup']['referenceDistributionVisibility']
                  )
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                {CALIBRATION_REFERENCE_DISTRIBUTION_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            참고 분포는 hard validation이나 forced blocking으로 절대 동작하지 않습니다. 세션 중 self-check와 inflation
            방지용 nudge로만 사용합니다.
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {props.viewModel.gradeOptions.map((grade) => (
              <Field key={grade.id} label={`${grade.grade} 참고 비율`}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={
                    draft.setup.referenceDistributionRatios.find((item) => item.gradeId === grade.id)?.ratio ??
                    grade.targetRatio ??
                    0
                  }
                  onChange={(event) => updateReferenceRatio(grade.id, grade.grade, Number(event.target.value) || 0)}
                  className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-slate-900">visible data columns preset</div>
            <CheckboxGrid
              options={props.viewModel.sessionOptions.visibleColumnOptions.map((option) => ({
                id: option.key,
                label: option.label,
                description: option.description,
              }))}
              selectedIds={draft.setup.visibleDataColumns}
              onToggle={(id, checked) =>
                toggleSetupList('visibleDataColumns', id as CalibrationVisibleColumnKey, checked)
              }
            />
          </div>
        </HubSection>
      </div>

      <div className="space-y-6">
        <HubSection
          title="Session1 / Session2 반영 포인트"
          description="업로드된 파일의 운영 원칙을 세션 설정 허브에서 직접 고정할 수 있도록 매핑했습니다."
        >
          <GuidanceCard
            icon={<CalendarClock className="h-4 w-4" />}
            title="D-365"
            description="기대 관리, 등급 체계, 등급 가이드를 세션 시작 전에 정렬합니다."
          />
          <GuidanceCard
            icon={<Users className="h-4 w-4" />}
            title="D-7"
            description="그라운드 룰, 사전 준비, 노출 데이터, 작은 범위부터 시작하는 세션 스코프를 확정합니다."
          />
          <GuidanceCard
            icon={<Flag className="h-4 w-4" />}
            title="D-1"
            description="참고 분포는 강제가 아니라 guideline / nudge로만 두고, 어떤 경우에도 강제 차단 규칙으로 쓰지 않습니다."
          />
          <GuidanceCard
            icon={<ShieldCheck className="h-4 w-4" />}
            title="HR guardrail"
            description="HR은 facilitator / standard keeper이며, 기본 설정에서 owner나 최종 결과 결정자로 간주하지 않습니다."
          />
        </HubSection>

        <HubSection
          title="Setup completeness check"
          description="세션 시작 전 비어 있는 항목과 경고 항목을 분리해 확인합니다."
        >
          <ReadinessSection readiness={readiness} />
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            owner는 조직장 중심으로 두고, facilitator는 HR이 맡을 수 있습니다. 단, HR은 기본적으로 최종 결과 결정자가
            아니며 forced distribution enforcer 역할도 맡지 않습니다.
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => props.onSave(draft)}
              disabled={props.isSubmitting}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              세션 설정 저장
            </button>
            <button
              type="button"
              onClick={props.onStartSession}
              disabled={props.isSubmitting || hasUnsavedChanges || !readiness.readyToStart}
              className="rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              세션 시작
            </button>
            {hasUnsavedChanges ? (
              <div className="text-xs text-slate-500">저장되지 않은 설정이 있습니다. 저장 후 세션을 시작해 주세요.</div>
            ) : null}
          </div>
        </HubSection>

        <HubSection
          title="현재 대상 범위 미리보기"
          description="설정된 범위를 기준으로 현재 세션 후보가 어떤 사람들인지 빠르게 확인합니다."
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">현재 후보 수</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{targetOptions.length}명</div>
            <div className="mt-3 text-sm text-slate-600">
              범위 설정은 준비 화면의 가시성과 participant/evaluator 구성을 위한 기준이며, 실제 D-day 토론 패널 개편은 이번
              작업 범위에 포함하지 않습니다.
            </div>
          </div>
        </HubSection>
      </div>
    </div>
  )
}

function cloneSessionConfig(config: CalibrationViewModel['sessionConfig']) {
  return JSON.parse(JSON.stringify(config)) as CalibrationViewModel['sessionConfig']
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function HubSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
    </label>
  )
}

function GuidanceCard(props: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="rounded-xl bg-white p-2 text-slate-700">{props.icon}</div>
      <div>
        <div className="font-semibold text-slate-900">{props.title}</div>
        <div className="mt-1 text-sm leading-6 text-slate-600">{props.description}</div>
      </div>
    </div>
  )
}

function SelectionPanel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{description}</div>
      </div>
      {children}
    </div>
  )
}

function CheckboxList(props: {
  options: Array<{ id: string; label: string }>
  selectedIds: string[]
  onToggle: (id: string, checked: boolean) => void
}) {
  if (!props.options.length) {
    return <div className="text-sm text-slate-500">선택 가능한 항목이 없습니다.</div>
  }

  return (
    <div className="max-h-72 space-y-2 overflow-auto pr-1">
      {props.options.map((option) => (
        <label
          key={option.id}
          className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            checked={props.selectedIds.includes(option.id)}
            onChange={(event) => props.onToggle(option.id, event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}

function CheckboxGrid(props: {
  options: Array<{ id: string; label: string; description: string }>
  selectedIds: string[]
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {props.options.map((option) => (
        <label
          key={option.id}
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4"
        >
          <input
            type="checkbox"
            checked={props.selectedIds.includes(option.id)}
            onChange={(event) => props.onToggle(option.id, event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <div>
            <div className="text-sm font-semibold text-slate-900">{option.label}</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">{option.description}</div>
          </div>
        </label>
      ))}
    </div>
  )
}

function ReadinessSection(props: { readiness: CalibrationViewModel['setupReadiness'] }) {
  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl border p-4 text-sm ${
          props.readiness.readyToStart
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          {props.readiness.readyToStart ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {props.readiness.readyToStart ? '세션 시작 가능' : '세션 시작 전 확인 필요'}
        </div>
      </div>
      {props.readiness.blockingItems.length ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-sm font-semibold text-rose-900">시작을 막는 항목</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-800">
            {props.readiness.blockingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {props.readiness.warningItems.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">경고 항목</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {props.readiness.warningItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
