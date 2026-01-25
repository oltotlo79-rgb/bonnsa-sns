/**
 * @file メッセージ一覧ページコンポーネント
 * @description ユーザー間のダイレクトメッセージ会話一覧を表示するページ
 *              - 認証済みユーザーのみアクセス可能
 *              - Server Componentとして実装し、会話一覧をサーバーサイドで取得
 *              - 未読メッセージのインジケーター表示をサポート
 */

// Next.js のリダイレクト関数 - 未認証ユーザーをログインページへ誘導
import { redirect } from 'next/navigation'

// Next.js のLink コンポーネント - クライアントサイドナビゲーション用
import Link from 'next/link'

// Next.js のImage コンポーネント - 最適化されたアバター画像表示
import Image from 'next/image'

// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'

// 会話一覧を取得するServer Action
import { getConversations } from '@/lib/actions/message'

// date-fns の相対時間フォーマット関数 - 「3分前」のような表示に使用
import { formatDistanceToNow } from 'date-fns'

// date-fns の日本語ロケール - 日本語での時間表示
import { ja } from 'date-fns/locale'

/**
 * 会話データの型定義
 */
type Conversation = {
  id: string           // 会話ID
  updatedAt: Date      // 最終更新日時
  otherUser?: {        // 相手ユーザーの情報
    id: string
    nickname: string | null
    avatarUrl: string | null
  } | null
  lastMessage?: {      // 最新メッセージ
    content: string
  } | null
  hasUnread: boolean   // 未読メッセージの有無
}

/**
 * メッセージアイコンコンポーネント
 *
 * @description
 * 会話がない場合の空状態表示に使用するSVGアイコン
 *
 * @param className - 追加のCSSクラス
 * @returns SVGアイコンのJSX
 */
function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルを設定
 */
export const metadata = {
  title: 'メッセージ - BON-LOG',
}

/**
 * メッセージ一覧ページのメインコンポーネント
 *
 * @description
 * - 認証チェックを行い、未ログインユーザーはログインページへリダイレクト
 * - 会話一覧をサーバーサイドで取得して表示
 * - 各会話には最新メッセージのプレビューと未読インジケーターを表示
 *
 * @returns メッセージ一覧ページのJSX
 */
export default async function MessagesPage() {
  // 現在のセッション情報を取得
  const session = await auth()

  // 未認証の場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect('/login')
  }

  // 会話一覧を取得
  const { conversations } = await getConversations()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダー */}
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">メッセージ</h1>
        </div>

        {/* 会話一覧 */}
        {conversations.length === 0 ? (
          // 会話がない場合の空状態表示
          <div className="p-8 text-center">
            {/* メッセージアイコン */}
            <MessageSquareIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />

            {/* メインメッセージ */}
            <p className="text-muted-foreground mb-4">
              まだメッセージはありません
            </p>

            {/* 補足説明 */}
            <p className="text-sm text-muted-foreground">
              ユーザーのプロフィールページから<br />
              メッセージを送ることができます
            </p>
          </div>
        ) : (
          // 会話リスト表示
          <div className="divide-y">
            {conversations.map((conversation: Conversation) => (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
              >
                {/* アバター画像 */}
                {conversation.otherUser?.avatarUrl ? (
                  <Image
                    src={conversation.otherUser.avatarUrl}
                    alt={conversation.otherUser.nickname || ''}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  // アバターがない場合のフォールバック（頭文字表示）
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-lg text-muted-foreground">
                      {conversation.otherUser?.nickname?.charAt(0) || '?'}
                    </span>
                  </div>
                )}

                {/* 会話情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    {/* 相手ユーザー名 */}
                    <span className="font-medium truncate">
                      {conversation.otherUser?.nickname || '削除されたユーザー'}
                    </span>

                    {/* 最終更新時刻（相対表示） */}
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(conversation.updatedAt), {
                        addSuffix: true,
                        locale: ja,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 最新メッセージのプレビュー */}
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {conversation.lastMessage?.content || 'メッセージなし'}
                    </p>

                    {/* 未読インジケーター */}
                    {conversation.hasUnread && (
                      <span className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0" />
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
