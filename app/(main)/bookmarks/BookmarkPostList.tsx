'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { PostCard } from '@/components/post/PostCard'
import { getBookmarkedPosts } from '@/lib/actions/bookmark'
import { Bookmark } from 'lucide-react'

type Post = {
  id: string
  content: string | null
  created_at: string
  user: {
    id: string
    nickname: string
    avatar_url: string | null
  }
  media?: Array<{
    id: string
    url: string
    type: string
    order: number
  }>
  genres?: Array<{
    id: string
    name: string
  }>
  likeCount: number
  commentCount: number
  repostCount: number
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
        {posts.map((post) => (
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
