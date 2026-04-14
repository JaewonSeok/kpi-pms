import type { SystemRole } from '@prisma/client'
import { resolveMasterLoginAccess } from '@/lib/master-login-shared'

type MasterLoginEnvSource = Record<string, string | undefined>

type MasterLoginAccessInput = {
  role?: SystemRole | string | null
  email?: string | null
  employeeId?: string | null
}

type MasterLoginActorRecord = {
  role: SystemRole
  masterLoginPermissionGranted: boolean
}

async function loadMasterLoginActorRecord(employeeId: string) {
  const { prisma } = await import('@/lib/prisma')
  return prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      role: true,
      masterLoginPermissionGranted: true,
    },
  }) as Promise<MasterLoginActorRecord | null>
}

export async function resolveMasterLoginAvailability(
  input: Pick<MasterLoginAccessInput, 'employeeId' | 'role' | 'email'>,
  env: MasterLoginEnvSource = process.env
) {
  const directAccess = resolveMasterLoginAccess(
    {
      role: input.role,
      email: input.email,
      masterLoginPermissionGranted: false,
    },
    env
  )

  if (directAccess.allowed) {
    return directAccess
  }

  if (input.role !== 'ROLE_ADMIN' || !input.employeeId) {
    return directAccess
  }

  const actor = await loadMasterLoginActorRecord(input.employeeId)
  return resolveMasterLoginAccess(
    {
      role: actor?.role ?? input.role,
      email: input.email,
      masterLoginPermissionGranted: actor?.masterLoginPermissionGranted ?? false,
    },
    env
  )
}

export async function canUseMasterLoginForActor(
  input: Pick<MasterLoginAccessInput, 'employeeId' | 'role' | 'email'>,
  env: MasterLoginEnvSource = process.env
) {
  return (await resolveMasterLoginAvailability(input, env)).allowed
}
