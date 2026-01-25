'use client'

import Link from 'next/link'

export default function BonsaiError({
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
              d="M12 3c-3 2-5 5-5 8 0 2 1 3.5 3 4.5M12 3c3 2 5 5 5 8 0 2-1 3.5-3 4.5M12 15v4M7 19h10"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">盆栽情報を読み込めません</h2>
        <p className="text-muted-foreground mb-6">
          盆栽の取得に失敗しました。再試行してください。
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
            {error.message}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            再試行
          </button>
          <Link
            href="/feed"
            className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
          >
            タイムラインへ
          </Link>
        </div>
      </div>
    </div>
  )
}
