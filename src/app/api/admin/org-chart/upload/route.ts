import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import * as XLSX from 'xlsx'
import { Position, SystemRole, EmployeeStatus } from '@prisma/client'

const REQUIRED_COLUMNS = [
  'emp_id', 'emp_name', 'dept_code', 'dept_name', 'position',
  'gws_email', 'join_date', 'status'
]

// POST /api/admin/org-chart/upload
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')

    const formData = await request.formData()
    const file = formData.get('file') as File
    const previewOnly = formData.get('previewOnly') === 'true'

    if (!file) throw new AppError(400, 'NO_FILE', '파일이 없습니다.')

    const maxSize = parseInt(process.env.FILE_UPLOAD_MAX_SIZE || '10485760') // 10MB
    if (file.size > maxSize) {
      throw new AppError(400, 'FILE_TOO_LARGE', `파일 크기는 ${maxSize / 1024 / 1024}MB를 초과할 수 없습니다.`)
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false })

    if (rows.length === 0) throw new AppError(400, 'EMPTY_FILE', '데이터가 없습니다.')

    const errors: { row: number; column: string; reason: string }[] = []
    const validRows: any[] = []
    const POSITION_MAP: Record<string, Position> = {
      '팀원': 'MEMBER', 'MEMBER': 'MEMBER',
      '팀장': 'TEAM_LEADER', 'TEAM_LEADER': 'TEAM_LEADER',
      '실장': 'SECTION_CHIEF', '부문장': 'SECTION_CHIEF', 'SECTION_CHIEF': 'SECTION_CHIEF',
      '본부장': 'DIV_HEAD', 'DIV_HEAD': 'DIV_HEAD',
      '대표이사': 'CEO', 'CEO': 'CEO',
    }
    const STATUS_MAP: Record<string, EmployeeStatus> = {
      '재직': 'ACTIVE', 'ACTIVE': 'ACTIVE',
      '휴직': 'ON_LEAVE', 'ON_LEAVE': 'ON_LEAVE',
      '퇴직': 'RESIGNED', 'RESIGNED': 'RESIGNED',
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // 헤더 제외
      const rowErrors: { row: number; column: string; reason: string }[] = []

      // 필수 컬럼 검증
      for (const col of REQUIRED_COLUMNS) {
        if (!row[col]) {
          rowErrors.push({ row: rowNum, column: col, reason: '필수값 누락' })
        }
      }

      // 이메일 형식 검증
      if (row.gws_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.gws_email)) {
        rowErrors.push({ row: rowNum, column: 'gws_email', reason: '이메일 형식이 올바르지 않습니다.' })
      }

      // Position 검증
      if (row.position && !POSITION_MAP[row.position]) {
        rowErrors.push({ row: rowNum, column: 'position', reason: `유효하지 않은 직책: ${row.position}` })
      }

      // Status 검증
      if (row.status && !STATUS_MAP[row.status]) {
        rowErrors.push({ row: rowNum, column: 'status', reason: `유효하지 않은 상태: ${row.status}` })
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
      } else {
        validRows.push({
          empId: row.emp_id,
          empName: row.emp_name,
          deptCode: row.dept_code,
          deptName: row.dept_name,
          position: POSITION_MAP[row.position],
          gwsEmail: row.gws_email,
          joinDate: new Date(row.join_date),
          status: STATUS_MAP[row.status],
          teamLeaderId: row.team_leader_id || null,
          sectionChiefId: row.section_chief_id || null,
          divisionHeadId: row.division_head_id || null,
          noEmail: !row.gws_email,
        })
      }
    }

    if (previewOnly) {
      return successResponse({
        totalRows: rows.length,
        validRows: validRows.length,
        errorRows: errors.length,
        errors,
        preview: validRows.slice(0, 20),
      })
    }

    // 실제 저장
    const org = await prisma.organization.findFirst()
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')

    let successCount = 0
    let failCount = 0
    const saveErrors: typeof errors = []

    // 부서 upsert 먼저
    const deptMap = new Map<string, string>()
    const uniqueDepts = [...new Map(validRows.map(r => [r.deptCode, r])).values()]

    for (const row of uniqueDepts) {
      try {
        const dept = await prisma.department.upsert({
          where: { deptCode: row.deptCode },
          create: {
            deptCode: row.deptCode,
            deptName: row.deptName,
            orgId: org.id,
          },
          update: { deptName: row.deptName },
        })
        deptMap.set(row.deptCode, dept.id)
      } catch (e) {
        console.error('부서 upsert 실패:', e)
      }
    }

    // 직원 upsert
    for (const row of validRows) {
      const deptId = deptMap.get(row.deptCode)
      if (!deptId) {
        saveErrors.push({ row: 0, column: 'dept_code', reason: `부서 코드를 찾을 수 없음: ${row.deptCode}` })
        failCount++
        continue
      }

      const position = row.position as Position
      let role: SystemRole = 'ROLE_MEMBER'
      if (position === 'TEAM_LEADER') role = 'ROLE_TEAM_LEADER'
      else if (position === 'SECTION_CHIEF') role = 'ROLE_SECTION_CHIEF'
      else if (position === 'DIV_HEAD') role = 'ROLE_DIV_HEAD'
      else if (position === 'CEO') role = 'ROLE_CEO'

      try {
        await prisma.employee.upsert({
          where: { empId: row.empId },
          create: {
            empId: row.empId,
            empName: row.empName,
            gwsEmail: row.gwsEmail,
            position,
            role,
            deptId,
            joinDate: row.joinDate,
            status: row.status,
            teamLeaderId: row.teamLeaderId,
            sectionChiefId: row.sectionChiefId,
            divisionHeadId: row.divisionHeadId,
          },
          update: {
            empName: row.empName,
            gwsEmail: row.gwsEmail,
            position,
            role,
            deptId,
            joinDate: row.joinDate,
            status: row.status,
            teamLeaderId: row.teamLeaderId,
            sectionChiefId: row.sectionChiefId,
            divisionHeadId: row.divisionHeadId,
          },
        })
        successCount++
      } catch (e: any) {
        saveErrors.push({ row: 0, column: 'emp_id', reason: e.message })
        failCount++
      }
    }

    // 업로드 이력 저장
    await prisma.uploadHistory.create({
      data: {
        uploadType: 'ORG_CHART',
        uploaderId: session.user.id,
        fileName: file.name,
        totalRows: rows.length,
        successCount,
        failCount: failCount + errors.length,
        errorDetails: [...errors, ...saveErrors] as any,
      },
    })

    return successResponse({
      totalRows: rows.length,
      successCount,
      failCount: failCount + errors.length,
      errors: [...errors, ...saveErrors],
    })
  } catch (error) {
    return errorResponse(error)
  }
}
