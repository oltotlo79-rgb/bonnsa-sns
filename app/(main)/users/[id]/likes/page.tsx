import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
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
    title: user ? `${user.nickname}のいいね - BON-LOG` : 'ユーザーが見つかりません',
  }
}

export default async function UserLikesPage({ params }: Props) {
  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true },
  })

  if (!user) {
    notFound()
  }

  const likes = await prisma.like.findMany({
    where: {
      userId: id,
      postId: { not: null },
    },
    include: {
      post: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const posts = likes.map((l) => l.post).filter(Boolean)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={`/users/${id}`} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">いいねした投稿</h1>
        </div>

        {posts.length > 0 ? (
          <div className="divide-y">
            {posts.map((post) => (
              <div key={post!.id} className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  {post!.user.nickname}
                </p>
                <p className="whitespace-pre-wrap">{post!.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(post!.createdAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            いいねした投稿がありません
          </p>
        )}
      </div>
    </div>
  )
}
