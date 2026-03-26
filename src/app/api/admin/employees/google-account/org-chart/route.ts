import { errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { fetchEmployeeOrgChart } from '@/server/admin/google-account-management'

export async function GET(request: Request) {
  try {
    await authorizeMenu('SYSTEM_SETTING')

    const { searchParams } = new URL(request.url)
    return successResponse(
      await fetchEmployeeOrgChart({
        query: searchParams.get('q') ?? undefined,
        status: searchParams.get('status') ?? undefined,
        departmentId: searchParams.get('departmentId') ?? undefined,
      })
    )
  } catch (error) {
    return errorResponse(error)
  }
}
