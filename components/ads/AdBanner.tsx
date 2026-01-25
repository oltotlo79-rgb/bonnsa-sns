/**
 * @file AdBanner.tsx
 * @description 広告バナーコンポーネント集
 *
 * このファイルには、Google AdSense広告を表示するためのコンポーネント群が含まれています。
 * さまざまなサイズ・フォーマットの広告に対応し、AdSense未設定時は
 * プレースホルダーを表示します。
 *
 * @features
 * - 複数の広告サイズ対応（rectangle, leaderboard, mobile-banner等）
 * - レスポンシブ広告対応
 * - フィード内広告対応
 * - AdSense未設定時のプレースホルダー表示
 * - 開発用プレースホルダー強制表示オプション
 *
 * @usage
 * ```tsx
 * // サイドバー広告
 * <AdBanner size="rectangle" adSlot="1234567890" />
 *
 * // フィード内広告
 * <InFeedAd adSlot="0987654321" />
 *
 * // サイドバー用ラッパー
 * <SidebarAd adSlot="1234567890" />
 * ```
 *
 * @env
 * - NEXT_PUBLIC_ADSENSE_CLIENT_ID: AdSenseのクライアントID
 */
'use client'

// ============================================================
// インポート
// ============================================================

/**
 * useEffect - 副作用を処理するフック
 * AdSenseの初期化処理に使用
 */
/**
 * useRef - DOM要素への参照を保持するフック
 * 広告要素への参照と初期化状態の追跡に使用
 */
import { useEffect, useRef } from 'react'

// ============================================================
// 型定義
// ============================================================

/**
 * 広告サイズの種別を定義する型
 *
 * - 'rectangle': 300x250 - サイドバー向けの標準サイズ
 * - 'large-rectangle': 336x280 - サイドバー/コンテンツ向けの大きめサイズ
 * - 'leaderboard': 728x90 - ページ上部向けの横長バナー
 * - 'mobile-banner': 320x100 - モバイル向けバナー
 * - 'half-page': 300x600 - サイドバー向けの縦長サイズ
 * - 'responsive': 自動サイズ調整（コンテナに合わせる）
 * - 'in-feed': フィード内広告用（フルイド）
 */
type AdSize =
  | 'rectangle'      // 300x250 - サイドバー向け
  | 'large-rectangle' // 336x280 - サイドバー/コンテンツ向け
  | 'leaderboard'    // 728x90 - ページ上部向け
  | 'mobile-banner'  // 320x100 - モバイル向け
  | 'half-page'      // 300x600 - サイドバー向け（大）
  | 'responsive'     // 自動サイズ調整
  | 'in-feed'        // フィード内広告

// ============================================================
// 定数
// ============================================================

/**
 * 広告サイズに対応するスタイル設定
 * 各サイズの幅、高さ、最小高さを定義
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

// ============================================================
// プロパティ型定義
// ============================================================

/**
 * AdBannerコンポーネントのプロパティ定義
 */
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
   * - 'auto': 自動選択
   * - 'fluid': フルイドレイアウト
   * - 'rectangle': 矩形
   * - 'vertical': 縦型
   * - 'horizontal': 横型
   * @default 'auto'
   */
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal'

  /**
   * 追加のCSSクラス
   */
  className?: string

  /**
   * テスト用にプレースホルダーを強制表示
   * 開発環境でのレイアウト確認に使用
   */
  showPlaceholder?: boolean
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 広告バナーコンポーネント
 *
 * Google AdSense広告を表示する汎用コンポーネント。
 * AdSense設定前やadSlot未指定時はプレースホルダーを表示。
 *
 * @param props - コンポーネントプロパティ
 * @returns 広告バナーまたはプレースホルダーのReact要素
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
  // ============================================================
  // Ref管理
  // ============================================================

  /**
   * 広告要素（ins要素）への参照
   * AdSense初期化時に使用
   */
  const adRef = useRef<HTMLModElement>(null)

  /**
   * 初期化済みフラグ
   * 重複初期化を防止するために使用
   */
  const isInitialized = useRef(false)

  // ============================================================
  // 定数・計算値
  // ============================================================

  /**
   * 環境変数からAdSenseクライアントIDを取得
   */
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID

  /**
   * 現在のサイズに対応するスタイル設定を取得
   */
  const sizeStyle = adSizeStyles[size]

  // ============================================================
  // 副作用
  // ============================================================

  /**
   * AdSense広告の初期化処理
   *
   * クライアントID、広告スロット、DOM要素が全て揃っており、
   * かつ未初期化の場合のみ、AdSenseの広告表示を開始する。
   */
  useEffect(() => {
    // AdSenseが有効で、広告スロットが設定されている場合のみ初期化
    if (clientId && adSlot && adRef.current && !isInitialized.current) {
      try {
        // AdSenseのグローバル配列に広告リクエストをプッシュ
        // @ts-expect-error - adsbygoogle is loaded from external script
        (window.adsbygoogle = window.adsbygoogle || []).push({})
        isInitialized.current = true
      } catch (error) {
        // 初期化エラーをコンソールに出力（本番では静かに失敗）
        console.error('AdSense initialization error:', error)
      }
    }
  }, [clientId, adSlot])

  // ============================================================
  // レンダリング
  // ============================================================

  // プレースホルダー表示（AdSense未設定時または開発用）
  if (!clientId || !adSlot || showPlaceholder) {
    return (
      <div
        className={`bg-muted/50 border border-dashed border-border rounded-lg flex items-center justify-center ${className}`}
        style={{
          width: sizeStyle.width,
          minHeight: sizeStyle.minHeight,
          maxWidth: '100%', // レスポンシブ対応
        }}
      >
        <div className="text-center text-muted-foreground p-4">
          {/* 広告アイコン */}
          <AdIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">広告スペース</p>
          {/* サイズ表示（デバッグ用） */}
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
      {/* AdSense広告ユニット（ins要素） */}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width: sizeStyle.width,
          // responsive/in-feedは高さを自動調整
          height: size === 'responsive' || size === 'in-feed' ? 'auto' : sizeStyle.height,
        }}
        // AdSenseのデータ属性
        data-ad-client={clientId}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={size === 'responsive' || size === 'in-feed' ? 'true' : 'false'}
      />
    </div>
  )
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 広告アイコンコンポーネント
 * プレースホルダー表示時に使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
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
      {/* 外枠 */}
      <rect width="18" height="18" x="3" y="3" rx="2" />
      {/* "AD"の"A"を表現 */}
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
  )
}

// ============================================================
// ラッパーコンポーネント
// ============================================================

/**
 * フィード内広告用のラッパーコンポーネント
 *
 * 投稿一覧の間に挿入する広告用のコンポーネント。
 * 上下のパディングとフルイドフォーマットを適用。
 *
 * @param adSlot - 広告スロットID
 * @param className - 追加のCSSクラス
 * @returns フィード内広告のReact要素
 *
 * @example
 * ```tsx
 * // フィード内で使用
 * {posts.map((post, index) => (
 *   <>
 *     <PostCard key={post.id} post={post} />
 *     {index === 2 && <InFeedAd adSlot="xxxxx" />}
 *   </>
 * ))}
 * ```
 */
export function InFeedAd({
  adSlot,
  className = '',
}: {
  /** 広告スロットID */
  adSlot?: string
  /** 追加のCSSクラス */
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
 *
 * サイドバーに配置する広告用のコンポーネント。
 * 標準的なrectangleサイズで中央揃え。
 *
 * @param adSlot - 広告スロットID
 * @param className - 追加のCSSクラス
 * @returns サイドバー広告のReact要素
 *
 * @example
 * ```tsx
 * // サイドバー内で使用
 * <aside>
 *   <SidebarAd adSlot="xxxxx" />
 * </aside>
 * ```
 */
export function SidebarAd({
  adSlot,
  className = '',
}: {
  /** 広告スロットID */
  adSlot?: string
  /** 追加のCSSクラス */
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
