/**
 * @file 盆栽園詳細ページのエラーUI
 * @description 盆栽園詳細ページでエラーが発生した際に表示されるエラーバウンダリ。
 * Next.js App Routerの規約により、このファイルはerror.tsx として配置することで
 * 同階層のpage.tsxで発生したエラーを自動的にキャッチして表示する。
 *
 * 注意: error.tsxはClient Componentである必要がある（'use client'が必須）
 */

'use client'

// Next.jsのLinkコンポーネント: ページ遷移用
import Link from 'next/link'

/**
 * 盆栽園詳細ページのエラーコンポーネント
 *
 * このClient Componentは以下の機能を提供する:
 * 1. エラー発生時のユーザーフレンドリーなUIの表示
 * 2. 開発環境でのエラーメッセージの表示（デバッグ用）
 * 3. 「再試行」ボタンによるページの再レンダリング
 * 4. 「盆栽園マップへ」リンクによる安全なナビゲーション
 *
 * @param error - 発生したエラーオブジェクト（digestプロパティ含む）
 * @param reset - エラー状態をリセットして再レンダリングする関数
 */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string }  // エラーオブジェクト（Next.jsが追加するdigestを含む）
  reset: () => void                    // エラー状態リセット関数
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="text-center max-w-md">
        {/* エラーアイコン: 地図ピンアイコンで盆栽園関連のエラーを示す */}
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
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        {/* エラータイトル */}
        <h2 className="text-xl font-semibold mb-2">盆栽園情報を表示できません</h2>

        {/* エラー説明 */}
        <p className="text-muted-foreground mb-6">
          盆栽園が見つからないか、情報の取得に失敗しました。
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
          {/* 盆栽園マップへのナビゲーションリンク */}
          <Link
            href="/shops"
            className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
          >
            盆栽園マップへ
          </Link>
        </div>
      </div>
    </div>
  )
}
