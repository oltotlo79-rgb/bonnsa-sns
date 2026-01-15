'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createShop, updateShop, geocodeAddress } from '@/lib/actions/shop'
import { BusinessHoursInput } from '@/components/shop/BusinessHoursInput'

interface Genre {
  id: string
  name: string
  category: string
}

interface ShopFormProps {
  genres: Genre[]
  initialData?: {
    id: string
    name: string
    address: string
    latitude: number | null
    longitude: number | null
    phone: string | null
    website: string | null
    businessHours: string | null
    closedDays: string | null
    genres: Genre[]
  }
  mode: 'create' | 'edit'
}

export function ShopForm({ genres, initialData, mode }: ShopFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  const [name, setName] = useState(initialData?.name || '')
  const [address, setAddress] = useState(initialData?.address || '')
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude || null)
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude || null)
  const [phone, setPhone] = useState(initialData?.phone || '')
  const [website, setWebsite] = useState(initialData?.website || '')
  const [businessHours, setBusinessHours] = useState(initialData?.businessHours || '')
  const [closedDays, setClosedDays] = useState(initialData?.closedDays || '')
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(
    initialData?.genres.map((g) => g.id) || []
  )

  // ジャンルをカテゴリごとにグループ化
  const groupedGenres = genres.reduce((acc, genre) => {
    if (!acc[genre.category]) {
      acc[genre.category] = []
    }
    acc[genre.category].push(genre)
    return acc
  }, {} as Record<string, Genre[]>)

  const handleGeocode = async () => {
    if (!address.trim()) {
      setError('住所を入力してください')
      return
    }

    setGeocoding(true)
    setError(null)

    const result = await geocodeAddress(address)

    if (result.error) {
      setError(result.error)
    } else if (result.latitude && result.longitude) {
      setLatitude(result.latitude)
      setLongitude(result.longitude)
    }

    setGeocoding(false)
  }

  const handleGenreToggle = (genreId: string) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId]
    )
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData()
    formData.append('name', name)
    formData.append('address', address)
    if (latitude !== null) formData.append('latitude', latitude.toString())
    if (longitude !== null) formData.append('longitude', longitude.toString())
    if (phone) formData.append('phone', phone)
    if (website) formData.append('website', website)
    if (businessHours) formData.append('businessHours', businessHours)
    if (closedDays) formData.append('closedDays', closedDays)
    selectedGenreIds.forEach((id) => formData.append('genreIds', id))

    startTransition(async () => {
      const result = mode === 'create'
        ? await createShop(formData)
        : await updateShop(initialData!.id, formData)

      if (result.error) {
        setError(result.error)
        if ('existingId' in result && result.existingId) {
          // 既存の盆栽園へのリンクを表示
          setError(`${result.error}。既存の盆栽園を確認しますか？`)
        }
      } else if ('shopId' in result && result.shopId) {
        router.push(`/shops/${result.shopId}`)
      } else {
        router.push(`/shops/${initialData?.id}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* 名称 */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          名称 <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: ○○盆栽園"
        />
      </div>

      {/* 住所 */}
      <div className="space-y-2">
        <label htmlFor="address" className="text-sm font-medium">
          住所 <span className="text-destructive">*</span>
        </label>
        <div className="flex gap-2">
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            className="flex-1 px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="例: 東京都○○区..."
          />
          <button
            type="button"
            onClick={handleGeocode}
            disabled={geocoding || !address.trim()}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50"
          >
            {geocoding ? '検索中...' : '位置取得'}
          </button>
        </div>
        {latitude !== null && longitude !== null && (
          <p className="text-xs text-muted-foreground">
            緯度: {latitude.toFixed(6)}, 経度: {longitude.toFixed(6)}
          </p>
        )}
      </div>

      {/* 電話番号 */}
      <div className="space-y-2">
        <label htmlFor="phone" className="text-sm font-medium">
          電話番号
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: 03-1234-5678"
        />
      </div>

      {/* ウェブサイト */}
      <div className="space-y-2">
        <label htmlFor="website" className="text-sm font-medium">
          ウェブサイト
        </label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: https://example.com"
        />
      </div>

      {/* 営業時間 */}
      <BusinessHoursInput
        value={businessHours}
        onChange={setBusinessHours}
        disabled={isPending}
      />

      {/* 定休日 */}
      <div className="space-y-2">
        <label htmlFor="closedDays" className="text-sm font-medium">
          定休日
        </label>
        <input
          id="closedDays"
          type="text"
          value={closedDays}
          onChange={(e) => setClosedDays(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: 水曜日、年末年始"
        />
      </div>

      {/* 取り扱いジャンル */}
      <div className="space-y-3">
        <label className="text-sm font-medium">取り扱いジャンル</label>
        <div className="space-y-4">
          {Object.entries(groupedGenres).map(([category, categoryGenres]) => (
            <div key={category}>
              <p className="text-xs text-muted-foreground mb-2">{category}</p>
              <div className="flex flex-wrap gap-2">
                {categoryGenres.map((genre) => (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => handleGenreToggle(genre.id)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      selectedGenreIds.includes(genre.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 送信ボタン */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending
            ? mode === 'create' ? '登録中...' : '更新中...'
            : mode === 'create' ? '登録する' : '更新する'
          }
        </button>
      </div>
    </form>
  )
}
