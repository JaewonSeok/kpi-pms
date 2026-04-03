import type { FeedbackAdminReviewScope, Prisma, SystemRole } from '@prisma/client'

async function getPrisma() {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

export const FEEDBACK_ADMIN_SCOPE_LABELS: Record<FeedbackAdminReviewScope, string> = {
  NONE: '해당 없음',
  ALL_REVIEWS_MANAGE: '모든 리뷰 사이클/템플릿 관리',
  ALL_REVIEWS_MANAGE_AND_CONTENT: '모든 리뷰 사이클/템플릿 관리 + 모든 리뷰 내용 열람 및 수정',
  COLLABORATOR_REVIEWS_MANAGE: '공동 작업자인 리뷰 사이클/템플릿 관리',
  COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT:
    '공동 작업자인 리뷰 사이클/템플릿 관리 + 공동 작업자인 리뷰 내용 열람 및 수정',
}

export const FEEDBACK_ADMIN_SCOPE_DESCRIPTIONS: Record<FeedbackAdminReviewScope, string> = {
  NONE: '리뷰 관리자 권한을 부여하지 않습니다.',
  ALL_REVIEWS_MANAGE: '조직 전체 리뷰 사이클과 템플릿 설정을 관리할 수 있습니다.',
  ALL_REVIEWS_MANAGE_AND_CONTENT:
    '조직 전체 리뷰 사이클과 템플릿을 관리하고, 모든 리뷰 내용도 열람 및 수정할 수 있습니다.',
  COLLABORATOR_REVIEWS_MANAGE:
    '공동 작업자로 지정된 리뷰 사이클과 템플릿만 관리할 수 있습니다.',
  COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT:
    '공동 작업자로 지정된 리뷰 사이클과 템플릿을 관리하고, 해당 리뷰 내용도 열람 및 수정할 수 있습니다.',
}

export type FeedbackReviewAdminAccess = {
  isGlobalAdmin: boolean
  reviewScopes: FeedbackAdminReviewScope[]
  sourceGroups: Array<{
    id: string
    groupName: string
    reviewScope: FeedbackAdminReviewScope
  }>
  summaryScope: FeedbackAdminReviewScope
  summaryLabel: string
  summaryDescription: string
  canManageAllRounds: boolean
  canManageCollaboratorRounds: boolean
  canReadAllContent: boolean
  canReadCollaboratorContent: boolean
}

const FEEDBACK_ADMIN_GROUP_SELECT = {
  id: true,
  groupName: true,
  reviewScope: true,
} satisfies Prisma.FeedbackAdminGroupSelect

function buildSummaryScope(params: {
  isGlobalAdmin: boolean
  canManageAllRounds: boolean
  canReadAllContent: boolean
  canManageCollaboratorRounds: boolean
  canReadCollaboratorContent: boolean
}): FeedbackAdminReviewScope {
  if (params.isGlobalAdmin || params.canReadAllContent) {
    return 'ALL_REVIEWS_MANAGE_AND_CONTENT'
  }
  if (params.canManageAllRounds) {
    return 'ALL_REVIEWS_MANAGE'
  }
  if (params.canReadCollaboratorContent) {
    return 'COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT'
  }
  if (params.canManageCollaboratorRounds) {
    return 'COLLABORATOR_REVIEWS_MANAGE'
  }
  return 'NONE'
}

export function buildFeedbackReviewAdminAccess(params: {
  actorRole: SystemRole
  groups: Array<{
    id: string
    groupName: string
    reviewScope: FeedbackAdminReviewScope
  }>
}): FeedbackReviewAdminAccess {
  const isGlobalAdmin = params.actorRole === 'ROLE_ADMIN'
  const reviewScopes = Array.from(new Set(params.groups.map((group) => group.reviewScope)))

  const canManageAllRounds =
    isGlobalAdmin ||
    reviewScopes.includes('ALL_REVIEWS_MANAGE') ||
    reviewScopes.includes('ALL_REVIEWS_MANAGE_AND_CONTENT')
  const canReadAllContent = isGlobalAdmin || reviewScopes.includes('ALL_REVIEWS_MANAGE_AND_CONTENT')
  const canManageCollaboratorRounds =
    canManageAllRounds ||
    reviewScopes.includes('COLLABORATOR_REVIEWS_MANAGE') ||
    reviewScopes.includes('COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT')
  const canReadCollaboratorContent =
    canReadAllContent || reviewScopes.includes('COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT')

  const summaryScope = buildSummaryScope({
    isGlobalAdmin,
    canManageAllRounds,
    canReadAllContent,
    canManageCollaboratorRounds,
    canReadCollaboratorContent,
  })

  return {
    isGlobalAdmin,
    reviewScopes,
    sourceGroups: params.groups,
    summaryScope,
    summaryLabel: isGlobalAdmin ? '전역 마스터 리뷰 관리자' : FEEDBACK_ADMIN_SCOPE_LABELS[summaryScope],
    summaryDescription: isGlobalAdmin
      ? '전역 관리자 권한으로 모든 리뷰 사이클, 템플릿, 리뷰 내용에 접근할 수 있습니다.'
      : FEEDBACK_ADMIN_SCOPE_DESCRIPTIONS[summaryScope],
    canManageAllRounds,
    canManageCollaboratorRounds,
    canReadAllContent,
    canReadCollaboratorContent,
  }
}

export async function getFeedbackReviewAdminAccess(params: {
  employeeId: string
  actorRole: SystemRole
  orgId: string
}) {
  if (params.actorRole === 'ROLE_ADMIN') {
    return buildFeedbackReviewAdminAccess({
      actorRole: params.actorRole,
      groups: [],
    })
  }

  const prisma = await getPrisma()
  const memberships = await prisma.feedbackAdminGroupMember.findMany({
    where: {
      employeeId: params.employeeId,
      group: {
        orgId: params.orgId,
      },
    },
    select: {
      group: {
        select: FEEDBACK_ADMIN_GROUP_SELECT,
      },
    },
  })

  return buildFeedbackReviewAdminAccess({
    actorRole: params.actorRole,
    groups: memberships.map((membership) => membership.group),
  })
}

export async function getCollaboratorRoundIds(params: {
  employeeId: string
  roundIds?: string[]
}) {
  const prisma = await getPrisma()
  const rows = await prisma.feedbackRoundCollaborator.findMany({
    where: {
      employeeId: params.employeeId,
      ...(params.roundIds?.length ? { roundId: { in: params.roundIds } } : {}),
    },
    select: {
      roundId: true,
    },
  })

  return new Set(rows.map((row) => row.roundId))
}

export async function canManageFeedbackRoundByAccess(params: {
  access: FeedbackReviewAdminAccess
  employeeId: string
  roundId: string
}) {
  if (params.access.canManageAllRounds) return true
  if (!params.access.canManageCollaboratorRounds) return false

  const prisma = await getPrisma()
  const collaboration = await prisma.feedbackRoundCollaborator.findUnique({
    where: {
      roundId_employeeId: {
        roundId: params.roundId,
        employeeId: params.employeeId,
      },
    },
    select: {
      id: true,
    },
  })

  return Boolean(collaboration)
}

export async function canReadFeedbackRoundContentByAccess(params: {
  access: FeedbackReviewAdminAccess
  employeeId: string
  roundId: string
}) {
  if (params.access.canReadAllContent) return true
  if (!params.access.canReadCollaboratorContent) return false

  const prisma = await getPrisma()
  const collaboration = await prisma.feedbackRoundCollaborator.findUnique({
    where: {
      roundId_employeeId: {
        roundId: params.roundId,
        employeeId: params.employeeId,
      },
    },
    select: {
      id: true,
    },
  })

  return Boolean(collaboration)
}
