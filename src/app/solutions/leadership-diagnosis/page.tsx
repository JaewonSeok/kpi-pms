import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, BarChart3, BriefcaseBusiness, BrainCircuit, CheckCircle2, Compass, FileSpreadsheet, Lightbulb, MessageSquareQuote, Users2 } from 'lucide-react'
import { LeadershipInsightSamples } from '@/components/marketing/LeadershipInsightSamples'
import { buildLeadershipInsightPageModel } from '@/lib/leadership-insight'

export const metadata: Metadata = {
  title: '리더십 진단 인사이트 패키지',
  description: '전사·조직·개인 단위 리더십 진단 결과를 HR 의사결정과 육성 전략으로 연결하는 인사이트 패키지 소개',
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id?: string
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-20">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
        {description ? <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{description}</p> : null}
      </div>
      <div className="mt-10">{children}</div>
    </section>
  )
}

function ExternalOrDisabledAction({
  link,
  variant = 'secondary',
}: {
  link: ReturnType<typeof buildLeadershipInsightPageModel>['links'][keyof ReturnType<typeof buildLeadershipInsightPageModel>['links']]
  variant?: 'primary' | 'secondary'
}) {
  const className =
    variant === 'primary'
      ? 'inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800'
      : 'inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'

  if (!link.href) {
    return (
      <div className="space-y-2">
        <span
          aria-disabled="true"
          className={`${className} cursor-not-allowed border-slate-200 text-slate-400 hover:bg-transparent`}
        >
          {link.label}
        </span>
        <p className="max-w-xs text-xs leading-5 text-slate-500">{link.helper}</p>
      </div>
    )
  }

  return (
    <Link href={link.href} target="_blank" rel="noreferrer noopener" className={className}>
      {link.label}
    </Link>
  )
}

export default function LeadershipDiagnosisPage() {
  const model = buildLeadershipInsightPageModel()

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_42%),linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)]">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Leadership Insight Package</p>
            <p className="mt-3 text-sm font-semibold text-slate-700">{model.heroTitle}</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              {model.heroHeadline}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              {model.heroDescription}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#report-samples"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                소개서 및 보고서 샘플 보기
              </Link>
              <ExternalOrDisabledAction link={model.links.contact} />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">전사</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">전사 리더십 수준과 조직 간 편차를 읽을 수 있습니다.</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">조직</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">팀·본부 단위의 강점과 리스크를 바로 비교할 수 있습니다.</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">개인</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">리더별 코칭 포인트와 육성 전략까지 연결할 수 있습니다.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:col-span-2">
              <div className="flex items-center gap-3 text-blue-600">
                <MessageSquareQuote className="h-5 w-5" />
                <span className="text-sm font-semibold">HR 의사결정에 연결되는 인사이트</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                진단 데이터를 단순 결과 조회로 끝내지 않고, 리더별 코칭 주안점, 육성 전략, 인사 활용 과제로 이어지는 형태로 재구성합니다.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-blue-600">
                <BrainCircuit className="h-5 w-5" />
                <span className="text-sm font-semibold">심층 분석</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                전사 리더십 수준, 유형 분류, demographic 비교까지 함께 읽어 실제 이슈를 찾습니다.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-blue-600">
                <Compass className="h-5 w-5" />
                <span className="text-sm font-semibold">실행 연결</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                어떤 리더에게 어떤 지원이 먼저 필요한지 우선순위 형태로 정리합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section
        id="value-proposition"
        eyebrow="Value"
        title="데이터 수집, 전문 인사이트, HR 도메인 지식을 하나의 패키지로 묶었습니다."
        description="단순 설문 운영이 아니라, HR과 경영진이 실제로 활용할 수 있는 형태의 분석 결과를 전달하는 데 초점을 맞췄습니다."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {model.valuePillars.map((item, index) => {
            const Icon = [BarChart3, Lightbulb, BriefcaseBusiness][index] ?? BarChart3
            return (
              <div key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            )
          })}
        </div>
      </Section>

      <Section
        eyebrow="Fit"
        title="이런 조직에 적합합니다"
        description="무단 로고 대신, 실제 도입 상황을 기준으로 어떤 조직에서 활용도가 높은지 설명합니다."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {model.trustPoints.map((item) => (
            <div key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                <Users2 className="h-4 w-4" />
                적합 조직
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Why This Package"
        title="결과를 보여주는 데서 끝나지 않고, 의사결정까지 연결합니다"
        description="리더십 진단은 결과표보다 해석과 실행 연결이 더 중요합니다. 그래서 결과 그 자체보다 ‘무엇을 해야 하는가’를 중심으로 설계했습니다."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {model.differentiators.map((item) => (
            <div
              key={item.title}
              className={`rounded-[28px] border p-6 shadow-sm ${
                item.tone === 'accent'
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
                {item.items.map((detail) => (
                  <li key={detail} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-500" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="package"
        eyebrow="Package"
        title="패키지 구성"
        description="기업 상황과 니즈에 맞춰 유연하게 조합할 수 있도록, 핵심 결과물과 운영 단계를 패키지 형태로 정리했습니다."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {model.packageItems.map((item) => (
            <div key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="report-samples"
        eyebrow="Report Samples"
        title="보고서 샘플과 인사이트 유형을 한눈에 볼 수 있습니다"
        description="실제 샘플은 기업 보안과 도입 채널에 맞춰 제공하되, 어떤 해석과 제안이 담기는지는 이 화면에서 바로 확인할 수 있습니다."
      >
        <LeadershipInsightSamples samples={model.reportSamples} sampleDoc={model.links.sampleDoc} />
      </Section>

      <Section
        eyebrow="Process"
        title="진행 프로세스"
        description="설계부터 디브리핑까지, 목표와 일정에 맞춰 운영 가능한 단계로 구성합니다."
      >
        <div className="grid gap-4 lg:grid-cols-5">
          {model.processSteps.map((step, index) => (
            <div key={step.title} className="relative rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
                Step {index + 1}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Benefits"
        title="도입 판단에 필요한 핵심 장점"
        description="과장된 수치 대신, 실제 도입 시 중요하게 보는 세 가지 기준을 명확히 보여줍니다."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {model.advantages.map((item) => (
            <div key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                핵심 장점
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <section id="contact-cta" className="mx-auto w-full max-w-7xl px-6 pb-20">
        <div className="rounded-[32px] border border-slate-200 bg-slate-900 px-6 py-10 text-white shadow-sm sm:px-8 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">Final CTA</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">우리 조직 상황에 맞는 리더십 진단 패키지를 설계해 보세요.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                전사·조직·개인 단위 해석, 리더별 코칭 포인트, HR 활용 시사점까지 한 번에 보고 싶다면
                도입 범위와 결과물 구성을 기준으로 상담을 진행할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <ExternalOrDisabledAction link={model.links.contact} variant="primary" />
              <ExternalOrDisabledAction link={model.links.homepage} />
              <Link
                href="#report-samples"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                소개서 및 보고서 샘플 보기 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
