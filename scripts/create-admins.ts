import { PrismaClient, Position, SystemRole, EmployeeStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const hrDept = await prisma.department.findFirst({
    where: { deptCode: 'HR-TEAM' },
  })

  if (!hrDept) {
    throw new Error('HR-TEAM department not found')
  }

  const admins = [
    {
      empId: 'EMP-2026-101',
      empName: '석재원',
      gwsEmail: 'jwseok@rsupport.com',
    },
    {
      empId: 'EMP-2026-102',
      empName: 'shjeong',
      gwsEmail: 'shjeong@rsupport.com',
    },
    {
      empId: 'EMP-2026-103',
      empName: 'shyun',
      gwsEmail: 'shyun@rsupport.com',
    },
  ]

  for (const admin of admins) {
    await prisma.employee.upsert({
      where: { empId: admin.empId },
      update: {
        empName: admin.empName,
        gwsEmail: admin.gwsEmail,
        position: Position.MEMBER,
        role: SystemRole.ROLE_ADMIN,
        deptId: hrDept.id,
        status: EmployeeStatus.ACTIVE,
      },
      create: {
        empId: admin.empId,
        empName: admin.empName,
        gwsEmail: admin.gwsEmail,
        position: Position.MEMBER,
        role: SystemRole.ROLE_ADMIN,
        deptId: hrDept.id,
        joinDate: new Date(),
        currentSalary: 70000000,
        status: EmployeeStatus.ACTIVE,
      },
    })
  }

  console.log('✅ Admin accounts created/updated:',
    admins.map((a) => a.gwsEmail).join(', ')
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })