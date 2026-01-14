'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PostCard } from '@/components/post/PostCard'
import { searchPosts, searchUsers, searchByTag } from '@/lib/actions/search'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any

type User = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  followingCount: number
}

// 投稿検索結果
type PostSearchResultsProps = {
  query: string
  genreIds?: string[]
  initialPosts?: Post[]
  currentUserId?: string
}

export function PostSearchResults({
  query,
  genreIds,
  initialPosts = [],
  currentUserId,
}: PostSearchResultsProps) {
  const { ref, inView } = useInView()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['search-posts', query, genreIds],
    queryFn: async ({ pageParam }) => {
      return await searchPosts(query, genreIds, pageParam)
    },
    initialPageParam: undefined as string | undefined,
    initialData: initialPosts.length > 0 ? {
      pages: [{
        posts: initialPosts,
        nextCursor: initialPosts.length >= 20 ? initialPosts[initialPosts.length - 1]?.id : undefined,
      }],
      pageParams: [undefined],
    } : undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) {
    return <SearchResultsSkeleton />
  }

  const allPosts = data?.pages.flatMap((page) => page.posts) || []

  if (allPosts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {query ? `「${query}」に一致する投稿はありません` : '投稿が見つかりません'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}

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

// ユーザー検索結果
type UserSearchResultsProps = {
  query: string
  initialUsers?: User[]
}

export function UserSearchResults({ query, initialUsers = [] }: UserSearchResultsProps) {
  const { ref, inView } = useInView()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['search-users', query],
    queryFn: async ({ pageParam }) => {
      return await searchUsers(query, pageParam)
    },
    initialPageParam: undefined as string | undefined,
    initialData: initialUsers.length > 0 ? {
      pages: [{
        users: initialUsers,
        nextCursor: initialUsers.length >= 20 ? initialUsers[initialUsers.length - 1]?.id : undefined,
      }],
      pageParams: [undefined],
    } : undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) {
    return <SearchResultsSkeleton />
  }

  const allUsers = data?.pages.flatMap((page) => page.users) || []

  if (allUsers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {query ? `「${query}」に一致するユーザーはいません` : 'ユーザーが見つかりません'}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {allUsers.map((user) => (
        <Link
          key={user.id}
          href={`/users/${user.id}`}
          className="flex items-center gap-3 p-3 bg-card rounded-lg border hover:bg-muted/50 transition-colors"
        >
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.nickname}
              width={48}
              height={48}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-lg">
                {user.nickname.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user.nickname}</p>
            {user.bio && (
              <p className="text-sm text-muted-foreground line-clamp-1">{user.bio}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {user.followersCount}フォロワー
            </p>
          </div>
        </Link>
      ))}

      <div ref={ref} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}
        {!hasNextPage && allUsers.length > 0 && (
          <p className="text-sm text-muted-foreground">これ以上ユーザーはいません</p>
        )}
      </div>
    </div>
  )
}

// タグ検索結果
type TagSearchResultsProps = {
  tag: string
  initialPosts?: Post[]
  currentUserId?: string
}

export function TagSearchResults({ tag, initialPosts = [], currentUserId }: TagSearchResultsProps) {
  const { ref, inView } = useInView()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['search-tag', tag],
    queryFn: async ({ pageParam }) => {
      return await searchByTag(tag, pageParam)
    },
    initialPageParam: undefined as string | undefined,
    initialData: initialPosts.length > 0 ? {
      pages: [{
        posts: initialPosts,
        nextCursor: initialPosts.length >= 20 ? initialPosts[initialPosts.length - 1]?.id : undefined,
      }],
      pageParams: [undefined],
    } : undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!tag,
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) {
    return <SearchResultsSkeleton />
  }

  const allPosts = data?.pages.flatMap((page) => page.posts) || []

  if (allPosts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {tag ? `#${tag} を含む投稿はありません` : 'タグを入力してください'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <h2 className="text-lg font-semibold">#{tag}</h2>
        <p className="text-sm text-muted-foreground">{allPosts.length}件の投稿</p>
      </div>

      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}

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

// 人気タグ一覧
type PopularTagsProps = {
  tags: { tag: string; count: number }[]
}

export function PopularTags({ tags }: PopularTagsProps) {
  if (tags.length === 0) {
    return null
  }

  return (
    <div className="bg-card rounded-lg border p-4">
      <h3 className="font-semibold mb-3">人気のタグ</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/search?tab=tags&q=${encodeURIComponent(tag)}`}
            className="px-3 py-1.5 bg-muted rounded-full text-sm hover:bg-muted/80 transition-colors"
          >
            #{tag}
            <span className="ml-1 text-muted-foreground text-xs">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// スケルトン
function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-card rounded-lg border p-4 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
