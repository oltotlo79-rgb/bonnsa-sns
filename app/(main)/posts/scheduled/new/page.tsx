import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'
import { getGenres } from '@/lib/actions/post'
import { ScheduledPostForm } from '@/components/post/ScheduledPostForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '予約投稿を作成 | BONLOG',
}

export default async function NewScheduledPostPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const isPremium = await isPremiumUser(session.user.id)
  if (!isPremium) {
    redirect('/posts/scheduled')
  }

  const genresResult = await getGenres()
  const genres = genresResult.genres || {}
  const limits = await getMembershipLimits(session.user.id)

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/posts/scheduled" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">予約投稿を作成</h1>
      </div>
      <ScheduledPostForm genres={genres} limits={limits} />
    </div>
  )
}
