import { prisma } from '@/lib/prisma'
import { AI_COMPETENCY_GATE_VISIBLE_STATUS_LABELS } from '@/lib/ai-competency-gate-config'

export type AiCompetencyGatePromotionStatus = {
  status: 'NOT_ASSIGNED' | 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'RESUBMITTED' | 'PASSED' | 'FAILED' | 'CLOSED'
  statusLabel: string
  isSatisfied: boolean
  cycleId: string
  employeeId: string
  caseId?: string
}

export async function loadAiCompetencyGatePromotionStatuses(params: {
  evalCycleIds: string[]
  employeeIds: string[]
}) {
  if (!params.evalCycleIds.length || !params.employeeIds.length) {
    return new Map<string, AiCompetencyGatePromotionStatus>()
  }

  const assignments = await prisma.aiCompetencyGateAssignment.findMany({
    where: {
      employeeId: { in: params.employeeIds },
      cycle: {
        evalCycleId: { in: params.evalCycleIds },
      },
    },
    include: {
      cycle: true,
      submissionCase: {
        select: {
          id: true,
        },
      },
    },
  })

  const result = new Map<string, AiCompetencyGatePromotionStatus>()
  for (const assignment of assignments) {
    result.set(`${assignment.cycle.evalCycleId}:${assignment.employeeId}`, {
      status: assignment.status,
      statusLabel: AI_COMPETENCY_GATE_VISIBLE_STATUS_LABELS[assignment.status],
      isSatisfied: assignment.status === 'PASSED',
      cycleId: assignment.cycle.evalCycleId,
      employeeId: assignment.employeeId,
      caseId: assignment.submissionCase?.id,
    })
  }
  return result
}
