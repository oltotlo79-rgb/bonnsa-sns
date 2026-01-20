'use client'

import Script from 'next/script'

/**
 * Google AdSenseスクリプトコンポーネント
 *
 * ルートレイアウトに配置してAdSenseスクリプトを読み込む
 * 環境変数 NEXT_PUBLIC_ADSENSE_CLIENT_ID が設定されている場合のみ有効
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * <GoogleAdSense />
 * ```
 */
export function GoogleAdSense() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID

  // AdSense Client IDが設定されていない場合は何も表示しない
  if (!clientId) {
    return null
  }

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="lazyOnload"
    />
  )
}
