export default function PostLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b">
          <div className="h-4 bg-muted rounded w-32" />
        </div>

        <div className="p-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
