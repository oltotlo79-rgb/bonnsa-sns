'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// 盆栽一覧取得
export async function getBonsais(userId?: string) {
  const session = await auth()
  const targetUserId = userId || session?.user?.id

  if (!targetUserId) {
    return { error: '認証が必要です' }
  }

  try {
    const bonsais = await prisma.bonsai.findMany({
      where: { userId: targetUserId },
      include: {
        records: {
          orderBy: { recordAt: 'desc' },
          take: 1,
          include: {
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
        _count: { select: { records: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { bonsais }
  } catch (error) {
    console.error('Get bonsais error:', error)
    return { error: '盆栽一覧の取得に失敗しました' }
  }
}

// 盆栽詳細取得
export async function getBonsai(bonsaiId: string) {
  try {
    const bonsai = await prisma.bonsai.findUnique({
      where: { id: bonsaiId },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        records: {
          orderBy: { recordAt: 'desc' },
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
          },
        },
        _count: { select: { records: true } },
      },
    })

    if (!bonsai) {
      return { error: '盆栽が見つかりません' }
    }

    return { bonsai }
  } catch (error) {
    console.error('Get bonsai error:', error)
    return { error: '盆栽の取得に失敗しました' }
  }
}

// 盆栽登録
export async function createBonsai(data: {
  name: string
  species?: string
  acquiredAt?: Date
  description?: string
}) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    const bonsai = await prisma.bonsai.create({
      data: {
        userId: session.user.id,
        name: data.name,
        species: data.species,
        acquiredAt: data.acquiredAt,
        description: data.description,
      },
    })

    revalidatePath('/bonsai')
    return { bonsai }
  } catch (error) {
    console.error('Create bonsai error:', error)
    return { error: '盆栽の登録に失敗しました' }
  }
}

// 盆栽更新
export async function updateBonsai(
  bonsaiId: string,
  data: {
    name?: string
    species?: string
    acquiredAt?: Date | null
    description?: string
  }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    const existing = await prisma.bonsai.findFirst({
      where: { id: bonsaiId, userId: session.user.id },
    })

    if (!existing) {
      return { error: '盆栽が見つかりません' }
    }

    const bonsai = await prisma.bonsai.update({
      where: { id: bonsaiId },
      data: {
        name: data.name,
        species: data.species,
        acquiredAt: data.acquiredAt,
        description: data.description,
      },
    })

    revalidatePath(`/bonsai/${bonsaiId}`)
    return { bonsai }
  } catch (error) {
    console.error('Update bonsai error:', error)
    return { error: '盆栽の更新に失敗しました' }
  }
}

// 盆栽削除
export async function deleteBonsai(bonsaiId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    const existing = await prisma.bonsai.findFirst({
      where: { id: bonsaiId, userId: session.user.id },
    })

    if (!existing) {
      return { error: '盆栽が見つかりません' }
    }

    await prisma.bonsai.delete({ where: { id: bonsaiId } })

    revalidatePath('/bonsai')
    return { success: true }
  } catch (error) {
    console.error('Delete bonsai error:', error)
    return { error: '盆栽の削除に失敗しました' }
  }
}

// 成長記録追加
export async function addBonsaiRecord(data: {
  bonsaiId: string
  content?: string
  recordAt?: Date
  imageUrls?: string[]
}) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // 盆栽の所有者確認
    const bonsai = await prisma.bonsai.findFirst({
      where: { id: data.bonsaiId, userId: session.user.id },
    })

    if (!bonsai) {
      return { error: '盆栽が見つかりません' }
    }

    const record = await prisma.bonsaiRecord.create({
      data: {
        bonsaiId: data.bonsaiId,
        content: data.content,
        recordAt: data.recordAt || new Date(),
        images: data.imageUrls?.length
          ? {
              create: data.imageUrls.map((url, index) => ({
                url,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    revalidatePath(`/bonsai/${data.bonsaiId}`)
    return { record }
  } catch (error) {
    console.error('Add bonsai record error:', error)
    return { error: '成長記録の追加に失敗しました' }
  }
}

// 成長記録更新
export async function updateBonsaiRecord(
  recordId: string,
  data: {
    content?: string
    recordAt?: Date
    imageUrls?: string[]
  }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // 記録の所有者確認
    const existing = await prisma.bonsaiRecord.findFirst({
      where: { id: recordId },
      include: { bonsai: true },
    })

    if (!existing || existing.bonsai.userId !== session.user.id) {
      return { error: '成長記録が見つかりません' }
    }

    // 画像を削除して再作成
    if (data.imageUrls !== undefined) {
      await prisma.bonsaiRecordImage.deleteMany({ where: { recordId } })
    }

    const record = await prisma.bonsaiRecord.update({
      where: { id: recordId },
      data: {
        content: data.content,
        recordAt: data.recordAt,
        images: data.imageUrls?.length
          ? {
              create: data.imageUrls.map((url, index) => ({
                url,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    revalidatePath(`/bonsai/${existing.bonsaiId}`)
    return { record }
  } catch (error) {
    console.error('Update bonsai record error:', error)
    return { error: '成長記録の更新に失敗しました' }
  }
}

// 成長記録削除
export async function deleteBonsaiRecord(recordId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // 記録の所有者確認
    const existing = await prisma.bonsaiRecord.findFirst({
      where: { id: recordId },
      include: { bonsai: true },
    })

    if (!existing || existing.bonsai.userId !== session.user.id) {
      return { error: '成長記録が見つかりません' }
    }

    await prisma.bonsaiRecord.delete({ where: { id: recordId } })

    revalidatePath(`/bonsai/${existing.bonsaiId}`)
    return { success: true }
  } catch (error) {
    console.error('Delete bonsai record error:', error)
    return { error: '成長記録の削除に失敗しました' }
  }
}

// タイムライン表示用：全盆栽の最新記録を取得
export async function getBonsaiTimeline(options: { cursor?: string; limit?: number } = {}) {
  const { cursor, limit = 20 } = options

  try {
    const records = await prisma.bonsaiRecord.findMany({
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { recordAt: 'desc' },
      include: {
        bonsai: {
          include: {
            user: {
              select: { id: true, nickname: true, avatarUrl: true },
            },
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    const hasMore = records.length === limit
    const nextCursor = hasMore ? records[records.length - 1]?.id : undefined

    return { records, nextCursor }
  } catch (error) {
    console.error('Get bonsai timeline error:', error)
    return { records: [], nextCursor: undefined }
  }
}

// 特定の盆栽の成長記録一覧取得
export async function getBonsaiRecords(
  bonsaiId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const { cursor, limit = 20 } = options

  try {
    const records = await prisma.bonsaiRecord.findMany({
      where: { bonsaiId },
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { recordAt: 'desc' },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    const hasMore = records.length === limit
    const nextCursor = hasMore ? records[records.length - 1]?.id : undefined

    return { records, nextCursor }
  } catch (error) {
    console.error('Get bonsai records error:', error)
    return { records: [], nextCursor: undefined }
  }
}
