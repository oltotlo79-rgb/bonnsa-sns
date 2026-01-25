/**
 * @file 投稿詳細ページ専用エラーコンポーネント
 * @description 投稿詳細ページでエラーが発生した場合に表示されるUI
 *
 * このファイルはNext.js App Routerの規約に基づくエラーバウンダリです。
 * /posts/[id]ページでサーバーエラーやネットワークエラーが発生した際に自動的に表示されます。
 *
 * 'use client'ディレクティブが必須です。
 * これはerror.tsxがクライアントサイドでエラーをキャッチする必要があるためです。
 *
 * @features
 * - エラー状態の視覚的表示（警告アイコン）
 * - 再試行ボタンによるリカバリー機能
 * - タイムラインへの代替ナビゲーション
 * - 開発環境でのエラー詳細表示
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
'use client'

// Next.jsのリンクコンポーネント
// タイムラインへの代替ナビゲーションに使用
import Link from 'next/link'

/**
 * 投稿詳細エラーコンポーネント
 *
 * 投稿詳細ページでエラーが発生した際に表示されるClient Componentです。
 * Next.jsのエラーバウンダリ機能と連携して動作します。
 *
 * 2つのリカバリーオプションを提供:
 * 1. 再試行 - 同じページの再レンダリングを試行
 * 2. タイムラインへ - 別のページへ移動してエラーを回避
 *
 * @param error - 発生したエラーオブジェクト。digestプロパティはサーバーエラーの識別子
 * @param reset - コンポーネントの再レンダリングを試行する関数（エラー状態をリセット）
 * @returns エラー表示UIのJSX要素
 */
export default function PostError({
  error,
  reset,
}: {
  error: Error & { digest?: string }  // digestはNext.jsが自動付与するエラー識別子
  reset: () => void                   // エラー状態をリセットして再レンダリングを試行
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="text-center max-w-md">
        {/* 警告アイコン - 三角形の警告マーク */}
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* エラーメッセージ */}
        <h2 className="text-xl font-semibold mb-2">投稿を表示できません</h2>
        <p className="text-muted-foreground mb-6">
          投稿が削除されたか、アクセス権限がない可能性があります。
        </p>

        {/* 開発環境でのみエラー詳細を表示
            本番環境ではセキュリティのため非表示 */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
            {error.message}
          </p>
        )}

        {/* アクションボタン - 再試行とタイムラインへの2つのオプション */}
        <div className="flex gap-3 justify-center">
          {/* 再試行ボタン - reset()を呼び出してコンポーネントを再レンダリング */}
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            再試行
          </button>

          {/* タイムラインへ戻るリンク - エラーを回避する代替手段 */}
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
