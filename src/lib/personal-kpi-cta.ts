export type PersonalKpiTabKey = 'mine' | 'review' | 'history' | 'ai'

export type PersonalKpiHeroCtaAction = 'create' | 'ai' | 'history' | 'review'

export type PersonalKpiSubmitCtaState = {
  disabled: boolean
  reason?: string
}

export const PERSONAL_KPI_REVIEW_CTA_LABEL = '검토 대기 보기'

export function getPersonalKpiHeroCtaTransition(action: PersonalKpiHeroCtaAction): {
  nextTab: PersonalKpiTabKey
  openEditor: boolean
} {
  switch (action) {
    case 'create':
      return {
        nextTab: 'mine',
        openEditor: true,
      }
    case 'ai':
      return {
        nextTab: 'ai',
        openEditor: false,
      }
    case 'history':
      return {
        nextTab: 'history',
        openEditor: false,
      }
    case 'review':
      return {
        nextTab: 'review',
        openEditor: false,
      }
    default:
      return {
        nextTab: 'mine',
        openEditor: false,
      }
  }
}

export function getPersonalKpiSubmitCtaState(params: {
  canSubmit: boolean
  totalCount: number
  selectedKpiStatus?: string | null
  hasSelectedKpi: boolean
  workflowSaving: boolean
}): PersonalKpiSubmitCtaState {
  if (!params.canSubmit) {
    return {
      disabled: true,
      reason: '제출 권한이 없습니다.',
    }
  }

  if (params.totalCount === 0) {
    return {
      disabled: true,
      reason: '제출하려면 KPI를 먼저 1개 이상 작성하세요.',
    }
  }

  if (!params.hasSelectedKpi) {
    return {
      disabled: true,
      reason: '제출하려면 제출할 KPI를 먼저 선택하세요.',
    }
  }

  if (params.selectedKpiStatus !== 'DRAFT') {
    return {
      disabled: true,
      reason: '제출하려면 선택한 KPI가 초안 상태여야 합니다.',
    }
  }

  if (params.workflowSaving) {
    return {
      disabled: true,
      reason: '제출을 처리하고 있습니다.',
    }
  }

  return {
    disabled: false,
    reason: '선택한 초안 KPI를 제출할 수 있습니다.',
  }
}
