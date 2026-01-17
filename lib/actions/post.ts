'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { getMembershipLimits } from '@/lib/premium'
import { sanitizePostContent } from '@/lib/sanitize'
import { attachHashtagsToPost, detachHashtagsFromPost } from './hashtag'
import { notifyMentionedUsers } from './mention'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const rawContent = formData.get('content') as string
  const content = sanitizePostContent(rawContent)
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  // 会員種別に応じた制限を取得
  const limits = await getMembershipLimits(session.user.id)

  // バリデーション
  if (!content && mediaUrls.length === 0) {
    return { error: 'テキストまたはメディアを入力してください' }
  }

  // 文字数チェック（会員種別で分岐）
  if (content && content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  // ジャンル数チェック
  if (genreIds.length > 3) {
    return { error: 'ジャンルは3つまで選択できます' }
  }

  // メディアバリデーション（会員種別で分岐）
  const imageCount = mediaTypes.filter((t: string) => t === 'image').length
  const videoCount = mediaTypes.filter((t: string) => t === 'video').length
  if (imageCount > limits.maxImages) {
    return { error: `画像は${limits.maxImages}枚までです` }
  }
  if (videoCount > limits.maxVideos) {
    return { error: `動画は${limits.maxVideos}本までです` }
  }

  // 投稿制限チェック（1日20件）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  // 投稿作成
  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      content: content || null,
      media: mediaUrls.length > 0 ? {
        create: mediaUrls.map((url: string, index: number) => ({
          url,
          type: mediaTypes[index] || 'image',
          sortOrder: index,
        })),
      } : undefined,
      genres: genreIds.length > 0 ? {
        create: genreIds.map((genreId: string) => ({
          genreId,
        })),
      } : undefined,
    },
  })

  // ハッシュタグを関連付け
  await attachHashtagsToPost(post.id, content)

  // メンションされたユーザーに通知
  await notifyMentionedUsers(post.id, content, session.user.id)

  revalidatePath('/feed')
  return { success: true, postId: post.id }
}

export async function createQuotePost(formData: FormData, quotePostId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const rawContent = formData.get('content') as string
  const content = sanitizePostContent(rawContent)

  if (!content) {
    return { error: '引用コメントを入力してください' }
  }

  // 会員種別に応じた制限を取得
  const limits = await getMembershipLimits(session.user.id)

  if (content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  // 投稿制限チェック
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      content,
      quotePostId,
    },
  })

  // ハッシュタグを関連付け
  await attachHashtagsToPost(post.id, content)

  // メンションされたユーザーに通知
  await notifyMentionedUsers(post.id, content, session.user.id)

  // 引用元投稿者へ通知
  const quotePost = await prisma.post.findUnique({
    where: { id: quotePostId },
    select: { userId: true },
  })

  if (quotePost && quotePost.userId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: quotePost.userId,
        actorId: session.user.id,
        type: 'quote',
        postId: post.id,
      },
    })
  }

  revalidatePath('/feed')
  return { success: true, postId: post.id }
}

export async function createRepost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 既にリポスト済みかチェック
  const existing = await prisma.post.findFirst({
    where: {
      userId: session.user.id,
      repostPostId: postId,
    },
  })

  if (existing) {
    // リポスト解除
    await prisma.post.delete({ where: { id: existing.id } })
    revalidatePath('/feed')
    return { success: true, reposted: false }
  }

  // 投稿制限チェック
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  await prisma.post.create({
    data: {
      userId: session.user.id,
      repostPostId: postId,
    },
  })

  // リポスト元投稿者へ通知（リポスト時のみ、解除時は通知しない）
  const repostPost = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true },
  })

  if (repostPost && repostPost.userId !== session.user.id) {
    // 既存の通知を確認（重複防止）
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: repostPost.userId,
        actorId: session.user.id,
        type: 'repost',
        postId,
      },
    })

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          userId: repostPost.userId,
          actorId: session.user.id,
          type: 'repost',
          postId,
        },
      })
    }
  }

  revalidatePath('/feed')
  return { success: true, reposted: true }
}

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 投稿の所有者確認
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true },
  })

  if (!post || post.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  // ハッシュタグの関連付けを削除
  await detachHashtagsFromPost(postId)

  await prisma.post.delete({ where: { id: postId } })

  revalidatePath('/feed')
  return { success: true }
}

export async function getPost(postId: string) {
  const session = await auth()
  const currentUserId = session?.user?.id

  const post = await prisma.post.findUnique({
    where: { id: postId, isHidden: false },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: {
          genre: true,
        },
      },
      _count: {
        select: { likes: true, comments: true },
      },
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!post) {
    return { error: '投稿が見つかりません' }
  }

  // 現在のユーザーがいいね/ブックマークしているかチェック
  let isLiked = false
  let isBookmarked = false

  if (currentUserId) {
    const [like, bookmark] = await Promise.all([
      prisma.like.findFirst({
        where: {
          userId: currentUserId,
          postId: postId,
          commentId: null,
        },
      }),
      prisma.bookmark.findFirst({
        where: {
          userId: currentUserId,
          postId: postId,
        },
      }),
    ])
    isLiked = !!like
    isBookmarked = !!bookmark
  }

  return {
    post: {
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
      isLiked,
      isBookmarked,
    },
  }
}

export async function getPosts(cursor?: string, limit = 20) {
  const session = await auth()
  const currentUserId = session?.user?.id

  // フォローしているユーザーのID、ブロック/ミュートしているユーザーのIDを取得
  let followingUserIds: string[] = []
  let blockedUserIds: string[] = []
  let mutedUserIds: string[] = []

  if (currentUserId) {
    const [following, blocks, mutes] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      }),
      prisma.block.findMany({
        where: { blockerId: currentUserId },
        select: { blockedId: true },
      }),
      prisma.mute.findMany({
        where: { muterId: currentUserId },
        select: { mutedId: true },
      }),
    ])
    followingUserIds = following.map((f: { followingId: string }) => f.followingId)
    blockedUserIds = blocks.map((b: { blockedId: string }) => b.blockedId)
    mutedUserIds = mutes.map((m: { mutedId: string }) => m.mutedId)
  }

  // 自分 + フォローしているユーザーの投稿を取得
  const userIdsToShow = currentUserId
    ? [currentUserId, ...followingUserIds]
    : []

  // ブロック/ミュートしているユーザーを除外
  const excludedUserIds = [...blockedUserIds, ...mutedUserIds]

  const posts = await prisma.post.findMany({
    where: {
      isHidden: false,
      ...(currentUserId && {
        userId: {
          in: userIdsToShow,
          notIn: excludedUserIds.length > 0 ? excludedUserIds : undefined,
        },
      }),
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: {
          genre: true,
        },
      },
      _count: {
        select: { likes: true, comments: true },
      },
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // 現在のユーザーがいいね/ブックマークしているかチェック
  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  if (currentUserId && posts.length > 0) {
    const postIds = posts.map((p: typeof posts[number]) => p.id)

    const [userLikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null,
        },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ])

    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
  }

  return {
    posts: posts.map((post: typeof posts[number]) => ({
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
      isLiked: likedPostIds.has(post.id),
      isBookmarked: bookmarkedPostIds.has(post.id),
    })),
  }
}

export async function getGenres() {
  const genres = await prisma.genre.findMany({
    orderBy: [{ sortOrder: 'asc' }],
  })

  // カテゴリごとにグループ化
  type GenreType = typeof genres[number]
  const groupedMap = genres.reduce((acc: Record<string, GenreType[]>, genre: GenreType) => {
    if (!acc[genre.category]) {
      acc[genre.category] = []
    }
    acc[genre.category].push(genre)
    return acc
  }, {})

  // カテゴリの表示順序を定義
  const categoryOrder = ['松柏類', '雑木類', '草もの', '用品・道具', '施設・イベント', 'その他']

  // 順序通りに並べ替え
  const grouped: Record<string, typeof genres> = {}
  for (const category of categoryOrder) {
    if (groupedMap[category]) {
      grouped[category] = groupedMap[category]
    }
  }

  return { genres: grouped }
}

export async function uploadPostMedia(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    return { error: '画像または動画ファイルを選択してください' }
  }

  // ファイルサイズチェック
  const maxSize = isVideo ? 512 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: isVideo ? '動画は512MB以下にしてください' : '画像は5MB以下にしてください' }
  }

  // ストレージにアップロード
  const { uploadFile } = await import('@/lib/storage')
  const buffer = Buffer.from(await file.arrayBuffer())
  const folder = isVideo ? 'post-videos' : 'post-images'

  const result = await uploadFile(buffer, file.name, file.type, folder)

  if (!result.success || !result.url) {
    return { error: result.error || 'アップロードに失敗しました' }
  }

  return {
    success: true,
    url: result.url,
    type: isVideo ? 'video' : 'image',
  }
}
