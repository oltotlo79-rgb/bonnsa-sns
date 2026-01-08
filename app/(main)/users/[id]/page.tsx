import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ProfileHeader } from '@/components/user/ProfileHeader'

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
  if (session?.user?.id && !isOwner) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: id,
        },
      },
    })
    isFollowing = !!follow
  }

  // 最近の投稿を取得
  const posts = await prisma.post.findMany({
    where: { userId: id },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ProfileHeader
        user={userWithCounts}
        isOwner={isOwner}
        isFollowing={isFollowing}
      />

      {/* 投稿一覧 */}
      <div className="bg-card rounded-lg border">
        <h2 className="px-4 py-3 font-bold border-b">投稿</h2>

        {posts && posts.length > 0 ? (
          <div className="divide-y">
            {posts.map((post) => (
              <div key={post.id} className="p-4">
                <p className="whitespace-pre-wrap">{post.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(post.createdAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
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
