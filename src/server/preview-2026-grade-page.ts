import type { CycleStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_ORGANIZATION_WEIGHTS_2026,
  resolveOrganizationWeights2026,
} from '@/lib/policy-2026-organization-weights'
import type { OrganizationWeights2026 } from '@/lib/validations'

// A1 시연 미리보기 (/admin/preview-2026-grade) server loader.
// 활성 사이클 1건 + 회사명 + 가중치(stored/default) 만 조회한다.
// employees / department_score_intakes / evaluations 등 다른 테이블 조회 0. prisma write 0.
//
// 권한 게이트는 페이지 레벨에서 ROLE_ADMIN 가드(eval-cycles 등 admin 로더 동일 패턴) —
// 본 loader는 권한 검증 안 함.
//
// 옵션 (b): 향후 활성 사이클의 department_score_intakes 평균을 default 슬라이더 값으로
//   자동 채울 수 있음. 본 loader는 미터치 — 호출자(client)가 슬라이더 입력 관리.

export type Preview2026GradePagePreloadSource = 'stored' | 'default'

export type Preview2026GradePageViewModel = {
  cycleName: string | null
  cycleStatus: CycleStatus | null
  companyName: string | null
  weights: OrganizationWeights2026
  preloadSource: Preview2026GradePagePreloadSource
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 설정 객체에 policy2026OrganizationWeights 키가 존재하면 'stored'. 그 외 'default'.
// schema 통과 여부와는 별개 — resolveOrganizationWeights2026 가 invalid 값일 때 DEFAULT 로
// fallback 하지만, 본 함수는 "저장 시도 흔적이 있느냐" 만 판정한다 (UI 헤더 라벨용).
//
// 순수 변환 함수 — DB·prisma 비의존. 단위 테스트로 검증.
export function resolvePreloadSource2026(
  cycleConfig: unknown
): Preview2026GradePagePreloadSource {
  if (!isRecord(cycleConfig)) return 'default'
  return 'policy2026OrganizationWeights' in cycleConfig ? 'stored' : 'default'
}

// 활성 사이클(status≠CLOSED 중 createdAt 최신) 1건 + 조직명 + 가중치 뷰모델.
// 활성 사이클 없으면 안전 fallback (cycleName/status/companyName=null, weights=DEFAULT, preloadSource='default').
export async function getPreview2026GradePageData(): Promise<Preview2026GradePageViewModel> {
  const activeCycle = await prisma.evalCycle.findFirst({
    where: { status: { not: 'CLOSED' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      cycleName: true,
      status: true,
      orgId: true,
      performanceDesignConfig: true,
    },
  })

  if (!activeCycle) {
    return {
      cycleName: null,
      cycleStatus: null,
      companyName: null,
      weights: DEFAULT_ORGANIZATION_WEIGHTS_2026,
      preloadSource: 'default',
    }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: activeCycle.orgId },
    select: { name: true },
  })

  const weights = resolveOrganizationWeights2026(activeCycle.performanceDesignConfig)
  const preloadSource = resolvePreloadSource2026(activeCycle.performanceDesignConfig)

  return {
    cycleName: activeCycle.cycleName,
    cycleStatus: activeCycle.status,
    companyName: organization?.name ?? null,
    weights,
    preloadSource,
  }
}
