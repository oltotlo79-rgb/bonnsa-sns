/**
 * @file 通知ページコンポーネント
 * @description ユーザーへの通知一覧を表示するページ
 *              - いいね、コメント、フォローなどの通知を時系列で表示
 *              - Server Componentとして実装し、初期データをサーバーサイドで取得
 *              - 未読通知の自動既読処理もサポート
 */

// 通知一覧を取得するServer Action
import { getNotifications } from '@/lib/actions/notification'

// 通知リスト表示コンポーネント - クライアントサイドで無限スクロールや既読処理を担当
import { NotificationList } from '@/components/notification/NotificationList'

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルを設定
 */
export const metadata = {
  title: '通知 - BON-LOG',
}

/**
 * 通知ページのメインコンポーネント
 *
 * @description
 * - Server Componentとしてサーバーサイドで通知データを取得
 * - NotificationListコンポーネントに初期データを渡して表示
 * - 認証チェックはmiddlewareで行われるため、ここでは省略
 *
 * @returns 通知ページのJSX
 */
export default async function NotificationsPage() {
  // サーバーサイドで通知一覧を取得
  const { notifications } = await getNotifications()

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      {/* ページヘッダー */}
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">通知</h1>
      </div>

      {/* 通知リスト - 初期データを渡してクライアントコンポーネントで表示 */}
      {/* 空配列をデフォルト値として渡すことでエラーを防止 */}
      <NotificationList initialNotifications={notifications || []} />
    </div>
  )
}
