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

import { useEffect } from 'react'

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * Google AdSenseスクリプトローダーコンポーネント
 *
 * AdSenseの広告配信スクリプトをページに読み込む。
 * Next.jsのScriptコンポーネントはdata-nscript属性を追加するが、
 * AdSenseはこれをサポートしていないため、useEffectで直接挿入する。
 *
 * @returns null（スクリプトはheadに直接挿入される）
 */
export function GoogleAdSense() {
  useEffect(() => {
    // 既にスクリプトが存在する場合はスキップ
    if (document.querySelector('script[src*="adsbygoogle.js"]')) {
      return
    }

    const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-7644314630384219'

    const script = document.createElement('script')
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`
    script.async = true
    script.crossOrigin = 'anonymous'
    document.head.appendChild(script)

    return () => {
      // クリーンアップ（SPAナビゲーション時）
      const existingScript = document.querySelector('script[src*="adsbygoogle.js"]')
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [])

  return null
}
