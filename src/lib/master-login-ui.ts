import type {
  MasterLoginAccessSource,
  MasterLoginPermissionManagementReason,
} from '@/lib/master-login-shared'

export function isFixedMasterLoginAccessSource(source: MasterLoginAccessSource) {
  return source === 'owner' || source === 'legacy_admin'
}

export function resolveMasterLoginPermissionManagementState(input: {
  isAuthenticated: boolean
  hasActiveMasterLogin: boolean
}) {
  if (!input.isAuthenticated) {
    return {
      allowed: false,
      reason: 'AUTH_REQUIRED' as MasterLoginPermissionManagementReason,
      message: '세션을 확인한 뒤 다시 시도해 주세요.',
    }
  }

  if (input.hasActiveMasterLogin) {
    return {
      allowed: false,
      reason: 'MASTER_LOGIN_ACTIVE' as MasterLoginPermissionManagementReason,
      message:
        '마스터 로그인 진행 중에는 권한을 변경할 수 없습니다. 먼저 현재 세션을 종료해 주세요.',
    }
  }

  return {
    allowed: true,
    reason: 'NONE' as MasterLoginPermissionManagementReason,
    message: null,
  }
}

export function resolveMasterLoginPermissionToggleState(input: {
  isAuthenticated: boolean
  hasActiveMasterLogin: boolean
  accessSource: MasterLoginAccessSource
  pending: boolean
}) {
  if (input.pending) {
    return {
      disabled: true,
      reason: 'PENDING' as MasterLoginPermissionManagementReason,
      message: '권한 변경을 처리하는 중입니다.',
    }
  }

  const management = resolveMasterLoginPermissionManagementState({
    isAuthenticated: input.isAuthenticated,
    hasActiveMasterLogin: input.hasActiveMasterLogin,
  })

  if (!management.allowed) {
    return {
      disabled: true,
      reason: management.reason,
      message: management.message,
    }
  }

  if (isFixedMasterLoginAccessSource(input.accessSource)) {
    return {
      disabled: true,
      reason: 'FIXED_ACCESS_SOURCE' as MasterLoginPermissionManagementReason,
      message: '소유자 또는 기본 허용 HR 관리자 계정은 여기에서 변경할 수 없습니다.',
    }
  }

  return {
    disabled: false,
    reason: 'NONE' as MasterLoginPermissionManagementReason,
    message: null,
  }
}
