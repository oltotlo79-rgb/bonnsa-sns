import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchTabs } from '@/components/search/SearchTabs'
import { GenreFilter } from '@/components/search/GenreFilter'
import {
  PostSearchResults,
  UserSearchResults,
  TagSearchResults,
  PopularTags,
} from '@/components/search/SearchResults'
import {
  searchPosts,
  searchUsers,
  searchByTag,
  getPopularTags,
  getAllGenres,
} from '@/lib/actions/search'

export const metadata = {
  title: '検索 - BON-LOG',
}

type SearchPageProps = {
  searchParams: Promise<{
    q?: string
    tab?: string
    genre?: string | string[]
  }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const session = await auth()
  const query = params.q || ''
  const tab = params.tab || 'posts'
  const genreParam = params.genre
  const genreIds = Array.isArray(genreParam) ? genreParam : genreParam ? [genreParam] : []

  // 並列でデータ取得
  const [genresResult, popularTagsResult] = await Promise.all([
    getAllGenres(),
    getPopularTags(10),
  ])

  const genres = genresResult.genres || {}
  const popularTags = popularTagsResult.tags || []

  return (
    <div className="space-y-4">
      {/* 検索バー */}
      <div className="bg-card rounded-lg border p-4">
        <SearchBar defaultValue={query} placeholder="投稿やユーザーを検索..." />
      </div>

      {/* タブ */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <SearchTabs activeTab={tab} />

        {/* フィルター（投稿タブのみ） */}
        {tab === 'posts' && (
          <div className="p-3 border-b flex items-center gap-2">
            <GenreFilter genres={genres} selectedGenreIds={genreIds} />
          </div>
        )}

        {/* 検索結果 */}
        <div className="p-4">
          <Suspense fallback={<SearchResultsLoading />}>
            <SearchResultsContent
              tab={tab}
              query={query}
              genreIds={genreIds}
              currentUserId={session?.user?.id}
            />
          </Suspense>
        </div>
      </div>

      {/* 人気タグ（クエリがない場合のみ） */}
      {!query && tab === 'tags' && <PopularTags tags={popularTags} />}
    </div>
  )
}

async function SearchResultsContent({
  tab,
  query,
  genreIds,
  currentUserId,
}: {
  tab: string
  query: string
  genreIds: string[]
  currentUserId?: string
}) {
  if (tab === 'posts') {
    const result = await searchPosts(query, genreIds.length > 0 ? genreIds : undefined)
    return (
      <PostSearchResults
        query={query}
        genreIds={genreIds.length > 0 ? genreIds : undefined}
        initialPosts={result.posts}
        currentUserId={currentUserId}
      />
    )
  }

  if (tab === 'users') {
    const result = await searchUsers(query)
    return <UserSearchResults query={query} initialUsers={result.users} />
  }

  if (tab === 'tags') {
    if (!query) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          検索したいタグを入力してください
        </div>
      )
    }
    const result = await searchByTag(query)
    return (
      <TagSearchResults
        tag={query}
        initialPosts={result.posts}
        currentUserId={currentUserId}
      />
    )
  }

  return null
}

function SearchResultsLoading() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-muted/50 rounded-lg p-4 animate-pulse">
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
