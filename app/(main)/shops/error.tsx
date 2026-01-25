'use client'

export default function ShopsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">盆栽園マップを読み込めません</h2>
        <p className="text-muted-foreground mb-6">
          地図の読み込みに失敗しました。再試行してください。
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
            {error.message}
          </p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          再試行
        </button>
      </div>
    </div>
  )
}
