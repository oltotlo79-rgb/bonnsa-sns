'use client'

import dynamic from 'next/dynamic'
import type { Shop } from './Map'

// SSR無効化（Leafletはクライアントサイドのみ）
const Map = dynamic(
  () => import('@/components/shop/Map').then((mod) => mod.Map),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full bg-muted flex items-center justify-center rounded-lg">
        <div className="text-muted-foreground">地図を読み込み中...</div>
      </div>
    ),
  }
)

interface MapWrapperProps {
  shops: Shop[]
  center?: [number, number]
  zoom?: number
  height?: string
}

export function MapWrapper({ shops, center, zoom, height = '500px' }: MapWrapperProps) {
  return (
    <div style={{ height }}>
      <Map shops={shops} center={center} zoom={zoom} />
    </div>
  )
}

// 詳細ページ用の小さいマップ
export function MapWrapperSmall({ shops, center, zoom }: Omit<MapWrapperProps, 'height'>) {
  return (
    <div className="h-[300px]">
      <Map shops={shops} center={center} zoom={zoom} />
    </div>
  )
}
