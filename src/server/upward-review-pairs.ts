import type { PrismaClient } from '@prisma/client'
import type { EvaluationRole } from '@/lib/evaluation-leader-role'
import { selectEvaluationTargets } from '@/lib/evaluation-targets'
import { prisma } from '@/lib/prisma'
import { buildUpwardChainSuggestions, parseUpwardReviewSettings } from '@/lib/upward-review'
import { loadStageEvaluatorsForTargets } from '@/server/evaluation-performance-assignments'

type PairEmployee = {
  id: string
  empName: string
  role: EvaluationRole
  jobTitle: string | null
  status: string
  deptId: string
  teamLeaderId?: string | null
}

/**
 * 상향평가 추천 짝: 각자 업적평가 체인의 바로 위 평가자를 평가한다.
 * 평가자 후보는 사이클의 업적평가 대상(selectEvaluationTargets), 평가자 결정은 업적평가 배정(배정 행 우선, 없으면 기본 배정)이다.
 * 직원 슬롯(teamLeaderId · sectionChiefId · divisionHeadId)은 읽지 않는다.
 */
export async function buildUpwardRoundPairSuggestions(params: {
  db?: PrismaClient
  orgId: string
  round: {
    evalCycleId: string
    minRaters: number
    documentSettings: unknown
    feedbacks: Array<{ giverId: string; receiverId: string }>
  }
  // 사이클 조직의 재직자(ACTIVE)
  employees: PairEmployee[]
  evaluateeId?: string | null
}) {
  const db = params.db ?? prisma
  const departments = await db.department.findMany({
    where: { orgId: params.orgId },
    select: { id: true },
  })
  const candidates = selectEvaluationTargets(params.employees, {
    orgDepartmentIds: new Set(departments.map((department) => department.id)),
  })
  const stageEvaluators = await loadStageEvaluatorsForTargets({
    db,
    evalCycleId: params.round.evalCycleId,
    targetIds: candidates.map((candidate) => candidate.id),
  })

  return buildUpwardChainSuggestions({
    candidates,
    stageEvaluatorsByCandidate: new Map(
      candidates.map((candidate) => [candidate.id, stageEvaluators.get(candidate.id)?.stages ?? []])
    ),
    employeesById: new Map(params.employees.map((employee) => [employee.id, employee])),
    targetTypes: parseUpwardReviewSettings(params.round.documentSettings).targetTypes,
    minRaters: params.round.minRaters,
    evaluateeId: params.evaluateeId,
    existingPairs: params.round.feedbacks.map((feedback) => ({
      evaluatorId: feedback.giverId,
      evaluateeId: feedback.receiverId,
    })),
  })
}
