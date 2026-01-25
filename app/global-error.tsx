/**
 * @file app/global-error.tsx
 * @description グローバルエラーバウンダリコンポーネント
 *
 * このファイルはNext.js App Routerのグローバルエラーハンドリングを担当します。
 * ルートレイアウト（app/layout.tsx）でキャッチされなかったエラーを処理し、
 * ユーザーにリカバリオプションを提供します。
 *
 * 主な責務:
 * - 予期しないエラーのキャッチと表示
 * - Sentryへのエラー報告（本番環境での監視）
 * - ユーザーへのリカバリオプション提供（再試行、ホームへ戻る）
 * - 開発環境でのエラー詳細表示
 *
 * 注意:
 * - 'use client'ディレクティブが必須（error.tsxはClient Componentのみ）
 * - このコンポーネントは独自のhtml/bodyタグを持つ必要がある
 *   （ルートレイアウトがエラーを起こした場合に備えて）
 */

// Client Componentとして動作することを宣言
// error.tsx/global-error.tsxはClient Componentである必要がある
'use client'

// Sentry: エラー監視・報告サービスのクライアントライブラリ
// captureExceptionでエラーをSentryに送信
import * as Sentry from '@sentry/nextjs'
// React Hook: 副作用（エラー報告）の実行
import { useEffect } from 'react'

/**
 * グローバルエラーコンポーネント
 *
 * ルートレイアウトでキャッチされなかった致命的なエラーを処理します。
 * エラー発生時にユーザーフレンドリーなUIを表示し、
 * リカバリオプション（再試行、ホームへ戻る）を提供します。
 *
 * @param error - 発生したエラーオブジェクト（digest: サーバーエラーの識別子を含む場合あり）
 * @param reset - エラー状態をリセットして再レンダリングを試みる関数
 * @returns エラー表示とリカバリオプションを含むHTML文書
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  /**
   * エラー発生時にSentryに報告
   *
   * useEffectを使用して、エラーオブジェクトが変更されたときに
   * Sentryにエラー情報を送信します。
   * これにより本番環境でのエラー監視が可能になります。
   */
  useEffect(() => {
    // Sentryにエラーを報告（本番環境で有効）
    Sentry.captureException(error)
  }, [error])

  return (
    // グローバルエラーではルートレイアウトが利用できない可能性があるため
    // 独自のhtml/bodyタグを定義する必要がある
    <html lang="ja">
      <body>
        {/* エラー表示コンテナ: 画面中央に配置 */}
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            {/* エラータイトル */}
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              エラーが発生しました
            </h1>
            {/* エラー説明文 */}
            <p className="text-gray-600 mb-8">
              申し訳ございません。予期しないエラーが発生しました。
              問題が継続する場合は、サポートまでお問い合わせください。
            </p>
            {/* リカバリオプションボタン */}
            <div className="space-y-4">
              {/* 再試行ボタン: reset関数を呼び出してエラー状態をリセット */}
              <button
                onClick={() => reset()}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                再試行する
              </button>
              {/* ホームへ戻るボタン: トップページにナビゲート */}
              <button
                onClick={() => window.location.href = '/'}
                className="block w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ホームに戻る
              </button>
            </div>
            {/* 開発環境でのみエラー詳細を表示 */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-8 text-left">
                {/* 折りたたみ可能なエラー詳細 */}
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  エラー詳細（開発用）
                </summary>
                {/* エラーメッセージとスタックトレース */}
                <pre className="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-auto max-h-48">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
