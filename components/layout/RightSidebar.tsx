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
    <aside className="sticky top-0 h-screen w-80 border-l bg-card/95 backdrop-blur-sm hidden xl:flex flex-col p-4 overflow-y-auto shadow-washi">
      {/* おすすめユーザー */}
      <div className="card-washi rounded p-4 mb-4">
        <h3 className="font-medium mb-4 text-sm flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full" />
          おすすめユーザー
        </h3>
        {recommendedUsers.length > 0 ? (
          <ul className="space-y-3">
            {recommendedUsers.map((user) => (
              <li key={user.id}>
                <Link
                  href={`/users/${user.id}`}
                  className="flex items-center gap-3 hover:bg-muted/50 rounded p-2 -m-2 transition-all duration-200"
                >
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.nickname}
                      width={40}
                      height={40}
                      className="rounded-full object-cover ring-2 ring-border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center ring-2 ring-border">
                      <span className="text-muted-foreground text-sm font-medium">
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
          className="block text-sm text-primary hover:text-primary/80 mt-4 transition-colors"
        >
          もっと見る →
        </Link>
      </div>

      {/* トレンドジャンル */}
      <div className="card-washi rounded p-4">
        <h3 className="font-medium mb-4 text-sm flex items-center gap-2">
          <TrendingIcon className="w-4 h-4 text-accent" />
          トレンドジャンル
        </h3>
        {trendingGenres.length > 0 ? (
          <ul className="space-y-2">
            {trendingGenres.map((genre, index) => (
              <li key={genre.id}>
                <Link
                  href={`/search?genre=${genre.id}`}
                  className="flex items-center gap-3 hover:bg-muted/50 rounded p-2 -m-2 transition-all duration-200"
                >
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
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
      <div className="mt-auto pt-6 text-xs text-muted-foreground">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-4" />
        <div className="flex flex-wrap gap-3">
          <Link href="/terms" className="hover:text-primary transition-colors">利用規約</Link>
          <span className="text-border">|</span>
          <Link href="/privacy" className="hover:text-primary transition-colors">プライバシー</Link>
          <span className="text-border">|</span>
          <Link href="/help" className="hover:text-primary transition-colors">ヘルプ</Link>
        </div>
        <p className="mt-3 text-muted-foreground/70">&copy; 2024 BON-LOG</p>
      </div>
    </aside>
  )
}
