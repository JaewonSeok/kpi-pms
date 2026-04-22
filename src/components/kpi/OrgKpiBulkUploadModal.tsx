'use client'

import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import type { OrgKpiScope } from '@/lib/org-kpi-scope'
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

type UploadResult = {
  createdCount: number
  failedCount: number
  errors: Array<{ row: number; kpiName: string; message: string }>
}

type Props = {
  scope: OrgKpiScope
  scopeLabel: string
  departments: OrgKpiScopeOption[]
  selectedYear: number
  defaultDepartmentId: string
  onClose: () => void
  onUploaded: (message: string, tone?: 'success' | 'error' | 'info') => void
}

function normalizeEnum<T extends string>(value: unknown, fallback: T, allowed: readonly T[]): T {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toUpperCase() as T
  return allowed.includes(normalized) ? normalized : fallback
}

function buildTemplateWorkbook(params: {
  selectedYear: number
  departments: OrgKpiScopeOption[]
  defaultDepartmentId: string
  scopeLabel: string
}) {
  const sampleDepartment =
    params.departments.find((department) => department.id === params.defaultDepartmentId) ??
    params.departments[0]

  const sampleRows = [
    {
      deptCode: sampleDepartment?.id ?? '',
      evalYear: params.selectedYear,
      kpiType: 'QUANTITATIVE',
      kpiCategory: '매출 성장',
      kpiName: `${params.scopeLabel} 핵심 고객군 매출 성장률`,
      definition: `${params.scopeLabel}에서 집중 관리할 핵심 고객군의 매출 성장률을 추적합니다.`,
      formula: '(당월 매출 - 전년동월 매출) / 전년동월 매출 * 100',
      targetValue: 12,
      unit: '%',
      weight: 25,
      difficulty: 'MEDIUM',
    },
  ]

  const guideRows = [
    { column: 'deptCode', description: 'departments 시트의 deptCode 값을 그대로 입력합니다.' },
    { column: 'evalYear', description: '평가 연도입니다. 비우면 현재 선택한 연도를 사용합니다.' },
    { column: 'kpiType', description: 'QUANTITATIVE 또는 QUALITATIVE' },
    { column: 'kpiCategory', description: '예: 매출 성장, 고객 성공, 운영 효율' },
    { column: 'kpiName', description: '중복되지 않는 KPI명을 입력합니다.' },
    { column: 'definition', description: 'KPI 정의를 입력합니다.' },
    { column: 'formula', description: '정량 KPI의 산식을 입력합니다.' },
    { column: 'targetValue', description: '숫자 목표값입니다. 비워 두면 목표값 없이 등록합니다.' },
    { column: 'unit', description: '%, 건, 시간 등 단위를 입력합니다.' },
    { column: 'weight', description: '같은 조직과 연도의 가중치 합은 100을 넘을 수 없습니다.' },
    { column: 'difficulty', description: 'HIGH, MEDIUM, LOW 중 하나를 입력합니다.' },
  ]

  const departmentRows = params.departments.map((department) => ({
    deptCode: department.id,
    deptName: department.name,
    organizationName: department.organizationName,
    level: department.level,
    scope: department.scope,
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sampleRows), 'org_kpis')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(guideRows), 'guide')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(departmentRows), 'departments')
  return workbook
}

async function parseWorkbook(file: File, departments: OrgKpiScopeOption[], selectedYear: number) {
  const departmentMap = new Map(departments.map((department) => [department.id, department]))
  const buffer = await file.arrayBuffer()
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
      issues.push({ row: rowNumber, message: '조직 코드가 비어 있거나 현재 탭에서 사용할 수 없는 조직입니다.' })
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
      kpiType: normalizeEnum(String(row.kpiType ?? ''), 'QUANTITATIVE', [
        'QUANTITATIVE',
        'QUALITATIVE',
      ] as const),
      kpiCategory,
      kpiName,
      definition: String(row.definition ?? '').trim() || undefined,
      formula: String(row.formula ?? '').trim() || undefined,
      targetValue:
        rawTargetValue === ''
          ? null
          : Number.isFinite(numericTargetValue)
            ? numericTargetValue
            : null,
      unit: String(row.unit ?? '').trim() || undefined,
      weight,
      difficulty: normalizeEnum(String(row.difficulty ?? ''), 'MEDIUM', [
        'HIGH',
        'MEDIUM',
        'LOW',
      ] as const),
    })
  })

  return { parsedRows, issues }
}

export function OrgKpiBulkUploadModal(props: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<UploadRow[]>([])
  const [issues, setIssues] = useState<ParseIssue[]>([])
  const [result, setResult] = useState<UploadResult | null>(null)

  const previewRows = useMemo(() => rows.slice(0, 8), [rows])

  function handleDownloadTemplate() {
    const workbook = buildTemplateWorkbook({
      selectedYear: props.selectedYear,
      departments: props.departments,
      defaultDepartmentId: props.defaultDepartmentId,
      scopeLabel: props.scopeLabel,
    })
    XLSX.writeFile(workbook, `org-kpi-bulk-template-${props.scope}-${props.selectedYear}.xlsx`)
    props.onUploaded(`${props.scopeLabel} 일괄 등록 템플릿을 다운로드했습니다.`, 'info')
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
          : `${parsed.parsedRows.length}건의 ${props.scopeLabel} 미리보기를 준비했습니다.`,
        parsed.issues.length ? 'info' : 'success',
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '업로드 파일을 읽는 중 오류가 발생했습니다.'
      setRows([])
      setIssues([{ row: 0, message }])
      props.onUploaded(message, 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
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
          scope: props.scope,
          fileName,
          rows,
        }),
      })

      const json = (await response.json()) as {
        success?: boolean
        data?: UploadResult
        error?: { message?: string }
      }

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || `${props.scopeLabel} 일괄 등록에 실패했습니다.`)
      }

      setResult(json.data)
      props.onUploaded(
        json.data.failedCount
          ? `${json.data.createdCount}건 반영, ${json.data.failedCount}건 실패했습니다. 상세 이력을 확인해 주세요.`
          : `${json.data.createdCount}건의 ${props.scopeLabel}를 등록했습니다.`,
        json.data.failedCount ? 'info' : 'success',
      )
    } catch (error) {
      props.onUploaded(
        error instanceof Error ? error.message : `${props.scopeLabel} 일괄 등록에 실패했습니다.`,
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
              Org KPI Bulk Upload
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{props.scopeLabel} 일괄 등록</h2>
            <p className="mt-2 text-sm text-slate-500">
              현재 탭에서 보이는 조직 범위만 업로드할 수 있습니다. 템플릿을 내려받아 작성한 뒤
              미리보기와 검증 결과를 확인하고 반영해 주세요.
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
              <p className="mt-2 text-sm leading-6 text-slate-600">
                <code>org_kpis</code> 시트에 입력하고, <code>departments</code> 시트의 조직
                코드를 그대로 사용해 주세요.
              </p>
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
              <p className="mt-2 text-sm leading-6 text-slate-600">
                <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code> 파일을 지원합니다.
                첫 번째 시트를 기준으로 읽습니다.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => void handleFileChange(event.target.files)}
                className="mt-4 block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {fileName ? (
                <div className="mt-3 text-xs text-slate-500">선택한 파일: {fileName}</div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">3. 반영</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                같은 조직과 연도의 가중치 합, 중복 KPI명, 권한 범위를 검증한 뒤 유효한 행만
                등록합니다.
              </p>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={busy || !rows.length}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {busy ? '업로드 처리 중...' : `${props.scopeLabel} 반영`}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <FileSpreadsheet className="h-4 w-4" />
                <h3 className="text-base font-semibold">업로드 미리보기</h3>
              </div>
              <p className="mt-2 text-sm text-slate-500">현재 반영 대상: {rows.length}건</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2">조직</th>
                      <th className="px-3 py-2">KPI명</th>
                      <th className="px-3 py-2">유형</th>
                      <th className="px-3 py-2">목표값</th>
                      <th className="px-3 py-2">가중치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length ? (
                      previewRows.map((row, index) => (
                        <tr
                          key={`${row.deptId}-${row.kpiName}-${index}`}
                          className="border-t border-slate-100"
                        >
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
                          아직 업로드한 파일이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-900">사전 검증 결과</h3>
              <div className="mt-4 space-y-2">
                {issues.length ? (
                  issues.map((issue) => (
                    <div
                      key={`${issue.row}-${issue.message}`}
                      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                    >
                      {issue.row}행 · {issue.message}
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
                      <div
                        key={`${error.row}-${error.kpiName}-${error.message}`}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                      >
                        {error.row}행 · {error.kpiName}: {error.message}
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
