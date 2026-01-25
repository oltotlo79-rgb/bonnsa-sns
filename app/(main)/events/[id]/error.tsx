/**
 * @file イベント詳細ページのエラーUI
 * @description イベント詳細ページでエラーが発生した際に表示されるエラーバウンダリ。
 * Next.js App Routerの規約により、このファイルはerror.tsx として配置することで
 * 同階層のpage.tsxで発生したエラーを自動的にキャッチして表示する。
 *
 * 注意: error.tsxはClient Componentである必要がある（'use client'が必須）
 */

'use client'

// Next.jsのLinkコンポーネント: ページ遷移用
import Link from 'next/link'

/**
 * イベント詳細ページのエラーコンポーネント
 *
 * このClient Componentは以下の機能を提供する:
 * 1. エラー発生時のユーザーフレンドリーなUIの表示
 * 2. 開発環境でのエラーメッセージの表示（デバッグ用）
 * 3. 「再試行」ボタンによるページの再レンダリング
 * 4. 「イベント一覧へ」リンクによる安全なナビゲーション
 *
 * @param error - 発生したエラーオブジェクト（digestプロパティ含む）
 * @param reset - エラー状態をリセットして再レンダリングする関数
 */
export default function EventError({
  error,
  reset,
}: {
  error: Error & { digest?: string }  // エラーオブジェクト（Next.jsが追加するdigestを含む）
  reset: () => void                    // エラー状態リセット関数
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="text-center max-w-md">
        {/* エラーアイコン: カレンダーアイコンでイベント関連のエラーを示す */}
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* エラータイトル */}
        <h2 className="text-xl font-semibold mb-2">イベント情報を表示できません</h2>

        {/* エラー説明 */}
        <p className="text-muted-foreground mb-6">
          イベントが見つからないか、終了している可能性があります。
        </p>

        {/* 開発環境でのみエラーメッセージを表示（デバッグ用） */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
            {error.message}
          </p>
        )}

        {/* アクションボタン */}
        <div className="flex gap-3 justify-center">
          {/* 再試行ボタン: reset関数を呼び出してページを再レンダリング */}
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            再試行
          </button>
          {/* イベント一覧へのナビゲーションリンク */}
          <Link
            href="/events"
            className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
          >
            イベント一覧へ
          </Link>
        </div>
      </div>
    </div>
  )
}
