import * as dotenv from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { assertAllowedGoogleWorkspaceEmail, getAllowedGoogleWorkspaceDomain } from '../src/lib/google-workspace'

dotenv.config()

function readArg(name: string) {
  const matched = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return matched ? matched.slice(name.length + 3).trim() : ''
}

async function main() {
  const empId = readArg('emp-id')
  const gwsEmail = readArg('email')

  if (!empId || !gwsEmail) {
    throw new Error('Usage: npm run register:google-email -- --emp-id=EMP-2022-002 --email=admin@rsupport.com')
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required.')
  }

  const adapter = new PrismaPg({ connectionString })
  const prisma = new PrismaClient({ adapter } as never)
  const normalizedEmail = assertAllowedGoogleWorkspaceEmail(gwsEmail)

  try {
    const employee = await prisma.employee.findUnique({
      where: { empId },
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        status: true,
      },
    })

    if (!employee) {
      throw new Error(`Employee not found for empId=${empId}`)
    }

    const duplicate = await prisma.employee.findFirst({
      where: {
        gwsEmail: normalizedEmail,
        NOT: { id: employee.id },
      },
      select: {
        empId: true,
        empName: true,
      },
    })

    if (duplicate) {
      throw new Error(
        `${normalizedEmail} is already assigned to ${duplicate.empName} (${duplicate.empId}).`
      )
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: { gwsEmail: normalizedEmail },
      select: {
        empId: true,
        empName: true,
        gwsEmail: true,
        status: true,
      },
    })

    console.log(JSON.stringify({
      ok: true,
      allowedDomain: getAllowedGoogleWorkspaceDomain(),
      employee: updated,
      loginReady: updated.status === 'ACTIVE',
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
