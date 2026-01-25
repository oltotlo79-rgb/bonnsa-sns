/**
 * @file ShopForm.tsx
 * @description 盆栽園の新規登録・編集フォームコンポーネント
 *
 * 機能概要:
 * - 盆栽園の新規登録と既存データの編集に対応
 * - 住所入力時のリアルタイム候補検索（ジオコーディング）
 * - 位置情報（緯度・経度）の自動取得
 * - 取り扱いジャンルの複数選択
 * - 営業時間のアナログ時計による直感的な入力
 * - 位置情報未取得時の確認ダイアログ表示
 * - 盆栽園の削除機能（編集モード時のみ）
 *
 * 使用例:
 * ```tsx
 * // 新規登録
 * <ShopForm genres={genres} mode="create" />
 *
 * // 編集
 * <ShopForm genres={genres} initialData={shopData} mode="edit" />
 * ```
 */
'use client'

// React hooks
// useState: フォームの各入力値やダイアログ表示状態を管理
// useTransition: フォーム送信時の非同期処理状態を管理
// useCallback: 住所検索のデバウンス処理を最適化
import { useState, useTransition, useCallback } from 'react'

// Next.jsのルーターフック
// 送信完了後のページ遷移に使用
import { useRouter } from 'next/navigation'

// Server Actions - 盆栽園関連の操作
// createShop: 新規盆栽園の登録
// updateShop: 既存盆栽園の更新
// deleteShop: 盆栽園の削除
// searchAddressSuggestions: 住所候補の検索（ジオコーディング）
import { createShop, updateShop, deleteShop, searchAddressSuggestions } from '@/lib/actions/shop'

// 営業時間入力コンポーネント
// アナログ時計UIで直感的に営業時間を設定できる
import { BusinessHoursInput } from '@/components/shop/BusinessHoursInput'

/**
 * 住所候補の型定義
 * ジオコーディングAPIから返される住所候補情報
 */
interface AddressSuggestion {
  /** 緯度 */
  latitude: number
  /** 経度 */
  longitude: number
  /** 表示用の住所名（検索結果として表示） */
  displayName: string
  /** フォーマット済み住所（選択時にフォームに設定） */
  formattedAddress: string
}

/**
 * ジャンル情報の型定義
 */
interface Genre {
  /** ジャンルの一意識別子 */
  id: string
  /** ジャンル名（例: 松柏類） */
  name: string
  /** ジャンルカテゴリ（例: 樹種） */
  category: string
}

/**
 * ShopFormコンポーネントのプロパティ定義
 */
interface ShopFormProps {
  /** 選択可能なジャンルの配列 */
  genres: Genre[]
  /** 編集時の初期データ（新規登録時はundefined） */
  initialData?: {
    /** 盆栽園ID */
    id: string
    /** 盆栽園名 */
    name: string
    /** 住所 */
    address: string
    /** 緯度 */
    latitude: number | null
    /** 経度 */
    longitude: number | null
    /** 電話番号 */
    phone: string | null
    /** ウェブサイトURL */
    website: string | null
    /** 営業時間 */
    businessHours: string | null
    /** 定休日 */
    closedDays: string | null
    /** 現在設定されているジャンル */
    genres: Genre[]
  }
  /** フォームモード: 'create'（新規登録）または 'edit'（編集） */
  mode: 'create' | 'edit'
}

/**
 * 盆栽園登録・編集フォームコンポーネント
 *
 * @param genres - 選択可能なジャンル一覧
 * @param initialData - 編集時の初期データ
 * @param mode - フォームモード（create/edit）
 */
export function ShopForm({ genres, initialData, mode }: ShopFormProps) {
  // ルーターインスタンス（ページ遷移用）
  const router = useRouter()

  // フォーム送信中の状態を管理するトランジション
  // isPending: 送信処理中かどうか
  // startTransition: 非同期処理を開始する関数
  const [isPending, startTransition] = useTransition()

  // エラーメッセージの状態管理
  const [error, setError] = useState<string | null>(null)

  // ジオコーディング処理中の状態
  const [geocoding, setGeocoding] = useState(false)

  // --- フォーム入力値の状態管理 ---

  // 盆栽園名（必須）
  const [name, setName] = useState(initialData?.name || '')

  // 住所（必須）
  const [address, setAddress] = useState(initialData?.address || '')

  // 緯度（ジオコーディングで自動取得）
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude || null)

  // 経度（ジオコーディングで自動取得）
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude || null)

  // 電話番号（任意）
  const [phone, setPhone] = useState(initialData?.phone || '')

  // ウェブサイトURL（任意）
  const [website, setWebsite] = useState(initialData?.website || '')

  // 営業時間（任意）
  const [businessHours, setBusinessHours] = useState(initialData?.businessHours || '')

  // 定休日（任意）
  const [closedDays, setClosedDays] = useState(initialData?.closedDays || '')

  // 選択されたジャンルIDの配列
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(
    initialData?.genres.map((g) => g.id) || []
  )

  // --- 住所候補検索関連の状態管理 ---

  // 住所候補の配列
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])

  // 住所候補ドロップダウンの表示状態
  const [showSuggestions, setShowSuggestions] = useState(false)

  // 住所検索中の状態
  const [searchingAddress, setSearchingAddress] = useState(false)

  // --- 確認ダイアログ関連の状態管理 ---

  // 位置情報未取得時の確認ダイアログ表示状態
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // 送信処理の保留状態（確認ダイアログ表示中）
  const [pendingSubmit, setPendingSubmit] = useState(false)

  // --- 削除ダイアログ関連の状態管理 ---

  // 削除確認ダイアログの表示状態
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // 削除処理中の状態
  const [isDeleting, setIsDeleting] = useState(false)

  /**
   * ジャンルをカテゴリごとにグループ化
   * 表示時にカテゴリ別に分類して表示するため
   */
  const groupedGenres = genres.reduce((acc, genre) => {
    if (!acc[genre.category]) {
      acc[genre.category] = []
    }
    acc[genre.category].push(genre)
    return acc
  }, {} as Record<string, Genre[]>)

  /**
   * 住所入力時のハンドラ
   * 2文字以上入力されたら住所候補を自動検索
   *
   * @param value - 入力された住所テキスト
   */
  const handleAddressChange = useCallback(async (value: string) => {
    setAddress(value)
    // 住所が変更されたら位置情報をリセット（再取得が必要）
    setLatitude(null)
    setLongitude(null)

    // 2文字以上で候補検索を開始
    if (value.length >= 2) {
      setSearchingAddress(true)
      const result = await searchAddressSuggestions(value)
      setSuggestions(result.suggestions)
      setShowSuggestions(result.suggestions.length > 0)
      setSearchingAddress(false)
    } else {
      // 2文字未満の場合は候補をクリア
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [])

  /**
   * 住所候補選択時のハンドラ
   * 選択された候補の位置情報を取得し、オプションで住所も更新
   *
   * @param suggestion - 選択された住所候補
   * @param keepOriginalAddress - trueの場合、入力済み住所を保持（位置情報のみ取得）
   */
  const handleSelectSuggestion = (suggestion: AddressSuggestion, keepOriginalAddress = false) => {
    // 住所を置換するかどうか
    if (!keepOriginalAddress) {
      setAddress(suggestion.formattedAddress)
    }
    // 位置情報を設定
    setLatitude(suggestion.latitude)
    setLongitude(suggestion.longitude)
    // 候補リストを閉じる
    setSuggestions([])
    setShowSuggestions(false)
    setError(null)
  }

  /**
   * 位置取得ボタンのハンドラ
   * 入力された住所からジオコーディングを実行
   */
  const handleGeocode = async () => {
    if (!address.trim()) {
      setError('住所を入力してください')
      return
    }

    setGeocoding(true)
    setError(null)

    const result = await searchAddressSuggestions(address)

    if (result.suggestions.length === 0) {
      // 候補が見つからない場合
      setError('住所が見つかりませんでした。住所の表記を確認してください（例: 東京都渋谷区...）')
    } else if (result.suggestions.length === 1) {
      // 1件だけの場合は位置情報のみ取得（入力した住所は保持）
      const suggestion = result.suggestions[0]
      setLatitude(suggestion.latitude)
      setLongitude(suggestion.longitude)
      setSuggestions([])
      setShowSuggestions(false)
    } else {
      // 複数候補がある場合はリストを表示して選択させる
      setSuggestions(result.suggestions)
      setShowSuggestions(true)
    }

    setGeocoding(false)
  }

  /**
   * ジャンル選択トグルのハンドラ
   * 選択済みの場合は解除、未選択の場合は追加
   *
   * @param genreId - トグルするジャンルのID
   */
  const handleGenreToggle = (genreId: string) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId]
    )
  }

  /**
   * 実際のフォーム送信処理
   * createShopまたはupdateShopを呼び出し、結果に応じてページ遷移
   */
  const executeSubmit = () => {
    startTransition(async () => {
      // FormDataオブジェクトを構築
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

      // モードに応じてcreateまたはupdateを実行
      const result = mode === 'create'
        ? await createShop(formData)
        : await updateShop(initialData!.id, formData)

      if (result.error) {
        setError(result.error)
        // 重複登録の場合、既存の盆栽園IDが返される
        if ('existingId' in result && result.existingId) {
          setError(`${result.error}。既存の盆栽園を確認しますか？`)
        }
      } else if ('shopId' in result && result.shopId) {
        // 新規登録成功 - 詳細ページへ遷移
        router.push(`/shops/${result.shopId}`)
      } else {
        // 更新成功 - 詳細ページへ遷移
        router.push(`/shops/${initialData?.id}`)
      }
    })
  }

  /**
   * フォーム送信ハンドラ
   * 位置情報未取得の場合は確認ダイアログを表示
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // 位置取得がされていない場合は確認ダイアログを表示
    if (latitude === null || longitude === null) {
      setShowConfirmDialog(true)
      setPendingSubmit(true)
      return
    }

    // 位置情報がある場合はそのまま送信
    executeSubmit()
  }

  /**
   * 確認ダイアログで「登録する」を選択した場合のハンドラ
   * 位置情報なしでも登録を続行
   */
  const handleConfirmSubmit = () => {
    setShowConfirmDialog(false)
    setPendingSubmit(false)
    executeSubmit()
  }

  /**
   * 確認ダイアログで「キャンセル」を選択した場合のハンドラ
   * フォームに戻って位置取得を促す
   */
  const handleCancelSubmit = () => {
    setShowConfirmDialog(false)
    setPendingSubmit(false)
  }

  /**
   * 盆栽園削除処理のハンドラ
   * 削除成功後は一覧ページへ遷移
   */
  const handleDelete = async () => {
    if (!initialData?.id) return

    setIsDeleting(true)
    const result = await deleteShop(initialData.id)

    if (result.error) {
      setError(result.error)
      setIsDeleting(false)
      setShowDeleteDialog(false)
    } else {
      // 削除成功 - 一覧ページへ遷移
      router.push('/shops')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* エラーメッセージ表示エリア */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* 名称入力フィールド（必須） */}
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

      {/* 住所入力フィールド（必須）+ 位置取得ボタン */}
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
            {/* 住所検索中のローディングスピナー */}
            {searchingAddress && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          {/* 位置取得ボタン */}
          <button
            type="button"
            onClick={handleGeocode}
            disabled={geocoding || !address.trim()}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50 whitespace-nowrap"
          >
            {geocoding ? '検索中...' : '位置取得'}
          </button>
        </div>

        {/* 住所候補リスト（ドロップダウン） */}
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
                      {/* 位置情報のみ取得（入力した住所を保持） */}
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion, true)}
                        className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      >
                        この位置を使用
                      </button>
                      {/* 住所も候補の内容に置換 */}
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

        {/* 位置情報取得成功時の表示 */}
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

      {/* 電話番号入力フィールド（任意） */}
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

      {/* ウェブサイト入力フィールド（任意） */}
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

      {/* 営業時間入力（アナログ時計コンポーネント使用） */}
      <BusinessHoursInput
        value={businessHours}
        onChange={setBusinessHours}
        disabled={isPending}
      />

      {/* 定休日入力フィールド（任意） */}
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

      {/* 取り扱いジャンル選択（カテゴリ別に表示） */}
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

      {/* 送信・キャンセルボタン */}
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

      {/* 削除ボタン（編集モードのみ表示） */}
      {mode === 'edit' && (
        <div className="pt-4 border-t">
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            className="w-full px-4 py-2 text-destructive border border-destructive rounded-lg hover:bg-destructive/10 disabled:opacity-50"
          >
            この盆栽園を削除
          </button>
        </div>
      )}

      {/* 位置取得未実行時の確認ダイアログ */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              {/* 警告アイコン */}
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

      {/* 削除確認ダイアログ */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              {/* 削除アイコン */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-destructive">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">盆栽園を削除</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  「{initialData?.name}」を削除しますか？この操作は取り消せません。
                  レビューも全て削除されます。
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
