import { auth } from '@/lib/auth'
import { FeedWithCompose } from '@/components/feed/FeedWithCompose'
import { getGenres } from '@/lib/actions/post'
import { getTimeline } from '@/lib/actions/feed'
import { getMembershipLimits } from '@/lib/premium'
import { getDraftCount } from '@/lib/actions/draft'
import { getBonsais } from '@/lib/actions/bonsai'

export const metadata = {
  title: 'タイムライン - BON-LOG',
}

export default async function FeedPage() {
  const session = await auth()

  const [genresResult, timelineResult, limits, draftCount, bonsaisResult] = await Promise.all([
    getGenres(),
    getTimeline(),
    session?.user?.id ? getMembershipLimits(session.user.id) : Promise.resolve({ maxPostLength: 500, maxImages: 4, maxVideos: 2, canSchedulePost: false, canViewAnalytics: false }),
    getDraftCount(),
    session?.user?.id ? getBonsais() : Promise.resolve({ bonsais: [] }),
  ])

  const genres = genresResult.genres || {}
  const posts = timelineResult.posts || []
  const bonsais = bonsaisResult.bonsais || []

  return (
    <FeedWithCompose
      initialPosts={posts}
      currentUserId={session?.user?.id}
      genres={genres}
      limits={limits}
      draftCount={draftCount}
      bonsais={bonsais}
    />
  )
}
