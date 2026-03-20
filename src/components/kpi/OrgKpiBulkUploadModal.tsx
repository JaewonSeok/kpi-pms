'use client'

import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import type { OrgKpiScopeOption } from '@/server/org-kpi-page'

type UploadRow = {
  deptId: string
  deptCode: string
  deptName: string
  evalYear: number
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  kpiCategory: string
  kpiName: string
  definition?: string
  formula?: string
  targetValue?: number | null
  unit?: string
  weight: number
  difficulty: 'HIGH' | 'MEDIUM' | 'LOW'
}

type ParseIssue = {
  row: number
  message: string
}

type Props = {
  departments: OrgKpiScopeOption[]
  selectedYear: number
  defaultDepartmentId: string
  onClose: () => void
  onUploaded: (message: string, tone?: 'success' | 'error' | 'info') => void
}

function buildTemplateWorkbook(selectedYear: number, departments: OrgKpiScopeOption[]) {
  const sampleRows = [
    {
      deptCode: departments[0]?.id ? departments[0]?.id : '',
      evalYear: selectedYear,
      kpiType: 'QUANTITATIVE',
      kpiCategory: '매출 성장',
      kpiName: '핵심 고객군 월간 매출 성장률',
      definition: '전년 동월 대비 핵심 고객군의 월간 매출 성장률을 관리합니다.',
      formula: '(당월 매출 - 전년동월 매출) / 전년동월 매출 * 100',
      targetValue: 12,
      unit: '%',
      weight: 25,
      difficulty: 'MEDIUM',
    },
  ]

  const guideRows = [
    { column: 'deptCode', description: '부서 식별자입니다. departments 시트의 deptCode 값을 그대로 사용합니다.' },
    { column: 'evalYear', description: '평가 연도입니다. 비우면 현재 선택 연도를 사용합니다.' },
    { column: 'kpiType', description: 'QUANTITATIVE 또는 QUALITATIVE' },
    { column: 'kpiCategory', description: '예: 매출 성장, 고객 성공, 운영 효율' },
    { column: 'kpiName', description: '중복 없이 구체적인 KPI명을 입력합니다.' },
    { column: 'definition', description: 'KPI 정의를 입력합니다.' },
    { column: 'formula', description: '정량 KPI인 경우 산식을 입력합니다.' },
    { column: 'targetValue', description: '숫자 목표값입니다.' },
    { column: 'unit', description: '%, 점, 건 등 단위를 입력합니다.' },
    { column: 'weight', description: '부서/연도 기준 가중치 총합이 100을 넘지 않아야 합니다.' },
    { column: 'difficulty', description: 'HIGH, MEDIUM, LOW 중 하나를 입력합니다.' },
  ]

  const departmentRows = departments.map((department) => ({
    deptCode: department.id,
    deptName: department.name,
    organizationName: department.organizationName,
    level: department.level,
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sampleRows), 'org_kpis')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(guideRows), 'guide')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(departmentRows), 'departments')
  return workbook
}

function normalizeEnum<T extends string>(value: unknown, fallback: T, allowed: readonly T[]): T {
  if (typeof value !== 'string') return fallback
  const upper = value.trim().toUpperCase() as T
  return allowed.includes(upper) ? upper : fallback
}

function parseWorkbook(file: File, departments: OrgKpiScopeOption[], selectedYear: number) {
  const departmentMap = new Map(departments.map((department) => [department.id, department]))

  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    const parsedRows: UploadRow[] = []
    const issues: ParseIssue[] = []

    rows.forEach((row, index) => {
      const rowNumber = index + 2
      const deptCode = String(row.deptCode ?? '').trim()
      const kpiCategory = String(row.kpiCategory ?? '').trim()
      const kpiName = String(row.kpiName ?? '').trim()
      const weight = Number(row.weight ?? '')

      if (!deptCode || !departmentMap.has(deptCode)) {
        issues.push({ row: rowNumber, message: '부서 코드가 비어 있거나 유효하지 않습니다.' })
        return
      }
      if (!kpiCategory || !kpiName) {
        issues.push({ row: rowNumber, message: '카테고리와 KPI명은 필수입니다.' })
        return
      }
      if (!Number.isFinite(weight)) {
        issues.push({ row: rowNumber, message: '가중치는 숫자로 입력해야 합니다.' })
        return
      }

      const department = departmentMap.get(deptCode)!
      const rawTargetValue = String(row.targetValue ?? '').trim()
      const numericTargetValue = rawTargetValue === '' ? null : Number(rawTargetValue)

      parsedRows.push({
        deptId: department.id,
        deptCode,
        deptName: department.name,
        evalYear: Number(row.evalYear) || selectedYear,
        kpiType: normalizeEnum(String(row.kpiType ?? ''), 'QUANTITATIVE', ['QUANTITATIVE', 'QUALITATIVE'] as const),
        kpiCategory,
        kpiName,
        definition: String(row.definition ?? '').trim() || undefined,
        formula: String(row.formula ?? '').trim() || undefined,
        targetValue: rawTargetValue === '' ? null : Number.isFinite(numericTargetValue) ? numericTargetValue : null,
        unit: String(row.unit ?? '').trim() || undefined,
        weight,
        difficulty: normalizeEnum(String(row.difficulty ?? ''), 'MEDIUM', ['HIGH', 'MEDIUM', 'LOW'] as const),
      })
    })

    return { parsedRows, issues }
  })
}

export function OrgKpiBulkUploadModal(props: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<UploadRow[]>([])
  const [issues, setIssues] = useState<ParseIssue[]>([])
  const [result, setResult] = useState<{ createdCount: number; failedCount: number; errors: Array<{ row: number; kpiName: string; message: string }> } | null>(null)

  const previewRows = useMemo(() => rows.slice(0, 8), [rows])

  function handleDownloadTemplate() {
    const workbook = buildTemplateWorkbook(props.selectedYear, props.departments)
    XLSX.writeFile(workbook, `org-kpi-bulk-template-${props.selectedYear}.xlsx`)
    props.onUploaded('조직 KPI 업로드 템플릿을 다운로드했습니다.', 'info')
  }

  async function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    setBusy(true)
    setResult(null)
    try {
      const parsed = await parseWorkbook(file, props.departments, props.selectedYear)
      setRows(parsed.parsedRows)
      setIssues(parsed.issues)
      setFileName(file.name)
      props.onUploaded(
        parsed.issues.length
          ? `파일을 읽었지만 ${parsed.issues.length}건의 사전 검증 이슈가 있습니다.`
          : `${parsed.parsedRows.length}건의 조직 KPI 업로드 미리보기를 준비했습니다.`,
        parsed.issues.length ? 'info' : 'success'
      )
    } catch (error) {
      setRows([])
      setIssues([{ row: 0, message: error instanceof Error ? error.message : '업로드 파일을 읽지 못했습니다.' }])
      props.onUploaded(error instanceof Error ? error.message : '업로드 파일을 읽지 못했습니다.', 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleUpload() {
    if (!rows.length) {
      props.onUploaded('먼저 업로드할 파일을 선택해 주세요.', 'error')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/kpi/org/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          rows,
        }),
      })
      const json = (await response.json()) as {
        success?: boolean
        data?: { createdCount: number; failedCount: number; errors: Array<{ row: number; kpiName: string; message: string }> }
        error?: { message?: string }
      }

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || '조직 KPI 일괄 업로드에 실패했습니다.')
      }

      setResult(json.data)
      props.onUploaded(
        json.data.failedCount
          ? `${json.data.createdCount}건 반영, ${json.data.failedCount}건 실패했습니다. 상세 내역을 확인해 주세요.`
          : `${json.data.createdCount}건의 조직 KPI를 일괄 등록했습니다.`,
        json.data.failedCount ? 'info' : 'success'
      )
    } catch (error) {
      props.onUploaded(error instanceof Error ? error.message : '조직 KPI 일괄 업로드에 실패했습니다.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Org KPI Bulk Upload</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">조직 KPI 일괄 업로드</h2>
            <p className="mt-2 text-sm text-slate-500">
              템플릿을 내려받아 여러 개의 조직 KPI를 한 번에 등록할 수 있습니다. 업로드 전 미리보기와 오류 내역을 먼저 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">1. 템플릿 다운로드</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">`org_kpis` 시트에 값을 입력하고, `departments` 시트에서 부서 코드를 확인해 주세요.</p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <Download className="h-4 w-4" />
                템플릿 다운로드
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">2. 파일 업로드</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">`.xlsx`, `.xls`, `.csv` 형식을 지원합니다. 첫 번째 시트를 기준으로 읽습니다.</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => void handleFileChange(event.target.files)}
                className="mt-4 block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {fileName ? <div className="mt-3 text-xs text-slate-500">선택 파일: {fileName}</div> : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">3. 반영</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">부서/연도 기준 가중치 총합과 중복 KPI명을 검사한 뒤, 유효한 행만 등록합니다.</p>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={busy || !rows.length}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {busy ? '업로드 처리 중...' : '업로드 반영'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <FileSpreadsheet className="h-4 w-4" />
                <h3 className="text-base font-semibold">업로드 미리보기</h3>
              </div>
              <p className="mt-2 text-sm text-slate-500">현재 읽힌 행 수: {rows.length}건</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2">부서</th>
                      <th className="px-3 py-2">KPI명</th>
                      <th className="px-3 py-2">유형</th>
                      <th className="px-3 py-2">목표값</th>
                      <th className="px-3 py-2">가중치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length ? (
                      previewRows.map((row, index) => (
                        <tr key={`${row.deptId}-${row.kpiName}-${index}`} className="border-t border-slate-100">
                          <td className="px-3 py-3">{row.deptName}</td>
                          <td className="px-3 py-3 font-medium text-slate-900">{row.kpiName}</td>
                          <td className="px-3 py-3">{row.kpiType}</td>
                          <td className="px-3 py-3">{row.targetValue ?? '-'}</td>
                          <td className="px-3 py-3">{row.weight}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                          업로드한 파일이 아직 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-900">사전 검증 이슈</h3>
              <div className="mt-4 space-y-2">
                {issues.length ? (
                  issues.map((issue) => (
                    <div key={`${issue.row}-${issue.message}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {issue.row}행: {issue.message}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                    파일을 읽으면 이곳에 사전 검증 결과가 표시됩니다.
                  </div>
                )}
              </div>
            </section>

            {result ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900">업로드 결과</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    성공 {result.createdCount}건
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    실패 {result.failedCount}건
                  </div>
                </div>
                {result.errors.length ? (
                  <div className="mt-4 space-y-2">
                    {result.errors.map((error) => (
                      <div key={`${error.row}-${error.kpiName}-${error.message}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {error.row}행 / {error.kpiName}: {error.message}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
