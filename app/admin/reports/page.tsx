import Link from 'next/link'
import Image from 'next/image'
import { getReports } from '@/lib/actions/report'
import { REPORT_REASONS } from '@/lib/constants/report'
import { ReportActionsDropdown } from './ReportActionsDropdown'

export const metadata = {
  title: '通報管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
    targetType?: 'post' | 'comment' | 'event' | 'shop' | 'user'
    page?: string
  }>
}

const statusLabels = {
  pending: '未対応',
  reviewed: '確認中',
  resolved: '対応完了',
  dismissed: '却下',
}

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  reviewed: 'bg-blue-500/10 text-blue-600',
  resolved: 'bg-green-500/10 text-green-600',
  dismissed: 'bg-gray-500/10 text-gray-600',
}

const targetTypeLabels = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  user: 'ユーザー',
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = params.status
  const targetType = params.targetType
  const page = parseInt(params.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const result = await getReports({
    status,
    targetType,
    limit,
    offset,
  })

  if ('error' in result) {
    return <div className="text-red-500">{result.error}</div>
  }

  const { reports, total } = result
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">通報管理</h1>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      {/* フィルター */}
      <div className="bg-card rounded-lg border p-4">
        <form className="flex flex-wrap gap-4">
          <select
            name="status"
            defaultValue={status || ''}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">全ステータス</option>
            <option value="pending">未対応</option>
            <option value="reviewed">確認中</option>
            <option value="resolved">対応完了</option>
            <option value="dismissed">却下</option>
          </select>

          <select
            name="targetType"
            defaultValue={targetType || ''}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">全タイプ</option>
            <option value="post">投稿</option>
            <option value="comment">コメント</option>
            <option value="event">イベント</option>
            <option value="shop">盆栽園</option>
            <option value="user">ユーザー</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            フィルター
          </button>
        </form>
      </div>

      {/* 通報テーブル */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">通報者</th>
              <th className="text-left px-4 py-3 text-sm font-medium">対象タイプ</th>
              <th className="text-left px-4 py-3 text-sm font-medium">理由</th>
              <th className="text-left px-4 py-3 text-sm font-medium">詳細</th>
              <th className="text-left px-4 py-3 text-sm font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-sm font-medium">通報日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reports.map((report: typeof reports[number]) => {
              const reasonLabel = REPORT_REASONS.find(r => r.value === report.reason)?.label || report.reason

              return (
                <tr key={report.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/users/${report.reporter.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      {report.reporter.avatarUrl ? (
                        <Image
                          src={report.reporter.avatarUrl}
                          alt={report.reporter.nickname}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-muted rounded-full" />
                      )}
                      <span className="text-sm">{report.reporter.nickname}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs bg-muted rounded-full">
                      {targetTypeLabels[report.targetType as keyof typeof targetTypeLabels]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {reasonLabel}
                  </td>
                  <td className="px-4 py-3">
                    {report.description ? (
                      <span className="text-sm line-clamp-1 max-w-[200px]">
                        {report.description}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[report.status as keyof typeof statusColors]}`}>
                      {statusLabels[report.status as keyof typeof statusLabels]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(report.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    <ReportActionsDropdown
                      reportId={report.id}
                      currentStatus={report.status}
                      targetType={report.targetType}
                      targetId={report.targetId}
                    />
                  </td>
                </tr>
              )
            })}

            {reports.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  通報が見つかりません
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
              href={`/admin/reports?status=${status || ''}&targetType=${targetType || ''}&page=${page - 1}`}
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
              href={`/admin/reports?status=${status || ''}&targetType=${targetType || ''}&page=${page + 1}`}
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
