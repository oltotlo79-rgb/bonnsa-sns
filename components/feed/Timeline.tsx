'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import { useEffect } from 'react'
import { PostCard } from '@/components/post/PostCard'
import { getTimeline } from '@/lib/actions/feed'
import { TimelineSkeleton } from './TimelineSkeleton'
import { EmptyTimeline } from './EmptyTimeline'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any

type TimelineProps = {
  initialPosts: Post[]
  currentUserId?: string
}

export function Timeline({ initialPosts, currentUserId }: TimelineProps) {
  const { ref, inView } = useInView()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['timeline'],
    queryFn: async ({ pageParam }) => {
      const result = await getTimeline(pageParam)
      return result
    },
    initialPageParam: undefined as string | undefined,
    initialData: {
      pages: [{
        posts: initialPosts,
        nextCursor: initialPosts.length >= 20 ? initialPosts[initialPosts.length - 1]?.id : undefined,
      }],
      pageParams: [undefined],
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) {
    return <TimelineSkeleton />
  }

  const allPosts = data?.pages.flatMap((page) => page.posts) || []

  if (allPosts.length === 0) {
    return <EmptyTimeline />
  }

  return (
    <div className="space-y-4">
      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}

      {/* 無限スクロール検知 */}
      <div ref={ref} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}
        {!hasNextPage && allPosts.length > 0 && (
          <p className="text-sm text-muted-foreground">これ以上投稿はありません</p>
        )}
      </div>
    </div>
  )
}
