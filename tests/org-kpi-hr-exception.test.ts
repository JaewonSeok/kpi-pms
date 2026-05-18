import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AppError } from '../src/lib/utils'
import {
  buildOrgKpiHrExceptionUpdate2026,
  canManageOrgKpiHrException,
} from '../src/server/org-kpi-hr-exception'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

const currentTeamKpi = {
  id: 'org-kpi-1',
  kpiName: '팀 KPI',
  scope: 'team' as const,
  mboExceptionApproved: false,
  mboExceptionReason: null,
  mboExceptionApprovedById: null,
  mboExceptionApprovedAt: null,
}

run('admin can approve team KPI exception with reason', () => {
  const result = buildOrgKpiHrExceptionUpdate2026({
    current: currentTeamKpi,
    actor: { id: 'admin-1', role: 'ROLE_ADMIN' },
    input: {
      exceptionApproved: true,
      reason: '본부 KPI 미포함 핵심 과제로 HR 협의 완료',
    },
    now: new Date('2026-05-14T01:02:03.000Z'),
  })

  assert.equal(canManageOrgKpiHrException('ROLE_ADMIN'), true)
  assert.equal(result.data.mboExceptionApproved, true)
  assert.equal(result.data.mboExceptionReason, '본부 KPI 미포함 핵심 과제로 HR 협의 완료')
  assert.equal(result.data.mboExceptionApprovedById, 'admin-1')
  assert.equal(result.newValue.mboExceptionApprovedAt, '2026-05-14T01:02:03.000Z')
})

run('reason is required when approving team KPI exception', () => {
  assert.throws(
    () =>
      buildOrgKpiHrExceptionUpdate2026({
        current: currentTeamKpi,
        actor: { id: 'admin-1', role: 'ROLE_ADMIN' },
        input: {
          exceptionApproved: true,
          reason: '  ',
        },
      }),
    (error) => error instanceof AppError && error.code === 'MBO_EXCEPTION_REASON_REQUIRED'
  )
})

run('ordinary member cannot approve team KPI exception', () => {
  assert.equal(canManageOrgKpiHrException('ROLE_MEMBER'), false)
  assert.throws(
    () =>
      buildOrgKpiHrExceptionUpdate2026({
        current: currentTeamKpi,
        actor: { id: 'member-1', role: 'ROLE_MEMBER' },
        input: {
          exceptionApproved: true,
          reason: '본부 KPI 미포함 핵심 과제로 HR 협의 완료',
        },
      }),
    (error) => error instanceof AppError && error.code === 'FORBIDDEN'
  )
})

run('non-team KPI cannot receive team KPI exception approval', () => {
  assert.throws(
    () =>
      buildOrgKpiHrExceptionUpdate2026({
        current: {
          ...currentTeamKpi,
          scope: 'division',
        },
        actor: { id: 'admin-1', role: 'ROLE_ADMIN' },
        input: {
          exceptionApproved: true,
          reason: '본부 KPI는 예외 승인 대상이 아님',
        },
      }),
    (error) => error instanceof AppError && error.code === 'ORG_KPI_EXCEPTION_TEAM_ONLY'
  )
})

run('revoking team KPI exception clears only exception metadata', () => {
  const result = buildOrgKpiHrExceptionUpdate2026({
    current: {
      ...currentTeamKpi,
      mboExceptionApproved: true,
      mboExceptionReason: '기존 승인 사유',
      mboExceptionApprovedById: 'admin-1',
      mboExceptionApprovedAt: '2026-05-14T01:02:03.000Z',
    },
    actor: { id: 'admin-2', role: 'ROLE_ADMIN' },
    input: {
      exceptionApproved: false,
    },
  })

  assert.equal(result.data.mboExceptionApproved, false)
  assert.equal(result.data.mboExceptionReason, null)
  assert.equal(result.data.mboExceptionApprovedById, null)
  assert.equal(result.data.mboExceptionApprovedAt, null)
  assert.equal('totalScore' in result.data, false)
  assert.equal('grade' in result.data, false)
})

run('HR exception API route is admin-only, metadata-only, and audited', () => {
  const routeSource = read('src/app/api/kpi/org/[id]/hr-exception/route.ts')
  const schemaSource = read('prisma/schema.prisma')
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.equal(routeSource.includes('OrgKpiHrExceptionSchema'), true)
  assert.equal(routeSource.includes('buildOrgKpiHrExceptionUpdate2026'), true)
  assert.equal(routeSource.includes('createAuditLog'), true)
  assert.equal(routeSource.includes('mboExceptionApproved'), true)
  assert.equal(routeSource.includes('totalScore'), false)
  assert.equal(routeSource.includes('grade'), false)
  assert.equal(schemaSource.includes('mboExceptionApproved Boolean @default(false)'), true)
  assert.equal(clientSource.includes('org-kpi-hr-exception-panel'), true)
  assert.equal(clientSource.includes('예외 승인 저장'), true)
})
