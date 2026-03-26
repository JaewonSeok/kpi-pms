import { authorizeMenu } from '@/server/auth/authorize'
import { errorResponse } from '@/lib/utils'
import { buildEmployeeTemplateWorkbook } from '@/server/admin/google-account-management'

export async function GET() {
  try {
    await authorizeMenu('SYSTEM_SETTING')

    const workbook = buildEmployeeTemplateWorkbook()

    return new Response(new Uint8Array(workbook), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="employee-google-account-upload-template.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
