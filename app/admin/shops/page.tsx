import Link from 'next/link'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/actions/admin'
import { redirect } from 'next/navigation'
import { ShopActionsDropdown } from './ShopActionsDropdown'

export const metadata = {
  title: '盆栽園管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    search?: string
    page?: string
  }>
}

export default async function AdminShopsPage({ searchParams }: PageProps) {
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
          { name: { contains: search } },
          { address: { contains: search } },
        ],
      }
    : {}

  const [shops, total] = await Promise.all([
    prisma.bonsaiShop.findMany({
      where,
      include: {
        creator: {
          select: { id: true, nickname: true },
        },
        _count: {
          select: { reviews: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.bonsaiShop.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">盆栽園管理</h1>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      {/* フィルター */}
      <div className="bg-card rounded-lg border p-4">
        <form className="flex gap-4">
          <input
            type="text"
            name="search"
            placeholder="名前・住所で検索"
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

      {/* 盆栽園テーブル */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">名前</th>
              <th className="text-left px-4 py-3 text-sm font-medium">登録者</th>
              <th className="text-left px-4 py-3 text-sm font-medium">住所</th>
              <th className="text-left px-4 py-3 text-sm font-medium">レビュー数</th>
              <th className="text-left px-4 py-3 text-sm font-medium">登録日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shops.map((shop: typeof shops[number]) => (
              <tr key={shop.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/shops/${shop.id}`}
                    className="text-sm font-medium hover:underline line-clamp-1 max-w-[200px]"
                  >
                    {shop.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/users/${shop.creator.id}`}
                    className="text-sm hover:underline"
                  >
                    {shop.creator.nickname}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
                  {shop.address || '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {shop._count.reviews}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(shop.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3">
                  <ShopActionsDropdown shopId={shop.id} />
                </td>
              </tr>
            ))}

            {shops.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  盆栽園が見つかりません
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
              href={`/admin/shops?search=${search}&page=${page - 1}`}
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
              href={`/admin/shops?search=${search}&page=${page + 1}`}
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
