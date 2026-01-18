/**
 * 盆栽園（ショップ）機能のServer Actions
 *
 * このファイルは、盆栽園情報の管理に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 盆栽園一覧の取得（検索・フィルター付き）
 * - 盆栽園詳細の取得
 * - 盆栽園の登録・更新・削除
 * - 住所からの緯度経度取得（ジオコーディング）
 * - 住所候補の検索（オートコンプリート）
 * - 盆栽園ジャンル一覧の取得
 *
 * ## 盆栽園とは
 * 盆栽を販売・展示している店舗や園の情報を
 * 地図上で共有する機能です。
 *
 * ## 使用API
 * - 国土地理院 住所検索API（ジオコーディング）
 *
 * @module lib/actions/shop
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * Next.jsのキャッシュ再検証関数
 * 盆栽園登録・更新・削除後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'

// ============================================================
// 盆栽園一覧取得
// ============================================================

/**
 * 盆栽園一覧を取得
 *
 * ## 機能概要
 * 検索条件やソート条件に基づいて盆栽園一覧を取得します。
 *
 * ## フィルターオプション
 * - search: 名前または住所で検索
 * - genreId: ジャンルでフィルター
 * - sortBy: ソート順（rating/name/newest）
 *
 * ## 返却データ
 * - 盆栽園基本情報
 * - 作成者情報
 * - ジャンル情報
 * - 平均評価
 * - レビュー数
 *
 * @param options - 検索・フィルターオプション
 * @returns 盆栽園一覧
 *
 * @example
 * ```typescript
 * // 名前で検索
 * const { shops } = await getShops({ search: '盆栽園' })
 *
 * // 評価順でソート
 * const { shops } = await getShops({ sortBy: 'rating' })
 * ```
 */
export async function getShops(options?: {
  search?: string
  genreId?: string
  sortBy?: 'rating' | 'name' | 'newest'
}) {
  const { search, genreId, sortBy = 'newest' } = options || {}

  // ------------------------------------------------------------
  // 盆栽園を取得
  // ------------------------------------------------------------

  const shops = await prisma.bonsaiShop.findMany({
    where: {
      /**
       * 非表示盆栽園を除外
       */
      isHidden: false,
      /**
       * 検索フィルター（名前または住所）
       *
       * OR: いずれかにマッチ
       * mode: 'insensitive': 大文字小文字を区別しない
       */
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      }),
      /**
       * ジャンルフィルター
       *
       * some: 少なくとも1つのジャンルがマッチ
       */
      ...(genreId && {
        genres: {
          some: { genreId },
        },
      }),
    },
    include: {
      /**
       * 作成者情報
       */
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      /**
       * ジャンル情報
       */
      genres: {
        include: { genre: true },
      },
      /**
       * レビュー情報（評価計算用）
       *
       * 非表示レビューを除外
       */
      reviews: {
        where: { isHidden: false },
        select: { rating: true },
      },
    },
    /**
     * ソート順
     *
     * rating は後からソートするため、ここでは newest または name
     */
    orderBy: sortBy === 'name'
      ? { name: 'asc' }
      : sortBy === 'newest'
      ? { createdAt: 'desc' }
      : { createdAt: 'desc' },
  })

  // ------------------------------------------------------------
  // 平均評価を計算して返却データを整形
  // ------------------------------------------------------------

  const shopsWithRating = shops.map((shop: typeof shops[number]) => {
    /**
     * 平均評価を計算
     *
     * レビューがない場合は null
     */
    const averageRating = shop.reviews.length > 0
      ? shop.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / shop.reviews.length
      : null

    /**
     * Prisma DecimalからJavaScript numberへ明示的に変換
     *
     * Prismaの Decimal 型はそのままでは JSON にシリアライズできないため、
     * toString() で文字列化してから Number() で数値に変換
     */
    const lat = shop.latitude !== null ? Number(shop.latitude.toString()) : null
    const lng = shop.longitude !== null ? Number(shop.longitude.toString()) : null

    return {
      ...shop,
      latitude: lat,
      longitude: lng,
      /**
       * ジャンルを中間テーブルから取り出してフラット化
       */
      genres: shop.genres.map((sg: typeof shop.genres[number]) => sg.genre),
      averageRating,
      reviewCount: shop.reviews.length,
    }
  })

  // ------------------------------------------------------------
  // 評価順ソート（DBレベルでは不可なので手動）
  // ------------------------------------------------------------

  /**
   * rating でソートする場合はメモリ上でソート
   *
   * null は後ろに配置
   */
  if (sortBy === 'rating') {
    shopsWithRating.sort((a: typeof shopsWithRating[number], b: typeof shopsWithRating[number]) => {
      if (a.averageRating === null && b.averageRating === null) return 0
      if (a.averageRating === null) return 1
      if (b.averageRating === null) return -1
      return b.averageRating - a.averageRating
    })
  }

  return { shops: shopsWithRating }
}

// ============================================================
// 盆栽園詳細取得
// ============================================================

/**
 * 盆栽園詳細を取得
 *
 * ## 機能概要
 * 指定された盆栽園の詳細情報を取得します。
 *
 * ## 返却情報
 * - 盆栽園基本情報
 * - 作成者情報
 * - ジャンル一覧
 * - レビュー一覧（ユーザー情報・画像含む）
 * - 平均評価
 * - isOwner: 現在のユーザーが作成者かどうか
 *
 * @param shopId - 盆栽園ID
 * @returns 盆栽園詳細、または { error: string }
 *
 * @example
 * ```typescript
 * const { shop, error } = await getShop('shop-123')
 *
 * if (shop) {
 *   console.log(`${shop.name}（評価: ${shop.averageRating}）`)
 * }
 * ```
 */
export async function getShop(shopId: string) {
  const session = await auth()
  const currentUserId = session?.user?.id

  // ------------------------------------------------------------
  // 盆栽園詳細を取得
  // ------------------------------------------------------------

  const shop = await prisma.bonsaiShop.findUnique({
    where: {
      id: shopId,
      isHidden: false,  // 非表示盆栽園は取得しない
    },
    include: {
      /**
       * 作成者情報
       */
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      /**
       * ジャンル情報
       */
      genres: {
        include: { genre: true },
      },
      /**
       * レビュー一覧
       *
       * 非表示レビューを除外し、新しい順に並べる
       */
      reviews: {
        where: { isHidden: false },
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          images: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  // ------------------------------------------------------------
  // 存在チェック
  // ------------------------------------------------------------

  if (!shop) {
    return { error: '盆栽園が見つかりません' }
  }

  // ------------------------------------------------------------
  // 平均評価を計算
  // ------------------------------------------------------------

  const averageRating = shop.reviews.length > 0
    ? shop.reviews.reduce((sum: number, r: typeof shop.reviews[number]) => sum + r.rating, 0) / shop.reviews.length
    : null

  // ------------------------------------------------------------
  // Decimal型の変換
  // ------------------------------------------------------------

  const lat = shop.latitude !== null ? Number(shop.latitude.toString()) : null
  const lng = shop.longitude !== null ? Number(shop.longitude.toString()) : null

  // ------------------------------------------------------------
  // 結果を返却
  // ------------------------------------------------------------

  return {
    shop: {
      ...shop,
      latitude: lat,
      longitude: lng,
      genres: shop.genres.map((sg: typeof shop.genres[number]) => sg.genre),
      averageRating,
      reviewCount: shop.reviews.length,
      /**
       * isOwner: 現在のユーザーが作成者かどうか
       * 編集・削除ボタンの表示制御に使用
       */
      isOwner: currentUserId === shop.createdBy,
    },
  }
}

// ============================================================
// 盆栽園登録
// ============================================================

/**
 * 盆栽園を登録
 *
 * ## 機能概要
 * 新しい盆栽園を地図に登録します。
 *
 * ## 必須項目
 * - name: 盆栽園名
 * - address: 住所
 *
 * ## オプション項目
 * - latitude/longitude: 緯度経度
 * - phone: 電話番号
 * - website: ウェブサイト
 * - businessHours: 営業時間
 * - closedDays: 定休日
 * - genreIds: ジャンルID配列
 *
 * ## 重複チェック
 * 同じ住所の盆栽園は登録不可
 *
 * @param formData - フォームデータ
 * @returns 成功時は { success: true, shopId }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await createShop(formData)
 *
 * if (result.success) {
 *   router.push(`/shops/${result.shopId}`)
 * }
 * ```
 */
export async function createShop(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // フォームデータの取得
  // ------------------------------------------------------------

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const latitudeStr = formData.get('latitude') as string
  const longitudeStr = formData.get('longitude') as string
  const phone = formData.get('phone') as string | null
  const website = formData.get('website') as string | null
  const businessHours = formData.get('businessHours') as string | null
  const closedDays = formData.get('closedDays') as string | null
  const genreIds = formData.getAll('genreIds') as string[]

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  if (!name || name.trim().length === 0) {
    return { error: '名称を入力してください' }
  }

  if (!address || address.trim().length === 0) {
    return { error: '住所を入力してください' }
  }

  // ------------------------------------------------------------
  // 緯度経度の変換
  // ------------------------------------------------------------

  /**
   * parseFloat で文字列を数値に変換
   * 空文字列の場合は null
   */
  const latitude = latitudeStr ? parseFloat(latitudeStr) : null
  const longitude = longitudeStr ? parseFloat(longitudeStr) : null

  // ------------------------------------------------------------
  // 重複チェック（住所ベース）
  // ------------------------------------------------------------

  /**
   * 同じ住所の盆栽園が既に登録されていないか確認
   */
  const existing = await prisma.bonsaiShop.findFirst({
    where: { address: address.trim() },
  })

  if (existing) {
    return {
      error: 'この住所の盆栽園は既に登録されています',
      existingId: existing.id  // 既存の盆栽園へのリンク用
    }
  }

  // ------------------------------------------------------------
  // 盆栽園を作成
  // ------------------------------------------------------------

  const shop = await prisma.bonsaiShop.create({
    data: {
      name: name.trim(),
      address: address.trim(),
      latitude: latitude,
      longitude: longitude,
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      businessHours: businessHours?.trim() || null,
      closedDays: closedDays?.trim() || null,
      createdBy: session.user.id,
      /**
       * ジャンルがある場合はネストして作成
       */
      genres: genreIds.length > 0
        ? {
            create: genreIds.map((genreId: string) => ({ genreId })),
          }
        : undefined,
    },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath('/shops')
  return { success: true, shopId: shop.id }
}

// ============================================================
// 盆栽園更新
// ============================================================

/**
 * 盆栽園を更新
 *
 * ## 機能概要
 * 既存の盆栽園情報を更新します。
 *
 * ## 権限
 * 盆栽園作成者のみ更新可能
 *
 * ## ジャンル更新
 * 既存のジャンルを削除して再作成
 *
 * @param shopId - 盆栽園ID
 * @param formData - フォームデータ
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await updateShop('shop-123', formData)
 *
 * if (result.success) {
 *   toast.success('更新しました')
 * }
 * ```
 */
export async function updateShop(shopId: string, formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 所有者確認
  // ------------------------------------------------------------

  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId },
    select: { createdBy: true },
  })

  if (!shop) {
    return { error: '盆栽園が見つかりません' }
  }

  if (shop.createdBy !== session.user.id) {
    return { error: '編集権限がありません' }
  }

  // ------------------------------------------------------------
  // フォームデータの取得
  // ------------------------------------------------------------

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const latitudeStr = formData.get('latitude') as string
  const longitudeStr = formData.get('longitude') as string
  const phone = formData.get('phone') as string | null
  const website = formData.get('website') as string | null
  const businessHours = formData.get('businessHours') as string | null
  const closedDays = formData.get('closedDays') as string | null
  const genreIds = formData.getAll('genreIds') as string[]

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  if (!name || name.trim().length === 0) {
    return { error: '名称を入力してください' }
  }

  if (!address || address.trim().length === 0) {
    return { error: '住所を入力してください' }
  }

  const latitude = latitudeStr ? parseFloat(latitudeStr) : null
  const longitude = longitudeStr ? parseFloat(longitudeStr) : null

  // ------------------------------------------------------------
  // ジャンルを更新（一度削除して再作成）
  // ------------------------------------------------------------

  /**
   * 既存のジャンル関連を削除
   */
  await prisma.shopGenre.deleteMany({
    where: { shopId },
  })

  // ------------------------------------------------------------
  // 盆栽園を更新
  // ------------------------------------------------------------

  await prisma.bonsaiShop.update({
    where: { id: shopId },
    data: {
      name: name.trim(),
      address: address.trim(),
      latitude: latitude,
      longitude: longitude,
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      businessHours: businessHours?.trim() || null,
      closedDays: closedDays?.trim() || null,
      /**
       * 新しいジャンルを作成
       */
      genres: genreIds.length > 0
        ? {
            create: genreIds.map((genreId: string) => ({ genreId })),
          }
        : undefined,
    },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath('/shops')
  revalidatePath(`/shops/${shopId}`)
  return { success: true }
}

// ============================================================
// 盆栽園削除
// ============================================================

/**
 * 盆栽園を削除
 *
 * ## 機能概要
 * 盆栽園を地図から削除します。
 *
 * ## 権限
 * 盆栽園作成者のみ削除可能
 *
 * ## カスケード削除
 * 関連するジャンル・レビューも自動削除
 *
 * @param shopId - 盆栽園ID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await deleteShop('shop-123')
 *
 * if (result.success) {
 *   router.push('/shops')
 * }
 * ```
 */
export async function deleteShop(shopId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 所有者確認
  // ------------------------------------------------------------

  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId },
    select: { createdBy: true },
  })

  if (!shop) {
    return { error: '盆栽園が見つかりません' }
  }

  if (shop.createdBy !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  // ------------------------------------------------------------
  // 盆栽園を削除
  // ------------------------------------------------------------

  /**
   * カスケード削除により関連データも自動削除
   */
  await prisma.bonsaiShop.delete({
    where: { id: shopId },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath('/shops')
  return { success: true }
}

// ============================================================
// 住所から緯度経度を取得（ジオコーディング）
// ============================================================

/**
 * 住所から緯度経度を取得（ジオコーディング）
 *
 * ## 機能概要
 * 住所文字列から緯度・経度を取得します。
 *
 * ## 使用API
 * 国土地理院 住所検索API（無料、APIキー不要）
 * https://msearch.gsi.go.jp/address-search/AddressSearch
 *
 * ## レスポンス形式
 * APIは [経度, 緯度] の形式で返すことに注意
 *
 * @param address - 住所文字列
 * @returns 成功時は { latitude, longitude, displayName }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await geocodeAddress('東京都渋谷区')
 *
 * if (result.latitude) {
 *   console.log(`緯度: ${result.latitude}, 経度: ${result.longitude}`)
 * }
 * ```
 */
export async function geocodeAddress(address: string) {
  try {
    /**
     * 住所をURLエンコード
     */
    const encodedAddress = encodeURIComponent(address)

    // ------------------------------------------------------------
    // 国土地理院APIを呼び出し
    // ------------------------------------------------------------

    const response = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodedAddress}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return { error: '住所の検索に失敗しました' }
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return { error: '住所が見つかりませんでした' }
    }

    // ------------------------------------------------------------
    // 結果を整形して返却
    // ------------------------------------------------------------

    /**
     * 国土地理院APIのレスポンス形式: [経度, 緯度]
     *
     * 注意: 一般的な [緯度, 経度] とは順序が逆
     */
    const [longitude, latitude] = data[0].geometry.coordinates

    return {
      latitude: latitude,
      longitude: longitude,
      displayName: data[0].properties.title,
    }
  } catch {
    return { error: '住所の検索中にエラーが発生しました' }
  }
}

// ============================================================
// 住所候補を検索（オートコンプリート）
// ============================================================

/**
 * 住所候補を検索（オートコンプリート用）
 *
 * ## 機能概要
 * 住所入力時のサジェスト候補を取得します。
 *
 * ## 使用API
 * 国土地理院 住所検索API
 *
 * ## 用途
 * - 住所入力フォームのオートコンプリート
 * - 正確な住所への補完
 *
 * @param query - 検索クエリ（2文字以上必要）
 * @returns 住所候補配列
 *
 * @example
 * ```typescript
 * // 「東京」と入力すると...
 * const { suggestions } = await searchAddressSuggestions('東京')
 *
 * // [{ displayName: '東京都', latitude: ..., longitude: ... }, ...]
 * ```
 */
export async function searchAddressSuggestions(query: string) {
  /**
   * 2文字未満は検索しない
   */
  if (!query.trim() || query.length < 2) {
    return { suggestions: [] }
  }

  try {
    const encodedQuery = encodeURIComponent(query)

    // ------------------------------------------------------------
    // 国土地理院APIを呼び出し
    // ------------------------------------------------------------

    const response = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodedQuery}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return { suggestions: [], originalQuery: query }
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return { suggestions: [], originalQuery: query }
    }

    // ------------------------------------------------------------
    // 最大5件の候補を返す
    // ------------------------------------------------------------

    const suggestions = data.slice(0, 5).map((item: {
      geometry: {
        coordinates: [number, number]  // [経度, 緯度]
      }
      properties: {
        title: string
      }
    }) => {
      const [longitude, latitude] = item.geometry.coordinates
      return {
        latitude: latitude,
        longitude: longitude,
        displayName: item.properties.title,
        formattedAddress: item.properties.title,
      }
    })

    return { suggestions, originalQuery: query }
  } catch {
    return { suggestions: [], originalQuery: query }
  }
}

// ============================================================
// 盆栽園ジャンル一覧取得
// ============================================================

/**
 * 盆栽園のジャンル一覧を取得
 *
 * ## 機能概要
 * 盆栽園登録時に選択できるジャンルの一覧を取得します。
 *
 * ## ジャンル例
 * - 販売店
 * - 展示園
 * - 育成園
 * など
 *
 * @returns ジャンル一覧
 *
 * @example
 * ```typescript
 * const { genres } = await getShopGenres()
 *
 * return (
 *   <select>
 *     {genres.map(genre => (
 *       <option key={genre.id} value={genre.id}>{genre.name}</option>
 *     ))}
 *   </select>
 * )
 * ```
 */
export async function getShopGenres() {
  /**
   * type: 'shop' のジャンルのみ取得
   *
   * カテゴリ順 → ソート順 で並べる
   */
  const genres = await prisma.genre.findMany({
    where: { type: 'shop' },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return { genres }
}
