import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required before PrismaClient can be initialized.'
    )
  }
  const adapter = new PrismaPg(new Pool({ connectionString }))
  return new PrismaClient({ adapter })
}

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }

  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient()
    const value = client[property as keyof PrismaClient]

    return typeof value === 'function' ? value.bind(client) : value
  },
  set(_target, property, value) {
    const client = getPrismaClient() as unknown as Record<PropertyKey, unknown>
    client[property] = value
    return true
  },
}) as PrismaClient
