export const LEADERSHIP_INSIGHT_ROUTE = '/solutions/leadership-diagnosis'

type LeadershipInsightLink = {
  href: string | null
  label: string
  helper: string
  external: boolean
}

type LeadershipInsightModelOverrides = {
  contactUrl?: string | null
  homepageUrl?: string | null
  sampleDocUrl?: string | null
}

const VALUE_PILLARS = [
  {
    title: '데이터 수집 및 분석',
    description:
      '응답 데이터, 조직 구조, 비교 지표를 함께 읽어 전사와 조직 단위에서 무엇이 실제 이슈인지 분리해 설명합니다.',
  },
  {
    title: '전문 인사이트',
    description:
      '단순 평균 점수보다 리더십 양태, 유형 차이, 우선 개입 과제를 중심으로 HR과 경영진이 바로 읽을 수 있는 해석을 제공합니다.',
  },
  {
    title: 'HR 도메인 지식',
    description:
      '리더 코칭 포인트, 육성 전략, 인사 활용 과제까지 이어지는 제안으로 진단 이후 운영 의사결정을 돕습니다.',
  },
] as const

const TRUST_POINTS = [
  {
    title: '전사 리더십 점검이 필요한 조직',
    description: '리더 역할 기대치와 실제 실행 수준의 간극을 전사 단위로 확인하고 싶은 조직에 적합합니다.',
  },
  {
    title: '승진·배치·육성 판단이 필요한 HR',
    description: '리더 후보군 비교, 유형별 육성 전략, 조직별 지원 우선순위를 함께 보고 싶은 HR 운영팀에 맞습니다.',
  },
  {
    title: '디브리핑까지 연결하려는 경영진',
    description: '보고서 납품에 그치지 않고, 경영진/HR 디브리핑과 후속 실행 과제를 같이 설계하려는 경우에 효과적입니다.',
  },
] as const

const DIFFERENTIATORS = [
  {
    title: '단순 결과 제공',
    items: ['점수와 분포만 요약', '리더별 해석 차이 부족', '현업 실행 과제 연결이 약함'],
    tone: 'muted' as const,
  },
  {
    title: '의사결정에 연결되는 인사이트 패키지',
    items: [
      '전사·조직·개인 관점의 종합 해석',
      '리더 유형별 코칭 포인트와 육성 전략 제안',
      'HR 활용 과제와 즉시 실행 우선순위까지 정리',
    ],
    tone: 'accent' as const,
  },
] as const

const PACKAGE_ITEMS = [
  {
    title: '진단 문항 설계',
    description: '기업 상황과 리더 역할 기대 수준에 맞춘 문항 구조를 함께 설계합니다.',
  },
  {
    title: '개인 보고서',
    description: '리더별 강점, 위험 신호, 코칭 주안점이 담긴 개인 리포트를 제공합니다.',
  },
  {
    title: '분석 결과 데이터',
    description: '엑셀 기반 원자료와 비교 가능한 분석 테이블을 함께 전달합니다.',
  },
  {
    title: '전사 종합보고서',
    description: '전사 수준과 조직별 차이, 우선 개입 과제를 한 번에 읽을 수 있게 정리합니다.',
  },
  {
    title: 'HR 대상 디브리핑',
    description: '핵심 결과와 해석, 인사 운영 시사점을 설명하는 디브리핑 세션을 지원합니다.',
  },
  {
    title: '선택형 부가 서비스',
    description: '임원용/리더용 디브리핑, 후속 코칭, 추가 분석을 상황에 맞게 확장할 수 있습니다.',
  },
] as const

const REPORT_SAMPLES = [
  {
    id: 'enterprise-profile',
    title: '전사 리더십 수준 및 양태',
    summary: '전사 평균만이 아니라 강점 축과 위험 축이 어디에 몰려 있는지 함께 읽습니다.',
    details: [
      '전사 평균과 분포를 함께 보고 특정 역량의 편차를 확인합니다.',
      '조직별 편차가 큰 축은 후속 디브리핑 우선순위로 제안합니다.',
      '리더십 양태를 해석해 경영진 의사결정 포인트로 연결합니다.',
    ],
  },
  {
    id: 'demographic-compare',
    title: '직급·조직 등 demographic 비교',
    summary: '직급, 조직, 재직 특성별 차이를 비교해 어디에서 지원이 먼저 필요한지 보여줍니다.',
    details: [
      '팀장/실장/임원 후보군 비교처럼 실제 운영 질문을 기준으로 정리합니다.',
      '조직 규모나 역할 차이를 함께 읽어 해석 오류를 줄입니다.',
      '승진·배치·육성 의사결정에 참고할 비교 포인트를 제공합니다.',
    ],
  },
  {
    id: 'leadership-cluster',
    title: '리더십 유형 분류',
    summary: '유사한 행동 패턴을 가진 리더 집단을 분류해 육성 접근을 구체화합니다.',
    details: [
      '유형별 강점과 취약 패턴을 구분해 설명합니다.',
      '유형별로 어떤 지원이 필요한지 우선순위를 제안합니다.',
      '유형 비중 변화를 조직 리스크로 해석할 수 있게 돕습니다.',
    ],
  },
  {
    id: 'interpretation',
    title: '유형별 해석 및 이미지',
    summary: '숫자 대신 이해가 쉬운 서술형 해석과 유형 이미지를 함께 제시합니다.',
    details: [
      '리더가 어떤 장면에서 강점을 보이는지 설명합니다.',
      '팀 운영에서 놓치기 쉬운 위험 신호를 함께 제시합니다.',
      '조직 커뮤니케이션용 설명 자료로도 활용할 수 있게 정리합니다.',
    ],
  },
  {
    id: 'hr-actions',
    title: '유형별 육성·지원·인사 제안',
    summary: '리더별 코칭 과제, 조직 지원, HR 운영 과제를 한 번에 연결합니다.',
    details: [
      '개인 코칭, 조직 지원, 인사 제도 활용 포인트를 구분해서 제시합니다.',
      '즉시 실행 가능한 조치와 중장기 과제를 나눠 설명합니다.',
      '경영진 보고에 필요한 의사결정형 문장으로 정리합니다.',
    ],
  },
  {
    id: 'personalized-summary',
    title: '개인화 결과 요약 및 개선 과제',
    summary: 'LLM 기반 요약 형식까지 포함해 리더별 핵심 메시지와 개선 과제를 빠르게 파악할 수 있습니다.',
    details: [
      '개인 보고서에서 즉시 확인해야 할 핵심 메시지를 짧게 요약합니다.',
      '행동 변화에 바로 연결되는 1차 개선 과제를 제안합니다.',
      '후속 코칭 대화의 시작점이 되는 질문 가이드를 함께 제공합니다.',
    ],
  },
] as const

const PROCESS_STEPS = [
  { title: '진단 설계', description: '조직 상황과 리더 역할 정의에 맞춰 진단 구조를 설계합니다.' },
  { title: '시스템 세팅', description: '대상자, 일정, 응답 환경을 세팅하고 운영 리스크를 점검합니다.' },
  { title: '진단 진행', description: '응답 현황을 모니터링하며 필요한 안내와 리마인드를 운영합니다.' },
  { title: '보고서 제작', description: '전사·조직·개인 관점에서 해석 가능한 결과물로 정리합니다.' },
  { title: '디브리핑', description: 'HR/경영진/리더 대상 설명과 후속 실행 과제를 함께 정리합니다.' },
] as const

const ADVANTAGES = [
  { title: '신속한 진행', description: '설계부터 디브리핑까지 운영 일정을 촘촘하게 관리합니다.' },
  { title: '합리적인 가격', description: '기업 상황과 범위에 따라 필요한 패키지 구성으로 설계합니다.' },
  { title: '높은 품질 결과물', description: '숫자 요약을 넘어 HR 의사결정에 바로 쓰이는 해석을 제공합니다.' },
] as const

function normalizeExternalUrl(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('mailto:')) {
    return trimmed
  }
  return null
}

export function buildLeadershipInsightPageModel(overrides?: LeadershipInsightModelOverrides) {
  const contactUrl = normalizeExternalUrl(
    overrides?.contactUrl ?? process.env.NEXT_PUBLIC_LEADERSHIP_INSIGHT_CONTACT_URL ?? null
  )
  const homepageUrl = normalizeExternalUrl(
    overrides?.homepageUrl ?? process.env.NEXT_PUBLIC_LEADERSHIP_INSIGHT_HOMEPAGE_URL ?? null
  )
  const sampleDocUrl = normalizeExternalUrl(
    overrides?.sampleDocUrl ?? process.env.NEXT_PUBLIC_LEADERSHIP_INSIGHT_SAMPLE_DOC_URL ?? null
  )

  const links: {
    contact: LeadershipInsightLink
    homepage: LeadershipInsightLink
    sampleDoc: LeadershipInsightLink
  } = {
    contact: {
      href: contactUrl,
      label: '상담 문의',
      helper: contactUrl
        ? '도입 범위와 보고서 구성에 맞춰 상담을 진행할 수 있습니다.'
        : '상담 채널은 운영 환경에 맞춰 연결할 수 있습니다.',
      external: Boolean(contactUrl),
    },
    homepage: {
      href: homepageUrl,
      label: '서비스 홈페이지',
      helper: homepageUrl
        ? '서비스 소개 페이지나 공식 홈페이지로 이동합니다.'
        : '서비스 홈페이지 링크는 운영 환경에 맞춰 연결할 수 있습니다.',
      external: Boolean(homepageUrl),
    },
    sampleDoc: {
      href: sampleDocUrl,
      label: '소개서 PDF 열기',
      helper: sampleDocUrl
        ? '소개서 또는 보고서 샘플 문서를 새 탭에서 열 수 있습니다.'
        : '실제 소개서/PDF 샘플은 상담 채널에 맞춰 연결할 수 있습니다.',
      external: Boolean(sampleDocUrl),
    },
  }

  return {
    route: LEADERSHIP_INSIGHT_ROUTE,
    heroTitle: '리더십 진단 인사이트 패키지',
    heroHeadline: '어려운 시기일수록 팀장과 리더의 역할을 더 정확하게 파악하고 지원해야 합니다.',
    heroDescription:
      '진단 결과를 단순 설문 결과로 끝내지 않고, 전사·조직·개인 단위의 리더십 인사이트와 코칭 포인트, 육성 전략, 인사 활용 과제까지 연결해 드립니다.',
    valuePillars: VALUE_PILLARS,
    trustPoints: TRUST_POINTS,
    differentiators: DIFFERENTIATORS,
    packageItems: PACKAGE_ITEMS,
    reportSamples: REPORT_SAMPLES,
    processSteps: PROCESS_STEPS,
    advantages: ADVANTAGES,
    links,
  }
}

export type LeadershipInsightPageModel = ReturnType<typeof buildLeadershipInsightPageModel>
