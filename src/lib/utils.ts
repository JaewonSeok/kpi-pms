import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    step?: string
    prismaCode?: string
  }
  pagination?: { page: number; pageSize: number; total: number }
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: {
      step?: string
      prismaCode?: string
    }
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function successResponse<T>(data: T, pagination?: ApiResponse<T>['pagination']) {
  return Response.json({ success: true, data, pagination })
}

export function errorResponse(
  error: unknown,
  defaultMessage = '요청 처리 중 오류가 발생했습니다.'
) {
  if (error instanceof AppError) {
    console[error.statusCode >= 500 ? 'error' : 'warn'](
      `[api] ${error.code} (${error.statusCode}) ${error.message}`
    )

    return Response.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details?.step ? { step: error.details.step } : {}),
          ...(error.details?.prismaCode ? { prismaCode: error.details.prismaCode } : {}),
        },
      },
      { status: error.statusCode }
    )
  }

  console.error(error)

  return Response.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: defaultMessage } },
    { status: 500 }
  )
}

export function calcAchievementRate(actual: number, target: number): number {
  if (target === 0) return 0
  return Math.round((actual / target) * 100 * 10) / 10
}

export function calcPdcaScore(
  planScore: number,
  doScore: number,
  checkScore: number,
  actScore: number
): number {
  return planScore * 0.3 + doScore * 0.4 + checkScore * 0.2 + actScore * 0.1
}

export function calcWeightedScore(score: number, weight: number): number {
  return Math.round(((score * weight) / 100) * 100) / 100
}

export function formatDate(date: Date | string): string {
  const value = new Date(date)
  return value.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatYearMonth(date: Date | string): string {
  const value = new Date(date)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getCurrentYear(): number {
  return new Date().getFullYear()
}

export function getCurrentYearMonth(): string {
  return formatYearMonth(new Date())
}

export const ROLE_LABELS: Record<string, string> = {
  ROLE_MEMBER: '구성원',
  ROLE_TEAM_LEADER: '팀장',
  ROLE_SECTION_CHIEF: '실장/부문장',
  ROLE_DIV_HEAD: '본부장',
  ROLE_CEO: 'CEO',
  ROLE_ADMIN: 'HR 관리자',
}

export const POSITION_LABELS: Record<string, string> = {
  MEMBER: '구성원',
  TEAM_LEADER: '팀장',
  SECTION_CHIEF: '실장/부문장',
  DIV_HEAD: '본부장',
  CEO: 'CEO',
}

export const KPI_TYPE_LABELS: Record<string, string> = {
  QUANTITATIVE: '정량',
  QUALITATIVE: '정성',
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  HIGH: '상',
  MEDIUM: '중',
  LOW: '하',
}

export const EVAL_STAGE_LABELS: Record<string, string> = {
  SELF: '자기 평가',
  FIRST: '1차 평가',
  SECOND: '2차 평가',
  FINAL: '최종 평가',
  CEO_ADJUST: '대표이사 확정',
}

export const CHECKIN_TYPE_LABELS: Record<string, string> = {
  WEEKLY: '주간 체크인',
  BIWEEKLY: '격주 체크인',
  MONTHLY: '월간 체크인',
  AD_HOC: '수시 체크인',
  MIDYEAR_REVIEW: '중간 점검',
  QUARTERLY: '분기 리뷰',
}

export const COMPENSATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성 중',
  UNDER_REVIEW: '검토 중',
  REVIEW_APPROVED: '검토 승인',
  REJECTED: '반려',
  FINAL_APPROVED: '최종 승인',
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)
}
