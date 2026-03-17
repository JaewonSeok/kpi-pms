'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CHECKIN_TYPE_LABELS } from '@/lib/utils'
import { useSession } from 'next-auth/react'

export default function CheckInDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [completing, setCompleting] = useState(false)

  const { data: checkIn, isLoading } = useQuery({
    queryKey: ['checkin', params.id],
    queryFn: async () => {
      const res = await fetch(`/api/checkin/${params.id}`)
      const json = await res.json()
      return json.data
    },
  })

  const [form, setForm] = useState({
    keyTakeaways: '',
    energyLevel: 3,
    satisfactionLevel: 3,
    blockerCount: 0,
    managerNotes: '',
    actionItems: [] as { action: string; assignee: string; dueDate: string; completed: boolean }[],
    duration: 30,
    nextCheckInDate: '',
  })

  const completeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/checkin/${params.id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          actualDate: new Date().toISOString(),
          nextCheckInDate: data.nextCheckInDate ? new Date(data.nextCheckInDate).toISOString() : undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkins'] })
      setCompleting(false)
      router.push('/checkin')
    },
    onError: (err: Error) => alert(err.message),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>
  }

  if (!checkIn) {
    return <div className="text-center text-gray-400 py-12">체크인을 찾을 수 없습니다.</div>
  }

  const isManager = session?.user.id === checkIn.managerId
  const isCompleted = checkIn.status === 'COMPLETED'

  const addActionItem = () => {
    setForm(f => ({
      ...f,
      actionItems: [...f.actionItems, { action: '', assignee: '', dueDate: '', completed: false }],
    }))
  }

  const updateActionItem = (index: number, field: string, value: any) => {
    const updated = [...form.actionItems]
    updated[index] = { ...updated[index], [field]: value }
    setForm(f => ({ ...f, actionItems: updated }))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"
          >
            ← 돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {CHECKIN_TYPE_LABELS[checkIn.checkInType]}
          </h1>
          <p className="text-gray-500 mt-1">
            {checkIn.owner?.empName} ↔ {checkIn.manager?.empName} ·{' '}
            {new Date(checkIn.scheduledDate).toLocaleDateString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
            })}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          checkIn.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
          checkIn.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {checkIn.status === 'COMPLETED' ? '완료' : checkIn.status === 'SCHEDULED' ? '예정' : '진행중'}
        </span>
      </div>

      {/* 사전 메모 */}
      {checkIn.ownerNotes && (
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="text-xs font-medium text-blue-600 mb-1">팀원 사전 메모</div>
          <p className="text-sm text-gray-700">{checkIn.ownerNotes}</p>
        </div>
      )}

      {/* 완료된 체크인 결과 표시 */}
      {isCompleted && (
        <div className="space-y-4">
          {checkIn.keyTakeaways && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">핵심 논의사항</h3>
              <p className="text-sm text-gray-600">{checkIn.keyTakeaways}</p>
            </div>
          )}

          {checkIn.energyLevel && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">에너지/만족도</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">에너지 레벨</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} className={`text-xl ${n <= checkIn.energyLevel ? '' : 'opacity-20'}`}>
                        {n <= 2 ? '🔋' : n <= 4 ? '⚡' : '🚀'}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">업무 만족도</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} className={`text-xl ${n <= checkIn.satisfactionLevel ? '' : 'opacity-20'}`}>
                        ⭐
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {checkIn.actionItems && checkIn.actionItems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">실행항목</h3>
              <div className="space-y-2">
                {checkIn.actionItems.map((item: any, i: number) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${item.completed ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <span className={`text-lg ${item.completed ? '' : 'opacity-30'}`}>
                      {item.completed ? '✅' : '⬜'}
                    </span>
                    <div className="flex-1">
                      <span className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {item.action}
                      </span>
                      <div className="text-xs text-gray-400">
                        {item.assignee} {item.dueDate ? `· ${item.dueDate}까지` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 체크인 완료 폼 (매니저만, 예정 상태일 때) */}
      {isManager && !isCompleted && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-800">체크인 기록 작성</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">소요 시간 (분)</label>
            <input
              type="number"
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
              min={5} max={480}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">핵심 논의사항</label>
            <textarea
              value={form.keyTakeaways}
              onChange={e => setForm(f => ({ ...f, keyTakeaways: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              rows={3}
              placeholder="주요 논의 내용, 합의사항 등"
            />
          </div>

          {/* 에너지/만족도 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">에너지 레벨 (팀원)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, energyLevel: n }))}
                    className={`text-2xl transition-all ${n <= form.energyLevel ? 'scale-110' : 'opacity-30 hover:opacity-60'}`}
                  >
                    🔋
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-1">{form.energyLevel}/5</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">업무 만족도</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, satisfactionLevel: n }))}
                    className={`text-2xl transition-all ${n <= form.satisfactionLevel ? 'scale-110' : 'opacity-30 hover:opacity-60'}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-1">{form.satisfactionLevel}/5</div>
            </div>
          </div>

          {/* 실행항목 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">실행항목 (Action Items)</label>
              <button type="button" onClick={addActionItem} className="text-sm text-blue-600 hover:text-blue-800">
                + 추가
              </button>
            </div>
            {form.actionItems.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={item.action}
                  onChange={e => updateActionItem(i, 'action', e.target.value)}
                  placeholder="실행항목"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  value={item.assignee}
                  onChange={e => updateActionItem(i, 'assignee', e.target.value)}
                  placeholder="담당자"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={item.dueDate}
                  onChange={e => updateActionItem(i, 'dueDate', e.target.value)}
                  className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>

          {/* 다음 체크인 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">다음 체크인 예정일</label>
            <input
              type="datetime-local"
              value={form.nextCheckInDate}
              onChange={e => setForm(f => ({ ...f, nextCheckInDate: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => router.back()}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={() => completeMutation.mutate(form)}
              disabled={completeMutation.isPending}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {completeMutation.isPending ? '처리 중...' : '체크인 완료'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
