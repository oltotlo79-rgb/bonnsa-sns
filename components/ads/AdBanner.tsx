'use client'

import { useEffect, useRef } from 'react'

/**
 * 広告サイズの定義
 */
type AdSize =
  | 'rectangle'      // 300x250 - サイドバー向け
  | 'large-rectangle' // 336x280 - サイドバー/コンテンツ向け
  | 'leaderboard'    // 728x90 - ページ上部向け
  | 'mobile-banner'  // 320x100 - モバイル向け
  | 'half-page'      // 300x600 - サイドバー向け（大）
  | 'responsive'     // 自動サイズ調整
  | 'in-feed'        // フィード内広告

/**
 * 広告サイズに対応するスタイル
 */
const adSizeStyles: Record<AdSize, { width: string; height: string; minHeight: string }> = {
  'rectangle': { width: '300px', height: '250px', minHeight: '250px' },
  'large-rectangle': { width: '336px', height: '280px', minHeight: '280px' },
  'leaderboard': { width: '728px', height: '90px', minHeight: '90px' },
  'mobile-banner': { width: '320px', height: '100px', minHeight: '100px' },
  'half-page': { width: '300px', height: '600px', minHeight: '600px' },
  'responsive': { width: '100%', height: 'auto', minHeight: '100px' },
  'in-feed': { width: '100%', height: 'auto', minHeight: '120px' },
}

interface AdBannerProps {
  /**
   * 広告ユニットID（AdSenseで作成したad-slot）
   * 未設定の場合はプレースホルダーを表示
   */
  adSlot?: string
  /**
   * 広告サイズ
   * @default 'responsive'
   */
  size?: AdSize
  /**
   * 広告フォーマット（AdSenseの設定）
   * @default 'auto'
   */
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal'
  /**
   * 追加のCSSクラス
   */
  className?: string
  /**
   * テスト用にプレースホルダーを強制表示
   */
  showPlaceholder?: boolean
}

/**
 * 広告バナーコンポーネント
 *
 * Google AdSense広告を表示するコンポーネント
 * AdSense設定前はプレースホルダーを表示
 *
 * @example
 * ```tsx
 * // サイドバー広告
 * <AdBanner size="rectangle" adSlot="1234567890" />
 *
 * // フィード内広告
 * <AdBanner size="in-feed" adSlot="0987654321" format="fluid" />
 *
 * // プレースホルダー表示（開発中）
 * <AdBanner size="rectangle" showPlaceholder />
 * ```
 */
export function AdBanner({
  adSlot,
  size = 'responsive',
  format = 'auto',
  className = '',
  showPlaceholder = false,
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null)
  const isInitialized = useRef(false)

  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
  const sizeStyle = adSizeStyles[size]

  useEffect(() => {
    // AdSenseが有効で、広告スロットが設定されている場合のみ初期化
    if (clientId && adSlot && adRef.current && !isInitialized.current) {
      try {
        // @ts-expect-error - adsbygoogle is loaded from external script
        (window.adsbygoogle = window.adsbygoogle || []).push({})
        isInitialized.current = true
      } catch (error) {
        console.error('AdSense initialization error:', error)
      }
    }
  }, [clientId, adSlot])

  // プレースホルダー表示（AdSense未設定時または開発用）
  if (!clientId || !adSlot || showPlaceholder) {
    return (
      <div
        className={`bg-muted/50 border border-dashed border-border rounded-lg flex items-center justify-center ${className}`}
        style={{
          width: sizeStyle.width,
          minHeight: sizeStyle.minHeight,
          maxWidth: '100%',
        }}
      >
        <div className="text-center text-muted-foreground p-4">
          <AdIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">広告スペース</p>
          <p className="text-[10px] opacity-70">{size}</p>
        </div>
      </div>
    )
  }

  // 実際のAdSense広告
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        width: sizeStyle.width,
        minHeight: sizeStyle.minHeight,
        maxWidth: '100%',
      }}
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width: sizeStyle.width,
          height: size === 'responsive' || size === 'in-feed' ? 'auto' : sizeStyle.height,
        }}
        data-ad-client={clientId}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={size === 'responsive' || size === 'in-feed' ? 'true' : 'false'}
      />
    </div>
  )
}

/**
 * 広告アイコン
 */
function AdIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
  )
}

/**
 * フィード内広告用のラッパーコンポーネント
 *
 * 投稿一覧の間に挿入する広告用
 */
export function InFeedAd({
  adSlot,
  className = '',
}: {
  adSlot?: string
  className?: string
}) {
  return (
    <div className={`py-4 ${className}`}>
      <AdBanner
        adSlot={adSlot}
        size="in-feed"
        format="fluid"
        className="mx-auto"
      />
    </div>
  )
}

/**
 * サイドバー広告用のラッパーコンポーネント
 */
export function SidebarAd({
  adSlot,
  className = '',
}: {
  adSlot?: string
  className?: string
}) {
  return (
    <div className={`${className}`}>
      <AdBanner
        adSlot={adSlot}
        size="rectangle"
        className="mx-auto"
      />
    </div>
  )
}
