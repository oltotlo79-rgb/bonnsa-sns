'use client'

import { useState } from 'react'

type ImageGalleryProps = {
  images: {
    id: string
    url: string
    type: string
    sortOrder: number
  }[]
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

export function ImageGallery({ images }: ImageGalleryProps) {
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

  return (
    <>
      <div className={`${gridClass} rounded-lg overflow-hidden`}>
        {sortedImages.map((image, index) => (
          <button
            key={image.id}
            onClick={() => setSelectedIndex(index)}
            className={`relative block w-full bg-muted overflow-hidden ${
              images.length === 3 && index === 0 ? 'row-span-2' : ''
            }`}
            style={{
              paddingBottom: images.length === 3 && index === 0 ? '100%' : '56.25%', // 1:1 or 16:9
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover hover:opacity-90 transition-opacity"
            />
          </button>
        ))}
      </div>

      {/* モーダル */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
          >
            <XIcon className="w-6 h-6 text-white" />
          </button>

          <div className="flex items-center justify-center max-w-4xl max-h-[90vh] w-full h-full p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sortedImages[selectedIndex].url}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* ナビゲーション */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {sortedImages.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedIndex(index)
                  }}
                  className={`w-2 h-2 rounded-full ${
                    index === selectedIndex ? 'bg-white' : 'bg-white/50'
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
