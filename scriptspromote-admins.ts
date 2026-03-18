import { PrismaClient, SystemRole, EmployeeStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const emails = [
    'jwseok@rsupport.com',
    'shjeong@rsupport.com',
    'shyun@rsupport.com',
  ]

  const result = await prisma.employee.updateMany({
    where: {
      gwsEmail: {
        in: emails,
      },
    },
    data: {
      role: SystemRole.ROLE_ADMIN,
      status: EmployeeStatus.ACTIVE,
    },
  })

  console.log(`✅ Updated ${result.count} employee(s) to ROLE_ADMIN`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })