import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function CompensationMyPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const scenarios = await prisma.compensationScenario.findMany({
    where: {
      status: 'FINAL_APPROVED',
      publishedAt: { not: null },
      employees: {
        some: {
          employeeId: session.user.id,
        },
      },
    },
    include: {
      evalCycle: {
        select: { cycleName: true, evalYear: true },
      },
      ruleSet: {
        select: { versionNo: true, changeReason: true },
      },
      employees: {
        where: { employeeId: session.user.id },
        take: 1,
      },
    },
    orderBy: [{ evalCycle: { evalYear: 'desc' } }, { versionNo: 'desc' }],
  })

  const latest = scenarios[0]
  const latestRow = latest?.employees[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">내 보상 확정 결과</h1>
        <p className="mt-1 text-sm text-gray-500">
          최종 승인 및 공개가 완료된 보상안만 self-view 에 표시됩니다.
        </p>
      </div>

      {!latest || !latestRow ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500">
          아직 공개된 보상 확정안이 없습니다.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card label="등급" value={latestRow.gradeName} />
            <Card label="성과급" value={formatCurrency(latestRow.bonusAmount)} />
            <Card label="연봉 인상액" value={formatCurrency(latestRow.salaryIncreaseAmount)} />
            <Card label="총 보상 예상액" value={formatCurrency(latestRow.projectedTotalCompensation)} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-gray-900">
                {latest.evalCycle.evalYear} / {latest.evalCycle.cycleName}
              </h2>
              <p className="text-sm text-gray-500">
                시나리오 v{latest.versionNo} / rule v{latest.ruleSet.versionNo} / 공개일{' '}
                {latest.publishedAt ? formatDate(latest.publishedAt) : '-'}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Detail label="기준 연봉" value={formatCurrency(latestRow.currentSalary)} />
              <Detail label="성과급률" value={`${latestRow.bonusRate}%`} />
              <Detail label="성과급" value={formatCurrency(latestRow.bonusAmount)} />
              <Detail label="연봉 인상률" value={`${latestRow.salaryIncreaseRate}%`} />
              <Detail label="연봉 인상액" value={formatCurrency(latestRow.salaryIncreaseAmount)} />
              <Detail label="인상 후 연봉" value={formatCurrency(latestRow.projectedSalary)} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">공개 이력</h2>
            <div className="space-y-3">
              {scenarios.map((scenario) => {
                const row = scenario.employees[0]
                if (!row) return null

                return (
                  <div key={scenario.id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">
                        {scenario.evalCycle.evalYear} / {scenario.evalCycle.cycleName}
                      </div>
                      <div className="text-xs text-gray-500">
                        v{scenario.versionNo} / 공개 {scenario.publishedAt ? formatDate(scenario.publishedAt) : '-'}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-gray-600 md:grid-cols-4">
                      <span>등급 {row.gradeName}</span>
                      <span>성과급 {formatCurrency(row.bonusAmount)}</span>
                      <span>인상액 {formatCurrency(row.salaryIncreaseAmount)}</span>
                      <span>총액 {formatCurrency(row.projectedTotalCompensation)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900">{value}</div>
    </div>
  )
}
