/**
 * 画像・動画ギャラリーコンポーネント
 *
 * このファイルは、投稿に添付された画像や動画を表示するギャラリーを提供します。
 * PostCardや投稿詳細ページで使用されます。
 *
 * ## 機能概要
 * - 1〜4枚の画像・動画のグリッド表示
 * - 画像クリックでモーダル拡大表示
 * - 複数画像の場合は前後ナビゲーション
 * - 動画の再生コントロール
 * - 遅延読み込みと最適化
 *
 * ## レイアウト
 * - 1枚: 全幅表示
 * - 2枚: 2列グリッド
 * - 3枚: 2列グリッド（1枚目が縦に長い）
 * - 4枚: 2x2グリッド
 *
 * @module components/post/ImageGallery
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React useState Hook
 * モーダルの選択状態と画像読み込み状態の管理
 */
import { useState } from 'react'

/**
 * Next.js Imageコンポーネント
 * 画像の最適化（WebP変換、リサイズ）と遅延読み込みを提供
 */
import Image from 'next/image'

// ============================================================
// 型定義
// ============================================================

/**
 * メディア型
 *
 * 投稿に添付された画像・動画の情報
 *
 * @property id - メディアの一意識別子
 * @property url - メディアのURL
 * @property type - メディアタイプ（'image' または 'video'）
 * @property sortOrder - 表示順序（0から開始）
 */
type Media = {
  id: string
  url: string
  type: string
  sortOrder: number
}

/**
 * ImageGalleryコンポーネントのProps型
 *
 * @property images - 表示するメディアの配列
 * @property onMediaClick - メディアクリック時のカスタムハンドラ（省略時はモーダル表示）
 */
type ImageGalleryProps = {
  images: Media[]
  onMediaClick?: (media: Media) => void
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * バツ印アイコン
 * モーダルの閉じるボタンに使用
 *
 * @param className - 追加のCSSクラス
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * 拡大アイコン
 * 動画の拡大ボタンに使用
 *
 * @param className - 追加のCSSクラス
 */
function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

/**
 * 左矢印アイコン
 * モーダル内の前へボタンに使用
 *
 * @param className - 追加のCSSクラス
 */
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

/**
 * 右矢印アイコン
 * モーダル内の次へボタンに使用
 *
 * @param className - 追加のCSSクラス
 */
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

// ============================================================
// サブコンポーネント
// ============================================================

/**
 * 最適化されたメディアアイテムコンポーネント
 *
 * Next.js Imageを使用して遅延読み込みとサイズ最適化を実現。
 * 読み込み中はスケルトン（プレースホルダー）を表示。
 *
 * @param media - 表示するメディア
 * @param priority - 優先読み込みフラグ（LCP画像に使用）
 */
function MediaItem({ media, priority = false }: { media: Media; priority?: boolean }) {
  /**
   * 画像読み込み状態
   * trueの間はスケルトンを表示
   */
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 動画の場合
   * controlsを付与してユーザーが操作可能に
   */
  if (media.type === 'video') {
    return (
      <video
        src={media.url}
        controls
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
        onClick={(e) => {
          /**
           * クリックイベントの伝播を停止
           * 親要素のクリックハンドラが発火しないように
           */
          e.stopPropagation()
          e.preventDefault()
        }}
      />
    )
  }

  /**
   * 画像の場合
   * Next.js Imageで最適化
   */
  return (
    <>
      {/* ローディング中のスケルトン */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <Image
        src={media.url}
        alt=""
        fill
        /**
         * sizes属性
         * レスポンシブに応じた適切なサイズの画像を取得
         */
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px"
        className={`object-cover hover:opacity-90 transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={() => setIsLoading(false)}
        /**
         * priorityがtrueの場合は即座に読み込み
         * それ以外は遅延読み込み
         */
        priority={priority}
        loading={priority ? undefined : 'lazy'}
      />
    </>
  )
}

/**
 * モーダル内のメディア表示コンポーネント
 *
 * 拡大表示用の画像・動画表示。
 * 動画の場合は自動再生。
 *
 * @param media - 表示するメディア
 * @param onClick - クリックイベントハンドラ
 */
function ModalMediaItem({ media, onClick }: { media: Media; onClick: (e: React.MouseEvent) => void }) {
  /**
   * 動画の場合
   * 自動再生でモーダル表示
   */
  if (media.type === 'video') {
    return (
      <video
        src={media.url}
        controls
        className="max-w-full max-h-full"
        onClick={(e) => {
          /**
           * クリックイベントの伝播を停止
           * モーダルが閉じないように
           */
          e.stopPropagation()
        }}
        autoPlay
      />
    )
  }

  /**
   * 画像の場合
   * 画面いっぱいに表示
   */
  return (
    <div className="relative max-w-full max-h-full" style={{ width: '100%', height: '100%' }}>
      <Image
        src={media.url}
        alt=""
        fill
        sizes="100vw"
        className="object-contain"
        onClick={onClick}
        priority
      />
    </div>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 画像・動画ギャラリーコンポーネント
 *
 * ## 機能
 * - 1〜4枚のメディアをグリッド表示
 * - sortOrderでソートして表示
 * - クリックでモーダル拡大表示
 * - 複数枚の場合は前後ナビゲーション
 *
 * ## レイアウトルール
 * - 1枚: 全幅表示（アスペクト比16:9）
 * - 2枚: 2列グリッド
 * - 3枚: 2列グリッド、1枚目が2行分の高さ
 * - 4枚: 2x2グリッド
 *
 * ## モーダル機能
 * - 背景クリックで閉じる
 * - 前後ボタンでナビゲーション
 * - ナビゲーションドットで直接選択
 *
 * @param images - 表示するメディアの配列
 * @param onMediaClick - カスタムクリックハンドラ（省略時はモーダル表示）
 *
 * @example
 * ```tsx
 * <ImageGallery
 *   images={[
 *     { id: '1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
 *     { id: '2', url: '/video.mp4', type: 'video', sortOrder: 1 },
 *   ]}
 *   onMediaClick={(media) => console.log('Clicked:', media.id)}
 * />
 * ```
 */
export function ImageGallery({ images, onMediaClick }: ImageGalleryProps) {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * モーダルで選択されているメディアのインデックス
   * nullの場合はモーダルを表示しない
   */
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  /**
   * sortOrderでソートしたメディア配列
   */
  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder)

  // ------------------------------------------------------------
  // 計算値
  // ------------------------------------------------------------

  /**
   * グリッドのCSSクラス
   * 画像数に応じて異なるレイアウトを適用
   */
  const gridClass = images.length === 1
    ? ''  // 1枚: グリッドなし（全幅）
    : images.length === 2
      ? 'grid grid-cols-2 gap-1'  // 2枚: 2列
      : images.length === 3
        ? 'grid grid-cols-2 gap-1'  // 3枚: 2列（1枚目は2行分）
        : 'grid grid-cols-2 gap-1'  // 4枚: 2列（2x2）

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * 前へボタンクリックハンドラ
   *
   * @param e - クリックイベント
   */
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  /**
   * 次へボタンクリックハンドラ
   *
   * @param e - クリックイベント
   */
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex < sortedImages.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <>
      {/* メディアグリッド */}
      <div className={`${gridClass} rounded-lg overflow-hidden`}>
        {sortedImages.map((media, index) => {
          /**
           * メディアクリックハンドラ
           * onMediaClickが指定されていればそれを呼び出し、
           * なければモーダルを開く
           */
          const handleClick = (e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            if (onMediaClick) {
              onMediaClick(media)
            } else {
              setSelectedIndex(index)
            }
          }

          /**
           * 動画の場合
           * divで囲んで拡大ボタンを追加
           */
          if (media.type === 'video') {
            return (
              <div
                key={media.id}
                className={`relative block w-full bg-muted overflow-hidden ${
                  images.length === 3 && index === 0 ? 'row-span-2' : ''
                }`}
                style={{
                  /**
                   * アスペクト比
                   * 3枚で1枚目の場合は正方形、それ以外は16:9
                   */
                  paddingBottom: images.length === 3 && index === 0 ? '100%' : '56.25%',
                }}
              >
                <MediaItem media={media} priority={index === 0} />
                {/* 拡大ボタン */}
                <button
                  onClick={handleClick}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors z-10"
                  title="拡大表示"
                >
                  <ExpandIcon className="w-4 h-4 text-white" />
                </button>
              </div>
            )
          }

          /**
           * 画像の場合
           * ボタンとして全体がクリック可能
           */
          return (
            <button
              key={media.id}
              onClick={handleClick}
              className={`relative block w-full bg-muted overflow-hidden ${
                images.length === 3 && index === 0 ? 'row-span-2' : ''
              }`}
              style={{
                paddingBottom: images.length === 3 && index === 0 ? '100%' : '56.25%',
              }}
            >
              <MediaItem media={media} priority={index === 0} />
            </button>
          )
        })}
      </div>

      {/* モーダル（画像・動画の拡大表示） */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          {/* 閉じるボタン */}
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 z-10"
          >
            <XIcon className="w-6 h-6 text-white" />
          </button>

          {/* 前へボタン（複数枚で2枚目以降の場合のみ表示） */}
          {images.length > 1 && selectedIndex > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 z-10"
            >
              <ChevronLeftIcon className="w-6 h-6 text-white" />
            </button>
          )}

          {/* 次へボタン（複数枚で最後以外の場合のみ表示） */}
          {images.length > 1 && selectedIndex < sortedImages.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 z-10"
            >
              <ChevronRightIcon className="w-6 h-6 text-white" />
            </button>
          )}

          {/* メディア表示エリア */}
          <div className="flex items-center justify-center max-w-4xl max-h-[90vh] w-full h-full p-4">
            <ModalMediaItem
              media={sortedImages[selectedIndex]}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* ナビゲーションドット（複数枚の場合のみ表示） */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {sortedImages.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedIndex(index)
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === selectedIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
