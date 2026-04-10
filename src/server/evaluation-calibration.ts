import type {
  CheckInStatus,
  CheckInType,
  CycleStatus,
  AppealStatus,
  Position,
  Prisma,
  RaterRelationship,
  SystemRole,
} from '@prisma/client'
import {
  CALIBRATION_COMMUNICATION_GUIDE,
  collectCalibrationFollowUpThemes,
  createDefaultCalibrationCommentHandoff,
  type CalibrationFollowUpValue,
} from '@/lib/calibration-follow-up'
import {
  CALIBRATION_DEFAULT_FACILITATOR_PROMPTS,
  isResolvedCalibrationDiscussionStatus,
  type CalibrationWorkspaceCandidateState,
  normalizeCalibrationWorkspaceCandidateState,
} from '@/lib/calibration-workspace'
import { calcPdcaScore } from '@/lib/utils'
import {
  buildCalibrationSetupReadiness,
  CALIBRATION_GROUND_RULE_PRESETS,
  CALIBRATION_VISIBLE_COLUMN_OPTIONS,
  type CalibrationGroundRulePolicy,
} from '@/lib/calibration-session-setup'
import { prisma } from '@/lib/prisma'
import { loadAiCompetencySyncedResults } from '@/server/ai-competency'
import {
  parseCalibrationSessionConfig,
  type CalibrationSessionConfigValue,
} from '@/server/evaluation-calibration-session'

export type CalibrationPageState = 'ready' | 'empty' | 'permission-denied' | 'error'
export type CalibrationStatus = 'READY' | 'CALIBRATING' | 'REVIEW_CONFIRMED' | 'FINAL_LOCKED'
export type CalibrationFollowUpObjectionStatus =
  | 'SUBMITTED'
  | 'REVIEWING'
  | 'RESPONDED'
  | 'CLOSED'

export type CalibrationCandidate = {
  id: string
  employeeId: string
  employeeName: string
  departmentId: string
  department: string
  jobGroup?: string
  sourceStage: 'FIRST' | 'SECOND' | 'FINAL'
  hasMergedCalibration: boolean
  rawScore: number
  originalGrade: string
  adjustedGrade?: string
  adjusted: boolean
  reason?: string
  evaluatorName?: string
  reviewerName?: string
  performanceScore?: number
  competencyScore?: number
  evaluationComment?: string
  reviewerComment?: string
  needsAttention: boolean
  reasonMissing: boolean
  suggestedReason?: string
  monthlySummary: Array<{
    month: string
    achievementRate?: number
    comment?: string
  }>
  kpiSummary: Array<{
    id: string
    title: string
    target?: number
    actual?: number
    achievementRate?: number
    unit?: string
  }>
  checkins: Array<{
    date: string
    type: CheckInType
    status: CheckInStatus
    summary: string
  }>
  externalData: Array<{
    key: string
    label: string
    value: string
  }>
  threeYearHistory: Array<{
    year: number
    cycleName: string
    grade: string
    score?: number
  }>
  feedbackSummary: {
    selfMean?: number
    managerMean?: number
    peerMean?: number
    peerVariance?: number
  }
  outlierFlag: boolean
  newlyJoined: boolean
  newlyPromoted: boolean | null
  promotionCandidate: boolean | null
  seniorLevel: boolean
  currentManagerRating: string
  priorTrendSummary?: string
  priorRatingDelta?: number
  workspace: CalibrationWorkspaceCandidateState
}

export type CalibrationViewModel = {
  actor: {
    userId: string
    role: SystemRole
    sessionRole: 'CEO' | 'ADMIN' | 'OWNER' | 'FACILITATOR' | 'RECORDER' | 'PARTICIPANT' | 'OBSERVER'
    canManageFlow: boolean
    canFinalizeAdjustments: boolean
    canRecordPrivateNote: boolean
    canWritePublicComment: boolean
    canFinalizeFollowUpComment: boolean
    canSubmitFollowUpSurvey: boolean
    canRecordLeaderFeedback: boolean
  }
  actorRole: SystemRole
  cycle: {
    id: string
    name: string
    year: number
    status: CalibrationStatus
    rawStatus: CycleStatus
    lockedAt?: string
    sessionStartedAt?: string
    organizationName: string
    selectedScopeId: string
  }
  sessionConfig: {
    excludedTargetIds: string[]
    participantIds: string[]
    evaluatorIds: string[]
    observerIds: string[]
    externalColumns: Array<{
      key: string
      label: string
    }>
    lastMergeSummary?: {
      mergedAt: string
      mergedBy: string
      createdCount: number
      skippedCount: number
      scopeId?: string
    } | null
    setup: {
      sessionName: string
      sessionType: 'SINGLE_TEAM' | 'MULTI_TEAM' | 'ROLLUP' | 'EXECUTIVE'
      scopeMode: 'ORGANIZATION' | 'REVIEW_CYCLE' | 'LEADER_GROUP'
      scopeDepartmentIds: string[]
      scopeLeaderIds: string[]
      ownerId: string | null
      facilitatorId: string | null
      recorderId: string | null
      observerIds: string[]
      preReadDeadline: string | null
      scheduledStart: string | null
      scheduledEnd: string | null
      timeboxMinutes: number
      decisionPolicy: 'OWNER_DECIDES' | 'CONSENSUS_PREFERRED' | 'ESCALATION_REQUIRED'
      referenceDistributionUse: 'OFF' | 'GUIDELINE_ONLY'
      referenceDistributionVisibility: 'VISIBLE_ONLY' | 'WARNING_ONLY'
      referenceDistributionRatios: Array<{
        gradeId: string
        gradeLabel: string
        ratio: number
      }>
      ratingGuideUse: boolean
      ratingGuideLinks: Array<{
        id: string
        scopeType: 'POSITION' | 'JOB_GROUP' | 'LEVEL'
        scopeValue: string
        memo?: string
      }>
      expectationAlignmentMemo: string
      visibleDataColumns: string[]
      memoCommentPolicyPreset: 'PRIVATE_MEMO_DEFAULT' | 'OWNER_REVIEW_REQUIRED' | 'STRICT_SEPARATION'
      objectionWindowOpenAt: string | null
      objectionWindowCloseAt: string | null
      followUpOwnerId: string | null
      groundRules: Array<{
        key: string
        label: string
        description: string
        enabled: boolean
      }>
      groundRuleAcknowledgementPolicy: CalibrationGroundRulePolicy
      facilitatorCanFinalize: boolean
    }
    workspace: {
      currentCandidateId: string | null
      timer: {
        candidateId: string | null
        startedAt: string | null
        durationMinutes: number
        extendedMinutes: number
        startedById: string | null
      } | null
      customPrompts: string[]
    }
  }
  sessionOptions: {
    targets: Array<{
      id: string
      employeeId: string
      name: string
      department: string
    }>
    people: Array<{
      id: string
      name: string
      department: string
      role: string
    }>
    departments: Array<{
      id: string
      label: string
    }>
    visibleColumnOptions: Array<{
      key: string
      label: string
      description: string
    }>
    groundRulePresets: Array<{
      key: string
      label: string
      description: string
    }>
  }
  scopeOptions: Array<{
    id: string
    label: string
  }>
  gradeOptions: Array<{
    id: string
    grade: string
    targetRatio?: number
  }>
  summary: {
    totalCount: number
    adjustedCount: number
    pendingCount: number
    adjustedRate: number
    outlierOrgCount?: number
    highGradeRatio: number
    lowGradeRatio: number
    reviewedCount: number
  }
  distributions: {
    company: Array<{ grade: string; count: number; ratio: number; targetRatio?: number }>
    byDepartment: Array<{
      departmentId: string
      department: string
      grades: Array<{ grade: string; count: number; ratio: number; targetRatio?: number }>
      totalCount: number
      deltaScore: number
      isOutlier: boolean
    }>
    byJobGroup: Array<{
      jobGroup: string
      grades: Array<{ grade: string; count: number; ratio: number; targetRatio?: number }>
      totalCount: number
    }>
  }
  candidates: CalibrationCandidate[]
  timeline: Array<{
    id: string
    at: string
    actor: string
    action: string
    employeeName?: string
    fromGrade?: string
    toGrade?: string
    reason?: string
    actionType: 'adjust' | 'lock' | 'reopen' | 'review' | 'system'
  }>
  checklist: {
    missingReasonCount: number
    unresolvedCandidateCount: number
    readyToLock: boolean
  }
  setupReadiness: {
    readyToStart: boolean
    blockingItems: string[]
    warningItems: string[]
  }
  followUp: {
    review: {
      changedRatingCount: number
      outlierRecheckCount: number
      newlyJoinedCount: number
      newlyPromotedCount: number
      promotionCandidateCount: number
      compensationSensitiveCount: number
      departmentComparisons: Array<{
        departmentId: string
        department: string
        leaderName: string
        originalAverageOrder: number
        finalAverageOrder: number
        changedCount: number
        isOutlier: boolean
      }>
      topBottomRecheck: Array<{
        targetId: string
        employeeName: string
        finalGrade: string
        outlierFlag: boolean
      }>
      changeHistory: Array<{
        id: string
        at: string
        actor: string
        employeeName?: string
        fromGrade?: string
        toGrade?: string
        reason?: string
      }>
    }
    communicationGuide: {
      purpose: string
      sequence: string[]
      goodExample: string
      badExample: string
      avoidPhrases: string[]
      managerDo: string[]
      packets: Array<{
        targetId: string
        employeeName: string
        department: string
        finalGrade: string
        changed: boolean
        contextSummary: string
        draftComment: string
        finalizedComment?: string
        revisionCount: number
        packetGeneratedAt?: string
        finalizedAt?: string
        compensationSensitive: boolean
        finalCheckNote: string
        revisions: Array<{
          id: string
          stage: 'DRAFT' | 'FINALIZED'
          comment: string
          createdAt: string
          actorName: string
        }>
      }>
    }
    objections: {
      windowOpenAt: string | null
      windowCloseAt: string | null
      summary: Record<CalibrationFollowUpObjectionStatus, number>
      cases: Array<{
        id: string
        appealerName: string
        targetName: string
        targetDepartment: string
        status: CalibrationFollowUpObjectionStatus
        reason: string
        requestedAction?: string
        adminResponse?: string
        createdAt: string
        updatedAt: string
      }>
    }
    surveys: {
      responseCount: number
      responses: Array<{
        id: string
        respondentName: string
        submittedAt: string
        hardestPart: string
        missingData: string
        rulesAndTimebox: string
        positives: string
        improvements: string
        nextCycleNeeds: string
        leniencyFeedback: string
      }>
      aggregates: {
        hardestThemes: string[]
        missingDataThemes: string[]
        improvementThemes: string[]
      }
    }
    leaderFeedback: Array<{
      leaderId: string
      leaderName: string
      summary: string
      suggestions: string
      visibility: 'LEADER_ONLY'
      updatedAt?: string
      updatedByName?: string
    }>
  }
}

export type CalibrationPageData = {
  state: CalibrationPageState
  availableCycles: Array<{
    id: string
    name: string
    year: number
    organizationName: string
    status: CycleStatus
  }>
  selectedCycleId?: string
  selectedScopeId?: string
  viewModel?: CalibrationViewModel
  message?: string
}

type EvaluationRecord = Prisma.EvaluationGetPayload<{
  include: {
    target: {
      include: {
        department: true
      }
    }
    evaluator: {
      select: {
        empName: true
        position: true
      }
    }
    items: {
      include: {
        personalKpi: {
          include: {
            monthlyRecords: {
              orderBy: {
                yearMonth: 'desc'
              }
            }
          }
        }
      }
    }
  }
}>

type CheckInRecord = Prisma.CheckInGetPayload<{
  select: {
    ownerId: true
    scheduledDate: true
    actualDate: true
    checkInType: true
    status: true
    keyTakeaways: true
    managerNotes: true
    ownerNotes: true
  }
}>

type AuditLogRecord = Prisma.AuditLogGetPayload<{
  select: {
    id: true
    action: true
    entityType: true
    entityId: true
    userId: true
    oldValue: true
    newValue: true
    timestamp: true
  }
}>

type GradeSettingLite = {
  id: string
  gradeName: string
  minScore: number
  maxScore: number
  targetDistRate: number | null
  gradeOrder: number
}

type CandidateGroup = {
  target: EvaluationRecord['target']
  selfEvaluation: EvaluationRecord | null
  finalEvaluation: EvaluationRecord | null
  adjustedEvaluation: EvaluationRecord | null
  reviewerEvaluation: EvaluationRecord | null
}

type CalibrationAuditPayload = {
  targetId?: string
  targetName?: string
  department?: string
  fromGrade?: string
  toGrade?: string
  rawScore?: number
  reason?: string
  confirmedBy?: string
}

type HistoricalEvaluationRecord = {
  targetId: string
  evalStage: string
  totalScore: number | null
  gradeId: string | null
  updatedAt: Date
  evalCycle: {
    id: string
    evalYear: number
    cycleName: string
  }
}

type FeedbackSummaryRecord = {
  receiverId: string
  relationship: RaterRelationship
  ratings: number[]
}

type CalibrationAppealRecord = {
  id: string
  reason: string
  status: AppealStatus
  adminResponse: string | null
  createdAt: Date
  updatedAt: Date
  appealer: {
    empName: string
  }
  evaluation: {
    target: {
      empName: string
      department: {
        deptName: string
      }
    }
  }
}

export async function getEvaluationCalibrationPageData(params: {
  userId: string
  role: SystemRole
  cycleId?: string
  scopeId?: string
}): Promise<CalibrationPageData> {
  try {
    if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(params.role)) {
      return {
        state: 'permission-denied',
        availableCycles: [],
        message: '등급 조정 화면은 관리자 또는 CEO만 접근할 수 있습니다.',
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.userId },
      include: {
        department: {
          include: {
            organization: true,
          },
        },
      },
    })

    if (!employee) {
      return {
        state: 'permission-denied',
        availableCycles: [],
        message: '등급 조정 화면을 조회할 직원 정보를 찾지 못했습니다.',
      }
    }

    const cycles = await prisma.evalCycle.findMany({
      where: {
        orgId: employee.department.orgId,
      },
      include: {
        organization: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
    })

    const availableCycles = cycles.map((cycle) => ({
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalYear,
      organizationName: cycle.organization.name,
      status: cycle.status,
    }))

    if (!cycles.length) {
      return {
        state: 'empty',
        availableCycles,
        message: '캘리브레이션을 진행할 평가 주기가 아직 없습니다.',
      }
    }

    const selectedCycle =
      cycles.find((cycle) => cycle.id === params.cycleId) ??
      cycles.find((cycle) => cycle.status !== 'SETUP') ??
      cycles[0]

    const [gradeSettings, evaluations, checkIns, orgEmployees] = await Promise.all([
      prisma.gradeSetting.findMany({
        where: {
          orgId: selectedCycle.orgId,
          evalYear: selectedCycle.evalYear,
          isActive: true,
        },
        select: {
          id: true,
          gradeName: true,
          minScore: true,
          maxScore: true,
          targetDistRate: true,
          gradeOrder: true,
        },
        orderBy: {
          gradeOrder: 'asc',
        },
      }),
      prisma.evaluation.findMany({
        where: {
          evalCycleId: selectedCycle.id,
          evalStage: {
            in: ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
          },
        },
        include: {
          target: {
            include: {
              department: true,
            },
          },
          evaluator: {
            select: {
              empName: true,
              position: true,
            },
          },
          items: {
            include: {
              personalKpi: {
                include: {
                  monthlyRecords: {
                    orderBy: {
                      yearMonth: 'desc',
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ evalStage: 'asc' }, { updatedAt: 'desc' }],
      }),
      prisma.checkIn.findMany({
        where: {
          scheduledDate: {
            gte: new Date(`${selectedCycle.evalYear}-01-01T00:00:00.000Z`),
            lte: new Date(`${selectedCycle.evalYear}-12-31T23:59:59.999Z`),
          },
        },
        select: {
          ownerId: true,
          scheduledDate: true,
          actualDate: true,
          checkInType: true,
          status: true,
          keyTakeaways: true,
          managerNotes: true,
          ownerNotes: true,
        },
      }),
      prisma.employee.findMany({
        where: {
          department: {
            orgId: selectedCycle.orgId,
          },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          empName: true,
          position: true,
          jobTitle: true,
          teamName: true,
          joinDate: true,
          notes: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
        orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
      }),
    ])

    if (!evaluations.length) {
      return {
        state: 'empty',
        availableCycles,
        selectedCycleId: selectedCycle.id,
        message: '캘리브레이션을 진행할 평가 결과가 아직 없습니다.',
      }
    }

    const adjustedEvaluationIds = evaluations
      .filter((evaluation) => evaluation.evalStage === 'CEO_ADJUST')
      .map((evaluation) => evaluation.id)

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          {
            entityType: 'EvalCycle',
            entityId: selectedCycle.id,
          },
          adjustedEvaluationIds.length
            ? {
                entityType: 'Evaluation',
                entityId: {
                  in: adjustedEvaluationIds,
                },
              }
            : undefined,
        ].filter(Boolean) as Prisma.AuditLogWhereInput[],
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    if (!gradeSettings.length) {
      return {
        state: 'empty',
        availableCycles,
        selectedCycleId: selectedCycle.id,
        message: '활성화된 등급 기준이 없어 캘리브레이션 분포를 계산할 수 없습니다.',
      }
    }

    const sessionConfig = parseCalibrationSessionConfig(selectedCycle.calibrationSessionConfig)
    const latestSessionDeleteLog = [...auditLogs]
      .reverse()
      .find((log) => log.entityType === 'EvalCycle' && log.action === 'CALIBRATION_SESSION_DELETED')
    const effectiveAuditLogs = latestSessionDeleteLog
      ? auditLogs.filter((log) => log.timestamp >= latestSessionDeleteLog.timestamp)
      : auditLogs
    const groups = groupEvaluationsByTarget(evaluations)
    const scopeOptions = buildScopeOptions(groups)
    const selectedScopeId =
      params.scopeId && (params.scopeId === 'all' || scopeOptions.some((option) => option.id === params.scopeId))
        ? params.scopeId
        : 'all'

    const filteredGroups = filterGroupsByScope(groups, selectedScopeId).filter(
      (group) => !sessionConfig.excludedTargetIds.includes(group.target.id)
    )
    if (!filteredGroups.length) {
      return {
        state: 'empty',
        availableCycles,
        selectedCycleId: selectedCycle.id,
        selectedScopeId,
        message: '선택한 범위에 표시할 조정 대상이 없습니다.',
      }
    }

    const targetIds = filteredGroups.map((group) => group.target.id)
    const orgEmployeeMap = new Map(orgEmployees.map((employee) => [employee.id, employee]))
    const [historicalEvaluations, feedbackSummaries, departments, appeals] = await Promise.all([
      prisma.evaluation.findMany({
        where: {
          targetId: {
            in: targetIds,
          },
          evalStage: {
            in: ['FINAL', 'CEO_ADJUST', 'SECOND', 'FIRST'],
          },
          evalCycle: {
            orgId: selectedCycle.orgId,
            evalYear: {
              gte: selectedCycle.evalYear - 2,
              lte: selectedCycle.evalYear,
            },
          },
        },
        select: {
          targetId: true,
          evalStage: true,
          totalScore: true,
          gradeId: true,
          updatedAt: true,
          evalCycle: {
            select: {
              id: true,
              evalYear: true,
              cycleName: true,
            },
          },
        },
        orderBy: [{ evalCycle: { evalYear: 'desc' } }, { updatedAt: 'desc' }],
      }),
      prisma.multiFeedback.findMany({
        where: {
          receiverId: {
            in: targetIds,
          },
          status: 'SUBMITTED',
          relationship: {
            in: ['SELF', 'SUPERVISOR', 'PEER', 'CROSS_TEAM_PEER'],
          },
          round: {
            evalCycleId: selectedCycle.id,
          },
        },
        select: {
          receiverId: true,
          relationship: true,
          responses: {
            select: {
              ratingValue: true,
            },
          },
        },
      }),
      prisma.department.findMany({
        where: {
          orgId: selectedCycle.orgId,
        },
        select: {
          id: true,
          deptName: true,
          leaderEmployeeId: true,
          leaderEmployee: {
            select: {
              empName: true,
            },
          },
        },
      }),
      prisma.appeal.findMany({
        where: {
          evaluation: {
            evalCycleId: selectedCycle.id,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          reason: true,
          status: true,
          adminResponse: true,
          createdAt: true,
          updatedAt: true,
          appealer: {
            select: {
              empName: true,
            },
          },
          evaluation: {
            select: {
              target: {
                select: {
                  empName: true,
                  department: {
                    select: {
                      deptName: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ])

    const aiCompetencyResults = await loadAiCompetencySyncedResults({
      evalCycleIds: [selectedCycle.id],
      employeeIds: targetIds,
    }).catch((error) => {
      console.error('[evaluation-calibration] AI competency sync fallback', error)
      return new Map()
    })

    const checkInMap = buildCheckInMap(checkIns)
    const historicalEvaluationMap = buildHistoricalEvaluationMap(
      historicalEvaluations,
      gradeSettings
    )
    const feedbackSummaryMap = buildFeedbackSummaryMap(feedbackSummaries)
    const departmentLeaderMap = new Map(
      departments.map((department) => [
        department.id,
        department.leaderEmployee?.empName ?? department.deptName,
      ])
    )
    const byDepartment = buildDepartmentDistributions(filteredGroups, gradeSettings)
    const outlierDepartmentIds = new Set(
      byDepartment.filter((department) => department.isOutlier).map((department) => department.departmentId)
    )
    const decoratedCandidates = filteredGroups.map((group) =>
      buildCalibrationCandidate({
        cycleYear: selectedCycle.evalYear,
        group,
        gradeSettings,
        checkIns: checkInMap.get(group.target.id) ?? [],
        departmentOutlierMap: outlierDepartmentIds,
        aiCompetencyScore: aiCompetencyResults.get(`${selectedCycle.id}:${group.target.id}`)?.finalScore,
        externalColumns: sessionConfig.externalColumns,
        externalRow: sessionConfig.externalRowsByTargetId[group.target.id] ?? {},
        employeeRecord: orgEmployeeMap.get(group.target.id),
        historicalEvaluations: historicalEvaluationMap.get(group.target.id) ?? [],
        feedbackSummary: feedbackSummaryMap.get(group.target.id),
        workspaceState: sessionConfig.workspace.candidateStates[group.target.id],
      })
    )

    const summary = buildSummary(decoratedCandidates, byDepartment)
    const cycleStatus = resolveCalibrationStatus(selectedCycle, effectiveAuditLogs, summary.adjustedCount)
    const checklist = buildChecklist(decoratedCandidates)
    const setupReadiness = buildCalibrationSetupReadiness({
      setup: sessionConfig.setup,
      participantIds: sessionConfig.participantIds,
    })
    const timeline = buildCalibrationTimeline({
      cycle: selectedCycle,
      auditLogs: effectiveAuditLogs,
      groups: filteredGroups,
      gradeSettings,
    })
    const actorCapabilities = buildCalibrationActorCapabilities({
      userId: params.userId,
      role: params.role,
      sessionConfig,
    })
    const followUp = buildCalibrationFollowUp({
      candidates: decoratedCandidates,
      byDepartment,
      timeline,
      sessionConfig: sessionConfig.followUp,
      departmentLeaderMap,
      setup: sessionConfig.setup,
      appeals,
      gradeOptions: gradeSettings,
    })

    return {
      state: 'ready',
      availableCycles,
      selectedCycleId: selectedCycle.id,
      selectedScopeId,
      viewModel: {
        actor: actorCapabilities,
        actorRole: params.role,
        cycle: {
          id: selectedCycle.id,
          name: selectedCycle.cycleName,
          year: selectedCycle.evalYear,
          status: cycleStatus,
          rawStatus: selectedCycle.status,
          lockedAt: resolveLockedAt(selectedCycle, effectiveAuditLogs),
          sessionStartedAt: resolveSessionStartedAt(effectiveAuditLogs),
          organizationName: employee.department.organization.name,
          selectedScopeId,
        },
        sessionConfig: {
          excludedTargetIds: sessionConfig.excludedTargetIds,
          participantIds: sessionConfig.participantIds,
          evaluatorIds: sessionConfig.evaluatorIds,
          observerIds: sessionConfig.observerIds,
          externalColumns: sessionConfig.externalColumns,
          lastMergeSummary: sessionConfig.lastMergeSummary,
          setup: sessionConfig.setup,
          workspace: {
            currentCandidateId: sessionConfig.workspace.currentCandidateId,
            timer: sessionConfig.workspace.timer,
            customPrompts: sessionConfig.workspace.customPrompts.length
              ? sessionConfig.workspace.customPrompts
              : [...CALIBRATION_DEFAULT_FACILITATOR_PROMPTS],
          },
        },
        sessionOptions: {
          targets: groups.map((group) => ({
            id: group.target.id,
            employeeId: group.target.empId,
            name: group.target.empName,
            department: group.target.department.deptName,
          })),
          people: orgEmployees.map((person) => ({
            id: person.id,
            name: person.empName,
            department: person.department.deptName,
            role: resolvePositionLabel(person.position),
          })),
          departments: scopeOptions
            .filter((option) => option.id !== 'all')
            .map((option) => ({
              id: option.id,
              label: option.label,
            })),
          visibleColumnOptions: CALIBRATION_VISIBLE_COLUMN_OPTIONS.map((option) => ({
            key: option.key,
            label: option.label,
            description: option.description,
          })),
          groundRulePresets: CALIBRATION_GROUND_RULE_PRESETS.map((rule) => ({
            key: rule.key,
            label: rule.label,
            description: rule.description,
          })),
        },
        scopeOptions,
        gradeOptions: gradeSettings.map((grade) => ({
          id: grade.id,
          grade: grade.gradeName,
          targetRatio: grade.targetDistRate ?? undefined,
        })),
        summary,
        distributions: {
          company: buildGradeDistribution(decoratedCandidates, gradeSettings),
          byDepartment,
          byJobGroup: buildJobGroupDistributions(decoratedCandidates, gradeSettings),
        },
        candidates: decoratedCandidates,
        timeline,
        checklist,
        setupReadiness,
        followUp,
      },
    }
  } catch (error) {
    console.error('[evaluation-calibration] failed to build page data', error)
    return {
      state: 'error',
      availableCycles: [],
      message: '등급 조정 화면을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }
}

function groupEvaluationsByTarget(evaluations: EvaluationRecord[]) {
  const grouped = new Map<string, CandidateGroup>()

  for (const evaluation of evaluations) {
    const current =
      grouped.get(evaluation.targetId) ??
      ({
        target: evaluation.target,
        selfEvaluation: null,
        finalEvaluation: null,
        adjustedEvaluation: null,
        reviewerEvaluation: null,
      } satisfies CandidateGroup)

    if (evaluation.evalStage === 'SELF') current.selfEvaluation = evaluation
    if (evaluation.evalStage === 'FINAL') current.finalEvaluation = evaluation
    if (evaluation.evalStage === 'CEO_ADJUST') current.adjustedEvaluation = evaluation
    if (evaluation.evalStage === 'SECOND') current.reviewerEvaluation = evaluation
    if (!current.finalEvaluation && evaluation.evalStage === 'FIRST') current.finalEvaluation = evaluation

    grouped.set(evaluation.targetId, current)
  }

  return [...grouped.values()].filter((group) => group.finalEvaluation || group.adjustedEvaluation)
}

function buildScopeOptions(groups: CandidateGroup[]) {
  const options = [
    {
      id: 'all',
      label: '전사 전체',
    },
  ]

  const seen = new Set<string>()
  for (const group of groups) {
    if (seen.has(group.target.department.id)) continue
    seen.add(group.target.department.id)
    options.push({
      id: group.target.department.id,
      label: group.target.department.deptName,
    })
  }

  return options
}

function filterGroupsByScope(groups: CandidateGroup[], selectedScopeId: string) {
  if (!selectedScopeId || selectedScopeId === 'all') return groups
  return groups.filter((group) => group.target.department.id === selectedScopeId)
}

function resolveSourceStage(group: CandidateGroup): CalibrationCandidate['sourceStage'] {
  if (group.finalEvaluation?.evalStage === 'FINAL') return 'FINAL'
  if (group.finalEvaluation?.evalStage === 'SECOND' || group.reviewerEvaluation) return 'SECOND'
  return 'FIRST'
}

function buildCheckInMap(checkIns: CheckInRecord[]) {
  const map = new Map<string, CheckInRecord[]>()
  for (const record of checkIns) {
    const current = map.get(record.ownerId) ?? []
    current.push(record)
    map.set(record.ownerId, current)
  }
  return map
}

function buildCalibrationCandidate(params: {
  cycleYear: number
  group: CandidateGroup
  gradeSettings: GradeSettingLite[]
  checkIns: CheckInRecord[]
  departmentOutlierMap: Set<string>
  aiCompetencyScore?: number
  externalColumns: Array<{ key: string; label: string }>
  externalRow: Record<string, string>
  employeeRecord?: {
    id: string
    empName: string
    position: Position
    jobTitle: string | null
    teamName: string | null
    joinDate: Date
    notes: string | null
    department: {
      deptName: string
    }
  }
  historicalEvaluations: Array<{
    year: number
    cycleName: string
    grade: string
    score?: number
  }>
  feedbackSummary?: CalibrationCandidate['feedbackSummary']
  workspaceState?: CalibrationWorkspaceCandidateState
}) {
  const { group, gradeSettings } = params
  const baseEvaluation = group.finalEvaluation ?? group.adjustedEvaluation
  const adjustedEvaluation = group.adjustedEvaluation
  const sourceStage = resolveSourceStage(group)
  const rawScore = calculateEffectiveEvaluationScore({
    evaluation: baseEvaluation ?? adjustedEvaluation ?? null,
    fallback: baseEvaluation?.totalScore ?? adjustedEvaluation?.totalScore ?? 0,
    syncedCompetencyScore: params.aiCompetencyScore,
  })
  const originalGrade = resolveGradeName(
    group.finalEvaluation?.gradeId ?? null,
    group.finalEvaluation?.totalScore ?? rawScore,
    gradeSettings
  )
  const adjustedGrade = resolveGradeName(
    adjustedEvaluation?.gradeId ?? null,
    adjustedEvaluation?.totalScore ?? rawScore,
    gradeSettings
  )
  const adjusted = Boolean(adjustedEvaluation && adjustedGrade && adjustedGrade !== originalGrade)
  const reason = adjustedEvaluation?.comment?.trim() || undefined
  const reasonMissing = adjusted && !reason
  const performanceScore = calcEvaluationAxisScore(baseEvaluation, 'performance')
  const competencyScore = params.aiCompetencyScore ?? calcEvaluationAxisScore(baseEvaluation, 'competency')
  const monthlySummary = buildMonthlySummary(baseEvaluation)
  const kpiSummary = buildKpiSummary(baseEvaluation)
  const checkins = params.checkIns
    .sort((a, b) => (b.actualDate ?? b.scheduledDate).getTime() - (a.actualDate ?? a.scheduledDate).getTime())
    .slice(0, 3)
    .map((record) => ({
      date: (record.actualDate ?? record.scheduledDate).toISOString(),
      type: record.checkInType,
      status: record.status,
      summary:
        record.keyTakeaways ||
        record.managerNotes ||
        record.ownerNotes ||
        '최근 체크인에 남겨진 요약 메모가 없습니다.',
    }))

  const nearBoundary = isNearGradeBoundary(rawScore, gradeSettings)
  const needsAttention =
    reasonMissing || nearBoundary || params.departmentOutlierMap.has(group.target.department.id)
  const externalData = params.externalColumns
    .map((column) => ({
      key: column.key,
      label: column.label,
      value: params.externalRow[column.key] ?? '',
    }))
    .filter((item) => item.value.trim().length > 0)
  const threeYearHistory = params.historicalEvaluations
  const priorEvaluation = threeYearHistory.find((entry) => entry.year < params.cycleYear)
  const priorRatingDelta =
    typeof priorEvaluation?.score === 'number' ? roundToSingle(rawScore - priorEvaluation.score) : undefined
  const workspace = normalizeCalibrationWorkspaceCandidateState(params.workspaceState)
  const newlyJoined = Boolean(
    params.employeeRecord?.joinDate &&
      new Date(params.employeeRecord.joinDate).getUTCFullYear() >= params.cycleYear - 1
  )
  const newlyPromoted = resolveBooleanFlagFromExternalData(externalData, ['recently promoted', 'newly promoted', '승진'])
  const promotionCandidate = resolveBooleanFlagFromExternalData(externalData, ['promotion', '승진'])
  const seniorLevel = ['SECTION_CHIEF', 'DIV_HEAD', 'CEO'].includes(String(group.target.position))
  const outlierFlag = params.departmentOutlierMap.has(group.target.department.id)

  return {
    id: group.target.id,
    employeeId: group.target.empId,
    employeeName: group.target.empName,
    departmentId: group.target.department.id,
    department: group.target.department.deptName,
    jobGroup: resolvePositionLabel(group.target.position),
    sourceStage,
    hasMergedCalibration: Boolean(adjustedEvaluation),
    rawScore: roundToSingle(rawScore),
    originalGrade: originalGrade ?? '미확정',
    adjustedGrade: adjustedGrade ?? originalGrade ?? '미확정',
    adjusted,
    reason,
    evaluatorName: baseEvaluation?.evaluator.empName,
    reviewerName: group.reviewerEvaluation?.evaluator.empName,
    performanceScore,
    competencyScore,
    evaluationComment: baseEvaluation?.comment ?? '최종 평가 코멘트가 아직 없습니다.',
    reviewerComment:
      group.reviewerEvaluation?.comment ??
      adjustedEvaluation?.comment ??
      '상위 평가자의 별도 코멘트가 없습니다.',
    needsAttention,
    reasonMissing,
    suggestedReason: buildSuggestedReason({
      adjusted,
      reasonMissing,
      isOutlier: params.departmentOutlierMap.has(group.target.department.id),
      nearBoundary,
      rawScore,
      originalGrade: originalGrade ?? '미확정',
      adjustedGrade: adjustedGrade ?? originalGrade ?? '미확정',
    }),
    monthlySummary,
    kpiSummary,
    checkins,
    externalData,
    threeYearHistory,
    feedbackSummary: params.feedbackSummary ?? {},
    outlierFlag,
    newlyJoined,
    newlyPromoted,
    promotionCandidate,
    seniorLevel,
    currentManagerRating: adjustedGrade ?? originalGrade ?? '미확정',
    priorTrendSummary: buildPriorTrendSummary(threeYearHistory),
    priorRatingDelta,
    workspace,
  } satisfies CalibrationCandidate
}

function buildHistoricalEvaluationMap(
  evaluations: HistoricalEvaluationRecord[],
  gradeSettings: GradeSettingLite[]
) {
  const grouped = new Map<string, Map<string, HistoricalEvaluationRecord>>()

  for (const evaluation of evaluations) {
    const targetMap = grouped.get(evaluation.targetId) ?? new Map<string, HistoricalEvaluationRecord>()
    const cycleKey = evaluation.evalCycle.id
    const current = targetMap.get(cycleKey)

    if (!current || getCalibrationStagePriority(evaluation.evalStage) > getCalibrationStagePriority(current.evalStage)) {
      targetMap.set(cycleKey, evaluation)
    }

    grouped.set(evaluation.targetId, targetMap)
  }

  return new Map(
    [...grouped.entries()].map(([targetId, cycleMap]) => [
      targetId,
      [...cycleMap.values()]
        .sort((a, b) => b.evalCycle.evalYear - a.evalCycle.evalYear)
        .slice(0, 3)
        .map((evaluation) => ({
          year: evaluation.evalCycle.evalYear,
          cycleName: evaluation.evalCycle.cycleName,
          grade:
            resolveGradeName(evaluation.gradeId, evaluation.totalScore, gradeSettings) ?? '미확정',
          score: evaluation.totalScore ?? undefined,
        })),
    ])
  )
}

function buildFeedbackSummaryMap(records: Array<{
  receiverId: string
  relationship: RaterRelationship
  responses: Array<{ ratingValue: number | null }>
}>) {
  const grouped = new Map<string, FeedbackSummaryRecord[]>()

  for (const record of records) {
    const ratings = record.responses
      .map((response) => response.ratingValue)
      .filter((value): value is number => typeof value === 'number')

    if (!ratings.length) continue

    const current = grouped.get(record.receiverId) ?? []
    current.push({
      receiverId: record.receiverId,
      relationship: record.relationship,
      ratings,
    })
    grouped.set(record.receiverId, current)
  }

  return new Map(
    [...grouped.entries()].map(([targetId, summaries]) => {
      const selfRatings = flattenFeedbackRatings(summaries, ['SELF'])
      const managerRatings = flattenFeedbackRatings(summaries, ['SUPERVISOR'])
      const peerRatings = flattenFeedbackRatings(summaries, ['PEER', 'CROSS_TEAM_PEER'])

      return [
        targetId,
        {
          selfMean: selfRatings.length ? roundToSingle(average(selfRatings)) : undefined,
          managerMean: managerRatings.length ? roundToSingle(average(managerRatings)) : undefined,
          peerMean: peerRatings.length ? roundToSingle(average(peerRatings)) : undefined,
          peerVariance: peerRatings.length > 1 ? roundToSingle(variance(peerRatings)) : undefined,
        } satisfies CalibrationCandidate['feedbackSummary'],
      ]
    })
  )
}

function flattenFeedbackRatings(
  records: FeedbackSummaryRecord[],
  relationships: RaterRelationship[]
) {
  return records
    .filter((record) => relationships.includes(record.relationship))
    .flatMap((record) => record.ratings)
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function variance(values: number[]) {
  const mean = average(values)
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
}

function getCalibrationStagePriority(stage: string) {
  if (stage === 'CEO_ADJUST') return 4
  if (stage === 'FINAL') return 3
  if (stage === 'SECOND') return 2
  if (stage === 'FIRST') return 1
  return 0
}

function buildPriorTrendSummary(
  history: Array<{
    year: number
    cycleName: string
    grade: string
    score?: number
  }>
) {
  if (history.length <= 1) return undefined

  const grades = history.map((entry) => `${entry.year} ${entry.grade}`).join(' → ')
  return `최근 3년 흐름: ${grades}`
}

function resolveBooleanFlagFromExternalData(
  externalData: Array<{ key: string; label: string; value: string }>,
  keywords: string[]
) {
  const matched = externalData.find((item) =>
    keywords.some((keyword) =>
      `${item.key} ${item.label}`.toLowerCase().includes(keyword.toLowerCase())
    )
  )

  if (!matched) return null

  return ['y', 'yes', 'true', '1', '대상', '예', 'candidate'].includes(
    matched.value.trim().toLowerCase()
  )
}

function buildSummary(
  candidates: CalibrationCandidate[],
  byDepartment: CalibrationViewModel['distributions']['byDepartment']
) {
  const adjustedCount = candidates.filter((candidate) => candidate.adjusted).length
  const pendingCount = candidates.filter((candidate) => candidate.needsAttention && !candidate.adjusted).length
  const reviewedCount = candidates.length - pendingCount
  const highGradeRatio =
    candidates.length > 0
      ? roundToSingle(
          (candidates.filter((candidate) => ['S', 'A'].includes(candidate.adjustedGrade ?? candidate.originalGrade)).length /
            candidates.length) *
            100
        )
      : 0
  const lowGradeRatio =
    candidates.length > 0
      ? roundToSingle(
          (candidates.filter((candidate) => ['C', 'D'].includes(candidate.adjustedGrade ?? candidate.originalGrade)).length /
            candidates.length) *
            100
        )
      : 0

  return {
    totalCount: candidates.length,
    adjustedCount,
    pendingCount,
    adjustedRate: candidates.length ? roundToSingle((adjustedCount / candidates.length) * 100) : 0,
    outlierOrgCount: byDepartment.filter((department) => department.isOutlier).length,
    highGradeRatio,
    lowGradeRatio,
    reviewedCount,
  }
}

function buildChecklist(candidates: CalibrationCandidate[]) {
  const missingReasonCount = candidates.filter((candidate) => candidate.adjusted && !candidate.reason?.trim()).length
  const hasWorkspaceProgress = candidates.some(
    (candidate) =>
      candidate.workspace.status !== 'PENDING' ||
      candidate.workspace.shortReason.length > 0 ||
      candidate.workspace.discussionMemo.length > 0 ||
      candidate.workspace.privateNote.length > 0 ||
      candidate.workspace.publicComment.length > 0
  )
  const unresolvedCandidateCount = hasWorkspaceProgress
    ? candidates.filter((candidate) => !isResolvedCalibrationDiscussionStatus(candidate.workspace.status)).length
    : candidates.filter((candidate) => candidate.needsAttention && !candidate.adjusted).length

  return {
    missingReasonCount,
    unresolvedCandidateCount,
    readyToLock: missingReasonCount === 0 && unresolvedCandidateCount === 0 && candidates.length > 0,
  }
}

function buildGradeDistribution(candidates: CalibrationCandidate[], gradeSettings: GradeSettingLite[]) {
  return gradeSettings.map((grade) => {
    const count = candidates.filter(
      (candidate) => (candidate.adjustedGrade ?? candidate.originalGrade) === grade.gradeName
    ).length
    const ratio = candidates.length ? roundToSingle((count / candidates.length) * 100) : 0
    return {
      grade: grade.gradeName,
      count,
      ratio,
      targetRatio: grade.targetDistRate ?? undefined,
    }
  })
}

function buildDepartmentDistributions(
  groups: CandidateGroup[],
  gradeSettings: GradeSettingLite[]
): CalibrationViewModel['distributions']['byDepartment'] {
  const departmentMap = new Map<string, CandidateGroup[]>()

  for (const group of groups) {
    const current = departmentMap.get(group.target.department.id) ?? []
    current.push(group)
    departmentMap.set(group.target.department.id, current)
  }

  return [...departmentMap.entries()].map(([departmentId, items]) => {
    const candidates = items.map((group) =>
      buildCalibrationCandidate({
        group,
        cycleYear: new Date().getFullYear(),
        gradeSettings,
        checkIns: [],
        employeeRecord: undefined,
        historicalEvaluations: [],
        feedbackSummary: undefined,
        workspaceState: undefined,
        departmentOutlierMap: new Set<string>(),
        externalColumns: [],
        externalRow: {},
      })
    )
    const grades = buildGradeDistribution(candidates, gradeSettings)
    const deltaScore = roundToSingle(
      grades.reduce((sum, grade) => sum + Math.abs((grade.targetRatio ?? grade.ratio) - grade.ratio), 0)
    )

    return {
      departmentId,
      department: items[0]?.target.department.deptName ?? '미지정',
      grades,
      totalCount: items.length,
      deltaScore,
      isOutlier: deltaScore >= 18,
    }
  })
}

function buildJobGroupDistributions(
  candidates: CalibrationCandidate[],
  gradeSettings: GradeSettingLite[]
) {
  const map = new Map<string, CalibrationCandidate[]>()
  for (const candidate of candidates) {
    const key = candidate.jobGroup ?? '기타'
    const current = map.get(key) ?? []
    current.push(candidate)
    map.set(key, current)
  }

  return [...map.entries()].map(([jobGroup, rows]) => ({
    jobGroup,
    grades: buildGradeDistribution(rows, gradeSettings),
    totalCount: rows.length,
  }))
}

function formatCalibrationTimelineAction(action: string) {
  switch (action) {
    case 'CALIBRATION_DISCUSSION_UPDATED':
      return '토론 상태 저장'
    case 'CALIBRATION_CURRENT_CANDIDATE_CHANGED':
      return '현재 논의 대상 변경'
    case 'CALIBRATION_TIMER_STARTED':
      return '타이머 시작'
    case 'CALIBRATION_TIMER_RESET':
      return '타이머 리셋'
    case 'CALIBRATION_TIMER_EXTENDED':
      return '타이머 연장'
    case 'CALIBRATION_FACILITATOR_PROMPT_ADDED':
      return '퍼실리테이터 질문 추가'
    case 'CALIBRATION_FACILITATOR_PROMPT_REMOVED':
      return '퍼실리테이터 질문 제거'
    case 'CALIBRATION_PUBLIC_COMMENT_HANDOFF_SAVED':
      return '공개용 코멘트 초안 저장'
    case 'CALIBRATION_PUBLIC_COMMENT_FINALIZED':
      return '공개용 코멘트 확정'
    case 'CALIBRATION_COMMUNICATION_PACKET_GENERATED':
      return '커뮤니케이션 패킷 생성'
    case 'CALIBRATION_FOLLOW_UP_REVIEW_FLAG_UPDATED':
      return '후속 점검 플래그 저장'
    case 'CALIBRATION_RETROSPECTIVE_SURVEY_SUBMITTED':
      return '회고 설문 제출'
    case 'CALIBRATION_LEADER_FEEDBACK_RECORDED':
      return '리더 피드백 저장'
    default:
      return humanizeCalibrationActionLabel(action)
  }
}

function resolveExtendedTimelineActionKind(
  action: string
): CalibrationViewModel['timeline'][number]['actionType'] {
  if (action.startsWith('CALIBRATION_TIMER_')) return 'system'
  if (action === 'CALIBRATION_CURRENT_CANDIDATE_CHANGED') return 'system'
  if (action.startsWith('CALIBRATION_FACILITATOR_PROMPT_')) return 'system'
  if (action.startsWith('CALIBRATION_PUBLIC_COMMENT_')) return 'review'
  if (action === 'CALIBRATION_COMMUNICATION_PACKET_GENERATED') return 'review'
  if (action === 'CALIBRATION_FOLLOW_UP_REVIEW_FLAG_UPDATED') return 'review'
  if (action === 'CALIBRATION_RETROSPECTIVE_SURVEY_SUBMITTED') return 'system'
  if (action === 'CALIBRATION_LEADER_FEEDBACK_RECORDED') return 'review'
  return resolveTimelineActionKind(action)
}

function buildCalibrationTimeline(params: {
  cycle: {
    id: string
    cycleName: string
    ceoAdjustStart: Date | null
    ceoAdjustEnd: Date | null
    resultOpenStart: Date | null
    status: CycleStatus
  }
  auditLogs: AuditLogRecord[]
  groups: CandidateGroup[]
  gradeSettings: GradeSettingLite[]
}) {
  const timeline: CalibrationViewModel['timeline'] = params.auditLogs.map((log) => {
    const payload = parseCalibrationPayload(log.newValue)
    return {
      id: log.id,
      at: log.timestamp.toISOString(),
      actor: payload.confirmedBy ?? payload.targetName ?? log.userId,
        action: formatCalibrationTimelineAction(log.action),
      employeeName: payload.targetName,
      fromGrade: payload.fromGrade,
      toGrade: payload.toGrade,
      reason: payload.reason,
        actionType: resolveExtendedTimelineActionKind(log.action),
    }
  })

  if (!timeline.length) {
    const adjustedGroups = params.groups.filter((group) => {
      const originalGrade = resolveGradeName(
        group.finalEvaluation?.gradeId ?? null,
        group.finalEvaluation?.totalScore ?? null,
        params.gradeSettings
      )
      const adjustedGrade = resolveGradeName(
        group.adjustedEvaluation?.gradeId ?? null,
        group.adjustedEvaluation?.totalScore ?? null,
        params.gradeSettings
      )
      return Boolean(group.adjustedEvaluation && adjustedGrade && adjustedGrade !== originalGrade)
    })

    adjustedGroups.forEach((group, index) => {
      timeline.push({
        id: `synthetic-${group.target.id}-${index}`,
        at: (group.adjustedEvaluation?.updatedAt ?? group.finalEvaluation?.updatedAt ?? new Date()).toISOString(),
        actor: group.adjustedEvaluation?.evaluator.empName ?? '캘리브레이션 운영',
        action: '등급 조정 반영',
        employeeName: group.target.empName,
        fromGrade: resolveGradeName(
          group.finalEvaluation?.gradeId ?? null,
          group.finalEvaluation?.totalScore ?? null,
          params.gradeSettings
        ) ?? '미확정',
        toGrade:
          resolveGradeName(
            group.adjustedEvaluation?.gradeId ?? null,
            group.adjustedEvaluation?.totalScore ?? null,
            params.gradeSettings
          ) ?? '미확정',
        reason: group.adjustedEvaluation?.comment ?? undefined,
        actionType: 'adjust',
      })
    })
  }

  return timeline.sort((a, b) => b.at.localeCompare(a.at))
}

function mapAppealStatusToCalibrationFollowUpStatus(
  status: AppealStatus
): CalibrationFollowUpObjectionStatus {
  if (status === 'SUBMITTED') return 'SUBMITTED'
  if (status === 'UNDER_REVIEW') return 'REVIEWING'
  if (status === 'CLOSED') return 'CLOSED'
  return 'RESPONDED'
}

function buildCommunicationContextSummary(candidate: CalibrationCandidate) {
  const parts = [
    candidate.adjusted
      ? `등급 변경 ${candidate.originalGrade} -> ${candidate.adjustedGrade ?? candidate.originalGrade}`
      : '등급 변경 없음',
    candidate.outlierFlag ? 'outlier 재확인 필요' : null,
    candidate.newlyJoined ? '신규 입사자 맥락 확인' : null,
    candidate.newlyPromoted ? '최근 승진 맥락 확인' : null,
    candidate.promotionCandidate ? '승진 후보 관점 설명 필요' : null,
  ].filter((item): item is string => Boolean(item))

  return parts.join(' / ')
}

function buildCalibrationFollowUp(params: {
  candidates: CalibrationCandidate[]
  byDepartment: CalibrationViewModel['distributions']['byDepartment']
  timeline: CalibrationViewModel['timeline']
  sessionConfig: CalibrationFollowUpValue
  departmentLeaderMap: Map<string, string>
  setup: CalibrationViewModel['sessionConfig']['setup']
  appeals: CalibrationAppealRecord[]
  gradeOptions: Array<{
    id: string
    gradeName: string
    gradeOrder: number
  }>
}): CalibrationViewModel['followUp'] {
  const gradeOrderMap = new Map(
    params.gradeOptions.map((grade) => [grade.gradeName, grade.gradeOrder])
  )
  const departmentComparisons = params.byDepartment.map((department) => {
    const departmentCandidates = params.candidates.filter(
      (candidate) => candidate.departmentId === department.departmentId
    )
    const originalOrders = departmentCandidates
      .map((candidate) => gradeOrderMap.get(candidate.originalGrade))
      .filter((value): value is number => typeof value === 'number')
    const finalOrders = departmentCandidates
      .map((candidate) => gradeOrderMap.get(candidate.adjustedGrade ?? candidate.originalGrade))
      .filter((value): value is number => typeof value === 'number')

    return {
      departmentId: department.departmentId,
      department: department.department,
      leaderName:
        params.departmentLeaderMap.get(department.departmentId) ?? department.department,
      originalAverageOrder: average(originalOrders) ?? 0,
      finalAverageOrder: average(finalOrders) ?? 0,
      changedCount: departmentCandidates.filter((candidate) => candidate.adjusted).length,
      isOutlier: department.isOutlier,
    }
  })

  const topBottomRecheck = params.candidates
    .slice()
    .sort((left, right) => {
      const leftOrder = gradeOrderMap.get(left.adjustedGrade ?? left.originalGrade) ?? 999
      const rightOrder = gradeOrderMap.get(right.adjustedGrade ?? right.originalGrade) ?? 999
      if (left.outlierFlag !== right.outlierFlag) return left.outlierFlag ? -1 : 1
      return leftOrder - rightOrder
    })
    .slice(0, 6)
    .map((candidate) => ({
      targetId: candidate.id,
      employeeName: candidate.employeeName,
      finalGrade: candidate.adjustedGrade ?? candidate.originalGrade,
      outlierFlag: candidate.outlierFlag,
    }))
  const changeHistory = params.timeline
    .filter((item) => item.actionType === 'adjust' || item.action.includes('코멘트') || item.action.includes('패킷'))
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      at: item.at,
      actor: item.actor,
      employeeName: item.employeeName,
      fromGrade: item.fromGrade,
      toGrade: item.toGrade,
      reason: item.reason,
    }))

  const packets = params.candidates.map((candidate) => {
    const handoff =
      params.sessionConfig.commentHandoffsByTargetId[candidate.id] ??
      createDefaultCalibrationCommentHandoff(candidate.workspace.publicComment)
    const reviewFlag = params.sessionConfig.reviewFlagsByTargetId[candidate.id]
    return {
      targetId: candidate.id,
      employeeName: candidate.employeeName,
      department: candidate.department,
      finalGrade: candidate.adjustedGrade ?? candidate.originalGrade,
      changed: candidate.adjusted,
      contextSummary: buildCommunicationContextSummary(candidate),
      draftComment: handoff.draftComment || candidate.workspace.publicComment,
      finalizedComment: handoff.finalizedComment ?? undefined,
      revisionCount: handoff.revisions.length,
      packetGeneratedAt: handoff.packetGeneratedAt ?? undefined,
      finalizedAt: handoff.finalizedAt ?? undefined,
      compensationSensitive: Boolean(reviewFlag?.compensationSensitive),
      finalCheckNote: reviewFlag?.finalCheckNote ?? '',
      revisions: handoff.revisions.map((revision) => ({
        id: revision.id,
        stage: revision.stage,
        comment: revision.comment,
        createdAt: revision.createdAt,
        actorName: revision.actorName,
      })),
    }
  })

  const objectionCases = params.appeals.map((appeal) => ({
    id: appeal.id,
    appealerName: appeal.appealer.empName,
    targetName: appeal.evaluation.target.empName,
    targetDepartment: appeal.evaluation.target.department.deptName,
    status: mapAppealStatusToCalibrationFollowUpStatus(appeal.status),
    reason: appeal.reason,
    requestedAction: undefined,
    adminResponse: appeal.adminResponse ?? undefined,
    createdAt: appeal.createdAt.toISOString(),
    updatedAt: appeal.updatedAt.toISOString(),
  }))
  const objectionSummary = objectionCases.reduce(
    (summary, objection) => {
      summary[objection.status] += 1
      return summary
    },
    {
      SUBMITTED: 0,
      REVIEWING: 0,
      RESPONDED: 0,
      CLOSED: 0,
    } as Record<CalibrationFollowUpObjectionStatus, number>
  )

  const surveyResponses = params.sessionConfig.retrospectiveSurveys
    .slice()
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
    .map((response) => ({
      id: response.id,
      respondentName: response.respondentName,
      submittedAt: response.submittedAt,
      hardestPart: response.hardestPart,
      missingData: response.missingData,
      rulesAndTimebox: response.rulesAndTimebox,
      positives: response.positives,
      improvements: response.improvements,
      nextCycleNeeds: response.nextCycleNeeds,
      leniencyFeedback: response.leniencyFeedback,
    }))

  const leaderFeedback = Object.values(params.sessionConfig.leaderFeedbackByLeaderId)
    .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
    .map((feedback) => ({
      leaderId: feedback.leaderId,
      leaderName: feedback.leaderName,
      summary: feedback.summary,
      suggestions: feedback.suggestions,
      visibility: feedback.visibility,
      updatedAt: feedback.updatedAt ?? undefined,
      updatedByName: feedback.updatedByName ?? undefined,
    }))

  return {
    review: {
      changedRatingCount: params.candidates.filter((candidate) => candidate.adjusted).length,
      outlierRecheckCount: params.candidates.filter((candidate) => candidate.outlierFlag).length,
      newlyJoinedCount: params.candidates.filter((candidate) => candidate.newlyJoined).length,
      newlyPromotedCount: params.candidates.filter((candidate) => candidate.newlyPromoted).length,
      promotionCandidateCount: params.candidates.filter((candidate) => candidate.promotionCandidate).length,
      compensationSensitiveCount: Object.values(params.sessionConfig.reviewFlagsByTargetId).filter(
        (flag) => flag.compensationSensitive
      ).length,
      departmentComparisons,
      topBottomRecheck,
      changeHistory,
    },
    communicationGuide: {
      purpose: CALIBRATION_COMMUNICATION_GUIDE.purpose,
      sequence: [...CALIBRATION_COMMUNICATION_GUIDE.sequence],
      goodExample: CALIBRATION_COMMUNICATION_GUIDE.goodExample,
      badExample: CALIBRATION_COMMUNICATION_GUIDE.badExample,
      avoidPhrases: [...CALIBRATION_COMMUNICATION_GUIDE.avoidPhrases],
      managerDo: [...CALIBRATION_COMMUNICATION_GUIDE.managerDo],
      packets,
    },
    objections: {
      windowOpenAt: params.setup.objectionWindowOpenAt,
      windowCloseAt: params.setup.objectionWindowCloseAt,
      summary: objectionSummary,
      cases: objectionCases,
    },
    surveys: {
      responseCount: surveyResponses.length,
      responses: surveyResponses,
      aggregates: {
        hardestThemes: collectCalibrationFollowUpThemes(
          surveyResponses.map((response) => response.hardestPart)
        ),
        missingDataThemes: collectCalibrationFollowUpThemes(
          surveyResponses.map((response) => response.missingData)
        ),
        improvementThemes: collectCalibrationFollowUpThemes(
          surveyResponses.map((response) => response.improvements)
        ),
      },
    },
    leaderFeedback,
  }
}

function resolveCalibrationStatus(
  cycle: {
    status: CycleStatus
  },
  auditLogs: AuditLogRecord[],
  adjustedCount: number
): CalibrationStatus {
  if (['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(cycle.status)) {
    return 'FINAL_LOCKED'
  }

  const latestCycleAction = [...auditLogs]
    .reverse()
    .find((log) => log.entityType === 'EvalCycle' && log.action.startsWith('CALIBRATION_'))?.action

  if (latestCycleAction === 'CALIBRATION_LOCKED') return 'FINAL_LOCKED'
  if (latestCycleAction === 'CALIBRATION_SESSION_DELETED') return 'READY'
  if (latestCycleAction === 'CALIBRATION_REVIEW_CONFIRMED') return 'REVIEW_CONFIRMED'
  if (latestCycleAction === 'CALIBRATION_SESSION_STARTED') return 'CALIBRATING'
  if (latestCycleAction === 'CALIBRATION_REOPEN_REQUESTED') return 'CALIBRATING'
  if (adjustedCount > 0 || cycle.status === 'CEO_ADJUST') return 'CALIBRATING'
  return 'READY'
}

function resolveLockedAt(
  cycle: {
    status: CycleStatus
    resultOpenStart: Date | null
  },
  auditLogs: AuditLogRecord[]
) {
  if (['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(cycle.status)) {
    return cycle.resultOpenStart?.toISOString()
  }

  const lockedLog = [...auditLogs]
    .reverse()
    .find((log) => log.entityType === 'EvalCycle' && log.action === 'CALIBRATION_LOCKED')

  return lockedLog?.timestamp.toISOString()
}

function resolveSessionStartedAt(auditLogs: AuditLogRecord[]) {
  return [...auditLogs]
    .reverse()
    .find((log) => log.entityType === 'EvalCycle' && log.action === 'CALIBRATION_SESSION_STARTED')
    ?.timestamp.toISOString()
}

function buildCalibrationActorCapabilities(params: {
  userId: string
  role: SystemRole
  sessionConfig: CalibrationSessionConfigValue
}): CalibrationViewModel['actor'] {
  if (params.role === 'ROLE_CEO') {
    return {
      userId: params.userId,
      role: 'ROLE_CEO',
      sessionRole: 'CEO',
      canManageFlow: true,
      canFinalizeAdjustments: true,
      canRecordPrivateNote: true,
      canWritePublicComment: true,
      canFinalizeFollowUpComment: true,
      canSubmitFollowUpSurvey: true,
      canRecordLeaderFeedback: true,
    }
  }

  const { setup, participantIds, observerIds } = params.sessionConfig
  const sessionRole =
    setup.ownerId === params.userId
      ? 'OWNER'
      : setup.facilitatorId === params.userId
        ? 'FACILITATOR'
        : setup.recorderId === params.userId
          ? 'RECORDER'
          : participantIds.includes(params.userId)
            ? 'PARTICIPANT'
            : observerIds.includes(params.userId)
              ? 'OBSERVER'
              : 'ADMIN'

  return {
    userId: params.userId,
    role: params.role,
    sessionRole,
    canManageFlow: ['OWNER', 'FACILITATOR', 'ADMIN'].includes(sessionRole),
    canFinalizeAdjustments:
      sessionRole === 'OWNER' ||
      sessionRole === 'ADMIN' ||
      (sessionRole === 'FACILITATOR' && setup.facilitatorCanFinalize),
    canRecordPrivateNote: ['OWNER', 'FACILITATOR', 'RECORDER', 'PARTICIPANT', 'ADMIN'].includes(
      sessionRole
    ),
    canWritePublicComment: ['OWNER', 'FACILITATOR', 'PARTICIPANT', 'ADMIN'].includes(sessionRole),
    canFinalizeFollowUpComment:
      sessionRole === 'OWNER' ||
      sessionRole === 'ADMIN' ||
      (sessionRole === 'FACILITATOR' && setup.facilitatorCanFinalize),
    canSubmitFollowUpSurvey: ['OWNER', 'FACILITATOR', 'RECORDER', 'PARTICIPANT', 'OBSERVER', 'ADMIN'].includes(
      sessionRole
    ),
    canRecordLeaderFeedback: ['FACILITATOR', 'ADMIN', 'OWNER'].includes(sessionRole),
  }
}

function calcEvaluationAxisScore(
  evaluation: EvaluationRecord | null,
  axis: 'performance' | 'competency'
) {
  if (!evaluation) return undefined

  const rows = evaluation.items
    .map((item) => {
      const score = getDisplayScore(item)
      return {
        type: item.personalKpi.kpiType,
        score,
        weight: item.personalKpi.weight,
      }
    })
    .filter((row) =>
      axis === 'performance' ? row.type === 'QUANTITATIVE' : row.type === 'QUALITATIVE'
    )
    .filter(
      (
        row
      ): row is {
        type: EvaluationRecord['items'][number]['personalKpi']['kpiType']
        score: number
        weight: number
      } => typeof row.score === 'number'
    )

  if (!rows.length) return undefined
  const weightSum = rows.reduce((sum, row) => sum + row.weight, 0)
  if (weightSum <= 0) return roundToSingle(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
  return roundToSingle(rows.reduce((sum, row) => sum + row.score * row.weight, 0) / weightSum)
}

function calculateEffectiveEvaluationScore(params: {
  evaluation: EvaluationRecord | null
  fallback: number
  syncedCompetencyScore?: number
}) {
  if (!params.evaluation || typeof params.syncedCompetencyScore !== 'number') {
    return params.fallback
  }

  const rows = params.evaluation.items.map((item) => {
    const score = getDisplayScore(item)
    return {
      type: item.personalKpi.kpiType,
      score:
        item.personalKpi.kpiType === 'QUALITATIVE' && typeof params.syncedCompetencyScore === 'number'
          ? params.syncedCompetencyScore
          : score,
      weight: item.personalKpi.weight,
    }
  }).filter((row): row is { type: EvaluationRecord['items'][number]['personalKpi']['kpiType']; score: number; weight: number } => typeof row.score === 'number')

  if (!rows.length) return params.fallback

  const weightSum = rows.reduce((sum, row) => sum + row.weight, 0)
  if (weightSum <= 0) {
    return roundToSingle(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
  }

  return roundToSingle(rows.reduce((sum, row) => sum + row.score * row.weight, 0) / weightSum)
}

function getDisplayScore(
  item: EvaluationRecord['items'][number]
) {
  if (item.quantScore !== null) return roundToSingle(item.quantScore)
  if (item.qualScore !== null) return roundToSingle(item.qualScore)
  if ([item.planScore, item.doScore, item.checkScore, item.actScore].some((value) => value !== null)) {
    return roundToSingle(
      calcPdcaScore(item.planScore ?? 0, item.doScore ?? 0, item.checkScore ?? 0, item.actScore ?? 0)
    )
  }
  if (item.weightedScore !== null && item.personalKpi.weight > 0) {
    return roundToSingle((item.weightedScore * 100) / item.personalKpi.weight)
  }
  return null
}

function buildMonthlySummary(evaluation: EvaluationRecord | null) {
  if (!evaluation) return []

  const monthMap = new Map<string, { month: string; rates: number[]; comments: string[] }>()
  evaluation.items.forEach((item) => {
    item.personalKpi.monthlyRecords.forEach((record) => {
      const current = monthMap.get(record.yearMonth) ?? {
        month: record.yearMonth,
        rates: [],
        comments: [],
      }
      if (typeof record.achievementRate === 'number') current.rates.push(record.achievementRate)
      const comment = record.activities || record.obstacles || record.efforts
      if (comment) current.comments.push(comment)
      monthMap.set(record.yearMonth, current)
    })
  })

  return [...monthMap.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 4)
    .map((item) => ({
      month: item.month,
      achievementRate:
        item.rates.length > 0
          ? roundToSingle(item.rates.reduce((sum, rate) => sum + rate, 0) / item.rates.length)
          : undefined,
      comment: item.comments[0] ?? undefined,
    }))
}

function buildKpiSummary(evaluation: EvaluationRecord | null) {
  if (!evaluation) return []

  return evaluation.items.slice(0, 4).map((item) => {
    const latestRecord = item.personalKpi.monthlyRecords[0]
    return {
      id: item.personalKpi.id,
      title: item.personalKpi.kpiName,
      target: item.personalKpi.targetValue ?? undefined,
      actual: latestRecord?.actualValue ?? undefined,
      achievementRate: latestRecord?.achievementRate ?? undefined,
      unit: item.personalKpi.unit ?? undefined,
    }
  })
}

function resolveGradeName(
  gradeId: string | null,
  totalScore: number | null,
  gradeSettings: GradeSettingLite[]
) {
  if (gradeId) {
    const matched = gradeSettings.find((grade) => grade.id === gradeId)
    if (matched) return matched.gradeName
  }

  if (totalScore === null || totalScore === undefined) return null
  return (
    gradeSettings.find((grade) => totalScore >= grade.minScore && totalScore <= grade.maxScore)?.gradeName ??
    null
  )
}

function isNearGradeBoundary(score: number, gradeSettings: GradeSettingLite[]) {
  return gradeSettings.some((grade) => Math.abs(score - grade.minScore) <= 2 || Math.abs(score - grade.maxScore) <= 2)
}

function buildSuggestedReason(params: {
  adjusted: boolean
  reasonMissing: boolean
  isOutlier: boolean
  nearBoundary: boolean
  rawScore: number
  originalGrade: string
  adjustedGrade: string
}) {
  if (params.reasonMissing) {
    return '조정 사유가 비어 있습니다. 분포 편차 또는 상대 비교 근거를 명확히 남겨 주세요.'
  }

  if (params.adjusted) {
    return `원등급 ${params.originalGrade}에서 ${params.adjustedGrade}로 조정된 근거를 성과/역량/분포 관점으로 남겨 주세요.`
  }

  if (params.isOutlier) {
    return '해당 조직은 기준 분포 대비 편차가 커서 검토 우선순위가 높습니다.'
  }

  if (params.nearBoundary) {
    return '등급 경계 근처 점수입니다. 타 후보와의 형평성을 함께 검토해 주세요.'
  }

  return '조정 필요성이 없다면 원등급 유지 사유를 메모해 두면 잠금 전 검토에 도움이 됩니다.'
}

function parseCalibrationPayload(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as CalibrationAuditPayload
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function humanizeCalibrationAction(action: string) {
  switch (action) {
    case 'CALIBRATION_UPDATED':
      return '등급 조정 저장'
    case 'CALIBRATION_CLEARED':
      return '조정 해제'
    case 'CALIBRATION_BULK_IMPORTED':
      return '최종 등급 일괄 업로드'
    case 'CALIBRATION_EXTERNAL_DATA_UPLOADED':
      return '외부 데이터 업로드'
    case 'CALIBRATION_MERGED':
      return '다단계 결과 병합'
    case 'CALIBRATION_SESSION_DELETED':
      return '세션 삭제'
    case 'CALIBRATION_REVIEW_CONFIRMED':
      return '리뷰 확정'
    case 'CALIBRATION_LOCKED':
      return '최종 잠금'
    case 'CALIBRATION_REOPEN_REQUESTED':
      return '재오픈 요청'
    default:
      return action
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function resolveTimelineActionType(action: string) {
  if (action === 'CALIBRATION_LOCKED') return 'lock'
  if (action === 'CALIBRATION_REOPEN_REQUESTED') return 'reopen'
  if (action === 'CALIBRATION_REVIEW_CONFIRMED') return 'review'
  if (action === 'CALIBRATION_SESSION_DELETED') return 'system'
  if (action.startsWith('CALIBRATION_')) return 'adjust'
  return 'system'
}

function humanizeCalibrationActionLabel(action: string) {
  switch (action) {
    case 'CALIBRATION_UPDATED':
      return '등급 조정 저장'
    case 'CALIBRATION_CLEARED':
      return '조정 해제'
    case 'CALIBRATION_BULK_IMPORTED':
      return '최종 등급 일괄 업로드'
    case 'CALIBRATION_EXTERNAL_DATA_UPLOADED':
      return '외부 데이터 업로드'
    case 'CALIBRATION_MERGED':
      return '하위 단계 결과 병합'
    case 'CALIBRATION_SESSION_STARTED':
      return '세션 시작'
    case 'CALIBRATION_SESSION_DELETED':
      return '세션 삭제'
    case 'CALIBRATION_REVIEW_CONFIRMED':
      return '리뷰 확정'
    case 'CALIBRATION_LOCKED':
      return '최종 잠금'
    case 'CALIBRATION_REOPEN_REQUESTED':
      return '재오픈 요청'
    default:
      return action
  }
}

function resolveTimelineActionKind(action: string) {
  if (action === 'CALIBRATION_LOCKED') return 'lock'
  if (action === 'CALIBRATION_REOPEN_REQUESTED') return 'reopen'
  if (action === 'CALIBRATION_REVIEW_CONFIRMED') return 'review'
  if (action === 'CALIBRATION_SESSION_STARTED') return 'system'
  if (action === 'CALIBRATION_SESSION_DELETED') return 'system'
  if (action.startsWith('CALIBRATION_')) return 'adjust'
  return 'system'
}

function resolvePositionLabel(position: Position) {
  switch (position) {
    case 'TEAM_LEADER':
      return '팀장'
    case 'SECTION_CHIEF':
      return '부서장'
    case 'DIV_HEAD':
      return '본부장'
    case 'CEO':
      return 'CEO'
    default:
      return '구성원'
  }
}

function roundToSingle(value: number) {
  return Math.round(value * 10) / 10
}
