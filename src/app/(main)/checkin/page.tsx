'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CHECKIN_TYPE_LABELS } from '@/lib/utils'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: '예정',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소',
  RESCHEDULED: '일정변경',
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  RESCHEDULED: 'bg-orange-100 text-orange-700',
}

export default function CheckInPage() {
  const [showNewForm, setShowNewForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const queryClient = useQueryClient()

  const { data: checkIns, isLoading } = useQuery({
    queryKey: ['checkins', filterStatus],
    queryFn: async () => {
      const params = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const res = await fetch(`/api/checkin${params}`)
      const json = await res.json()
      return json.data || []
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkins'] })
      setShowNewForm(false)
    },
    onError: (err: Error) => alert(err.message),
  })

  const upcoming = checkIns?.filter((c: any) => c.status === 'SCHEDULED') || []
  const past = checkIns?.filter((c: any) => c.status === 'COMPLETED') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">수시 체크인</h1>
          <p className="text-gray-500 mt-1">팀원과의 정기적인 1:1 대화를 관리합니다</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + 체크인 예약
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: '전체' },
          { value: 'SCHEDULED', label: '예정' },
          { value: 'COMPLETED', label: '완료' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              filterStatus === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 예정 체크인 */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">예정된 체크인</h2>
          <div className="grid gap-3">
            {upcoming.map((ci: any) => (
              <CheckInCard key={ci.id} checkIn={ci} />
            ))}
          </div>
        </div>
      )}

      {/* 완료된 체크인 */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">완료된 체크인</h2>
          <div className="grid gap-3">
            {past.slice(0, 10).map((ci: any) => (
              <CheckInCard key={ci.id} checkIn={ci} />
            ))}
          </div>
        </div>
      )}

      {!isLoading && (!checkIns || checkIns.length === 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-3">📅</div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">체크인이 없습니다</h3>
          <p className="text-gray-400 text-sm">체크인을 예약하여 팀원과 소통해보세요.</p>
        </div>
      )}

      {/* 새 체크인 모달 */}
      {showNewForm && (
        <NewCheckInModal
          onSubmit={createMutation.mutate}
          onClose={() => setShowNewForm(false)}
          isPending={createMutation.isPending}
        />
      )}
    </div>
  )
}

function CheckInCard({ checkIn }: { checkIn: any }) {
  return (
    <Link href={`/checkin/${checkIn.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-lg">
              {checkIn.checkInType === 'WEEKLY' ? '📆' :
               checkIn.checkInType === 'MONTHLY' ? '📅' :
               checkIn.checkInType === 'QUARTERLY' ? '📊' : '💬'}
            </div>
            <div>
              <div className="font-medium text-gray-800">
                {CHECKIN_TYPE_LABELS[checkIn.checkInType]}
              </div>
              <div className="text-sm text-gray-500">
                {checkIn.owner?.empName} ↔ {checkIn.manager?.empName}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[checkIn.status]}`}>
              {STATUS_LABELS[checkIn.status]}
            </span>
            <div className="text-xs text-gray-400 mt-1">
              {new Date(checkIn.scheduledDate).toLocaleDateString('ko-KR', {
                month: 'long', day: 'numeric', weekday: 'short'
              })}
            </div>
          </div>
        </div>

        {/* 액션 아이템 미리보기 */}
        {checkIn.actionItems && checkIn.actionItems.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-1">실행항목</div>
            <div className="flex flex-wrap gap-1">
              {checkIn.actionItems.slice(0, 3).map((item: any, i: number) => (
                <span
                  key={i}
                  className={`text-xs px-2 py-0.5 rounded-full ${item.completed ? 'bg-green-100 text-green-600 line-through' : 'bg-gray-100 text-gray-600'}`}
                >
                  {item.action}
                </span>
              ))}
              {checkIn.actionItems.length > 3 && (
                <span className="text-xs text-gray-400">+{checkIn.actionItems.length - 3}개</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

function NewCheckInModal({ onSubmit, onClose, isPending }: any) {
  const [form, setForm] = useState({
    checkInType: 'WEEKLY',
    scheduledDate: '',
    ownerId: '',
    ownerNotes: '',
  })

  const { data: myTeam } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const res = await fetch('/api/employees/my-team')
      const json = await res.json()
      return json.data || []
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.scheduledDate) return alert('날짜를 선택해주세요.')
    onSubmit({
      ...form,
      scheduledDate: new Date(form.scheduledDate).toISOString(),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">체크인 예약</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">체크인 유형 *</label>
            <select
              value={form.checkInType}
              onChange={e => setForm(f => ({ ...f, checkInType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {Object.entries(CHECKIN_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {myTeam && myTeam.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">대상 팀원 *</label>
              <select
                value={form.ownerId}
                onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              >
                <option value="">선택하세요</option>
                {myTeam.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.empName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">예정 일시 *</label>
            <input
              type="datetime-local"
              value={form.scheduledDate}
              onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사전 메모 (선택)</label>
            <textarea
              value={form.ownerNotes}
              onChange={e => setForm(f => ({ ...f, ownerNotes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              rows={3}
              placeholder="체크인 전 공유할 내용이 있으면 입력하세요"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
              취소
            </button>
            <button type="submit" disabled={isPending} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {isPending ? '예약 중...' : '예약하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
