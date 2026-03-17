'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getCurrentYear, getCurrentYearMonth, formatYearMonth } from '@/lib/utils'
import { useSession } from 'next-auth/react'

export default function MonthlyRecordPage() {
  const { data: session } = useSession()
  const currentYearMonth = getCurrentYearMonth()
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth)
  const queryClient = useQueryClient()

  const year = selectedMonth.split('-')[0]

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['personal-kpis', year],
    queryFn: async () => {
      const res = await fetch(`/api/kpi/personal?evalYear=${year}`)
      const json = await res.json()
      return json.data || []
    },
  })

  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['monthly-records', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/kpi/monthly-record?year=${year}`)
      const json = await res.json()
      return json.data || []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/kpi/monthly-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, yearMonth: selectedMonth }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-records'] })
    },
  })

  // 월 목록 생성 (올해 1~12월)
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0')
    return `${year}-${month}`
  })

  const getRecordForKpi = (kpiId: string) => {
    return records?.find((r: any) => r.personalKpiId === kpiId && r.yearMonth === selectedMonth)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">월별 실적 입력</h1>
        <p className="text-gray-500 mt-1">매월 KPI 실적을 입력하고 관리합니다</p>
      </div>

      {/* 월 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {months.map(month => (
          <button
            key={month}
            onClick={() => setSelectedMonth(month)}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedMonth === month
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {month.split('-')[1]}월
            {month === currentYearMonth && (
              <span className="ml-1 text-xs opacity-75">(현재)</span>
            )}
          </button>
        ))}
      </div>

      {/* KPI 실적 입력 */}
      {kpisLoading ? (
        <div className="text-center py-8 text-gray-400">로딩 중...</div>
      ) : !kpis || kpis.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-gray-500">등록된 KPI가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {kpis.map((kpi: any) => (
            <KpiRecordCard
              key={kpi.id}
              kpi={kpi}
              record={getRecordForKpi(kpi.id)}
              yearMonth={selectedMonth}
              onSave={saveMutation.mutate}
              isSaving={saveMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function KpiRecordCard({ kpi, record, yearMonth, onSave, isSaving }: any) {
  const [actualValue, setActualValue] = useState(record?.actualValue?.toString() || '')
  const [activities, setActivities] = useState(record?.activities || '')
  const [obstacles, setObstacles] = useState(record?.obstacles || '')
  const [efforts, setEfforts] = useState(record?.efforts || '')
  const [isDirty, setIsDirty] = useState(false)

  const achievementRate = kpi.targetValue && actualValue
    ? Math.round((Number(actualValue) / kpi.targetValue) * 100 * 10) / 10
    : null

  const handleSave = (isDraft: boolean) => {
    onSave({
      personalKpiId: kpi.id,
      actualValue: actualValue ? Number(actualValue) : undefined,
      activities,
      obstacles,
      efforts,
      isDraft,
    })
    setIsDirty(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800">{kpi.kpiName}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${kpi.kpiType === 'QUANTITATIVE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {kpi.kpiType === 'QUANTITATIVE' ? '계량' : '비계량'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              가중치 {kpi.weight}%
            </span>
          </div>
          {kpi.definition && <p className="text-sm text-gray-400 mt-1">{kpi.definition}</p>}
        </div>
        {record && !record.isDraft && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">제출완료</span>
        )}
        {record?.isDraft && (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">임시저장</span>
        )}
      </div>

      {kpi.kpiType === 'QUANTITATIVE' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">실적 입력</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={actualValue}
                  onChange={e => { setActualValue(e.target.value); setIsDirty(true) }}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="실적값"
                />
                <span className="text-sm text-gray-500">
                  {kpi.unit || ''} / 목표: {kpi.targetValue} {kpi.unit || ''}
                </span>
              </div>
            </div>

            {achievementRate !== null && (
              <div className="text-center">
                <div className="text-2xl font-bold" style={{
                  color: achievementRate >= 100 ? '#22c55e' : achievementRate >= 70 ? '#3b82f6' : '#f97316'
                }}>
                  {achievementRate}%
                </div>
                <div className="text-xs text-gray-400">달성률</div>
              </div>
            )}
          </div>

          {achievementRate !== null && (
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${achievementRate >= 100 ? 'bg-green-500' : achievementRate >= 70 ? 'bg-blue-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(achievementRate, 100)}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">주요 활동</label>
            <textarea
              value={activities}
              onChange={e => { setActivities(e.target.value); setIsDirty(true) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              rows={2}
              placeholder="이번 달 주요 활동을 입력하세요"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">장애요인</label>
              <textarea
                value={obstacles}
                onChange={e => { setObstacles(e.target.value); setIsDirty(true) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                rows={2}
                placeholder="어려움이나 장애요인"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">극복 노력</label>
              <textarea
                value={efforts}
                onChange={e => { setEfforts(e.target.value); setIsDirty(true) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                rows={2}
                placeholder="극복 방법과 노력"
              />
            </div>
          </div>
        </div>
      )}

      {isDirty && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            임시저장
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '제출'}
          </button>
        </div>
      )}
    </div>
  )
}
