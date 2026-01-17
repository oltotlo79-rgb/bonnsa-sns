import Link from 'next/link'
import { getAdminStats } from '@/lib/actions/admin'
import { getReportStats } from '@/lib/actions/report'

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" x2="8" y1="13" y2="13"/>
      <line x1="16" x2="8" y1="17" y2="17"/>
    </svg>
  )
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" x2="12" y1="9" y2="13"/>
      <line x1="12" x2="12.01" y1="17" y2="17"/>
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14"/>
      <path d="m12 5 7 7-7 7"/>
    </svg>
  )
}

export const metadata = {
  title: '管理者ダッシュボード - BON-LOG',
}

export default async function AdminDashboardPage() {
  const stats = await getAdminStats()
  const reportResult = await getReportStats()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {/* 主要統計 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <UsersIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">総ユーザー数</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</p>
          <p className="text-sm text-green-500 mt-1">+{stats.todayUsers} 今日</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
              <FileTextIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">総投稿数</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalPosts.toLocaleString()}</p>
          <p className="text-sm text-green-500 mt-1">+{stats.todayPosts} 今日</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
              <AlertTriangleIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">未対応通報</span>
          </div>
          <p className="text-3xl font-bold text-red-500">{stats.pendingReports}</p>
          <Link href="/admin/reports" className="text-sm text-blue-500 hover:underline mt-1 inline-flex items-center gap-1">
            確認する <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
              <ActivityIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">週間アクティブ</span>
          </div>
          <p className="text-3xl font-bold">{stats.activeUsersWeek.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">過去7日間</p>
        </div>
      </div>

      {/* サブ統計 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">登録イベント数</span>
          </div>
          <p className="text-2xl font-bold">{stats.totalEvents.toLocaleString()}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-teal-500/10 text-teal-500 rounded-lg">
              <MapPinIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">登録盆栽園数</span>
          </div>
          <p className="text-2xl font-bold">{stats.totalShops.toLocaleString()}</p>
        </div>
      </div>

      {/* 通報統計 */}
      {'stats' in reportResult && reportResult.stats && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">通報統計</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{reportResult.stats.pending}</p>
              <p className="text-sm text-muted-foreground">未対応</p>
            </div>
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{reportResult.stats.reviewed}</p>
              <p className="text-sm text-muted-foreground">確認中</p>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{reportResult.stats.resolved}</p>
              <p className="text-sm text-muted-foreground">対応完了</p>
            </div>
            <div className="text-center p-3 bg-gray-500/10 rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{reportResult.stats.dismissed}</p>
              <p className="text-sm text-muted-foreground">却下</p>
            </div>
          </div>

          {reportResult.stats.byType && Object.keys(reportResult.stats.byType).length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium mb-2">種別ごとの通報</h3>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(reportResult.stats.byType) as [string, number][]).map(([type, count]) => (
                  <span key={type} className="px-3 py-1 bg-muted rounded-full text-sm">
                    {type === 'post' && '投稿'}
                    {type === 'comment' && 'コメント'}
                    {type === 'event' && 'イベント'}
                    {type === 'shop' && '盆栽園'}
                    {type === 'user' && 'ユーザー'}
                    : {count}件
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* クイックアクション */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">クイックアクション</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/users"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <UsersIcon className="w-8 h-8 text-blue-500" />
            <span className="text-sm">ユーザー管理</span>
          </Link>
          <Link
            href="/admin/posts"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <FileTextIcon className="w-8 h-8 text-green-500" />
            <span className="text-sm">投稿管理</span>
          </Link>
          <Link
            href="/admin/reports"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <AlertTriangleIcon className="w-8 h-8 text-red-500" />
            <span className="text-sm">通報管理</span>
          </Link>
          <Link
            href="/admin/logs"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <ActivityIcon className="w-8 h-8 text-purple-500" />
            <span className="text-sm">操作ログ</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
