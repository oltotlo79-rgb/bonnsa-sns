'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createShop, updateShop, searchAddressSuggestions } from '@/lib/actions/shop'
import { BusinessHoursInput } from '@/components/shop/BusinessHoursInput'

// 住所候補の型
interface AddressSuggestion {
  latitude: number
  longitude: number
  displayName: string
  formattedAddress: string
}

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

  // 住所候補関連の状態
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchingAddress, setSearchingAddress] = useState(false)

  // 確認ダイアログの状態
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  // ジャンルをカテゴリごとにグループ化
  const groupedGenres = genres.reduce((acc, genre) => {
    if (!acc[genre.category]) {
      acc[genre.category] = []
    }
    acc[genre.category].push(genre)
    return acc
  }, {} as Record<string, Genre[]>)

  // 住所入力時に候補を検索
  const handleAddressChange = useCallback(async (value: string) => {
    setAddress(value)
    // 住所が変更されたら位置情報をリセット
    setLatitude(null)
    setLongitude(null)

    if (value.length >= 2) {
      setSearchingAddress(true)
      const result = await searchAddressSuggestions(value)
      setSuggestions(result.suggestions)
      setShowSuggestions(result.suggestions.length > 0)
      setSearchingAddress(false)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [])

  // 住所候補を選択（位置情報のみ取得、入力した住所は保持）
  const handleSelectSuggestion = (suggestion: AddressSuggestion, keepOriginalAddress = false) => {
    if (!keepOriginalAddress) {
      setAddress(suggestion.formattedAddress)
    }
    setLatitude(suggestion.latitude)
    setLongitude(suggestion.longitude)
    setSuggestions([])
    setShowSuggestions(false)
    setError(null)
  }

  const handleGeocode = async () => {
    if (!address.trim()) {
      setError('住所を入力してください')
      return
    }

    setGeocoding(true)
    setError(null)

    const result = await searchAddressSuggestions(address)

    if (result.suggestions.length === 0) {
      setError('住所が見つかりませんでした。住所の表記を確認してください（例: 東京都渋谷区...）')
    } else if (result.suggestions.length === 1) {
      // 1件だけの場合は位置情報のみ取得（入力した住所は保持）
      const suggestion = result.suggestions[0]
      setLatitude(suggestion.latitude)
      setLongitude(suggestion.longitude)
      setSuggestions([])
      setShowSuggestions(false)
    } else {
      // 複数候補がある場合は表示
      setSuggestions(result.suggestions)
      setShowSuggestions(true)
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

  // 実際の送信処理
  const executeSubmit = () => {
    startTransition(async () => {
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

      const result = mode === 'create'
        ? await createShop(formData)
        : await updateShop(initialData!.id, formData)

      if (result.error) {
        setError(result.error)
        if ('existingId' in result && result.existingId) {
          setError(`${result.error}。既存の盆栽園を確認しますか？`)
        }
      } else if ('shopId' in result && result.shopId) {
        router.push(`/shops/${result.shopId}`)
      } else {
        router.push(`/shops/${initialData?.id}`)
      }
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // 位置取得がされていない場合は確認ダイアログを表示
    if (latitude === null || longitude === null) {
      setShowConfirmDialog(true)
      setPendingSubmit(true)
      return
    }

    executeSubmit()
  }

  // 確認ダイアログで「登録する」を選択した場合
  const handleConfirmSubmit = () => {
    setShowConfirmDialog(false)
    setPendingSubmit(false)
    executeSubmit()
  }

  // 確認ダイアログで「キャンセル」を選択した場合
  const handleCancelSubmit = () => {
    setShowConfirmDialog(false)
    setPendingSubmit(false)
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
          <div className="relative flex-1">
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              required
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="例: 東京都○○区..."
              autoComplete="off"
            />
            {searchingAddress && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleGeocode}
            disabled={geocoding || !address.trim()}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50 whitespace-nowrap"
          >
            {geocoding ? '検索中...' : '位置取得'}
          </button>
        </div>

        {/* 住所候補リスト */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="border rounded-lg bg-card shadow-lg overflow-hidden">
            <p className="px-3 py-2 text-xs text-muted-foreground bg-muted border-b">
              近い場所を選択してください（入力した住所はそのまま保存されます）
            </p>
            <ul className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="border-b last:border-b-0">
                  <div className="px-3 py-2 hover:bg-muted transition-colors">
                    <p className="text-sm mb-1">{suggestion.formattedAddress}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion, true)}
                        className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        この位置を使用
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion, false)}
                        className="text-xs px-2 py-1 border rounded hover:bg-muted"
                      >
                        住所も置換
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {latitude !== null && longitude !== null && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            位置情報を取得しました（緯度: {latitude.toFixed(6)}, 経度: {longitude.toFixed(6)}）
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
          disabled={isPending || pendingSubmit}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending
            ? mode === 'create' ? '登録中...' : '更新中...'
            : mode === 'create' ? '登録する' : '更新する'
          }
        </button>
      </div>

      {/* 位置取得未実行時の確認ダイアログ */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-yellow-600">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">位置情報が取得されていません</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  位置取得をしていないと、盆栽園マップに位置がマークされません。
                  このまま登録してもよろしいですか？
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelSubmit}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted"
              >
                戻って位置取得
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                このまま登録
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
