import { auth } from '@/lib/auth'
import { FeedWithCompose } from '@/components/feed/FeedWithCompose'
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
    <FeedWithCompose
      initialPosts={posts}
      currentUserId={session?.user?.id}
      genres={genres}
      limits={limits}
    />
  )
}
