import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ProfileHeader } from '@/components/user/ProfileHeader'
import { PostCard } from '@/components/post/PostCard'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: { nickname: true },
  })

  return {
    title: user ? `${user.nickname} - BON-LOG` : 'ユーザーが見つかりません',
  }
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  // ユーザー情報とカウントを取得
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  })

  if (!user) {
    notFound()
  }

  const userWithCounts = {
    ...user,
    postsCount: user._count.posts,
    followersCount: user._count.followers,
    followingCount: user._count.following,
  }

  const isOwner = session?.user?.id === user.id

  // フォロー状態を取得
  let isFollowing = false
  let isBlocked = false
  let isMuted = false

  if (session?.user?.id && !isOwner) {
    const [follow, block, mute] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: id,
          },
        },
      }),
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: session.user.id,
            blockedId: id,
          },
        },
      }),
      prisma.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: session.user.id,
            mutedId: id,
          },
        },
      }),
    ])
    isFollowing = !!follow
    isBlocked = !!block
    isMuted = !!mute
  }

  // 最近の投稿を取得
  const posts = await prisma.post.findMany({
    where: { userId: id },
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
    take: 10,
  })

  // 現在のユーザーがいいね/ブックマークしているかチェック
  const currentUserId = session?.user?.id
  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  if (currentUserId && posts.length > 0) {
    const postIds = posts.map(p => p.id)

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

    likedPostIds = new Set(userLikes.map(l => l.postId).filter((id): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map(b => b.postId))
  }

  // 投稿データを整形
  const formattedPosts = posts.map((post) => ({
    ...post,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    genres: post.genres.map((pg) => pg.genre),
    isLiked: likedPostIds.has(post.id),
    isBookmarked: bookmarkedPostIds.has(post.id),
  }))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ProfileHeader
        user={userWithCounts}
        isOwner={isOwner}
        isFollowing={isFollowing}
        isBlocked={isBlocked}
        isMuted={isMuted}
      />

      {/* 投稿一覧 */}
      <div className="bg-card rounded-lg border">
        <h2 className="px-4 py-3 font-bold border-b">投稿</h2>

        {formattedPosts && formattedPosts.length > 0 ? (
          <div className="divide-y">
            {formattedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            まだ投稿がありません
          </p>
        )}
      </div>
    </div>
  )
}
