'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// 下書き一覧取得
export async function getDrafts() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    const drafts = await prisma.draftPost.findMany({
      where: { userId: session.user.id },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        genres: { include: { genre: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return { drafts }
  } catch (error) {
    console.error('Get drafts error:', error)
    return { error: '下書きの取得に失敗しました' }
  }
}

// 下書き保存
export async function saveDraft(data: {
  id?: string
  content?: string
  mediaUrls?: string[]
  genreIds?: string[]
}) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // 既存の下書きを更新
    if (data.id) {
      const existing = await prisma.draftPost.findFirst({
        where: { id: data.id, userId: session.user.id },
      })

      if (!existing) {
        return { error: '下書きが見つかりません' }
      }

      // メディアとジャンルを削除して再作成
      await prisma.$transaction([
        prisma.draftPostMedia.deleteMany({ where: { draftPostId: data.id } }),
        prisma.draftPostGenre.deleteMany({ where: { draftPostId: data.id } }),
      ])

      const draft = await prisma.draftPost.update({
        where: { id: data.id },
        data: {
          content: data.content,
          media: data.mediaUrls?.length
            ? {
                create: data.mediaUrls.map((url, index) => ({
                  url,
                  type: 'image',
                  sortOrder: index,
                })),
              }
            : undefined,
          genres: data.genreIds?.length
            ? {
                create: data.genreIds.map((genreId) => ({ genreId })),
              }
            : undefined,
        },
        include: {
          media: true,
          genres: { include: { genre: true } },
        },
      })

      return { draft }
    }

    // 新規下書き作成
    const draft = await prisma.draftPost.create({
      data: {
        userId: session.user.id,
        content: data.content,
        media: data.mediaUrls?.length
          ? {
              create: data.mediaUrls.map((url, index) => ({
                url,
                type: 'image',
                sortOrder: index,
              })),
            }
          : undefined,
        genres: data.genreIds?.length
          ? {
              create: data.genreIds.map((genreId) => ({ genreId })),
            }
          : undefined,
      },
      include: {
        media: true,
        genres: { include: { genre: true } },
      },
    })

    return { draft }
  } catch (error) {
    console.error('Save draft error:', error)
    return { error: '下書きの保存に失敗しました' }
  }
}

// 下書きから投稿を作成
export async function publishDraft(draftId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    const draft = await prisma.draftPost.findFirst({
      where: { id: draftId, userId: session.user.id },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        genres: true,
      },
    })

    if (!draft) {
      return { error: '下書きが見つかりません' }
    }

    // 投稿を作成
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        content: draft.content,
        media: draft.media.length
          ? {
              create: draft.media.map((m) => ({
                url: m.url,
                type: m.type,
                sortOrder: m.sortOrder,
              })),
            }
          : undefined,
        genres: draft.genres.length
          ? {
              create: draft.genres.map((g) => ({ genreId: g.genreId })),
            }
          : undefined,
      },
    })

    // 下書きを削除
    await prisma.draftPost.delete({ where: { id: draftId } })

    revalidatePath('/feed')
    return { postId: post.id }
  } catch (error) {
    console.error('Publish draft error:', error)
    return { error: '投稿の作成に失敗しました' }
  }
}

// 下書き削除
export async function deleteDraft(draftId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    const draft = await prisma.draftPost.findFirst({
      where: { id: draftId, userId: session.user.id },
    })

    if (!draft) {
      return { error: '下書きが見つかりません' }
    }

    await prisma.draftPost.delete({ where: { id: draftId } })

    return { success: true }
  } catch (error) {
    console.error('Delete draft error:', error)
    return { error: '下書きの削除に失敗しました' }
  }
}

// 下書き詳細取得
export async function getDraft(draftId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    const draft = await prisma.draftPost.findFirst({
      where: { id: draftId, userId: session.user.id },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        genres: { include: { genre: true } },
      },
    })

    if (!draft) {
      return { error: '下書きが見つかりません' }
    }

    return { draft }
  } catch (error) {
    console.error('Get draft error:', error)
    return { error: '下書きの取得に失敗しました' }
  }
}
