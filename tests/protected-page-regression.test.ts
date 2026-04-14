/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import { prisma } from '../src/lib/prisma'
import { getUpwardReviewPageData } from '../src/server/upward-review'

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

type PrismaDelegateMethod = (...args: any[]) => any

type Snapshot = {
  employeeFindUnique: PrismaDelegateMethod
  employeeFindMany: PrismaDelegateMethod
  evalCycleFindMany: PrismaDelegateMethod
  multiFeedbackRoundFindMany: PrismaDelegateMethod
  upwardReviewTemplateFindMany: PrismaDelegateMethod
  feedbackAdminGroupMemberFindMany: PrismaDelegateMethod
}

function captureSnapshot(): Snapshot {
  const prismaAny = prisma as any

  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    multiFeedbackRoundFindMany: prismaAny.multiFeedbackRound.findMany,
    upwardReviewTemplateFindMany: prismaAny.upwardReviewTemplate.findMany,
    feedbackAdminGroupMemberFindMany: prismaAny.feedbackAdminGroupMember.findMany,
  }
}

function restoreSnapshot(snapshot: Snapshot) {
  const prismaAny = prisma as any

  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
  prismaAny.multiFeedbackRound.findMany = snapshot.multiFeedbackRoundFindMany
  prismaAny.upwardReviewTemplate.findMany = snapshot.upwardReviewTemplateFindMany
  prismaAny.feedbackAdminGroupMember.findMany = snapshot.feedbackAdminGroupMemberFindMany
}

function makeSession() {
  return {
    user: {
      id: 'emp-admin-1',
      email: 'admin-1@company.test',
      name: '관리자',
      role: 'ROLE_ADMIN',
      empId: 'EMP-ADMIN-1',
      position: 'HEAD',
      deptId: 'dept-1',
      deptName: 'People Ops',
      departmentCode: 'PEOPLE',
      orgPath: 'RSUPPORT/People Ops',
      accessibleDepartmentIds: ['dept-1'],
    },
  } as any
}

async function withStubbedUpwardData(
  overrides: Partial<Record<keyof Snapshot, PrismaDelegateMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async () => ({
      id: 'emp-admin-1',
      empId: 'EMP-ADMIN-1',
      empName: '관리자',
      role: 'ROLE_ADMIN',
      deptId: 'dept-1',
      department: {
        id: 'dept-1',
        deptName: 'People Ops',
        orgId: 'org-1',
      },
    }))

  prismaAny.employee.findMany = overrides.employeeFindMany ?? (async () => [])
  prismaAny.evalCycle.findMany =
    overrides.evalCycleFindMany ??
    (async () => [
      {
        id: 'cycle-2026',
        cycleName: '2026 Performance',
        evalYear: 2026,
        status: 'RESULT_OPEN',
      },
    ])
  prismaAny.multiFeedbackRound.findMany = overrides.multiFeedbackRoundFindMany ?? (async () => [])
  prismaAny.upwardReviewTemplate.findMany = overrides.upwardReviewTemplateFindMany ?? (async () => [])
  prismaAny.feedbackAdminGroupMember.findMany =
    overrides.feedbackAdminGroupMemberFindMany ?? (async () => [])

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('critical protected pages use the shared protected session helper', () => {
    const protectedPages = [
      'src/app/(main)/dashboard/page.tsx',
      'src/app/(main)/kpi/personal/page.tsx',
      'src/app/(main)/kpi/monthly/page.tsx',
      'src/app/(main)/kpi/org/page.tsx',
      'src/app/(main)/evaluation/results/page.tsx',
      'src/app/(main)/evaluation/appeal/page.tsx',
      'src/app/(main)/evaluation/workbench/page.tsx',
      'src/app/(main)/evaluation/ai-competency/page.tsx',
      'src/app/(main)/evaluation/upward/admin/page.tsx',
      'src/app/(main)/evaluation/upward/respond/page.tsx',
      'src/app/(main)/evaluation/upward/respond/[feedbackId]/page.tsx',
      'src/app/(main)/evaluation/upward/results/page.tsx',
      'src/app/(main)/admin/google-access/page.tsx',
    ]

    for (const file of protectedPages) {
      const source = read(file)
      assert.equal(source.includes('requireProtectedPageSession'), true, `${file} should use the shared helper`)
      assert.equal(source.includes("redirect('/login')"), false, `${file} should not inline login redirects`)
    }

    const googleAccessPage = read('src/app/(main)/admin/google-access/page.tsx')
    assert.equal(googleAccessPage.includes("canAccessMenu(session.user.role, 'SYSTEM_SETTING')"), true)
    assert.equal(googleAccessPage.includes("redirect('/403')"), true)
  })

  await run('upward review admin loader degrades to an error state when template schema lookup fails', async () => {
    await withStubbedUpwardData(
      {
        upwardReviewTemplateFindMany: async () => {
          const error = new Error('missing column')
          ;(error as Error & { code?: string }).code = 'P2022'
          throw error
        },
      },
      async () => {
        const data = await getUpwardReviewPageData({
          session: makeSession(),
          mode: 'admin',
        })

        assert.equal(data.state, 'error')
        assert.equal(data.mode, 'admin')
        assert.deepEqual(data.availableCycles, [])
        assert.deepEqual(data.availableRounds, [])
      }
    )
  })

  console.log('Protected page regression tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
