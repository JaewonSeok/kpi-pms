import type { Session } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { EVALUATION_POLICY_2026 } from '@/lib/evaluation-policy-2026'
import {
  readPolicy2026OfficialReadinessEnabled,
  writePolicy2026OfficialReadinessEnabledToConfig,
} from '@/lib/evaluation-policy-2026-preview-metadata'
import { AppError } from '@/lib/utils'
import { canAccessEvaluationPreview2026 } from '@/server/evaluation-preview-2026-loader'

type OfficialReadinessCycleDb = Pick<typeof prisma, 'evalCycle'>

type OfficialReadinessSessionUser = NonNullable<Session['user']> & {
  id: string
  role: string
}

export const EvaluationPolicy2026OfficialReadinessCyclePatchSchema = z.object({
  evalCycleId: z.string().trim().min(1),
  enabled: z.boolean(),
})

export type EvaluationPolicy2026OfficialReadinessCyclePatchInput = z.infer<
  typeof EvaluationPolicy2026OfficialReadinessCyclePatchSchema
>

export type EvaluationPolicy2026OfficialReadinessCyclePatchResult = {
  policyVersion: string
  evalCycleId: string
  evalYear: number
  cycleName: string
  enabled: boolean
  disabledOtherCycleIds: string[]
  officialScoresChanged: false
  officialGradesChanged: false
  aiScoreExclusionChanged: false
  backfillApplied: false
  notes: string[]
}

function getSessionUser(session: Session): OfficialReadinessSessionUser | null {
  const user = session.user as Partial<OfficialReadinessSessionUser> | undefined
  if (!user?.id || !user.role) return null
  return user as OfficialReadinessSessionUser
}

function assertOfficialCycleAccess(session: Session) {
  const user = getSessionUser(session)
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }
  if (!canAccessEvaluationPreview2026(session)) {
    throw new AppError(403, 'FORBIDDEN', '2026 readiness 대상 주기 지정은 HR 관리자만 사용할 수 있습니다.')
  }
  return user
}

export async function updatePolicy2026OfficialReadinessCycleForSession(
  params: {
    session: Session
    input: EvaluationPolicy2026OfficialReadinessCyclePatchInput
  },
  options: {
    db?: OfficialReadinessCycleDb
  } = {}
): Promise<EvaluationPolicy2026OfficialReadinessCyclePatchResult> {
  assertOfficialCycleAccess(params.session)
  const db = options.db ?? prisma

  const targetCycle = await db.evalCycle.findUnique({
    where: { id: params.input.evalCycleId },
    select: {
      id: true,
      orgId: true,
      evalYear: true,
      cycleName: true,
      performanceDesignConfig: true,
    },
  })

  if (!targetCycle) {
    throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }

  const peerCycles = params.input.enabled
    ? await db.evalCycle.findMany({
        where: {
          orgId: targetCycle.orgId,
          evalYear: targetCycle.evalYear,
        },
        select: {
          id: true,
          cycleName: true,
          performanceDesignConfig: true,
        },
      })
    : [targetCycle]

  const disabledOtherCycleIds: string[] = []

  for (const cycle of peerCycles) {
    const shouldEnable = params.input.enabled && cycle.id === targetCycle.id
    const currentlyEnabled = readPolicy2026OfficialReadinessEnabled(cycle.performanceDesignConfig)
    if (currentlyEnabled === shouldEnable) continue

    await db.evalCycle.update({
      where: { id: cycle.id },
      data: {
        performanceDesignConfig: writePolicy2026OfficialReadinessEnabledToConfig(
          cycle.performanceDesignConfig,
          shouldEnable
        ),
      },
    })

    if (!shouldEnable && cycle.id !== targetCycle.id) {
      disabledOtherCycleIds.push(cycle.id)
    }
  }

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    evalCycleId: targetCycle.id,
    evalYear: targetCycle.evalYear,
    cycleName: targetCycle.cycleName,
    enabled: params.input.enabled,
    disabledOtherCycleIds,
    officialScoresChanged: false,
    officialGradesChanged: false,
    aiScoreExclusionChanged: false,
    backfillApplied: false,
    notes: [
      '공식 점수 전환이 아니라 readiness 대상 주기 지정입니다.',
      'EvalCycle.performanceDesignConfig metadata만 업데이트합니다.',
      'Evaluation.totalScore와 Evaluation.gradeId는 업데이트하지 않습니다.',
      '공식 2026 scoring/grade/AI score exclusion feature flag는 변경하지 않습니다.',
    ],
  }
}
