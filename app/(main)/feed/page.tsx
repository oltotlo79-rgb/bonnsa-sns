import { auth } from '@/lib/auth'
import { PostForm } from '@/components/post/PostForm'
import { Timeline } from '@/components/feed/Timeline'
import { getGenres } from '@/lib/actions/post'
import { getTimeline } from '@/lib/actions/feed'
import { getMembershipLimits } from '@/lib/premium'

export const metadata = {
  title: 'タイムライン - BON-LOG',
}

export default async function FeedPage() {
  const session = await auth()

  const [genresResult, timelineResult, limits] = await Promise.all([
    getGenres(),
    getTimeline(),
    session?.user?.id ? getMembershipLimits(session.user.id) : Promise.resolve({ maxPostLength: 500, maxImages: 4, maxVideos: 2, canSchedulePost: false, canViewAnalytics: false }),
  ])

  const genres = genresResult.genres || {}
  const posts = timelineResult.posts || []

  return (
    <div className="space-y-6">
      {/* 投稿フォーム */}
      <div className="bg-card rounded-lg border p-4">
        <PostForm genres={genres} limits={limits} />
      </div>

      {/* タイムライン */}
      <div>
        <h2 className="text-lg font-bold mb-4">タイムライン</h2>
        <Timeline initialPosts={posts} currentUserId={session?.user?.id} />
      </div>
    </div>
  )
}
