import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isPremiumUser } from '@/lib/premium'
import { ScheduledPostList } from '@/components/post/ScheduledPostList'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CalendarPlus } from 'lucide-react'

export const metadata = {
  title: '予約投稿 | BONLOG',
}

async function getScheduledPosts(userId: string) {
  return prisma.scheduledPost.findMany({
    where: { userId },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      genres: { include: { genre: true } },
    },
    orderBy: { scheduledAt: 'desc' },
  })
}

export default async function ScheduledPostsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="text-center py-12 bg-card rounded-lg border">
          <CalendarPlus className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">予約投稿機能</h1>
          <p className="text-muted-foreground mb-6">
            予約投稿はプレミアム会員限定の機能です。
          </p>
          <Button asChild className="bg-bonsai-green hover:bg-bonsai-green/90">
            <Link href="/settings/subscription">プレミアムに登録</Link>
          </Button>
        </div>
      </div>
    )
  }

  const scheduledPosts = await getScheduledPosts(session.user.id)

  return (
    <div className="max-w-2xl mx-auto py-4">
      <div className="flex items-center justify-between mb-6 px-4">
        <h1 className="text-xl font-bold">予約投稿</h1>
        <Button asChild size="sm" className="bg-bonsai-green hover:bg-bonsai-green/90">
          <Link href="/posts/scheduled/new">
            <CalendarPlus className="w-4 h-4 mr-2" />
            新規作成
          </Link>
        </Button>
      </div>
      <ScheduledPostList scheduledPosts={scheduledPosts} />
    </div>
  )
}
