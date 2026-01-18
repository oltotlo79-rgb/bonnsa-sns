/**
 * Sentry クライアントサイド設定
 *
 * ブラウザで実行されるJavaScriptエラーをキャプチャします。
 * エラー発生時にSentryに自動的に報告されます。
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 本番環境でのみサンプリングを有効化
  // 開発環境では全てのエラーをキャプチャ
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 本番環境でのみ有効化
  enabled: process.env.NODE_ENV === 'production',

  // デバッグモード（開発時のみ）
  debug: false,

  // リプレイセッションのサンプリング
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  // 統合設定
  integrations: [
    Sentry.replayIntegration({
      // プライバシー保護: マスキング設定
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // エラーフィルタリング
  beforeSend(event) {
    // 開発環境ではエラーを送信しない
    if (process.env.NODE_ENV !== 'production') {
      return null
    }

    // 特定のエラーを無視（例: ネットワークエラー）
    if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
      return null
    }

    return event
  },

  // 無視するエラーパターン
  ignoreErrors: [
    // ブラウザ拡張機能由来のエラー
    'top.GLOBALS',
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    'http://tt.telecomfactory.com',
    // Chrome拡張機能
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    // ネットワーク関連
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    // よくある無害なエラー
    'ResizeObserver loop',
    'Non-Error promise rejection',
  ],
})
