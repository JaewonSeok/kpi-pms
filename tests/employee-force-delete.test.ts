/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DeleteGoogleAccountEmployeeSchema } from '../src/lib/validations'

const { AppError, errorResponse } = require('../src/lib/utils') as typeof import('../src/lib/utils')
const {
  safeDeleteEmployeeRecord,
} = require('../src/server/admin/google-account-management') as typeof import('../src/server/admin/google-account-management')

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function createDeleteManyDelegate(
  calls: Array<{ delegate: string; method: string; args: unknown }>,
  delegate: string,
  count: number
) {
  return async (args: unknown) => {
    calls.push({ delegate, method: 'deleteMany', args })
    return { count }
  }
}

function createUpdateManyDelegate(
  calls: Array<{ delegate: string; method: string; args: unknown }>,
  delegate: string,
  resolver: (args: unknown) => number
) {
  return async (args: unknown) => {
    calls.push({ delegate, method: 'updateMany', args })
    return { count: resolver(args) }
  }
}

function createEmployeeForceDeletePrismaMock(options?: {
  current?: {
    id: string
    empId: string
    empName: string
    gwsEmail: string
    deptId: string
    role: string
    status: string
  } | null
  deleteError?: Error
  notificationJobDeleteError?: Error
}) {
  const current =
    options && 'current' in options
      ? options.current
      : {
          id: 'emp-1',
          empId: 'E-1001',
          empName: '홍길동',
          gwsEmail: 'hong.gildong@rsupport.com',
          deptId: 'dept-1',
          role: 'ROLE_MEMBER',
          status: 'ACTIVE',
        }

  const calls: Array<{ delegate: string; method: string; args: unknown }> = []

  const tx = {
    personalKpi: {
      findMany: async (args: unknown) => {
        calls.push({ delegate: 'personalKpi', method: 'findMany', args })
        return [{ id: 'pk-1' }, { id: 'pk-2' }]
      },
      updateMany: createUpdateManyDelegate(calls, 'personalKpi', () => 1),
      deleteMany: createDeleteManyDelegate(calls, 'personalKpi', 2),
    },
    evaluation: {
      findMany: async (args: unknown) => {
        calls.push({ delegate: 'evaluation', method: 'findMany', args })
        return [{ id: 'eval-1' }]
      },
      deleteMany: createDeleteManyDelegate(calls, 'evaluation', 1),
    },
    multiFeedback: {
      findMany: async (args: unknown) => {
        calls.push({ delegate: 'multiFeedback', method: 'findMany', args })
        return [{ id: 'feedback-1' }]
      },
      deleteMany: createDeleteManyDelegate(calls, 'multiFeedback', 1),
    },
    employee: {
      updateMany: createUpdateManyDelegate(calls, 'employee', (args) => {
        const where = (args as { where?: Record<string, unknown> }).where ?? {}
        if ('managerId' in where) return 2
        if ('teamLeaderId' in where) return 1
        if ('sectionChiefId' in where) return 1
        if ('divisionHeadId' in where) return 1
        return 0
      }),
      delete: async (args: unknown) => {
        calls.push({ delegate: 'employee', method: 'delete', args })
        if (options?.deleteError) {
          throw options.deleteError
        }
        return {
          id: current?.id ?? 'emp-1',
          empId: current?.empId ?? 'E-1001',
          empName: current?.empName ?? '홍길동',
        }
      },
    },
    department: {
      updateMany: createUpdateManyDelegate(calls, 'department', () => 1),
    },
    feedbackAdminGroupMember: {
      deleteMany: createDeleteManyDelegate(calls, 'feedbackAdminGroupMember', 1),
    },
    feedbackRoundCollaborator: {
      deleteMany: createDeleteManyDelegate(calls, 'feedbackRoundCollaborator', 1),
    },
    onboardingReviewGeneration: {
      deleteMany: createDeleteManyDelegate(calls, 'onboardingReviewGeneration', 1),
    },
    aiCompetencyAnswer: {
      updateMany: createUpdateManyDelegate(calls, 'aiCompetencyAnswer', () => 1),
    },
    aiCompetencySubmissionReview: {
      deleteMany: createDeleteManyDelegate(calls, 'aiCompetencySubmissionReview', 1),
    },
    aiCompetencySecondRoundSubmission: {
      updateMany: createUpdateManyDelegate(calls, 'aiCompetencySecondRoundSubmission', () => 1),
      deleteMany: createDeleteManyDelegate(calls, 'aiCompetencySecondRoundSubmission', 2),
    },
    aiCompetencyExternalCertClaim: {
      updateMany: createUpdateManyDelegate(calls, 'aiCompetencyExternalCertClaim', () => 1),
      deleteMany: createDeleteManyDelegate(calls, 'aiCompetencyExternalCertClaim', 2),
    },
    aiCompetencyResult: {
      updateMany: createUpdateManyDelegate(calls, 'aiCompetencyResult', () => 1),
      deleteMany: createDeleteManyDelegate(calls, 'aiCompetencyResult', 2),
    },
    wordCloud360Assignment: {
      deleteMany: createDeleteManyDelegate(calls, 'wordCloud360Assignment', 2),
    },
    wordCloud360Response: {
      deleteMany: createDeleteManyDelegate(calls, 'wordCloud360Response', 2),
    },
    feedbackNomination: {
      deleteMany: createDeleteManyDelegate(calls, 'feedbackNomination', 1),
    },
    feedbackReportCache: {
      deleteMany: createDeleteManyDelegate(calls, 'feedbackReportCache', 1),
    },
    developmentPlan: {
      deleteMany: createDeleteManyDelegate(calls, 'developmentPlan', 2),
    },
    checkIn: {
      deleteMany: createDeleteManyDelegate(calls, 'checkIn', 2),
    },
    feedbackResponse: {
      deleteMany: createDeleteManyDelegate(calls, 'feedbackResponse', 3),
    },
    monthlyRecord: {
      deleteMany: createDeleteManyDelegate(calls, 'monthlyRecord', 2),
    },
    evaluationItem: {
      deleteMany: createDeleteManyDelegate(calls, 'evaluationItem', 1),
    },
    appeal: {
      deleteMany: createDeleteManyDelegate(calls, 'appeal', 1),
    },
    compensationScenarioEmployee: {
      deleteMany: createDeleteManyDelegate(calls, 'compensationScenarioEmployee', 1),
    },
    notificationPreference: {
      deleteMany: createDeleteManyDelegate(calls, 'notificationPreference', 1),
    },
    notification: {
      deleteMany: createDeleteManyDelegate(calls, 'notification', 2),
    },
    notificationDeadLetter: {
      deleteMany: createDeleteManyDelegate(calls, 'notificationDeadLetter', 1),
    },
    notificationJob: {
      deleteMany: async (args: unknown) => {
        calls.push({ delegate: 'notificationJob', method: 'deleteMany', args })
        if (options?.notificationJobDeleteError) {
          throw options.notificationJobDeleteError
        }
        return { count: 1 }
      },
    },
    session: {
      deleteMany: createDeleteManyDelegate(calls, 'session', 1),
    },
    account: {
      deleteMany: createDeleteManyDelegate(calls, 'account', 1),
    },
    aiRequestLog: {
      updateMany: createUpdateManyDelegate(calls, 'aiRequestLog', () => 1),
      deleteMany: createDeleteManyDelegate(calls, 'aiRequestLog', 1),
    },
    aiCompetencyAssignment: {
      deleteMany: createDeleteManyDelegate(calls, 'aiCompetencyAssignment', 2),
    },
    aiCompetencyAttempt: {
      deleteMany: createDeleteManyDelegate(calls, 'aiCompetencyAttempt', 2),
    },
    aiCompetencyGeneratedExamSet: {
      deleteMany: createDeleteManyDelegate(calls, 'aiCompetencyGeneratedExamSet', 2),
    },
    impersonationSession: {
      deleteMany: createDeleteManyDelegate(calls, 'impersonationSession', 2),
    },
  }

  let transactionOptions: unknown = null

  const prismaMock = {
    employee: {
      findUnique: async () => current,
    },
    $transaction: async <T>(
      callback: (txArg: typeof tx) => Promise<T>,
      optionsArg?: unknown
    ) => {
      transactionOptions = optionsArg ?? null
      return callback(tx)
    },
  }

  return {
    prismaMock,
    calls,
    getTransactionOptions: () => transactionOptions,
  }
}

async function expectAppError(promise: Promise<unknown>, expectedCode: string, expectedStatus: number) {
  await assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof AppError &&
      error.code === expectedCode &&
      error.statusCode === expectedStatus
  )
}

async function main() {
  await run('employee delete UI uses a destructive confirm dialog and force delete request payload', () => {
    const clientSource = read('src/components/admin/GoogleAccountRegistrationClient.tsx')

    assert.equal(clientSource.includes('data-testid="employee-delete-dialog"'), true)
    assert.equal(clientSource.includes('data-testid="employee-delete-name"'), true)
    assert.equal(clientSource.includes('data-testid="employee-delete-meta"'), true)
    assert.equal(clientSource.includes('data-testid="employee-delete-cancel"'), true)
    assert.equal(clientSource.includes('data-testid="employee-delete-confirm"'), true)
    assert.equal(clientSource.includes('연결된 데이터도 함께 삭제되며'), true)
    assert.equal(clientSource.includes('이 작업은 되돌릴 수 없습니다.'), true)
    assert.equal(clientSource.includes('confirmDelete: true'), true)
    assert.equal(clientSource.includes('setEmployeeDeleteTarget({'), true)
    assert.equal(clientSource.includes('queryClient.setQueriesData'), true)
    assert.equal(clientSource.includes('setEmployeeDeleteTarget(null)'), true)
    assert.equal(clientSource.includes('setEditingEmployeeId(null)'), true)
    assert.equal(clientSource.includes('setForm(EMPTY_FORM)'), true)
    assert.equal(clientSource.includes('await refreshQueries()'), true)
  })

  await run('employee delete schema requires explicit confirmation', () => {
    assert.equal(
      DeleteGoogleAccountEmployeeSchema.safeParse({
        employeeId: 'emp-1',
        confirmDelete: true,
      }).success,
      true
    )
    assert.equal(
      DeleteGoogleAccountEmployeeSchema.safeParse({
        employeeId: 'emp-1',
        confirmDelete: false,
      }).success,
      false
    )
  })

  await run('employee delete route keeps authz, validation, force delete service, and audit summary wiring', () => {
    const routeSource = read('src/app/api/admin/employees/google-account/route.ts')

    assert.equal(routeSource.includes("authorizeMenu('SYSTEM_SETTING')"), true)
    assert.equal(routeSource.includes('DeleteGoogleAccountEmployeeSchema'), true)
    assert.equal(routeSource.includes('safeDeleteEmployeeRecord'), true)
    assert.equal(routeSource.includes("action: 'EMPLOYEE_DELETE'"), true)
    assert.equal(routeSource.includes('forceDelete: true'), true)
    assert.equal(routeSource.includes('cleanupSummary: result.cleanupSummary'), true)
  })

  await run('employee delete service removes blockers by cleaning linked data before deleting the employee', async () => {
    const { prismaMock, calls, getTransactionOptions } = createEmployeeForceDeletePrismaMock()

    const result = await safeDeleteEmployeeRecord('emp-1', {
      prisma: prismaMock as any,
      recalculateLeadershipLinks: async () => ({ updatedCount: 4 }),
    })

    assert.equal(result.deletedEmployee.id, 'emp-1')
    assert.equal(result.deletedEmployee.employeeNumber, 'E-1001')
    assert.equal(result.cleanupSummary.deletedPersonalKpiCount, 2)
    assert.equal(result.cleanupSummary.deletedMonthlyRecordCount, 2)
    assert.equal(result.cleanupSummary.deletedEvaluationCount, 1)
    assert.equal(result.cleanupSummary.deletedCheckInCount, 2)
    assert.equal(result.cleanupSummary.deletedAuthSessionCount, 1)
    assert.equal(result.cleanupSummary.deletedAuthAccountCount, 1)
    assert.equal(result.cleanupSummary.clearedAiRequestApprovalActorCount, 1)
    assert.equal(result.cleanupSummary.deletedAiCompetencyResultCount, 2)
    assert.equal(result.cleanupSummary.deletedAiCompetencyExternalCertClaimCount, 2)
    assert.equal(result.cleanupSummary.deletedAiCompetencySecondRoundSubmissionCount, 2)
    assert.equal(result.cleanupSummary.deletedAiCompetencyAttemptCount, 2)
    assert.equal(result.cleanupSummary.deletedAiCompetencyGeneratedExamSetCount, 2)
    assert.equal(result.cleanupSummary.deletedImpersonationSessionCount, 2)
    assert.equal(result.hierarchyUpdatedCount, 4)
    assert.deepEqual(getTransactionOptions(), {
      timeout: 30_000,
      maxWait: 10_000,
    })

    const calledDelegates = calls.map((entry) => `${entry.delegate}.${entry.method}`)
    assert.ok(calledDelegates.includes('employee.updateMany'))
    assert.ok(calledDelegates.includes('department.updateMany'))
    assert.ok(calledDelegates.includes('feedbackResponse.deleteMany'))
    assert.ok(calledDelegates.includes('multiFeedback.deleteMany'))
    assert.ok(calledDelegates.includes('monthlyRecord.deleteMany'))
    assert.ok(calledDelegates.includes('evaluationItem.deleteMany'))
    assert.ok(calledDelegates.includes('evaluation.deleteMany'))
    assert.ok(calledDelegates.includes('appeal.deleteMany'))
    assert.ok(calledDelegates.includes('checkIn.deleteMany'))
    assert.ok(calledDelegates.includes('developmentPlan.deleteMany'))
    assert.ok(calledDelegates.includes('personalKpi.updateMany'))
    assert.ok(calledDelegates.includes('personalKpi.deleteMany'))
    assert.ok(calledDelegates.includes('session.deleteMany'))
    assert.ok(calledDelegates.includes('account.deleteMany'))
    assert.ok(calledDelegates.includes('aiRequestLog.updateMany'))
    assert.ok(calledDelegates.includes('impersonationSession.deleteMany'))
    assert.ok(calledDelegates.includes('aiCompetencyResult.deleteMany'))
    assert.ok(calledDelegates.includes('aiCompetencyExternalCertClaim.deleteMany'))
    assert.ok(calledDelegates.includes('aiCompetencySecondRoundSubmission.deleteMany'))
    assert.ok(calledDelegates.includes('aiCompetencyAssignment.deleteMany'))
    assert.ok(calledDelegates.includes('aiCompetencyAttempt.deleteMany'))
    assert.ok(calledDelegates.includes('aiCompetencyGeneratedExamSet.deleteMany'))
    assert.ok(calledDelegates.includes('wordCloud360Response.deleteMany'))
    assert.ok(calledDelegates.includes('wordCloud360Assignment.deleteMany'))
    assert.ok(calledDelegates.includes('employee.delete'))
  })

  await run('employee delete service fails cleanly when the employee no longer exists', async () => {
    const { prismaMock } = createEmployeeForceDeletePrismaMock({ current: null })

    await expectAppError(
      safeDeleteEmployeeRecord('missing', {
        prisma: prismaMock as any,
        recalculateLeadershipLinks: async () => ({ updatedCount: 0 }),
      }),
      'EMPLOYEE_DELETE_TARGET_NOT_FOUND',
      404
    )
  })

  await run('employee delete service maps FK cleanup failures to a user-facing cleanup error', async () => {
    const { prismaMock } = createEmployeeForceDeletePrismaMock({
      deleteError: Object.assign(new Error('fk blocked'), { code: 'P2003' }),
    })

    await expectAppError(
      safeDeleteEmployeeRecord('emp-1', {
        prisma: prismaMock as any,
        recalculateLeadershipLinks: async () => ({ updatedCount: 0 }),
      }),
      'EMPLOYEE_DELETE_CLEANUP_FAILED',
      409
    )
  })

  await run('employee delete service maps transaction timeout failures to a typed timeout error', async () => {
    const { prismaMock } = createEmployeeForceDeletePrismaMock({
      notificationJobDeleteError: Object.assign(new Error('expired transaction'), {
        code: 'P2028',
        name: 'PrismaClientKnownRequestError',
      }),
    })

    await expectAppError(
      safeDeleteEmployeeRecord('emp-1', {
        prisma: prismaMock as any,
        recalculateLeadershipLinks: async () => ({ updatedCount: 0 }),
      }),
      'EMPLOYEE_DELETE_TX_TIMEOUT',
      503
    )
  })

  await run('employee delete typed errors preserve step and prisma metadata in API responses', async () => {
    const response = errorResponse(
      new AppError(503, 'EMPLOYEE_DELETE_TX_TIMEOUT', '직원 삭제 트랜잭션 시간이 초과되었습니다.', {
        step: 'deleteNotificationJobs',
        prismaCode: 'P2028',
      })
    )

    assert.equal(response.status, 503)

    const payload = (await response.json()) as {
      success: boolean
      error?: {
        code?: string
        message?: string
        step?: string
        prismaCode?: string
      }
    }

    assert.equal(payload.success, false)
    assert.equal(payload.error?.code, 'EMPLOYEE_DELETE_TX_TIMEOUT')
    assert.equal(payload.error?.step, 'deleteNotificationJobs')
    assert.equal(payload.error?.prismaCode, 'P2028')
  })

  await run('employee delete service stays successful when leadership refresh fails after delete', async () => {
    const { prismaMock } = createEmployeeForceDeletePrismaMock()

    const result = await safeDeleteEmployeeRecord('emp-1', {
      prisma: prismaMock as any,
      recalculateLeadershipLinks: async () => {
        throw new Error('leadership refresh failed')
      },
    })

    assert.equal(result.deletedEmployee.id, 'emp-1')
    assert.equal(result.hierarchyUpdatedCount, 0)
  })

  await run('legacy employee delete blocker messaging is removed from the delete service source', () => {
    const serverSource = read('src/server/admin/google-account-management.ts')

    assert.equal(serverSource.includes('EMPLOYEE_DELETE_BLOCKED'), false)
    assert.equal(
      serverSource.includes('이 직원은 바로 삭제할 수 없습니다.'),
      false
    )
    assert.equal(serverSource.includes('EMPLOYEE_DELETE_FAILED'), false)
    assert.equal(serverSource.includes('EMPLOYEE_DELETE_TX_FAILED'), true)
    assert.equal(serverSource.includes('EMPLOYEE_DELETE_TX_TIMEOUT'), true)
    assert.equal(serverSource.includes('EMPLOYEE_DELETE_TX_SUCCESS'), true)
    assert.equal(serverSource.includes('EMPLOYEE_DELETE_STEP_employeeDelete_FAILED'), false)
    assert.equal(serverSource.includes('EMPLOYEE_DELETE_STEP_deleteAiCompetencyResults_START'), false)
    assert.equal(serverSource.includes("'employeeDelete'"), true)
    assert.equal(serverSource.includes("'deleteNotificationJobs'"), true)
    assert.equal(serverSource.includes('cleanupSummary'), true)
  })

  console.log('Employee force delete tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
