'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// 盆栽園一覧取得
export async function getShops(options?: {
  search?: string
  genreId?: string
  sortBy?: 'rating' | 'name' | 'newest'
}) {
  const { search, genreId, sortBy = 'newest' } = options || {}

  const shops = await prisma.bonsaiShop.findMany({
    where: {
      isHidden: false, // 非表示盆栽園を除外
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(genreId && {
        genres: {
          some: { genreId },
        },
      }),
    },
    include: {
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      genres: {
        include: { genre: true },
      },
      reviews: {
        where: { isHidden: false }, // 非表示レビューを除外
        select: { rating: true },
      },
    },
    orderBy: sortBy === 'name'
      ? { name: 'asc' }
      : sortBy === 'newest'
      ? { createdAt: 'desc' }
      : { createdAt: 'desc' },
  })

  const shopsWithRating = shops.map((shop) => {
    const averageRating = shop.reviews.length > 0
      ? shop.reviews.reduce((sum, r) => sum + r.rating, 0) / shop.reviews.length
      : null

    // Prisma DecimalからJavaScript numberへ明示的に変換
    const lat = shop.latitude !== null ? Number(shop.latitude.toString()) : null
    const lng = shop.longitude !== null ? Number(shop.longitude.toString()) : null

    return {
      ...shop,
      latitude: lat,
      longitude: lng,
      genres: shop.genres.map((sg) => sg.genre),
      averageRating,
      reviewCount: shop.reviews.length,
    }
  })

  // 評価順ソート
  if (sortBy === 'rating') {
    shopsWithRating.sort((a, b) => {
      if (a.averageRating === null && b.averageRating === null) return 0
      if (a.averageRating === null) return 1
      if (b.averageRating === null) return -1
      return b.averageRating - a.averageRating
    })
  }

  return { shops: shopsWithRating }
}

// 盆栽園詳細取得
export async function getShop(shopId: string) {
  const session = await auth()
  const currentUserId = session?.user?.id

  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId, isHidden: false },
    include: {
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      genres: {
        include: { genre: true },
      },
      reviews: {
        where: { isHidden: false }, // 非表示レビューを除外
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

  if (!shop) {
    return { error: '盆栽園が見つかりません' }
  }

  const averageRating = shop.reviews.length > 0
    ? shop.reviews.reduce((sum, r) => sum + r.rating, 0) / shop.reviews.length
    : null

  // Prisma DecimalからJavaScript numberへ明示的に変換
  const lat = shop.latitude !== null ? Number(shop.latitude.toString()) : null
  const lng = shop.longitude !== null ? Number(shop.longitude.toString()) : null

  return {
    shop: {
      ...shop,
      latitude: lat,
      longitude: lng,
      genres: shop.genres.map((sg) => sg.genre),
      averageRating,
      reviewCount: shop.reviews.length,
      isOwner: currentUserId === shop.createdBy,
    },
  }
}

// 盆栽園登録
export async function createShop(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const latitudeStr = formData.get('latitude') as string
  const longitudeStr = formData.get('longitude') as string
  const phone = formData.get('phone') as string | null
  const website = formData.get('website') as string | null
  const businessHours = formData.get('businessHours') as string | null
  const closedDays = formData.get('closedDays') as string | null
  const genreIds = formData.getAll('genreIds') as string[]

  // バリデーション
  if (!name || name.trim().length === 0) {
    return { error: '名称を入力してください' }
  }

  if (!address || address.trim().length === 0) {
    return { error: '住所を入力してください' }
  }

  const latitude = latitudeStr ? parseFloat(latitudeStr) : null
  const longitude = longitudeStr ? parseFloat(longitudeStr) : null

  // 重複チェック（住所ベース）
  const existing = await prisma.bonsaiShop.findFirst({
    where: { address: address.trim() },
  })

  if (existing) {
    return {
      error: 'この住所の盆栽園は既に登録されています',
      existingId: existing.id
    }
  }

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
      genres: genreIds.length > 0
        ? {
            create: genreIds.map((genreId) => ({ genreId })),
          }
        : undefined,
    },
  })

  revalidatePath('/shops')
  return { success: true, shopId: shop.id }
}

// 盆栽園更新
export async function updateShop(shopId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 所有者確認
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

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const latitudeStr = formData.get('latitude') as string
  const longitudeStr = formData.get('longitude') as string
  const phone = formData.get('phone') as string | null
  const website = formData.get('website') as string | null
  const businessHours = formData.get('businessHours') as string | null
  const closedDays = formData.get('closedDays') as string | null
  const genreIds = formData.getAll('genreIds') as string[]

  // バリデーション
  if (!name || name.trim().length === 0) {
    return { error: '名称を入力してください' }
  }

  if (!address || address.trim().length === 0) {
    return { error: '住所を入力してください' }
  }

  const latitude = latitudeStr ? parseFloat(latitudeStr) : null
  const longitude = longitudeStr ? parseFloat(longitudeStr) : null

  // ジャンルを更新（一度削除して再作成）
  await prisma.shopGenre.deleteMany({
    where: { shopId },
  })

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
      genres: genreIds.length > 0
        ? {
            create: genreIds.map((genreId) => ({ genreId })),
          }
        : undefined,
    },
  })

  revalidatePath('/shops')
  revalidatePath(`/shops/${shopId}`)
  return { success: true }
}

// 盆栽園削除
export async function deleteShop(shopId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 所有者確認
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

  await prisma.bonsaiShop.delete({
    where: { id: shopId },
  })

  revalidatePath('/shops')
  return { success: true }
}

// 住所から緯度経度を取得（国土地理院API）
export async function geocodeAddress(address: string) {
  try {
    const encodedAddress = encodeURIComponent(address)

    // 国土地理院の住所検索API
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

    // 国土地理院APIのレスポンス形式: [経度, 緯度]
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

// 住所候補を検索（複数件返す）- 国土地理院API使用
export async function searchAddressSuggestions(query: string) {
  if (!query.trim() || query.length < 2) {
    return { suggestions: [] }
  }

  try {
    const encodedQuery = encodeURIComponent(query)

    // 国土地理院の住所検索API
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

    // 最大5件の候補を返す
    const suggestions = data.slice(0, 5).map((item: {
      geometry: {
        coordinates: [number, number] // [経度, 緯度]
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

// 盆栽園のジャンル一覧を取得
export async function getShopGenres() {
  const genres = await prisma.genre.findMany({
    where: { type: 'shop' },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return { genres }
}
