import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate, getCurrentYear } from '@/lib/utils'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const currentYear = getCurrentYear()
  const role = session.user.role

  // 역할별 데이터 조회
  let dashboardData: any = {}

  if (role === 'ROLE_MEMBER' || role === 'ROLE_TEAM_LEADER') {
    // 내 KPI 현황
    const myKpis = await prisma.personalKpi.findMany({
      where: { employeeId: session.user.id, evalYear: currentYear },
      include: {
        monthlyRecords: { orderBy: { yearMonth: 'asc' } },
      },
    })

    // 최근 체크인
    const recentCheckIns = await prisma.checkIn.findMany({
      where: {
        OR: [{ ownerId: session.user.id }, { managerId: session.user.id }],
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      include: { owner: { select: { empName: true } } },
      orderBy: { scheduledDate: 'asc' },
      take: 3,
    })

    // 미완료 알림 수
    const unreadNotifs = await prisma.notification.count({
      where: { recipientId: session.user.id, isRead: false },
    })

    // 평가 현황
    const pendingEvals = await prisma.evaluation.count({
      where: {
        evaluatorId: session.user.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    })

    dashboardData = { myKpis, recentCheckIns, unreadNotifs, pendingEvals }
  }

  // 전체 통계 (관리자용)
  if (role === 'ROLE_ADMIN') {
    const [totalEmployees, activeEvalCycles, pendingAppeals] = await Promise.all([
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.evalCycle.count({ where: { status: { notIn: ['SETUP', 'CLOSED'] } } }),
      prisma.appeal.count({ where: { status: 'SUBMITTED' } }),
    ])

    dashboardData = { totalEmployees, activeEvalCycles, pendingAppeals }
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">{currentYear}년 성과관리 현황</p>
      </div>

      {/* 역할별 대시보드 */}
      {(role === 'ROLE_MEMBER' || role === 'ROLE_TEAM_LEADER') && (
        <MemberDashboard data={dashboardData} session={session} />
      )}

      {role === 'ROLE_ADMIN' && (
        <AdminDashboard data={dashboardData} />
      )}
    </div>
  )
}

function MemberDashboard({ data, session }: { data: any; session: any }) {
  const { myKpis, recentCheckIns, unreadNotifs, pendingEvals } = data

  // KPI 평균 달성률 계산
  const avgAchievement = myKpis.reduce((sum: number, kpi: any) => {
    const lastRecord = kpi.monthlyRecords[kpi.monthlyRecords.length - 1]
    return sum + (lastRecord?.achievementRate || 0)
  }, 0) / Math.max(myKpis.length, 1)

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="KPI 달성률"
          value={`${Math.round(avgAchievement)}%`}
          subtitle={`${myKpis.length}개 KPI`}
          color="blue"
          icon="📊"
        />
        <SummaryCard
          title="미확인 알림"
          value={String(unreadNotifs)}
          subtitle="새 알림"
          color="red"
          icon="🔔"
        />
        <SummaryCard
          title="대기중 평가"
          value={String(pendingEvals)}
          subtitle="평가 건"
          color="orange"
          icon="📝"
        />
        <SummaryCard
          title="예정 체크인"
          value={String(recentCheckIns.length)}
          subtitle="이번 주"
          color="green"
          icon="📅"
        />
      </div>

      {/* KPI 현황 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">내 KPI 현황</h2>
        {myKpis.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📋</div>
            <p>등록된 KPI가 없습니다. KPI를 설정해주세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myKpis.map((kpi: any) => {
              const lastRecord = kpi.monthlyRecords[kpi.monthlyRecords.length - 1]
              const rate = lastRecord?.achievementRate || 0
              return (
                <div key={kpi.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate">{kpi.kpiName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${kpi.kpiType === 'QUANTITATIVE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {kpi.kpiType === 'QUANTITATIVE' ? '계량' : '비계량'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${rate >= 100 ? 'bg-green-500' : rate >= 70 ? 'bg-blue-500' : 'bg-orange-500'}`}
                          style={{ width: `${Math.min(rate, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-12 text-right">{rate}%</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">가중치 {kpi.weight}%</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 예정 체크인 */}
      {recentCheckIns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">예정된 체크인</h2>
          <div className="space-y-2">
            {recentCheckIns.map((ci: any) => (
              <div key={ci.id} className="flex items-center gap-3 p-3 rounded-lg bg-blue-50">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">
                    {ci.checkInType === 'WEEKLY' ? '주간' : ci.checkInType === 'MONTHLY' ? '월간' : '수시'} 체크인
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(ci.scheduledDate).toLocaleDateString('ko-KR')} · {ci.owner?.empName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AdminDashboard({ data }: { data: any }) {
  const { totalEmployees, activeEvalCycles, pendingAppeals } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard title="전체 임직원" value={String(totalEmployees)} subtitle="재직자" color="blue" icon="👥" />
        <SummaryCard title="진행중 평가" value={String(activeEvalCycles)} subtitle="평가 주기" color="orange" icon="📊" />
        <SummaryCard title="이의신청" value={String(pendingAppeals)} subtitle="검토 대기" color="red" icon="⚠️" />
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  color,
  icon,
}: {
  title: string
  value: string
  subtitle: string
  color: 'blue' | 'red' | 'orange' | 'green'
  icon: string
}) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200',
    red: 'bg-red-50 border-red-200',
    orange: 'bg-orange-50 border-orange-200',
    green: 'bg-green-50 border-green-200',
  }
  const valueColorMap = {
    blue: 'text-blue-700',
    red: 'text-red-700',
    orange: 'text-orange-700',
    green: 'text-green-700',
  }

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-3xl font-bold ${valueColorMap[color]}`}>{value}</div>
      <div className="text-sm font-medium text-gray-700 mt-1">{title}</div>
      <div className="text-xs text-gray-400">{subtitle}</div>
    </div>
  )
}
