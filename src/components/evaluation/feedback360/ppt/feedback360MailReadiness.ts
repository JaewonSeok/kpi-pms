'use client'

export type Feedback360MailChannel = 'APP' | 'EMAIL' | 'EMAIL_AND_APP'
export type Feedback360MailReadinessStatus =
  | 'READY'
  | 'CONFIG_REQUIRED'
  | 'NO_TARGETS'
  | 'NO_PERMISSION'
  | 'PARTIAL_SKIP'
  | 'FAILED'
  | 'DONE'

export type Feedback360MailReadinessParams = {
  contextLabel: string
  alertType: string
  targetCount: number
  emailRecipientCount: number
  appRecipientCount: number
  missingEmailCount?: number
  skippedCount?: number
  canManage: boolean
  providerConfigured?: boolean | 'unknown'
  preferredChannel?: Feedback360MailChannel
  previewSubject?: string
  previewBody?: string
  lastStatus?: Feedback360MailReadinessStatus
  lastFailureReason?: string | null
}

export type Feedback360MailChannelCard = {
  id: Feedback360MailChannel
  label: string
  description: string
  available: boolean
  statusLabel: string
}

export type Feedback360MailReadinessViewModel = {
  contextLabel: string
  alertType: string
  preferredChannel: Feedback360MailChannel
  channelLabel: string
  status: Feedback360MailReadinessStatus
  statusLabel: string
  statusTone: 'emerald' | 'amber' | 'rose' | 'slate'
  disabledReason: string
  canPreview: boolean
  canSendEmail: boolean
  canSendAppNotification: boolean
  canRunActualSend: boolean
  summaryRows: Array<{ label: string; value: string; tone?: 'emerald' | 'amber' | 'rose' | 'slate' }>
  channelCards: Feedback360MailChannelCard[]
  preview: {
    subject: string
    body: string
    recipientsLabel: string
    channelLabel: string
    safetyCopy: string
  }
  result: {
    title: string
    message: string
    successCount: number
    failureCount: number
    skippedCount: number
    emailSuccessCount: number
    emailFailureCount: number
    appSuccessCount: number
    appFailureCount: number
  }
  guidance: string[]
}

const CHANNEL_LABELS: Record<Feedback360MailChannel, string> = {
  APP: '앱 알림',
  EMAIL: '이메일',
  EMAIL_AND_APP: '이메일 + 앱 알림',
}

function formatCount(value: number) {
  return `${Math.max(0, value)}명`
}

function getStatusTone(status: Feedback360MailReadinessStatus): Feedback360MailReadinessViewModel['statusTone'] {
  switch (status) {
    case 'READY':
    case 'DONE':
      return 'emerald'
    case 'FAILED':
    case 'NO_PERMISSION':
      return 'rose'
    case 'CONFIG_REQUIRED':
    case 'NO_TARGETS':
    case 'PARTIAL_SKIP':
      return 'amber'
    default:
      return 'slate'
  }
}

function getStatusLabel(status: Feedback360MailReadinessStatus) {
  switch (status) {
    case 'READY':
      return '준비 가능'
    case 'CONFIG_REQUIRED':
      return '설정 필요'
    case 'NO_TARGETS':
      return '대상자 없음'
    case 'NO_PERMISSION':
      return '권한 없음'
    case 'PARTIAL_SKIP':
      return '일부 스킵'
    case 'FAILED':
      return '실패'
    case 'DONE':
      return '완료'
    default:
      return '상태 확인'
  }
}

export function buildFeedback360MailReadiness(
  params: Feedback360MailReadinessParams
): Feedback360MailReadinessViewModel {
  const preferredChannel = params.preferredChannel ?? 'EMAIL_AND_APP'
  const skippedCount = Math.max(0, params.skippedCount ?? 0)
  const missingEmailCount = Math.max(0, params.missingEmailCount ?? 0)
  const targetCount = Math.max(0, params.targetCount)
  const emailRecipientCount = Math.max(0, params.emailRecipientCount)
  const appRecipientCount = Math.max(0, params.appRecipientCount)
  const emailConfigured = params.providerConfigured === true
  const emailConfigUnknown = params.providerConfigured === 'unknown'
  const canSendEmail = params.canManage && emailConfigured && emailRecipientCount > 0
  const canSendAppNotification = params.canManage && appRecipientCount > 0

  let status: Feedback360MailReadinessStatus = params.lastStatus ?? 'READY'
  let disabledReason = ''

  if (!params.canManage) {
    status = 'NO_PERMISSION'
    disabledReason = '메일 발송 권한이 없습니다.'
  } else if (targetCount <= 0) {
    status = 'NO_TARGETS'
    disabledReason = '발송 대상자가 없습니다.'
  } else if (!emailConfigured && preferredChannel !== 'APP') {
    status = canSendAppNotification ? 'CONFIG_REQUIRED' : 'CONFIG_REQUIRED'
    disabledReason = '이메일 발송 설정이 완료되지 않았습니다.'
  } else if (missingEmailCount > 0 || skippedCount > 0) {
    status = 'PARTIAL_SKIP'
    disabledReason = '일부 대상자는 이메일 주소 또는 수신 조건을 확인해야 합니다.'
  } else if (params.lastFailureReason) {
    status = 'FAILED'
    disabledReason = params.lastFailureReason
  } else if (params.lastStatus === 'DONE') {
    status = 'DONE'
    disabledReason = '알림 발송 결과를 확인해 주세요.'
  } else {
    disabledReason = '실제 발송은 승인된 운영 환경에서만 진행하세요.'
  }

  const statusLabel = getStatusLabel(status)
  const channelLabel = CHANNEL_LABELS[preferredChannel]
  const providerStatusLabel = emailConfigured ? '설정 완료' : emailConfigUnknown ? '확인 불가' : '설정 필요'

  return {
    contextLabel: params.contextLabel,
    alertType: params.alertType,
    preferredChannel,
    channelLabel,
    status,
    statusLabel,
    statusTone: getStatusTone(status),
    disabledReason,
    canPreview: targetCount > 0,
    canSendEmail,
    canSendAppNotification,
    canRunActualSend: false,
    summaryRows: [
      { label: '알림 유형', value: params.alertType },
      { label: '채널 상태', value: channelLabel },
      { label: '발송 설정', value: providerStatusLabel, tone: emailConfigured ? 'emerald' : 'amber' },
      { label: '전체 대상자', value: formatCount(targetCount) },
      { label: '이메일 가능', value: formatCount(emailRecipientCount), tone: emailRecipientCount ? 'emerald' : 'amber' },
      { label: '앱 알림 가능', value: formatCount(appRecipientCount), tone: appRecipientCount ? 'emerald' : 'amber' },
      { label: '이메일 누락', value: formatCount(missingEmailCount), tone: missingEmailCount ? 'amber' : 'emerald' },
      { label: '스킵', value: formatCount(skippedCount), tone: skippedCount ? 'amber' : 'emerald' },
      { label: '상태', value: statusLabel, tone: getStatusTone(status) },
    ],
    channelCards: [
      {
        id: 'APP',
        label: CHANNEL_LABELS.APP,
        description: '시스템 안에서 확인하는 알림입니다.',
        available: canSendAppNotification,
        statusLabel: canSendAppNotification ? '준비 가능' : targetCount ? '대상 확인 필요' : '대상자 없음',
      },
      {
        id: 'EMAIL',
        label: CHANNEL_LABELS.EMAIL,
        description: '이메일 주소와 발송 설정이 모두 확인되어야 합니다.',
        available: canSendEmail,
        statusLabel: canSendEmail ? '준비 가능' : '설정 필요',
      },
      {
        id: 'EMAIL_AND_APP',
        label: CHANNEL_LABELS.EMAIL_AND_APP,
        description: '이메일과 앱 알림을 함께 준비합니다.',
        available: canSendEmail && canSendAppNotification,
        statusLabel: canSendEmail && canSendAppNotification ? '준비 가능' : '일부 준비 필요',
      },
    ],
    preview: {
      subject: params.previewSubject ?? `[360 다면평가] ${params.alertType}`,
      body:
        params.previewBody ??
        `${params.contextLabel} 대상자에게 ${params.alertType}을 안내합니다. 실제 발송 전 대상자와 채널 상태를 확인하세요.`,
      recipientsLabel: `전체 ${formatCount(targetCount)} · 이메일 ${formatCount(emailRecipientCount)} · 앱 알림 ${formatCount(appRecipientCount)}`,
      channelLabel,
      safetyCopy: '이 화면의 미리보기는 발송하지 않습니다. 실제 발송은 승인된 운영 환경에서만 진행하세요.',
    },
    result: {
      title: '발송 결과',
      message: params.lastFailureReason ?? disabledReason,
      successCount: params.lastStatus === 'DONE' ? targetCount - skippedCount : 0,
      failureCount: params.lastStatus === 'FAILED' ? Math.max(1, targetCount - skippedCount) : 0,
      skippedCount,
      emailSuccessCount: 0,
      emailFailureCount: canSendEmail ? 0 : emailRecipientCount,
      appSuccessCount: params.lastStatus === 'DONE' ? appRecipientCount : 0,
      appFailureCount: params.lastStatus === 'FAILED' ? appRecipientCount : 0,
    },
    guidance: [
      disabledReason,
      canSendAppNotification && !canSendEmail ? '현재는 앱 알림만 발송할 수 있습니다.' : '',
      missingEmailCount > 0 ? '이메일 주소가 없는 대상자는 앱 알림 대상자로만 표시됩니다.' : '',
      '알림 발송 결과를 확인해 주세요.',
    ].filter(Boolean),
  }
}
