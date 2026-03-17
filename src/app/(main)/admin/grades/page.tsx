'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCurrentYear } from '@/lib/utils'

const DEFAULT_GRADES = [
  { gradeOrder: 1, gradeName: 'A+', baseScore: 100, minScore: 96, maxScore: 100, levelName: '최우수', description: '목표 대비 월등히 탁월한 성과', targetDistRate: 5, isActive: true },
  { gradeOrder: 2, gradeName: 'A0', baseScore: 95, minScore: 91, maxScore: 95, levelName: '우수', description: '목표 대비 탁월한 성과', targetDistRate: 10, isActive: true },
  { gradeOrder: 3, gradeName: 'B+', baseScore: 90, minScore: 86, maxScore: 90, levelName: '현저', description: '목표 대비 상당히 우수한 성과', targetDistRate: 15, isActive: true },
  { gradeOrder: 4, gradeName: 'B0', baseScore: 85, minScore: 81, maxScore: 85, levelName: '양호', description: '목표를 충실히 달성', targetDistRate: 30, isActive: true },
  { gradeOrder: 5, gradeName: 'C0', baseScore: 80, minScore: 76, maxScore: 80, levelName: '보통', description: '목표 대비 무난한 성과', targetDistRate: 25, isActive: true },
  { gradeOrder: 6, gradeName: 'D+', baseScore: 75, minScore: 71, maxScore: 75, levelName: '미흡', description: '목표 대비 다소 부족', targetDistRate: 10, isActive: true },
  { gradeOrder: 7, gradeName: 'D0', baseScore: 70, minScore: 66, maxScore: 70, levelName: '불량', description: '목표 대비 상당히 부족', targetDistRate: 3, isActive: true },
  { gradeOrder: 8, gradeName: 'E+', baseScore: 65, minScore: 61, maxScore: 65, levelName: '매우불량', description: '목표 대비 현저히 부족', targetDistRate: 1, isActive: true },
  { gradeOrder: 9, gradeName: 'E0', baseScore: 60, minScore: 0, maxScore: 60, levelName: '최하', description: '성과가 매우 저조', targetDistRate: 1, isActive: true },
]

export default function GradesPage() {
  const currentYear = getCurrentYear()
  const [year, setYear] = useState(currentYear)
  const [grades, setGrades] = useState(DEFAULT_GRADES)
  const [overlapError, setOverlapError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['grades', year],
    queryFn: async () => {
      const res = await fetch(`/api/admin/grades/${year}`)
      const json = await res.json()
      return json.data
    },
  })

  useEffect(() => {
    if (data && data.length > 0) {
      setGrades(data)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async (grades: any[]) => {
      const res = await fetch(`/api/admin/grades/${year}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || '저장 실패')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades', year] })
      alert('등급 설정이 저장되었습니다.')
    },
    onError: (err: Error) => {
      alert(err.message)
    },
  })

  const copyMutation = useMutation({
    mutationFn: async (sourceYear: number) => {
      const res = await fetch(`/api/admin/grades/${year}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceYear }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || '복사 실패')
      return json.data
    },
    onSuccess: (data) => {
      setGrades(data)
      queryClient.invalidateQueries({ queryKey: ['grades', year] })
      alert(`${year - 1}년 등급 설정이 복사되었습니다.`)
    },
    onError: (err: Error) => alert(err.message),
  })

  const validateOverlap = (updated: typeof grades) => {
    const sorted = [...updated].sort((a, b) => a.minScore - b.minScore)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].maxScore >= sorted[i + 1].minScore) {
        return `${sorted[i].gradeName}와 ${sorted[i + 1].gradeName}의 점수 범위가 겹칩니다.`
      }
    }
    return null
  }

  const handleGradeChange = (index: number, field: string, value: any) => {
    const updated = [...grades]
    updated[index] = { ...updated[index], [field]: value }
    setGrades(updated)
    setOverlapError(validateOverlap(updated))
  }

  const addGrade = () => {
    if (grades.length >= 10) return alert('최대 10단계까지 설정 가능합니다.')
    setGrades([...grades, {
      gradeOrder: grades.length + 1,
      gradeName: '',
      baseScore: 0,
      minScore: 0,
      maxScore: 0,
      levelName: '',
      description: '',
      targetDistRate: 0,
      isActive: true,
    }])
  }

  const removeGrade = (index: number) => {
    if (grades.length <= 2) return alert('최소 2단계 이상 필요합니다.')
    const updated = grades.filter((_, i) => i !== index).map((g, i) => ({ ...g, gradeOrder: i + 1 }))
    setGrades(updated)
    setOverlapError(validateOverlap(updated))
  }

  const totalDistRate = grades.reduce((sum, g) => sum + (g.targetDistRate || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">평가 등급 설정</h1>
          <p className="text-gray-500 mt-1">연도별 평가 등급 체계를 관리합니다</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <button
            onClick={() => copyMutation.mutate(year - 1)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {year - 1}년에서 복사
          </button>
          <button
            onClick={() => setGrades(DEFAULT_GRADES)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            기본 템플릿
          </button>
        </div>
      </div>

      {overlapError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {overlapError}
        </div>
      )}

      {/* 등급 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">순서</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">등급명</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">기준점수</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">최솟값</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">최댓값</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">수준명</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">권장분포(%)</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">평가기준</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grades.map((grade, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400">{grade.gradeOrder}</td>
                  <td className="px-3 py-2">
                    <input
                      value={grade.gradeName}
                      onChange={e => handleGradeChange(index, 'gradeName', e.target.value)}
                      maxLength={5}
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-sm font-bold text-center"
                      placeholder="A+"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={grade.baseScore}
                      onChange={e => handleGradeChange(index, 'baseScore', Number(e.target.value))}
                      min={0} max={100}
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={grade.minScore}
                      onChange={e => handleGradeChange(index, 'minScore', Number(e.target.value))}
                      min={0} max={100}
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={grade.maxScore}
                      onChange={e => handleGradeChange(index, 'maxScore', Number(e.target.value))}
                      min={0} max={100}
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={grade.levelName}
                      onChange={e => handleGradeChange(index, 'levelName', e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={grade.targetDistRate || 0}
                      onChange={e => handleGradeChange(index, 'targetDistRate', Number(e.target.value))}
                      min={0} max={100}
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={grade.description || ''}
                      onChange={e => handleGradeChange(index, 'description', e.target.value)}
                      maxLength={200}
                      className="w-48 px-2 py-1 border border-gray-200 rounded text-sm"
                      placeholder="평가 기준 설명"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeGrade(index)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-4">
            <button
              onClick={addGrade}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + 등급 추가
            </button>
            <span className="text-sm text-gray-500">
              권장 분포율 합계: <span className={totalDistRate === 100 ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>{totalDistRate}%</span>
              {totalDistRate !== 100 && ' (100%가 되도록 설정 권장)'}
            </span>
          </div>
          <button
            onClick={() => saveMutation.mutate(grades)}
            disabled={!!overlapError || saveMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
