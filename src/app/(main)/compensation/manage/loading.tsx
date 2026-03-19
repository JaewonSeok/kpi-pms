export default function CompensationManageLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-40 rounded bg-gray-200" />
        <div className="mt-3 h-8 w-64 rounded bg-gray-200" />
        <div className="mt-3 h-4 w-full max-w-3xl rounded bg-gray-100" />
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="h-3 w-16 rounded bg-gray-200" />
                  <div className="mt-3 h-11 rounded-xl bg-gray-200" />
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="h-3 w-20 rounded bg-gray-200" />
                  <div className="mt-3 h-8 w-24 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-3xl border border-gray-200 bg-white p-5">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-12 rounded-2xl bg-gray-100" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="mt-3 h-8 w-20 rounded bg-gray-100" />
            <div className="mt-2 h-4 w-full rounded bg-gray-100" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-11 rounded-2xl bg-gray-100" />
        <div className="mt-6 h-96 rounded-2xl bg-gray-50" />
      </div>
    </div>
  )
}
