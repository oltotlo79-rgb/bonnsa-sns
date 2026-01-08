import { auth } from '@/lib/auth'
import { PostForm } from '@/components/post/PostForm'
import { PostList } from '@/components/post/PostList'
import { getGenres, getPosts } from '@/lib/actions/post'

export const metadata = {
  title: 'タイムライン - BON-LOG',
}

export default async function FeedPage() {
  const session = await auth()

  const [genresResult, postsResult] = await Promise.all([
    getGenres(),
    getPosts()
  ])

  const genres = genresResult.genres || {}
  const posts = postsResult.posts || []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PostForm genres={genres} />

      <div className="bg-card rounded-lg border overflow-hidden">
        <h2 className="px-4 py-3 font-bold border-b">タイムライン</h2>
        <PostList posts={posts} currentUserId={session?.user?.id} />
      </div>
    </div>
  )
}
