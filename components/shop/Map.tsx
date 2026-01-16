'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'

// カスタムピンアイコン（盆栽園用）
const shopPinIcon = L.divIcon({
  className: 'custom-pin-icon',
  html: `
    <svg width="32" height="44" viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z" fill="#16a34a"/>
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z" fill="url(#paint0_linear)" fill-opacity="0.3"/>
      <circle cx="16" cy="14" r="7" fill="white"/>
      <path d="M16 10c-1.5 0-2.5 1-2.5 2 0 .5.2 1 .5 1.3-.8.4-1.5 1.2-1.5 2.2 0 1.4 1.3 2.5 3.5 2.5s3.5-1.1 3.5-2.5c0-1-.7-1.8-1.5-2.2.3-.3.5-.8.5-1.3 0-1-1-2-2.5-2z" fill="#16a34a"/>
      <defs>
        <linearGradient id="paint0_linear" x1="16" y1="0" x2="16" y2="44" gradientUnits="userSpaceOnUse">
          <stop stop-color="white"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  `,
  iconSize: [32, 44],
  iconAnchor: [16, 44],
  popupAnchor: [0, -44],
})

export interface Shop {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  address: string
  averageRating: number | null
  reviewCount: number
}

interface MapProps {
  shops: Shop[]
  center?: [number, number]
  zoom?: number
  onShopClick?: (shopId: string) => void
}

// 現在地ボタンコンポーネント
function LocationButton() {
  const map = useMap()
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    setLoading(true)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          map.setView([latitude, longitude], 14)
          setLoading(false)
        },
        () => {
          alert('現在地を取得できませんでした')
          setLoading(false)
        }
      )
    } else {
      alert('お使いのブラウザは位置情報に対応していません')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="absolute bottom-4 right-4 z-[1000] bg-white p-2 rounded-lg shadow-md hover:bg-gray-100 disabled:opacity-50"
      title="現在地に移動"
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      )}
    </button>
  )
}

// 星評価表示
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const stars = []
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`text-yellow-400 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )
    } else if (i === fullStars && hasHalfStar) {
      stars.push(
        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`text-yellow-400 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}>
          <defs>
            <linearGradient id="halfStar">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="#D1D5DB" />
            </linearGradient>
          </defs>
          <path fill="url(#halfStar)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )
    } else {
      stars.push(
        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`text-gray-300 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )
    }
  }

  return <div className="flex items-center gap-0.5">{stars}</div>
}

export function Map({ shops, center = [35.6762, 139.6503], zoom = 6 }: MapProps) {
  const [isMounted, setIsMounted] = useState(false)

  // クライアントサイドでのみ地図をレンダリング（Leafletはサーバーサイドで動作しない）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="h-[500px] w-full bg-muted flex items-center justify-center rounded-lg">
        <div className="text-muted-foreground">地図を読み込み中...</div>
      </div>
    )
  }

  const validShops = shops.filter(
    (shop) => shop.latitude !== null && shop.longitude !== null
  )

  return (
    <div className="relative h-[500px] w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validShops.map((shop) => (
          <Marker
            key={shop.id}
            position={[shop.latitude!, shop.longitude!]}
            icon={shopPinIcon}
          >
            <Popup>
              <div className="min-w-[180px]">
                <h3 className="font-bold text-sm mb-1">{shop.name}</h3>
                <p className="text-xs text-gray-600 mb-2">{shop.address}</p>
                {shop.averageRating !== null && (
                  <div className="flex items-center gap-1 mb-2">
                    <StarRating rating={shop.averageRating} />
                    <span className="text-xs text-gray-500">
                      ({shop.reviewCount}件)
                    </span>
                  </div>
                )}
                <Link
                  href={`/shops/${shop.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  詳細を見る →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
        <LocationButton />
      </MapContainer>
    </div>
  )
}
