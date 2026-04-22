'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const STATUS_COLORS = {
  pending: '#cbd5e1',
  inProgress: '#60a5fa',
  submitted: '#34d399',
  rejected: '#f97316',
  confirmed: '#2563eb',
}

export function StatisticsTrendChart({
  data,
}: {
  data: Array<{ label: string; value: number }>
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value}%`, '평균 달성률']} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#2563eb"
          strokeWidth={3}
          dot={{ fill: '#2563eb', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function StatisticsStageStatusChart({
  data,
}: {
  data: Array<{
    label: string
    pending: number
    inProgress: number
    submitted: number
    rejected: number
    confirmed: number
  }>
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="pending" stackId="status" fill={STATUS_COLORS.pending} name="대기" />
        <Bar dataKey="inProgress" stackId="status" fill={STATUS_COLORS.inProgress} name="작성 중" />
        <Bar dataKey="submitted" stackId="status" fill={STATUS_COLORS.submitted} name="제출 완료 평가" />
        <Bar dataKey="rejected" stackId="status" fill={STATUS_COLORS.rejected} name="반려 평가" />
        <Bar dataKey="confirmed" stackId="status" fill={STATUS_COLORS.confirmed} name="최종 확정 평가" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function StatisticsDistributionChart({
  data,
  leftKey = 'ratio',
  leftLabel = '비율',
}: {
  data: Array<{ label: string; ratio: number; count?: number }>
  leftKey?: string
  leftLabel?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value}%`, leftLabel]} />
        <Bar dataKey={leftKey} fill="#1d4ed8" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function StatisticsComparisonChart({
  data,
  firstLabel,
  secondLabel,
}: {
  data: Array<{ label: string; first: number; second: number }>
  firstLabel: string
  secondLabel: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value}%`, '비율']} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="first" fill="#94a3b8" radius={[6, 6, 0, 0]} name={firstLabel} />
        <Bar dataKey="second" fill="#2563eb" radius={[6, 6, 0, 0]} name={secondLabel} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function StatisticsHorizontalBarChart({
  data,
  valueLabel,
}: {
  data: Array<{ label: string; value: number }>
  valueLabel: string
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} width={88} />
        <Tooltip formatter={(value) => [value, valueLabel]} />
        <Bar dataKey="value" fill="#0f766e" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
