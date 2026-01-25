'use client'

import { useState } from 'react'
import Image from 'next/image'

type Media = {
  id: string
  url: string
  type: string
  sortOrder: number
}

type ImageGalleryProps = {
  images: Media[]
  onMediaClick?: (media: Media) => void
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

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

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

/**
 * 最適化された画像アイテム
 * Next.js Imageを使用して遅延読み込みとサイズ最適化を実現
 */
function MediaItem({ media, priority = false }: { media: Media; priority?: boolean }) {
  const [isLoading, setIsLoading] = useState(true)

  if (media.type === 'video') {
    return (
      <video
        src={media.url}
        controls
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
      />
    )
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <Image
        src={media.url}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px"
        className={`object-cover hover:opacity-90 transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={() => setIsLoading(false)}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
      />
    </>
  )
}

/**
 * モーダル内の画像/動画表示
 */
function ModalMediaItem({ media, onClick }: { media: Media; onClick: (e: React.MouseEvent) => void }) {
  if (media.type === 'video') {
    return (
      <video
        src={media.url}
        controls
        className="max-w-full max-h-full"
        onClick={(e) => {
          e.stopPropagation()
        }}
        autoPlay
      />
    )
  }

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

export function ImageGallery({ images, onMediaClick }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder)

  // 1枚の場合は全幅、複数の場合はグリッド
  const gridClass = images.length === 1
    ? ''
    : images.length === 2
      ? 'grid grid-cols-2 gap-1'
      : images.length === 3
        ? 'grid grid-cols-2 gap-1'
        : 'grid grid-cols-2 gap-1'

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex < sortedImages.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  return (
    <>
      <div className={`${gridClass} rounded-lg overflow-hidden`}>
        {sortedImages.map((media, index) => {
          const handleClick = (e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            if (onMediaClick) {
              onMediaClick(media)
            } else {
              setSelectedIndex(index)
            }
          }

          // 動画の場合はdivを使用（video要素にcontrolsがあるため）
          if (media.type === 'video') {
            return (
              <div
                key={media.id}
                className={`relative block w-full bg-muted overflow-hidden ${
                  images.length === 3 && index === 0 ? 'row-span-2' : ''
                }`}
                style={{
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

          // 画像の場合はボタンを使用
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

      {/* モーダル（画像・動画） */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 z-10"
          >
            <XIcon className="w-6 h-6 text-white" />
          </button>

          {/* 前へボタン */}
          {images.length > 1 && selectedIndex > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 z-10"
            >
              <ChevronLeftIcon className="w-6 h-6 text-white" />
            </button>
          )}

          {/* 次へボタン */}
          {images.length > 1 && selectedIndex < sortedImages.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 z-10"
            >
              <ChevronRightIcon className="w-6 h-6 text-white" />
            </button>
          )}

          <div className="flex items-center justify-center max-w-4xl max-h-[90vh] w-full h-full p-4">
            <ModalMediaItem
              media={sortedImages[selectedIndex]}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* ナビゲーションドット */}
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
