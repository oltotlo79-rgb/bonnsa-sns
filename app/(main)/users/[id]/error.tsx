/**
 * @fileoverview ユーザープロフィールページのエラーバウンダリ
 *
 * このファイルはNext.js App Routerの規約に従ったエラーUIコンポーネントです。
 * /users/[id]ページおよびその子ルートで発生したエラーをキャッチして表示します。
 *
 * 主な機能:
 * - ユーザーページでのエラーのキャッチと表示
 * - エラー再試行機能の提供
 * - 開発環境でのエラーメッセージ表示
 * - 代替アクション（ユーザー検索への導線）の提供
 *
 * @route /users/[id] (およびその子ルート)
 * @requires 'use client' - エラーバウンダリはクライアントコンポーネントである必要がある
 */

'use client'

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'

/**
 * ユーザーページのエラーコンポーネント
 *
 * React Error Boundaryとして機能し、子コンポーネントでスローされた
 * エラーをキャッチして、ユーザーフレンドリーなエラーUIを表示します。
 *
 * @param {Object} props - コンポーネントのプロパティ
 * @param {Error & { digest?: string }} props.error - 発生したエラーオブジェクト
 *        digestはNext.jsが生成するエラー識別子（本番環境でのエラートラッキング用）
 * @param {() => void} props.reset - エラー状態をリセットして再レンダリングを試行する関数
 * @returns {JSX.Element} エラー表示UIのJSX要素
 */
export default function UserError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    // 画面中央にエラーメッセージを配置
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="text-center max-w-md">
        {/* エラーアイコン（ユーザーシルエットのSVG） */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {/* ユーザーアイコンのSVGパス */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>

        {/* エラーメッセージ見出し */}
        <h2 className="text-xl font-semibold mb-2">プロフィールを表示できません</h2>

        {/* エラーの説明テキスト */}
        <p className="text-muted-foreground mb-6">
          ユーザーが見つからないか、アカウントが非公開の可能性があります。
        </p>

        {/* 開発環境でのみ詳細なエラーメッセージを表示（デバッグ用） */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
            {error.message}
          </p>
        )}

        {/* アクションボタン */}
        <div className="flex gap-3 justify-center">
          {/* 再試行ボタン - reset関数を呼び出してページを再レンダリング */}
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            再試行
          </button>

          {/* 検索ページへのリンク - 代替手段としてユーザー検索を提案 */}
          <Link
            href="/search"
            className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
          >
            ユーザーを検索
          </Link>
        </div>
      </div>
    </div>
  )
}
