'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { PostCard } from '@/components/post/PostCard'
import { getBookmarkedPosts } from '@/lib/actions/bookmark'
import { Bookmark } from 'lucide-react'

type PostUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

type PostMedia = {
  id: string
  url: string
  type: string
  sortOrder: number
}

type PostGenre = {
  id: string
  name: string
  category: string
}

type QuotePost = {
  id: string
  content: string | null
  createdAt: string | Date
  user: PostUser
}

type Post = {
  id: string
  content: string | null
  createdAt: string | Date
  user: PostUser
  media: PostMedia[]
  genres: PostGenre[]
  likeCount: number
  commentCount: number
  quotePost?: QuotePost | null
  repostPost?: (QuotePost & { media: PostMedia[] }) | null
  isLiked?: boolean
  isBookmarked?: boolean
}

type BookmarkPostListProps = {
  initialPosts: Post[]
  initialNextCursor?: string
  currentUserId: string
}

export function BookmarkPostList({
  initialPosts,
  initialNextCursor,
  currentUserId,
}: BookmarkPostListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialNextCursor)
  const [loading, setLoading] = useState(false)

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return

    setLoading(true)
    const result = await getBookmarkedPosts(nextCursor)

    if (result.posts) {
      setPosts(prev => [...prev, ...result.posts as Post[]])
      setNextCursor(result.nextCursor)
    }
    setLoading(false)
  }, [nextCursor, loading])

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <Bookmark className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          ブックマークした投稿はありません
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          気になる投稿をブックマークして後で見返しましょう
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="divide-y">
        {posts.map((post: Post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {nextCursor && (
        <div className="p-4 text-center border-t">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? '読み込み中...' : 'さらに読み込む'}
          </Button>
        </div>
      )}
    </div>
  )
}
