import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { getConversations } from '@/lib/actions/message'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

export const metadata = {
  title: 'メッセージ - BON-LOG',
}

export default async function MessagesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

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
          <div className="p-8 text-center">
            <MessageSquareIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              まだメッセージはありません
            </p>
            <p className="text-sm text-muted-foreground">
              ユーザーのプロフィールページから<br />
              メッセージを送ることができます
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
              >
                {/* アバター */}
                {conversation.otherUser?.avatarUrl ? (
                  <Image
                    src={conversation.otherUser.avatarUrl}
                    alt={conversation.otherUser.nickname || ''}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-lg text-muted-foreground">
                      {conversation.otherUser?.nickname?.charAt(0) || '?'}
                    </span>
                  </div>
                )}

                {/* 会話情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">
                      {conversation.otherUser?.nickname || '削除されたユーザー'}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(conversation.updatedAt), {
                        addSuffix: true,
                        locale: ja,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {conversation.lastMessage?.content || 'メッセージなし'}
                    </p>
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
