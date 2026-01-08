import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getBookmarkedPosts } from '@/lib/actions/bookmark'
import { BookmarkPostList } from './BookmarkPostList'

export const metadata = {
  title: 'ブックマーク - BON-LOG',
}

export default async function BookmarksPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const result = await getBookmarkedPosts()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border overflow-hidden">
        <h1 className="px-4 py-3 font-bold border-b">ブックマーク</h1>
        <BookmarkPostList
          initialPosts={result.posts || []}
          initialNextCursor={result.nextCursor}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  )
}
