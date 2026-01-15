export default function ShopsLoading() {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="h-10 w-36 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* マップスケルトン */}
      <div className="h-[500px] w-full bg-muted rounded-lg animate-pulse" />

      {/* 検索フォームスケルトン */}
      <div className="bg-card rounded-lg border p-4 space-y-4">
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
        <div className="flex gap-4">
          <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
          <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>

      {/* リストスケルトン */}
      <div>
        <div className="h-7 w-40 bg-muted rounded mb-4 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 space-y-3 animate-pulse">
              <div className="h-6 w-3/4 bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-muted rounded-full" />
                <div className="h-6 w-16 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
