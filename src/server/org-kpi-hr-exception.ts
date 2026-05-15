import type { SystemRole } from '@prisma/client'
import type { OrgKpiScope } from '../lib/org-kpi-scope'
import { AppError } from '../lib/utils'

export type OrgKpiHrExceptionInput = {
  exceptionApproved: boolean
  reason?: string | null
}

export type OrgKpiHrExceptionActor = {
  id: string
  role: SystemRole
}

export type OrgKpiHrExceptionCurrentState = {
  id: string
  kpiName: string
  scope: OrgKpiScope
  mboExceptionApproved?: boolean | null
  mboExceptionReason?: string | null
  mboExceptionApprovedById?: string | null
  mboExceptionApprovedAt?: Date | string | null
  totalScore?: never
  grade?: never
}

export function canManageOrgKpiHrException(role: SystemRole) {
  return role === 'ROLE_ADMIN'
}

function normalizeReason(value: string | null | undefined) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length ? trimmed : null
}

function serializeDate(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

export function buildOrgKpiHrExceptionUpdate2026(params: {
  current: OrgKpiHrExceptionCurrentState
  actor: OrgKpiHrExceptionActor
  input: OrgKpiHrExceptionInput
  now?: Date
}) {
  if (!canManageOrgKpiHrException(params.actor.role)) {
    throw new AppError(403, 'FORBIDDEN', '팀 KPI 예외 승인은 HR/admin 권한에서만 가능합니다.')
  }

  if (params.current.scope !== 'team') {
    throw new AppError(400, 'ORG_KPI_EXCEPTION_TEAM_ONLY', '팀 KPI만 예외 승인 대상으로 지정할 수 있습니다.')
  }

  const reason = normalizeReason(params.input.reason)

  if (params.input.exceptionApproved && (!reason || reason.length < 5)) {
    throw new AppError(400, 'MBO_EXCEPTION_REASON_REQUIRED', '예외 승인 사유를 5자 이상 입력해 주세요.', {
      fieldErrors: {
        reason: '예외 승인 사유를 5자 이상 입력해 주세요.',
      },
    })
  }

  const approvedAt = params.input.exceptionApproved ? params.now ?? new Date() : null

  const data = params.input.exceptionApproved
    ? {
        mboExceptionApproved: true,
        mboExceptionReason: reason,
        mboExceptionApprovedById: params.actor.id,
        mboExceptionApprovedAt: approvedAt,
      }
    : {
        mboExceptionApproved: false,
        mboExceptionReason: null,
        mboExceptionApprovedById: null,
        mboExceptionApprovedAt: null,
      }

  return {
    data,
    oldValue: {
      mboExceptionApproved: params.current.mboExceptionApproved ?? false,
      mboExceptionReason: params.current.mboExceptionReason ?? null,
      mboExceptionApprovedById: params.current.mboExceptionApprovedById ?? null,
      mboExceptionApprovedAt: serializeDate(params.current.mboExceptionApprovedAt),
    },
    newValue: {
      mboExceptionApproved: data.mboExceptionApproved,
      mboExceptionReason: data.mboExceptionReason,
      mboExceptionApprovedById: data.mboExceptionApprovedById,
      mboExceptionApprovedAt: serializeDate(data.mboExceptionApprovedAt),
      note: params.input.exceptionApproved
        ? '2026 MBO 팀 KPI 조직목표 예외 승인'
        : '2026 MBO 팀 KPI 조직목표 예외 승인 취소',
    },
  }
}
