/**
 * @file タイムラインページ専用エラーコンポーネント
 * @description タイムラインのデータ取得時にエラーが発生した場合に表示されるUI
 *
 * このファイルはNext.js App Routerの規約に基づくエラーバウンダリです。
 * /feedページでサーバーエラーやネットワークエラーが発生した際に自動的に表示されます。
 *
 * 'use client'ディレクティブが必須です。
 * これはerror.tsxがクライアントサイドでエラーをキャッチする必要があるためです。
 *
 * @features
 * - エラー状態の視覚的表示
 * - 再試行ボタンによるリカバリー機能
 * - 開発環境でのエラー詳細表示
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
'use client'

/**
 * タイムラインエラーコンポーネント
 *
 * タイムラインページでエラーが発生した際に表示されるClient Componentです。
 * Next.jsのエラーバウンダリ機能と連携して動作します。
 *
 * @param error - 発生したエラーオブジェクト。digestプロパティはサーバーエラーの識別子
 * @param reset - コンポーネントの再レンダリングを試行する関数（エラー状態をリセット）
 * @returns エラー表示UIのJSX要素
 */
export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }  // digestはNext.jsが自動付与するエラー識別子
  reset: () => void                   // エラー状態をリセットして再レンダリングを試行
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="text-center max-w-md">
        {/* エラーアイコン - 新聞/フィードを模したSVGアイコン */}
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
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
        </div>

        {/* エラーメッセージ */}
        <h2 className="text-xl font-semibold mb-2">タイムラインを読み込めません</h2>
        <p className="text-muted-foreground mb-6">
          一時的な問題が発生しています。しばらく待ってから再試行してください。
        </p>

        {/* 開発環境でのみエラー詳細を表示
            本番環境ではセキュリティのため非表示 */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
            {error.message}
          </p>
        )}

        {/* 再試行ボタン
            クリックするとreset()が呼ばれ、コンポーネントの再レンダリングを試行 */}
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
