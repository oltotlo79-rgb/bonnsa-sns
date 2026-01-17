import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { UserList } from '@/components/user/UserList'
import Link from 'next/link'

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
    title: user ? `${user.nickname}のフォロワー - BON-LOG` : 'ユーザーが見つかりません',
  }
}

export default async function FollowersPage({ params }: Props) {
  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true },
  })

  if (!user) {
    notFound()
  }

  const followers = await prisma.follow.findMany({
    where: { followingId: id },
    include: {
      follower: {
        select: { id: true, nickname: true, avatarUrl: true, bio: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const users = followers.map((f: typeof followers[number]) => ({
    ...f.follower,
    avatar_url: f.follower.avatarUrl,
  }))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={`/users/${id}`} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">フォロワー</h1>
        </div>

        <UserList
          users={users}
          emptyMessage="フォロワーはいません"
        />
      </div>
    </div>
  )
}
