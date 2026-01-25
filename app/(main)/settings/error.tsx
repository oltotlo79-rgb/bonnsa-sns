/**
 * @fileoverview 設定ページのエラーバウンダリ
 *
 * このファイルはNext.js App Routerの規約に従ったエラーUIコンポーネントです。
 * /settingsページおよびその子ルート（profile, account, subscription等）で
 * 発生したエラーをキャッチして表示します。
 *
 * 主な機能:
 * - 設定ページでのエラーのキャッチと表示
 * - エラー再試行機能の提供
 * - 開発環境でのエラーメッセージ表示（デバッグ用）
 * - ユーザーフレンドリーなエラーUI
 *
 * @route /settings (およびその子ルート)
 * @requires 'use client' - エラーバウンダリはクライアントコンポーネントである必要がある
 */

'use client'

/**
 * 設定ページのエラーコンポーネント
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
export default function SettingsError({
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
        {/* エラーアイコン（歯車の形状で設定を表現） */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {/* 歯車アイコンのSVGパス（外側の歯） */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            {/* 歯車アイコンのSVGパス（中心の円） */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        {/* エラーメッセージ見出し */}
        <h2 className="text-xl font-semibold mb-2">設定を読み込めません</h2>

        {/* エラーの説明テキスト */}
        <p className="text-muted-foreground mb-6">
          設定の取得に失敗しました。再試行してください。
        </p>

        {/* 開発環境でのみ詳細なエラーメッセージを表示（デバッグ用） */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
            {error.message}
          </p>
        )}

        {/* 再試行ボタン - reset関数を呼び出してページを再レンダリング */}
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
