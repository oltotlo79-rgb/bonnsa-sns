import Link from 'next/link'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/actions/admin'
import { redirect } from 'next/navigation'
import { EventActionsDropdown } from './EventActionsDropdown'

export const metadata = {
  title: 'イベント管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    search?: string
    page?: string
  }>
}

export default async function AdminEventsPage({ searchParams }: PageProps) {
  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    redirect('/feed')
  }

  const params = await searchParams
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const where = search
    ? {
        OR: [
          { title: { contains: search } },
          { venue: { contains: search } },
        ],
      }
    : {}

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        creator: {
          select: { id: true, nickname: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.event.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">イベント管理</h1>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      {/* フィルター */}
      <div className="bg-card rounded-lg border p-4">
        <form className="flex gap-4">
          <input
            type="text"
            name="search"
            placeholder="タイトル・会場で検索"
            defaultValue={search}
            className="flex-1 px-4 py-2 border rounded-lg bg-background"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            検索
          </button>
        </form>
      </div>

      {/* イベントテーブル */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">タイトル</th>
              <th className="text-left px-4 py-3 text-sm font-medium">登録者</th>
              <th className="text-left px-4 py-3 text-sm font-medium">開催日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">場所</th>
              <th className="text-left px-4 py-3 text-sm font-medium">登録日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((event: typeof events[number]) => (
              <tr key={event.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/events/${event.id}`}
                    className="text-sm font-medium hover:underline line-clamp-1 max-w-[200px]"
                  >
                    {event.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/users/${event.creator.id}`}
                    className="text-sm hover:underline"
                  >
                    {event.creator.nickname}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm">
                  {new Date(event.startDate).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {event.prefecture}
                  {event.city && ` ${event.city}`}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(event.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3">
                  <EventActionsDropdown eventId={event.id} />
                </td>
              </tr>
            ))}

            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  イベントが見つかりません
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
              href={`/admin/events?search=${search}&page=${page - 1}`}
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
              href={`/admin/events?search=${search}&page=${page + 1}`}
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
