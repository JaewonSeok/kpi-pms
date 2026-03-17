'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'

interface MonthlyData {
  yearMonth: string
  achievementRate: number
  kpiName: string
}

export function MonthlyTrendChart({ data }: { data: MonthlyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 120]} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [`${value}%`, '달성률']}
          labelStyle={{ color: '#374151' }}
        />
        <Line
          type="monotone"
          dataKey="achievementRate"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ fill: '#2563eb', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface RadarData {
  subject: string
  score: number
  fullMark: number
}

export function KpiRadarChart({ data }: { data: RadarData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar
          name="KPI 달성률"
          dataKey="score"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.2}
        />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export function AchievementGauge({ value, max = 100 }: { value: number; max?: number }) {
  const percentage = Math.min((value / max) * 100, 100)
  const color = percentage >= 100 ? '#22c55e' : percentage >= 70 ? '#3b82f6' : '#f97316'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${percentage}, 100`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{Math.round(value)}%</span>
        </div>
      </div>
    </div>
  )
}
