import Link from 'next/link'
import Image from 'next/image'
import { getRecommendedUsers, getTrendingGenres } from '@/lib/actions/feed'
import { SidebarAd } from '@/components/ads'

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
    <aside className="sticky top-0 h-screen w-80 border-l border-kitsune/20 bg-tonoko/95 backdrop-blur-sm hidden xl:flex flex-col p-4 overflow-y-auto shadow-washi">
      {/* おすすめユーザー */}
      <div className="bg-tonoko border border-kitsune/20 p-4 mb-4 shadow-washi">
        <h3 className="font-serif text-sm mb-4 flex items-center gap-2 text-sumi">
          <span className="w-1 h-4 bg-kitsune" />
          おすすめユーザー
        </h3>
        {recommendedUsers.length > 0 ? (
          <ul className="space-y-3">
            {recommendedUsers.map((user: typeof recommendedUsers[number]) => (
              <li key={user.id}>
                <Link
                  href={`/users/${user.id}`}
                  className="flex items-center gap-3 hover:bg-kitsune/10 p-2 -m-2 transition-all duration-200"
                >
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.nickname}
                      width={40}
                      height={40}
                      className="rounded-sm object-cover border-2 border-border/50"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-muted flex items-center justify-center border-2 border-border/50">
                      <span className="text-muted-foreground text-sm font-serif">
                        {user.nickname.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-sumi">{user.nickname}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.followersCount}人
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
          className="block text-sm text-kitsune hover:text-kitsune/80 mt-4 transition-colors"
        >
          もっと見る →
        </Link>
      </div>

      {/* トレンドジャンル */}
      <div className="bg-tonoko border border-kitsune/20 p-4 shadow-washi">
        <h3 className="font-serif text-sm mb-4 flex items-center gap-2 text-sumi">
          <TrendingIcon className="w-4 h-4 text-kincha" />
          人気のジャンル
        </h3>
        {trendingGenres.length > 0 ? (
          <ul className="space-y-2">
            {trendingGenres.map((genre: typeof trendingGenres[number], index: number) => (
              <li key={genre.id}>
                <Link
                  href={`/search?genre=${genre.id}`}
                  className="flex items-center gap-3 hover:bg-kitsune/10 p-2 -m-2 transition-all duration-200"
                >
                  <span className="w-6 h-6 bg-kincha/10 text-kincha text-xs flex items-center justify-center font-serif border border-kincha/20">
                    {['壱', '弐', '参', '肆', '伍'][index] || index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-sumi">{genre.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {genre.postCount}件
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

      {/* 広告スペース */}
      <div className="mt-4">
        <SidebarAd adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR} />
      </div>

      {/* フッター */}
      <div className="mt-auto pt-6 text-xs text-muted-foreground">
        <div className="h-px bg-gradient-to-r from-transparent via-kincha/20 to-transparent mb-4" />
        <div className="flex flex-wrap gap-3">
          <Link href="/terms" className="hover:text-kitsune transition-colors">利用規約</Link>
          <span className="text-kitsune/30">·</span>
          <Link href="/privacy" className="hover:text-kitsune transition-colors">プライバシー</Link>
          <span className="text-kitsune/30">·</span>
          <Link href="/tokushoho" className="hover:text-kitsune transition-colors">特商法表記</Link>
          <span className="text-kitsune/30">·</span>
          <Link href="/help" className="hover:text-kitsune transition-colors">ヘルプ</Link>
        </div>
        <p className="mt-3 text-muted-foreground/50 font-serif tracking-wider">&copy; 2026 BON-LOG</p>
      </div>
    </aside>
  )
}
