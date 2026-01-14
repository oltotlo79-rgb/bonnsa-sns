import { auth } from '@/lib/auth'
import { PostForm } from '@/components/post/PostForm'
import { Timeline } from '@/components/feed/Timeline'
import { getGenres } from '@/lib/actions/post'
import { getTimeline } from '@/lib/actions/feed'

export const metadata = {
  title: 'タイムライン - BON-LOG',
}

export default async function FeedPage() {
  const session = await auth()

  const [genresResult, timelineResult] = await Promise.all([
    getGenres(),
    getTimeline()
  ])

  const genres = genresResult.genres || {}
  const posts = timelineResult.posts || []

  return (
    <div className="space-y-6">
      {/* 投稿フォーム */}
      <div className="bg-card rounded-lg border p-4">
        <PostForm genres={genres} />
      </div>

      {/* タイムライン */}
      <div>
        <h2 className="text-lg font-bold mb-4">タイムライン</h2>
        <Timeline initialPosts={posts} currentUserId={session?.user?.id} />
      </div>
    </div>
  )
}
