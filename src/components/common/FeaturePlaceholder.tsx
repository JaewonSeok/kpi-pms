type FeaturePlaceholderProps = {
  title: string
  description: string
  notice?: string
  bullets?: string[]
}

export function FeaturePlaceholder({
  title,
  description,
  notice = '이 화면은 현재 운영 안정화를 위해 기본 셸로 제공되고 있습니다.',
  bullets = [],
}: FeaturePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          준비 중
        </div>
        <p className="mt-4 text-sm leading-6 text-amber-900">{notice}</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">안내</h2>
        <p className="mt-2 text-sm text-gray-500">
          메뉴 진입 시 404 또는 잘못된 접근 상태가 발생하지 않도록 기본 페이지를 연결했습니다.
        </p>

        {bullets.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm text-gray-600">
            {bullets.map((bullet) => (
              <li key={bullet} className="rounded-xl bg-gray-50 px-4 py-3">
                {bullet}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
