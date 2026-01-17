import Link from 'next/link'
import Image from 'next/image'
import { getPremiumUsers, getPremiumStats } from '@/lib/actions/admin/premium'
import { PremiumActionsDropdown } from './PremiumActionsDropdown'

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  )
}

export const metadata = {
  title: 'プレミアム会員管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    search?: string
    page?: string
  }>
}

export default async function AdminPremiumPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const [usersResult, statsResult] = await Promise.all([
    getPremiumUsers({ search: search || undefined, limit, offset }),
    getPremiumStats(),
  ])

  const users = 'error' in usersResult ? [] : usersResult.users
  const total = 'error' in usersResult ? 0 : usersResult.total
  const stats = 'error' in statsResult ? null : statsResult

  const totalPages = Math.ceil(total / limit)

  // 日付計算（レンダー外で事前計算）
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CrownIcon className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold">プレミアム会員管理</h1>
        </div>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      {/* 統計 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">総プレミアム会員</p>
            <p className="text-2xl font-bold">{stats.totalPremiumUsers}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">今月の新規</p>
            <p className="text-2xl font-bold">{stats.newThisMonth}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">7日以内に期限切れ</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.expiringIn7Days}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">総売上（概算）</p>
            <p className="text-2xl font-bold">¥{(stats.totalRevenue || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* フィルター */}
      <div className="bg-card rounded-lg border p-4">
        <form className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                placeholder="ニックネーム・メールアドレスで検索"
                defaultValue={search}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            検索
          </button>
        </form>
      </div>

      {/* ユーザーテーブル */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">ユーザー</th>
              <th className="text-left px-4 py-3 text-sm font-medium">メール</th>
              <th className="text-left px-4 py-3 text-sm font-medium">プレミアム開始</th>
              <th className="text-left px-4 py-3 text-sm font-medium">有効期限</th>
              <th className="text-left px-4 py-3 text-sm font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user: typeof users[number]) => {
              const isExpiringSoon = user.premiumExpiresAt &&
                new Date(user.premiumExpiresAt) < sevenDaysFromNow
              const isExpired = user.premiumExpiresAt &&
                new Date(user.premiumExpiresAt) < now

              return (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/users/${user.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      {user.avatarUrl ? (
                        <Image
                          src={user.avatarUrl}
                          alt={user.nickname}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-muted rounded-full" />
                      )}
                      <span className="font-medium">{user.nickname}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ja-JP') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {user.premiumExpiresAt ? (
                      <span className={isExpiringSoon ? 'text-yellow-600 font-medium' : ''}>
                        {new Date(user.premiumExpiresAt).toLocaleDateString('ja-JP')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">無期限</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isExpired ? (
                      <span className="px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded-full">
                        期限切れ
                      </span>
                    ) : user.stripeSubscriptionId ? (
                      <span className="px-2 py-1 text-xs bg-green-500/10 text-green-500 rounded-full">
                        Stripe連携
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-blue-500/10 text-blue-500 rounded-full">
                        手動付与
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PremiumActionsDropdown
                      userId={user.id}
                      userName={user.nickname}
                      isPremium={user.isPremium}
                      premiumExpiresAt={user.premiumExpiresAt}
                    />
                  </td>
                </tr>
              )
            })}

            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  プレミアム会員が見つかりません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/premium?search=${search}&page=${page - 1}`}
              className="px-3 py-1 border rounded hover:bg-muted"
            >
              前へ
            </Link>
          )}

          <span className="px-3 py-1">
            {page} / {totalPages}
          </span>

          {page < totalPages && (
            <Link
              href={`/admin/premium?search=${search}&page=${page + 1}`}
              className="px-3 py-1 border rounded hover:bg-muted"
            >
              次へ
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
