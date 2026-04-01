'use client'

type GroupedResponse = {
  questionId: string
  category: string
  questionText: string
  answers: Array<{
    feedbackId: string
    relationship: string
    authorLabel: string
    ratingValue?: number | null
    textValue?: string | null
  }>
}

export function FeedbackReferencePanel(props: {
  groupedResponses: GroupedResponse[]
  warnings: string[]
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">참고정보 / 문항별 응답</h2>
          <p className="mt-1 text-sm text-slate-500">
            동일 문항에 여러 작성자가 응답한 경우, 문항은 한 번만 보여주고 응답만 묶어서 표시합니다.
          </p>
        </div>
        <div className="space-y-4">
          {props.groupedResponses.length ? (
            props.groupedResponses.map((group) => (
              <div key={group.questionId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {group.category}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{group.questionText}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {group.answers.map((answer, index) => (
                    <div key={`${answer.feedbackId}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {answer.authorLabel}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {answer.relationship}
                        </span>
                        {typeof answer.ratingValue === 'number' ? (
                          <span className="text-xs font-medium text-slate-500">점수 {answer.ratingValue}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {answer.textValue?.trim() || '텍스트 응답이 없는 문항입니다.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <EmptyBlock message="익명 기준을 충족하거나 조회 가능한 참고 응답이 생기면 이 영역에 문항별 근거가 표시됩니다." />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">주의 / 품질 경고</h2>
          <p className="mt-1 text-sm text-slate-500">
            익명 기준 미달, 응답 수 부족, 문항 편중 같은 상황을 결과 해석 전에 먼저 확인합니다.
          </p>
        </div>
        <div className="space-y-3">
          {props.warnings.length ? (
            props.warnings.map((warning) => (
              <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {warning}
              </div>
            ))
          ) : (
            <EmptyBlock message="현재 결과에는 추가 품질 경고가 없습니다." />
          )}
        </div>
      </div>
    </section>
  )
}

function EmptyBlock(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {props.message}
    </div>
  )
}
