/**
 * @file OptimizedImage.tsx
 * @description 最適化画像コンポーネント
 *
 * このコンポーネントは、Next.js Imageコンポーネントをラップし、
 * 追加の機能（ローディングプレースホルダー、エラーハンドリング、
 * フェードインアニメーション）を提供します。
 *
 * @features
 * - 遅延読み込み（Lazy Loading）によるパフォーマンス最適化
 * - ローディング中のパルスアニメーションプレースホルダー
 * - 画像読み込みエラー時のフォールバック表示
 * - フェードインアニメーションによるスムーズな表示
 * - レスポンシブサイズ対応（sizes属性）
 * - objectFitオプション（cover, contain, fill, none）
 * - クリックイベントハンドラ対応
 *
 * @usage
 * ```tsx
 * // 基本的な使用方法
 * <OptimizedImage
 *   src="/images/photo.jpg"
 *   alt="写真の説明"
 *   width={300}
 *   height={200}
 * />
 *
 * // fill モードで親要素に合わせる
 * <div className="relative w-full aspect-video">
 *   <OptimizedImage
 *     src="/images/banner.jpg"
 *     alt="バナー"
 *     fill
 *   />
 * </div>
 *
 * // クリック可能な画像
 * <OptimizedImage
 *   src="/images/thumbnail.jpg"
 *   alt="サムネイル"
 *   width={100}
 *   height={100}
 *   onClick={() => openModal()}
 * />
 * ```
 */
'use client'

// ============================================================
// インポート
// ============================================================

/**
 * Image - Next.jsの最適化画像コンポーネント
 * 自動的に画像を最適化し、WebP変換、遅延読み込みなどを行う
 */
import Image from 'next/image'

/**
 * useState - コンポーネントの状態管理フック
 * ローディング状態とエラー状態を管理
 */
import { useState } from 'react'

// ============================================================
// 型定義
// ============================================================

/**
 * OptimizedImageコンポーネントのプロパティ定義
 */
type OptimizedImageProps = {
  /**
   * 画像のソースURL
   * ローカルパス（/images/...）またはリモートURL
   */
  src: string

  /**
   * 画像の代替テキスト（アクセシビリティ用）
   * スクリーンリーダーが読み上げる内容
   */
  alt: string

  /**
   * 画像の幅（ピクセル）
   * fill=trueの場合は不要
   */
  width?: number

  /**
   * 画像の高さ（ピクセル）
   * fill=trueの場合は不要
   */
  height?: number

  /**
   * 親要素を埋めるモード
   * trueの場合、親要素がposition: relativeである必要がある
   * @default false
   */
  fill?: boolean

  /**
   * レスポンシブサイズ指定
   * ブラウザに適切な画像サイズを選択させるためのヒント
   * 例: "(max-width: 768px) 100vw, 50vw"
   * @default '100vw'
   */
  sizes?: string

  /**
   * 優先読み込みフラグ
   * LCP（Largest Contentful Paint）画像に使用
   * trueの場合、遅延読み込みを無効化して即座に読み込む
   * @default false
   */
  priority?: boolean

  /**
   * 追加のCSSクラス
   */
  className?: string

  /**
   * オブジェクトフィットの指定
   * - 'cover': アスペクト比を維持して領域を埋める（はみ出し部分は切り取り）
   * - 'contain': アスペクト比を維持して全体が収まるように表示
   * - 'fill': 領域に合わせて伸縮（アスペクト比は変わる可能性）
   * - 'none': 元のサイズで表示
   * @default 'cover'
   */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none'

  /**
   * クリックイベントハンドラ
   * 画像をクリック可能にする場合に使用
   */
  onClick?: (e: React.MouseEvent) => void
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 最適化画像コンポーネント
 *
 * Next.js Imageをラップし、ローディング状態とエラー状態の
 * ハンドリングを追加したコンポーネント。
 *
 * @param props - コンポーネントプロパティ
 * @returns 最適化された画像要素
 *
 * @example
 * ```tsx
 * // 固定サイズ
 * <OptimizedImage
 *   src="/avatar.jpg"
 *   alt="プロフィール画像"
 *   width={64}
 *   height={64}
 *   className="rounded-full"
 * />
 *
 * // 親要素に合わせる（fill mode）
 * <div className="relative h-48">
 *   <OptimizedImage
 *     src="/banner.jpg"
 *     alt="ヘッダー画像"
 *     fill
 *     objectFit="cover"
 *   />
 * </div>
 * ```
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  sizes = '100vw',
  priority = false,
  className = '',
  objectFit = 'cover',
  onClick,
}: OptimizedImageProps) {
  // ============================================================
  // ステート管理
  // ============================================================

  /**
   * 画像のローディング状態を管理
   * true: 読み込み中（プレースホルダー表示）
   * false: 読み込み完了（画像表示）
   */
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 画像読み込みエラー状態を管理
   * true: エラー発生（フォールバック表示）
   * false: 正常
   */
  const [hasError, setHasError] = useState(false)

  // ============================================================
  // エラー時のフォールバック表示
  // ============================================================

  // 画像の読み込みに失敗した場合、アイコン付きのプレースホルダーを表示
  if (hasError) {
    return (
      <div
        className={`bg-muted flex items-center justify-center ${className}`}
        style={fill ? { position: 'absolute', inset: 0 } : { width, height }}
      >
        {/* 壊れた画像を示すアイコン */}
        <svg
          className="w-8 h-8 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    )
  }

  // ============================================================
  // objectFitクラスのマッピング
  // ============================================================

  /**
   * objectFitプロパティをTailwind CSSクラスに変換
   */
  const objectFitClass = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none',
  }[objectFit]

  // ============================================================
  // レンダリング
  // ============================================================

  return (
    <div className={`relative ${fill ? '' : 'inline-block'}`} style={fill ? undefined : { width, height }}>
      {/* ローディングプレースホルダー - 読み込み中に表示 */}
      {isLoading && (
        <div
          className="absolute inset-0 bg-muted animate-pulse"
          style={{ zIndex: 1 }}
        />
      )}

      {/* メイン画像 */}
      <Image
        src={src}
        alt={alt}
        // fill=trueの場合、width/heightは指定しない
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        sizes={sizes}
        priority={priority}
        // クラス: objectFit + カスタムクラス + ローディング状態に応じた透明度
        className={`${objectFitClass} ${className} transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        // 読み込み完了時にローディング状態を解除
        onLoad={() => setIsLoading(false)}
        // エラー時にローディング解除とエラー状態設定
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
        onClick={onClick}
        // priorityが設定されていない場合は遅延読み込み
        loading={priority ? undefined : 'lazy'}
      />
    </div>
  )
}
