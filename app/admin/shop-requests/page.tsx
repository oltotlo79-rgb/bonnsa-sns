import Link from 'next/link'
import Image from 'next/image'
import { getShopChangeRequests } from '@/lib/actions/shop'
import { ShopRequestActions } from './ShopRequestActions'

export const metadata = {
  title: '盆栽園変更リクエスト - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    status?: 'pending' | 'approved' | 'rejected' | 'all'
  }>
}

const statusLabels: Record<string, string> = {
  pending: '保留中',
  approved: '承認済み',
  rejected: '却下済み',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  approved: 'bg-green-500/10 text-green-600',
  rejected: 'bg-red-500/10 text-red-600',
}

export default async function AdminShopRequestsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = params.status || 'pending'

  const result = await getShopChangeRequests({ status })

  if ('error' in result) {
    return <div className="text-red-500">{result.error}</div>
  }

  const { requests } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">盆栽園変更リクエスト</h1>
        <span className="text-sm text-muted-foreground">{requests.length} 件</span>
      </div>

      {/* フィルター */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/shop-requests?status=pending"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'pending'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            保留中
          </Link>
          <Link
            href="/admin/shop-requests?status=approved"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'approved'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            承認済み
          </Link>
          <Link
            href="/admin/shop-requests?status=rejected"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'rejected'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            却下済み
          </Link>
          <Link
            href="/admin/shop-requests?status=all"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            すべて
          </Link>
        </div>
      </div>

      {/* リクエスト一覧 */}
      {requests.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">
          {status === 'pending' ? '保留中のリクエストはありません' : 'リクエストはありません'}
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const changes = request.requestedChanges as Record<string, string>
            const changeFields = Object.keys(changes).filter((k) => changes[k])

            return (
              <div key={request.id} className="bg-card rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* リクエスター情報 */}
                    <div className="flex items-center gap-3 mb-3">
                      {request.user.avatarUrl ? (
                        <Image
                          src={request.user.avatarUrl}
                          alt={request.user.nickname}
                          width={40}
                          height={40}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground">
                            {request.user.nickname.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <Link
                          href={`/users/${request.user.id}`}
                          className="font-medium hover:underline"
                        >
                          {request.user.nickname}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleString('ja-JP')}
                        </p>
                      </div>
                      <span
                        className={`ml-auto px-2 py-1 text-xs font-medium rounded ${
                          statusColors[request.status] || 'bg-muted'
                        }`}
                      >
                        {statusLabels[request.status] || request.status}
                      </span>
                    </div>

                    {/* 対象盆栽園 */}
                    <div className="mb-3">
                      <p className="text-sm text-muted-foreground mb-1">対象盆栽園</p>
                      <Link
                        href={`/shops/${request.shop.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {request.shop.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{request.shop.address}</p>
                    </div>

                    {/* 変更内容サマリー */}
                    <div className="mb-3">
                      <p className="text-sm text-muted-foreground mb-1">変更リクエスト</p>
                      <div className="flex flex-wrap gap-1">
                        {changeFields.map((field) => (
                          <span
                            key={field}
                            className="px-2 py-0.5 text-xs bg-muted rounded"
                          >
                            {fieldLabels[field] || field}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 変更理由 */}
                    {request.reason && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground mb-1">変更理由</p>
                        <p className="text-sm bg-muted/50 p-2 rounded">{request.reason}</p>
                      </div>
                    )}

                    {/* 管理者コメント */}
                    {request.adminComment && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground mb-1">管理者コメント</p>
                        <p className="text-sm bg-blue-50 dark:bg-blue-950 p-2 rounded">
                          {request.adminComment}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* アクションボタン */}
                {request.status === 'pending' && (
                  <div className="mt-4 pt-4 border-t">
                    <ShopRequestActions
                      requestId={request.id}
                      shopId={request.shop.id}
                      shopName={request.shop.name}
                      changes={changes}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const fieldLabels: Record<string, string> = {
  name: '名称',
  address: '住所',
  phone: '電話番号',
  website: 'ウェブサイト',
  businessHours: '営業時間',
  closedDays: '定休日',
}
