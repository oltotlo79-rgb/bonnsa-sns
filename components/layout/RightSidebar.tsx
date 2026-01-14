import Link from 'next/link'
import Image from 'next/image'
import { getRecommendedUsers, getTrendingGenres } from '@/lib/actions/feed'

function TrendingIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

export async function RightSidebar() {
  const [usersResult, genresResult] = await Promise.all([
    getRecommendedUsers(5),
    getTrendingGenres(5),
  ])

  const recommendedUsers = usersResult.users || []
  const trendingGenres = genresResult.genres || []

  return (
    <aside className="sticky top-0 h-screen w-80 border-l bg-card hidden xl:flex flex-col p-4 overflow-y-auto">
      {/* おすすめユーザー */}
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <h3 className="font-semibold mb-4">おすすめユーザー</h3>
        {recommendedUsers.length > 0 ? (
          <ul className="space-y-3">
            {recommendedUsers.map((user) => (
              <li key={user.id}>
                <Link
                  href={`/users/${user.id}`}
                  className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 -m-2 transition-colors"
                >
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.nickname}
                      width={40}
                      height={40}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">
                        {user.nickname.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.nickname}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.followersCount}フォロワー
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            おすすめユーザーはいません
          </p>
        )}
        <Link
          href="/search?tab=users"
          className="block text-sm text-primary hover:underline mt-4"
        >
          もっと見る
        </Link>
      </div>

      {/* トレンドジャンル */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingIcon className="w-4 h-4" />
          トレンドジャンル
        </h3>
        {trendingGenres.length > 0 ? (
          <ul className="space-y-2">
            {trendingGenres.map((genre, index) => (
              <li key={genre.id}>
                <Link
                  href={`/search?genre=${genre.id}`}
                  className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 -m-2 transition-colors"
                >
                  <span className="text-muted-foreground text-sm w-4">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{genre.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {genre.postCount}件の投稿
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            トレンドデータはありません
          </p>
        )}
      </div>

      {/* フッター */}
      <div className="mt-auto pt-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          <Link href="/terms" className="hover:underline">利用規約</Link>
          <Link href="/privacy" className="hover:underline">プライバシー</Link>
          <Link href="/help" className="hover:underline">ヘルプ</Link>
        </div>
        <p className="mt-2">&copy; 2024 BON-LOG</p>
      </div>
    </aside>
  )
}
