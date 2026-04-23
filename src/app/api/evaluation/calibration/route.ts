import { randomUUID } from 'node:crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import {
  createDefaultCalibrationCommentHandoff,
  normalizeCalibrationCommentHandoff,
  normalizeCalibrationFollowUpReviewFlag,
} from '@/lib/calibration-follow-up'
import {
  normalizeCalibrationWorkspaceCandidateState,
  type CalibrationDiscussionStatus,
} from '@/lib/calibration-workspace'
import {
  normalizeCalibrationSessionSetup,
  type CalibrationSessionSetupValue,
} from '@/lib/calibration-session-setup'
import {
  isCeoFinalGradeAdjusted,
  normalizeCeoAdjustmentReason,
  requiresCeoFinalAdjustmentReason,
} from '@/lib/evaluation-ceo-final'
import { prisma } from '@/lib/prisma'
import { CalibrationCandidateUpdateSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import {
  parseCalibrationSessionConfig,
  toCalibrationSessionConfigJson,
} from '@/server/evaluation-calibration-session'

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '등급 조정 권한이 없습니다.')
    }

    const parsed = CalibrationCandidateUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '요청 형식이 올바르지 않습니다.')
    }

    const body = parsed.data
    const client = getClientInfo(request)
    const cycle = await prisma.evalCycle.findUnique({
      where: { id: body.cycleId },
      include: {
        organization: true,
      },
    })

    if (!cycle) {
      throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾지 못했습니다.')
    }

    if (body.action !== 'update-follow-up' && isLockedCycle(cycle.status)) {
      throw new AppError(400, 'CALIBRATION_LOCKED', '이미 잠긴 주기라 조정할 수 없습니다.')
    }

    const latestCycleAction = await prisma.auditLog.findFirst({
      where: {
        entityType: 'EvalCycle',
        entityId: cycle.id,
        action: {
          in: ['CALIBRATION_LOCKED', 'CALIBRATION_REOPEN_REQUESTED'],
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    })

    if (body.action !== 'update-follow-up' && latestCycleAction?.action === 'CALIBRATION_LOCKED') {
      throw new AppError(400, 'CALIBRATION_LOCKED', '잠금 상태에서는 조정을 수정할 수 없습니다.')
    }

    const currentSessionConfig = parseCalibrationSessionConfig(cycle.calibrationSessionConfig)

    if (body.action === 'update-session-config') {
      const nextSessionConfig = {
        ...currentSessionConfig,
        excludedTargetIds: body.sessionConfig?.excludedTargetIds ?? currentSessionConfig.excludedTargetIds,
        participantIds: body.sessionConfig?.participantIds ?? currentSessionConfig.participantIds,
        evaluatorIds: body.sessionConfig?.evaluatorIds ?? currentSessionConfig.evaluatorIds,
        observerIds: body.sessionConfig?.observerIds ?? currentSessionConfig.observerIds,
        externalColumns: body.sessionConfig?.externalColumns ?? currentSessionConfig.externalColumns,
        setup: normalizeCalibrationSessionSetup(
          (body.sessionConfig?.setup ?? currentSessionConfig.setup) as Partial<CalibrationSessionSetupValue>
        ),
      }

      await prisma.evalCycle.update({
        where: { id: cycle.id },
        data: {
          calibrationSessionConfig: toCalibrationSessionConfigJson(nextSessionConfig),
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_SESSION_CONFIG_UPDATED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: nextSessionConfig,
        ...client,
      })

      return successResponse({
        cycleId: cycle.id,
        sessionConfig: nextSessionConfig,
      })
    }

    if (body.action === 'update-workspace') {
      if (!body.workspaceCommand) {
        throw new AppError(400, 'WORKSPACE_COMMAND_REQUIRED', '워크스페이스 변경 내용을 확인해 주세요.')
      }

      const command = body.workspaceCommand
      const now = new Date().toISOString()
      const nextWorkspace = {
        ...currentSessionConfig.workspace,
        candidateStates: {
          ...currentSessionConfig.workspace.candidateStates,
        },
      }

      let auditAction = 'CALIBRATION_WORKSPACE_UPDATED'
      let auditValue: Record<string, unknown> = {}

      if (command.type === 'set-current-candidate') {
        nextWorkspace.currentCandidateId = command.targetId
        auditAction = 'CALIBRATION_CURRENT_CANDIDATE_CHANGED'
        auditValue = {
          currentCandidateId: command.targetId,
        }
      } else if (command.type === 'save-candidate-workspace') {
        nextWorkspace.candidateStates[command.targetId] = normalizeCalibrationWorkspaceCandidateState({
          ...nextWorkspace.candidateStates[command.targetId],
          status: command.status as CalibrationDiscussionStatus,
          shortReason: command.shortReason,
          discussionMemo: command.discussionMemo,
          privateNote: command.privateNote,
          publicComment: command.publicComment,
          updatedAt: now,
          updatedBy: session.user.name ?? session.user.id,
        })
        auditAction = 'CALIBRATION_DISCUSSION_UPDATED'
        auditValue = {
          targetId: command.targetId,
          status: command.status,
          shortReason: command.shortReason,
          hasDiscussionMemo: command.discussionMemo.trim().length > 0,
          hasPrivateNote: command.privateNote.trim().length > 0,
          hasPublicComment: command.publicComment.trim().length > 0,
        }
      } else if (command.type === 'start-timer') {
        nextWorkspace.currentCandidateId = command.targetId
        nextWorkspace.timer = {
          candidateId: command.targetId,
          startedAt: now,
          durationMinutes: command.durationMinutes ?? currentSessionConfig.setup.timeboxMinutes,
          extendedMinutes: 0,
          startedById: session.user.id,
        }
        auditAction = 'CALIBRATION_TIMER_STARTED'
        auditValue = {
          targetId: command.targetId,
          durationMinutes: nextWorkspace.timer.durationMinutes,
        }
      } else if (command.type === 'reset-timer') {
        nextWorkspace.timer = {
          candidateId:
            command.targetId ??
            nextWorkspace.timer?.candidateId ??
            nextWorkspace.currentCandidateId ??
            null,
          startedAt: now,
          durationMinutes: nextWorkspace.timer?.durationMinutes ?? currentSessionConfig.setup.timeboxMinutes,
          extendedMinutes: 0,
          startedById: session.user.id,
        }
        auditAction = 'CALIBRATION_TIMER_RESET'
        auditValue = {
          targetId: nextWorkspace.timer.candidateId,
          durationMinutes: nextWorkspace.timer.durationMinutes,
        }
      } else if (command.type === 'extend-timer') {
        if (!nextWorkspace.timer?.startedAt) {
          throw new AppError(400, 'TIMER_NOT_STARTED', '먼저 타이머를 시작해 주세요.')
        }
        nextWorkspace.timer = {
          ...nextWorkspace.timer,
          extendedMinutes: Math.min(15, nextWorkspace.timer.extendedMinutes + command.minutes),
        }
        auditAction = 'CALIBRATION_TIMER_EXTENDED'
        auditValue = {
          targetId: nextWorkspace.timer.candidateId,
          extendedMinutes: nextWorkspace.timer.extendedMinutes,
        }
      } else if (command.type === 'add-custom-prompt') {
        nextWorkspace.customPrompts = Array.from(
          new Set([...nextWorkspace.customPrompts, command.prompt.trim()])
        ).slice(0, 10)
        auditAction = 'CALIBRATION_FACILITATOR_PROMPT_ADDED'
        auditValue = {
          prompt: command.prompt.trim(),
          promptCount: nextWorkspace.customPrompts.length,
        }
      } else if (command.type === 'remove-custom-prompt') {
        nextWorkspace.customPrompts = nextWorkspace.customPrompts.filter(
          (prompt) => prompt !== command.prompt.trim()
        )
        auditAction = 'CALIBRATION_FACILITATOR_PROMPT_REMOVED'
        auditValue = {
          prompt: command.prompt.trim(),
          promptCount: nextWorkspace.customPrompts.length,
        }
      }

      const nextSessionConfig = {
        ...currentSessionConfig,
        workspace: nextWorkspace,
      }

      await prisma.evalCycle.update({
        where: { id: cycle.id },
        data: {
          calibrationSessionConfig: toCalibrationSessionConfigJson(nextSessionConfig),
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: auditAction,
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: auditValue,
        ...client,
      })

      return successResponse({
        cycleId: cycle.id,
        workspace: nextWorkspace,
      })
    }

    if (body.action === 'update-follow-up') {
      if (!body.followUpCommand) {
        throw new AppError(400, 'FOLLOW_UP_COMMAND_REQUIRED', '팔로우업 변경 내용을 확인해 주세요.')
      }

      const command = body.followUpCommand
      const now = new Date().toISOString()
      const nextFollowUp = {
        ...currentSessionConfig.followUp,
        commentHandoffsByTargetId: {
          ...currentSessionConfig.followUp.commentHandoffsByTargetId,
        },
        reviewFlagsByTargetId: {
          ...currentSessionConfig.followUp.reviewFlagsByTargetId,
        },
        leaderFeedbackByLeaderId: {
          ...currentSessionConfig.followUp.leaderFeedbackByLeaderId,
        },
        retrospectiveSurveys: [...currentSessionConfig.followUp.retrospectiveSurveys],
      }

      let auditAction = 'CALIBRATION_FOLLOW_UP_UPDATED'
      let auditValue: Record<string, unknown> = {}

      if (command.type === 'save-comment-draft' || command.type === 'finalize-comment') {
        const currentHandoff = normalizeCalibrationCommentHandoff(
          nextFollowUp.commentHandoffsByTargetId[command.targetId] ??
            createDefaultCalibrationCommentHandoff(
              currentSessionConfig.workspace.candidateStates[command.targetId]?.publicComment ?? ''
            )
        )
        const trimmedComment = command.comment.trim()
        const revisions = [
          ...currentHandoff.revisions,
          {
            id: randomUUID(),
            stage: (command.type === 'finalize-comment' ? 'FINALIZED' : 'DRAFT') as 'DRAFT' | 'FINALIZED',
            comment: trimmedComment,
            createdAt: now,
            actorUserId: session.user.id,
            actorName: session.user.name ?? session.user.id,
          },
        ]

        nextFollowUp.commentHandoffsByTargetId[command.targetId] = {
          ...currentHandoff,
          draftComment: trimmedComment,
          finalizedComment:
            command.type === 'finalize-comment'
              ? trimmedComment
              : currentHandoff.finalizedComment,
          finalizedAt:
            command.type === 'finalize-comment' ? now : currentHandoff.finalizedAt,
          finalizedById:
            command.type === 'finalize-comment'
              ? session.user.id
              : currentHandoff.finalizedById,
          finalizedByName:
            command.type === 'finalize-comment'
              ? session.user.name ?? session.user.id
              : currentHandoff.finalizedByName,
          revisions,
        }

        auditAction =
          command.type === 'finalize-comment'
            ? 'CALIBRATION_PUBLIC_COMMENT_FINALIZED'
            : 'CALIBRATION_PUBLIC_COMMENT_HANDOFF_SAVED'
        auditValue = {
          targetId: command.targetId,
          commentLength: trimmedComment.length,
          revisionCount: revisions.length,
        }
      } else if (command.type === 'generate-communication-packet') {
        const currentHandoff = normalizeCalibrationCommentHandoff(
          nextFollowUp.commentHandoffsByTargetId[command.targetId] ??
            createDefaultCalibrationCommentHandoff(
              currentSessionConfig.workspace.candidateStates[command.targetId]?.publicComment ?? ''
            )
        )
        const packetComment =
          currentHandoff.finalizedComment ??
          currentHandoff.draftComment ??
          currentSessionConfig.workspace.candidateStates[command.targetId]?.publicComment ??
          ''

        if (!packetComment.trim()) {
          throw new AppError(
            400,
            'COMMENT_REQUIRED',
            '공유용 코멘트가 없습니다. 팔로우업에서 공유 코멘트를 입력해 주세요.'
          )
        }

        nextFollowUp.commentHandoffsByTargetId[command.targetId] = {
          ...currentHandoff,
          draftComment: packetComment.trim(),
          packetGeneratedAt: now,
          packetGeneratedById: session.user.id,
          packetGeneratedByName: session.user.name ?? session.user.id,
        }
        auditAction = 'CALIBRATION_COMMUNICATION_PACKET_GENERATED'
        auditValue = {
          targetId: command.targetId,
          finalized: Boolean(currentHandoff.finalizedComment),
        }
      } else if (command.type === 'set-review-flag') {
        nextFollowUp.reviewFlagsByTargetId[command.targetId] =
          normalizeCalibrationFollowUpReviewFlag({
            ...nextFollowUp.reviewFlagsByTargetId[command.targetId],
            compensationSensitive: command.compensationSensitive,
            finalCheckNote: command.note,
            updatedAt: now,
            updatedById: session.user.id,
            updatedByName: session.user.name ?? session.user.id,
          })
        auditAction = 'CALIBRATION_FOLLOW_UP_REVIEW_FLAG_UPDATED'
        auditValue = {
          targetId: command.targetId,
          compensationSensitive: command.compensationSensitive,
          noteLength: command.note.trim().length,
        }
      } else if (command.type === 'submit-survey') {
        const surveyResponse = {
          id:
            nextFollowUp.retrospectiveSurveys.find(
              (response) => response.respondentId === session.user.id
            )?.id ?? randomUUID(),
          respondentId: session.user.id,
          respondentName: session.user.name ?? session.user.id,
          hardestPart: command.hardestPart.trim(),
          missingData: command.missingData.trim(),
          rulesAndTimebox: command.rulesAndTimebox.trim(),
          positives: command.positives.trim(),
          improvements: command.improvements.trim(),
          nextCycleNeeds: command.nextCycleNeeds.trim(),
          leniencyFeedback: command.leniencyFeedback.trim(),
          submittedAt: now,
        }

        nextFollowUp.retrospectiveSurveys = [
          ...nextFollowUp.retrospectiveSurveys.filter(
            (response) => response.respondentId !== session.user.id
          ),
          surveyResponse,
        ]
        auditAction = 'CALIBRATION_RETROSPECTIVE_SURVEY_SUBMITTED'
        auditValue = {
          respondentId: session.user.id,
          responseCount: nextFollowUp.retrospectiveSurveys.length,
        }
      } else if (command.type === 'save-leader-feedback') {
        nextFollowUp.leaderFeedbackByLeaderId[command.leaderId] = {
          leaderId: command.leaderId,
          leaderName: command.leaderName.trim(),
          summary: command.summary.trim(),
          suggestions: command.suggestions.trim(),
          visibility: 'LEADER_ONLY',
          updatedAt: now,
          updatedById: session.user.id,
          updatedByName: session.user.name ?? session.user.id,
        }
        auditAction = 'CALIBRATION_LEADER_FEEDBACK_RECORDED'
        auditValue = {
          leaderId: command.leaderId,
          leaderName: command.leaderName.trim(),
        }
      }

      const nextSessionConfig = {
        ...currentSessionConfig,
        followUp: nextFollowUp,
      }

      await prisma.evalCycle.update({
        where: { id: cycle.id },
        data: {
          calibrationSessionConfig: toCalibrationSessionConfigJson(nextSessionConfig),
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: auditAction,
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: auditValue,
        ...client,
      })

      return successResponse({
        cycleId: cycle.id,
        followUp: nextFollowUp,
      })
    }

    if (body.action === 'upload-external-data') {
      const targetIds = Array.from(new Set((body.externalData?.rows ?? []).map((row) => row.targetId)))
      const matchedTargets = await prisma.evaluation.findMany({
        where: {
          evalCycleId: cycle.id,
          targetId: { in: targetIds },
          evalStage: {
            in: ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
          },
        },
        select: {
          targetId: true,
        },
        distinct: ['targetId'],
      })

      const validTargetIds = new Set(matchedTargets.map((item) => item.targetId))
      const failedRows: Array<{ rowNumber?: number; identifier?: string; message: string }> = []
      const nextExternalRowsByTargetId: Record<string, Record<string, string>> = {}

      for (const row of body.externalData?.rows ?? []) {
        if (!validTargetIds.has(row.targetId)) {
          failedRows.push({
            rowNumber: row.rowNumber,
            identifier: row.identifier ?? row.targetId,
            message: '캘리브레이션 대상자와 매칭되지 않아 업로드하지 못했습니다.',
          })
          continue
        }

        nextExternalRowsByTargetId[row.targetId] = Object.fromEntries(
          body.externalData?.columns.map((column) => [column.key, row.values[column.key] ?? '']) ?? []
        )
      }

      const nextSessionConfig = {
        ...currentSessionConfig,
        externalColumns: body.externalData?.columns ?? [],
        externalRowsByTargetId: nextExternalRowsByTargetId,
      }

      await prisma.evalCycle.update({
        where: { id: cycle.id },
        data: {
          calibrationSessionConfig: toCalibrationSessionConfigJson(nextSessionConfig),
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_EXTERNAL_DATA_UPLOADED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: {
          columnCount: nextSessionConfig.externalColumns.length,
          appliedCount: Object.keys(nextExternalRowsByTargetId).length,
          failedCount: failedRows.length,
        },
        ...client,
      })

      return successResponse({
        cycleId: cycle.id,
        columnCount: nextSessionConfig.externalColumns.length,
        appliedCount: Object.keys(nextExternalRowsByTargetId).length,
        failedRows,
      })
    }

    if (body.action === 'bulk-import') {
      const targetIds = Array.from(new Set((body.rows ?? []).map((row) => row.targetId)))
      const [gradeSettings, evaluations] = await Promise.all([
        prisma.gradeSetting.findMany({
          where: {
            orgId: cycle.orgId,
            evalYear: cycle.evalYear,
            isActive: true,
          },
          select: {
            id: true,
            gradeName: true,
            minScore: true,
            maxScore: true,
          },
        }),
        prisma.evaluation.findMany({
          where: {
            evalCycleId: cycle.id,
            targetId: { in: targetIds },
            evalStage: {
              in: ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
            },
          },
          include: {
            target: {
              include: {
                department: true,
              },
            },
            items: true,
          },
        }),
      ])

      const grouped = new Map<
        string,
        {
          finalEvaluation: (typeof evaluations)[number] | null
          adjustedEvaluation: (typeof evaluations)[number] | null
        }
      >()

      for (const evaluation of evaluations) {
        const current = grouped.get(evaluation.targetId) ?? { finalEvaluation: null, adjustedEvaluation: null }
        if (evaluation.evalStage === 'CEO_ADJUST') current.adjustedEvaluation = evaluation
        if (evaluation.evalStage === 'FINAL') current.finalEvaluation = evaluation
        if (!current.finalEvaluation && evaluation.evalStage === 'SECOND') current.finalEvaluation = evaluation
        if (!current.finalEvaluation && evaluation.evalStage === 'FIRST') current.finalEvaluation = evaluation
        grouped.set(evaluation.targetId, current)
      }

      const validRows: Array<{
        rowNumber?: number
        identifier?: string
        targetId: string
        gradeId: string
        adjustReason: string | null
        gradeName: string
        originalGrade: string
        finalEvaluation: (typeof evaluations)[number]
        adjustedEvaluation: (typeof evaluations)[number] | null
        gradeChanged: boolean
      }> = []
      const failedRows: Array<{ rowNumber?: number; identifier?: string; message: string }> = []

      for (const row of body.rows ?? []) {
        const grade = gradeSettings.find((item) => item.id === row.gradeId)
        const entry = grouped.get(row.targetId)
        const finalEvaluation = entry?.finalEvaluation
        const adjustedEvaluation = entry?.adjustedEvaluation ?? null

        if (!grade) {
          failedRows.push({
            rowNumber: row.rowNumber,
            identifier: row.identifier ?? row.targetId,
            message: '선택한 조정 등급을 찾지 못했습니다.',
          })
          continue
        }

        if (!finalEvaluation) {
          failedRows.push({
            rowNumber: row.rowNumber,
            identifier: row.identifier ?? row.targetId,
            message: '원 평가 결과를 찾지 못했습니다.',
          })
          continue
        }

        const originalGrade =
          resolveGradeName(
            adjustedEvaluation?.gradeId ?? finalEvaluation.gradeId,
            finalEvaluation.totalScore,
            gradeSettings
          ) ?? '미확정'

        const normalizedReason = normalizeCeoAdjustmentReason(row.adjustReason)
        const originalDivisionHeadGrade =
          resolveGradeName(finalEvaluation.gradeId, finalEvaluation.totalScore, gradeSettings) ??
          originalGrade
        const gradeChanged = isCeoFinalGradeAdjusted({
          originalDivisionHeadGradeId: finalEvaluation.gradeId,
          finalCeoGradeId: row.gradeId,
        })

        if (
          requiresCeoFinalAdjustmentReason({
            originalDivisionHeadGradeId: finalEvaluation.gradeId,
            finalCeoGradeId: row.gradeId,
            adjustmentReason: normalizedReason,
          })
        ) {
          failedRows.push({
            rowNumber: row.rowNumber,
            identifier: row.identifier ?? row.targetId,
            message: '등급을 변경한 경우 조정 사유를 입력해 주세요.',
          })
          continue
        }

        validRows.push({
          rowNumber: row.rowNumber,
          identifier: row.identifier,
          targetId: row.targetId,
          gradeId: row.gradeId,
          adjustReason: normalizedReason,
          gradeName: grade.gradeName,
          originalGrade: originalDivisionHeadGrade,
          finalEvaluation,
          adjustedEvaluation,
          gradeChanged,
        })
      }

      const savedRows: Array<{
        targetId: string
        targetName: string
        department: string
        fromGrade: string
        toGrade: string
        rawScore: number
        reason: string | null
        evaluationId: string
        adjusted: boolean
        previousFinalGrade: string
      }> = []

      for (const row of validRows) {
        try {
          const savedEvaluation = await prisma.$transaction(async (tx) => {
            if (row.adjustedEvaluation) {
              return tx.evaluation.update({
                where: { id: row.adjustedEvaluation.id },
                data: {
                  gradeId: row.gradeId,
                  totalScore: row.finalEvaluation.totalScore,
                  comment: row.adjustReason,
                  evaluatorId: session.user.id,
                  status: 'CONFIRMED',
                  isDraft: false,
                  submittedAt: new Date(),
                },
              })
            }

            return tx.evaluation.create({
              data: {
                evalCycleId: cycle.id,
                targetId: row.targetId,
                evaluatorId: session.user.id,
                evalStage: 'CEO_ADJUST',
                totalScore: row.finalEvaluation.totalScore,
                gradeId: row.gradeId,
                comment: row.adjustReason,
                status: 'CONFIRMED',
                isDraft: false,
                submittedAt: new Date(),
                items: {
                  create: row.finalEvaluation.items.map((item) => ({
                    personalKpiId: item.personalKpiId,
                    quantScore: item.quantScore,
                    planScore: item.planScore,
                    doScore: item.doScore,
                    checkScore: item.checkScore,
                    actScore: item.actScore,
                    qualScore: item.qualScore,
                    itemComment: item.itemComment,
                    weightedScore: item.weightedScore,
                  })),
                },
              },
            })
          })

          savedRows.push({
            targetId: row.targetId,
            targetName: row.finalEvaluation.target.empName,
            department: row.finalEvaluation.target.department.deptName,
            fromGrade: row.originalGrade,
            toGrade: row.gradeName,
            rawScore: row.finalEvaluation.totalScore ?? 0,
            reason: row.adjustReason,
            evaluationId: savedEvaluation.id,
            adjusted: row.gradeChanged,
            previousFinalGrade:
              resolveGradeName(
                row.adjustedEvaluation?.gradeId ?? row.finalEvaluation.gradeId,
                row.finalEvaluation.totalScore,
                gradeSettings
              ) ?? row.originalGrade,
          })
        } catch (error) {
          console.error('[calibration bulk-import] row apply failed', error)
          failedRows.push({
            rowNumber: row.rowNumber,
            identifier: row.identifier ?? row.targetId,
            message: '이 행을 반영하지 못했습니다. 등급/사유 값을 다시 확인해 주세요.',
          })
        }
      }

      for (const row of savedRows) {
        await createAuditLog({
          userId: session.user.id,
          action: 'CALIBRATION_UPDATED',
          entityType: 'Evaluation',
          entityId: row.evaluationId,
          oldValue: {
            targetId: row.targetId,
            targetName: row.targetName,
            department: row.department,
            fromGrade: row.previousFinalGrade,
            originalDivisionHeadGrade: row.fromGrade,
          },
          newValue: {
            targetId: row.targetId,
            targetName: row.targetName,
            department: row.department,
            fromGrade: row.fromGrade,
            toGrade: row.toGrade,
            rawScore: row.rawScore,
            reason: row.reason,
            adjusted: row.adjusted,
            originalDivisionHeadGrade: row.fromGrade,
            confirmedBy: session.user.name,
          },
          ...client,
        })
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_BULK_IMPORTED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: {
          rowCount: body.rows?.length ?? 0,
          appliedCount: savedRows.length,
          failedCount: failedRows.length,
          targetIds: savedRows.map((item) => item.targetId),
        },
        ...client,
      })

      return successResponse({
        cycleId: cycle.id,
        rowCount: body.rows?.length ?? 0,
        appliedCount: savedRows.length,
        failedRows,
      })
    }

    const [gradeSettings, evaluations] = await Promise.all([
      prisma.gradeSetting.findMany({
        where: {
          orgId: cycle.orgId,
          evalYear: cycle.evalYear,
          isActive: true,
        },
        select: {
          id: true,
          gradeName: true,
          minScore: true,
          maxScore: true,
        },
      }),
      prisma.evaluation.findMany({
        where: {
          evalCycleId: cycle.id,
          targetId: body.targetId,
          evalStage: {
            in: ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
          },
        },
        include: {
          target: {
            include: {
              department: true,
            },
          },
          items: true,
        },
      }),
    ])

    const finalEvaluation =
      evaluations.find((evaluation) => evaluation.evalStage === 'FINAL') ??
      evaluations.find((evaluation) => evaluation.evalStage === 'SECOND') ??
      evaluations.find((evaluation) => evaluation.evalStage === 'FIRST')
    const adjustedEvaluation = evaluations.find((evaluation) => evaluation.evalStage === 'CEO_ADJUST')
    const targetId = body.targetId ?? finalEvaluation?.targetId ?? adjustedEvaluation?.targetId

    if (!finalEvaluation) {
      throw new AppError(404, 'FINAL_EVALUATION_NOT_FOUND', '원 평가 결과를 찾지 못했습니다.')
    }

    if (!targetId) {
      throw new AppError(400, 'TARGET_REQUIRED', '등급 조정 대상자를 찾지 못했습니다.')
    }

    const originalGrade =
      resolveGradeName(finalEvaluation.gradeId, finalEvaluation.totalScore, gradeSettings) ?? '미확정'

    if (body.action === 'clear') {
      if (adjustedEvaluation) {
        await prisma.$transaction(async (tx) => {
          await tx.evaluationItem.deleteMany({
            where: {
              evaluationId: adjustedEvaluation.id,
            },
          })
          await tx.evaluation.delete({
            where: {
              id: adjustedEvaluation.id,
            },
          })
        })
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_CLEARED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        oldValue: {
          targetId: body.targetId,
          targetName: finalEvaluation.target.empName,
          fromGrade:
            resolveGradeName(adjustedEvaluation?.gradeId ?? null, adjustedEvaluation?.totalScore ?? null, gradeSettings) ??
            originalGrade,
        },
        newValue: {
          targetId: body.targetId,
          targetName: finalEvaluation.target.empName,
          toGrade: originalGrade,
          reason: '원등급 복원',
        },
        ...client,
      })

      return successResponse({
        targetId,
        cleared: true,
      })
    }

    const nextGrade = gradeSettings.find((grade) => grade.id === body.gradeId)
    if (!nextGrade) {
      throw new AppError(404, 'GRADE_NOT_FOUND', '선택한 조정 등급을 찾지 못했습니다.')
    }

    const normalizedReason = normalizeCeoAdjustmentReason(body.adjustReason)
    const gradeChanged = isCeoFinalGradeAdjusted({
      originalDivisionHeadGradeId: finalEvaluation.gradeId,
      finalCeoGradeId: nextGrade.id,
    })

    if (
      requiresCeoFinalAdjustmentReason({
        originalDivisionHeadGradeId: finalEvaluation.gradeId,
        finalCeoGradeId: nextGrade.id,
        adjustmentReason: normalizedReason,
      })
    ) {
      throw new AppError(400, 'ADJUST_REASON_REQUIRED', '등급을 변경한 경우 조정 사유를 입력해 주세요.')
    }

    const previousFinalGrade =
      resolveGradeName(
        adjustedEvaluation?.gradeId ?? finalEvaluation.gradeId,
        finalEvaluation.totalScore,
        gradeSettings
      ) ?? originalGrade

    const savedEvaluation = await prisma.$transaction(async (tx) => {
      if (adjustedEvaluation) {
        return tx.evaluation.update({
          where: { id: adjustedEvaluation.id },
          data: {
            gradeId: nextGrade.id,
            totalScore: finalEvaluation.totalScore,
            comment: normalizedReason,
            evaluatorId: session.user.id,
            status: 'CONFIRMED',
            isDraft: false,
            submittedAt: new Date(),
          },
        })
      }

      return tx.evaluation.create({
        data: {
          evalCycleId: cycle.id,
          targetId,
          evaluatorId: session.user.id,
          evalStage: 'CEO_ADJUST',
          totalScore: finalEvaluation.totalScore,
          gradeId: nextGrade.id,
          comment: normalizedReason,
          status: 'CONFIRMED',
          isDraft: false,
          submittedAt: new Date(),
          items: {
            create: finalEvaluation.items.map((item) => ({
              personalKpiId: item.personalKpiId,
              quantScore: item.quantScore,
              planScore: item.planScore,
              doScore: item.doScore,
              checkScore: item.checkScore,
              actScore: item.actScore,
              qualScore: item.qualScore,
              itemComment: item.itemComment,
              weightedScore: item.weightedScore,
            })),
          },
        },
      })
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'CALIBRATION_UPDATED',
      entityType: 'Evaluation',
      entityId: savedEvaluation.id,
      oldValue: {
        targetId: body.targetId,
        targetName: finalEvaluation.target.empName,
        department: finalEvaluation.target.department.deptName,
        fromGrade: previousFinalGrade,
        originalDivisionHeadGrade: originalGrade,
      },
      newValue: {
        targetId: body.targetId,
        targetName: finalEvaluation.target.empName,
        department: finalEvaluation.target.department.deptName,
        fromGrade: originalGrade,
        toGrade: nextGrade.gradeName,
        rawScore: finalEvaluation.totalScore ?? 0,
        reason: normalizedReason,
        adjusted: gradeChanged,
        originalDivisionHeadGrade: originalGrade,
        confirmedBy: session.user.name,
      },
      ...client,
    })

    return successResponse({
      targetId: body.targetId,
      evaluationId: savedEvaluation.id,
      adjustedGrade: nextGrade.gradeName,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

function isLockedCycle(status: string) {
  return ['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(status)
}

function resolveGradeName(
  gradeId: string | null,
  totalScore: number | null,
  gradeSettings: Array<{
    id: string
    gradeName: string
    minScore: number
    maxScore: number
  }>
) {
  if (gradeId) {
    const matched = gradeSettings.find((grade) => grade.id === gradeId)
    if (matched) return matched.gradeName
  }

  if (totalScore === null) return null

  return (
    gradeSettings.find((grade) => totalScore >= grade.minScore && totalScore <= grade.maxScore)?.gradeName ??
    null
  )
}
