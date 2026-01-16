import { getHiddenContent, getAdminNotifications } from '@/lib/actions/admin/hidden'
import { HiddenContentList } from './HiddenContentList'
import { AdminNotificationBanner } from './AdminNotificationBanner'

export const metadata = {
  title: '非表示コンテンツ管理 - BON-LOG管理',
}

export default async function HiddenContentPage() {
  const [contentResult, notificationResult] = await Promise.all([
    getHiddenContent(),
    getAdminNotifications({ unreadOnly: true }),
  ])

  if (contentResult.error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
        {contentResult.error}
      </div>
    )
  }

  const items = contentResult.items || []
  const unreadNotifications = notificationResult.notifications || []
  const unreadCount = notificationResult.unreadCount || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">非表示コンテンツ管理</h1>
        <p className="text-muted-foreground">
          通報により自動非表示になったコンテンツを確認・管理できます
        </p>
      </div>

      {/* 未読通知バナー */}
      {unreadCount > 0 && (
        <AdminNotificationBanner
          notifications={unreadNotifications}
          unreadCount={unreadCount}
        />
      )}

      {/* 統計 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(['post', 'comment', 'event', 'shop', 'review'] as const).map((type) => {
          const count = items.filter((item) => item.type === type).length
          const label = {
            post: '投稿',
            comment: 'コメント',
            event: 'イベント',
            shop: '盆栽園',
            review: 'レビュー',
          }[type]
          return (
            <div key={type} className="bg-card p-4 rounded-lg border">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          )
        })}
      </div>

      {/* コンテンツ一覧 */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          非表示コンテンツはありません
        </div>
      ) : (
        <HiddenContentList items={items} />
      )}
    </div>
  )
}
