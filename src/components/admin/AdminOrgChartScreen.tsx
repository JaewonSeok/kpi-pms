import {
  fetchEmployeeOrgChart,
  loadEmployeeDirectory,
} from '@/server/admin/google-account-management'
import { AdminOrgChartManagementClient } from './AdminOrgChartManagementClient'

type AdminOrgChartScreenProps = {
  search?: string | null
  status?: string | null
  departmentId?: string | null
}

export async function AdminOrgChartScreen(props: AdminOrgChartScreenProps) {
  const [directoryData, orgChartData] = await Promise.all([
    loadEmployeeDirectory({
      query: props.search ?? undefined,
      status: props.status ?? undefined,
      departmentId: undefined,
    }),
    fetchEmployeeOrgChart({
      query: props.search ?? undefined,
      status: props.status ?? undefined,
      departmentId: props.departmentId ?? undefined,
    }),
  ])

  return (
    <AdminOrgChartManagementClient
      initialSearch={props.search ?? null}
      initialStatus={props.status ?? null}
      initialDepartmentId={props.departmentId ?? null}
      initialDirectoryData={directoryData}
      initialOrgChartData={orgChartData}
    />
  )
}
