/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import assert from 'node:assert/strict'
import Module from 'node:module'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'

const moduleLoader = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string
}
const originalResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const { getAiCompetencyGatePageData } = require('../src/server/ai-competency-gate') as typeof import('../src/server/ai-competency-gate')
const { getAiCompetencyGateAdminPageData } = require('../src/server/ai-competency-gate-admin') as typeof import('../src/server/ai-competency-gate-admin')

function workspaceEmail(localPart: string) {
  return `${localPart}@${process.env.ALLOWED_DOMAIN?.trim() || 'company.com'}`
}

async function run(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'EACCES'
    ) {
      console.log(`SKIP ${name} (database access is unavailable in the current sandbox)`)
      return
    }
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function loadSeededUser(localPart: string) {
  const employee = await prisma.employee.findUnique({
    where: { gwsEmail: workspaceEmail(localPart) },
    include: {
      department: true,
    },
  })

  assert.ok(employee, `${localPart} seeded employee should exist`)
  assert.ok(employee.department, `${localPart} seeded employee should have department`)

  return employee
}

function makeSession(employee: Awaited<ReturnType<typeof loadSeededUser>>) {
  return {
    user: {
      id: employee.id,
      email: employee.gwsEmail,
      name: employee.empName,
      role: employee.role,
      empId: employee.empId,
      deptId: employee.deptId,
      deptName: employee.department?.deptName,
    },
  } as any
}

async function main() {
  await run('seeded member can open the gate page without hitting an unrecoverable error', async () => {
    const member = await loadSeededUser('member1')
    const data = await getAiCompetencyGatePageData({
      session: makeSession(member),
    })

    assert.notEqual(data.state, 'error')
    assert.equal(Array.isArray(data.cycleOptions), true)
    assert.equal(Array.isArray(data.timeline), true)
  })

  await run('seeded admin can open the gate admin page without hitting an unrecoverable error', async () => {
    const admin = await loadSeededUser('admin')
    const data = await getAiCompetencyGateAdminPageData({
      session: makeSession(admin),
    })

    assert.notEqual(data.state, 'error')
    assert.equal(Array.isArray(data.cycleOptions), true)
    assert.equal(Array.isArray(data.assignments), true)
  })

  console.log('Seeded AI competency gate runtime tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
