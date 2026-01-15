import { getStatsHistory, getStatsSummary } from '@/lib/actions/admin'
import { StatsCharts } from './StatsCharts'

export const metadata = {
  title: '統計情報 - BON-LOG 管理',
}

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  )
}

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
      <line x1="10" x2="8" y1="9" y2="9"/>
    </svg>
  )
}

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

export default async function AdminStatsPage() {
  const [statsHistory, summary] = await Promise.all([
    getStatsHistory(30),
    getStatsSummary(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendUpIcon className="w-6 h-6" />
        <h1 className="text-2xl font-bold">統計情報</h1>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ユーザー */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <UsersIcon className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="font-semibold">ユーザー</h3>
          </div>
          <p className="text-3xl font-bold">{summary.users.total.toLocaleString()}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">今日</p>
              <p className="font-medium text-green-500">+{summary.users.today}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今週</p>
              <p className="font-medium">+{summary.users.week}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今月</p>
              <p className="font-medium">+{summary.users.month}</p>
            </div>
          </div>
        </div>

        {/* 投稿 */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <FileTextIcon className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="font-semibold">投稿</h3>
          </div>
          <p className="text-3xl font-bold">{summary.posts.total.toLocaleString()}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">今日</p>
              <p className="font-medium text-green-500">+{summary.posts.today}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今週</p>
              <p className="font-medium">+{summary.posts.week}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今月</p>
              <p className="font-medium">+{summary.posts.month}</p>
            </div>
          </div>
        </div>

        {/* コメント */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <MessageSquareIcon className="w-5 h-5 text-purple-500" />
            </div>
            <h3 className="font-semibold">コメント</h3>
          </div>
          <p className="text-3xl font-bold">{summary.comments.total.toLocaleString()}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">今日</p>
              <p className="font-medium text-green-500">+{summary.comments.today}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今週</p>
              <p className="font-medium">+{summary.comments.week}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今月</p>
              <p className="font-medium">+{summary.comments.month}</p>
            </div>
          </div>
        </div>
      </div>

      {/* グラフ */}
      <StatsCharts data={statsHistory} />
    </div>
  )
}
