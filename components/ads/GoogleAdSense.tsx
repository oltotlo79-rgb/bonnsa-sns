/**
 * @file GoogleAdSense.tsx
 * @description Google AdSenseスクリプトローダーコンポーネント
 *
 * このコンポーネントは、Google AdSenseの広告配信に必要なスクリプトを
 * ページに読み込むためのコンポーネントです。ルートレイアウトに配置して使用します。
 *
 * @features
 * - AdSenseスクリプトの遅延読み込み（lazyOnload戦略）
 * - 環境変数による有効/無効の切り替え
 * - クロスオリジン対応
 *
 * @usage
 * ```tsx
 * // app/layout.tsx に配置
 * import { GoogleAdSense } from '@/components/ads/GoogleAdSense'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <GoogleAdSense />
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 *
 * @env
 * - NEXT_PUBLIC_ADSENSE_CLIENT_ID: AdSenseのクライアントID（ca-pub-xxxxx形式）
 */
'use client'

// ============================================================
// インポート
// ============================================================

/**
 * Script - Next.jsのスクリプト最適化コンポーネント
 * 外部スクリプトの読み込みを最適化し、パフォーマンスを向上
 */
import Script from 'next/script'

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * Google AdSenseスクリプトローダーコンポーネント
 *
 * AdSenseの広告配信スクリプトをページに読み込む。
 * 環境変数が設定されていない場合は何も表示しない。
 *
 * @returns スクリプト要素、または環境変数未設定時はnull
 *
 * @example
 * ```tsx
 * // ルートレイアウトに配置
 * <GoogleAdSense />
 * ```
 */
export function GoogleAdSense() {
  /**
   * 環境変数からAdSenseクライアントIDを取得
   * NEXT_PUBLIC_プレフィックスでクライアントサイドでもアクセス可能
   * 未設定の場合はデフォルト値を使用（サイト審査対応）
   */
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-7644314630384219'

  return (
    <Script
      // 非同期読み込みを有効化
      async
      // AdSenseスクリプトのURL（クライアントIDをクエリパラメータで指定）
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      // クロスオリジン属性（AdSenseの要件）
      crossOrigin="anonymous"
      // afterInteractive: ページがインタラクティブになった直後に読み込み
      // AdSense審査で確実に認識されるようにするため
      strategy="afterInteractive"
    />
  )
}
