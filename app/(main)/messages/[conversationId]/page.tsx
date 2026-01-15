import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { getConversation, getMessages } from '@/lib/actions/message'
import { MessageList } from '@/components/message/MessageList'
import { MessageForm } from '@/components/message/MessageForm'

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7"/>
      <path d="M19 12H5"/>
    </svg>
  )
}

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>
}

export async function generateMetadata({ params }: ConversationPageProps) {
  const { conversationId } = await params
  const result = await getConversation(conversationId)

  if ('error' in result || !result.conversation) {
    return { title: 'メッセージ - BON-LOG' }
  }

  return {
    title: `${result.conversation.otherUser?.nickname || 'ユーザー'}とのメッセージ - BON-LOG`,
  }
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const { conversationId } = await params

  const [conversationResult, messagesResult] = await Promise.all([
    getConversation(conversationId),
    getMessages(conversationId),
  ])

  if ('error' in conversationResult || !conversationResult.conversation) {
    notFound()
  }

  if ('error' in messagesResult) {
    notFound()
  }

  const { conversation } = conversationResult
  const { messages, currentUserId } = messagesResult

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      <div className="bg-card rounded-lg border flex flex-col h-full">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Link
            href="/messages"
            className="p-2 hover:bg-muted rounded-lg transition-colors -ml-2"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>

          <Link
            href={conversation.otherUser ? `/users/${conversation.otherUser.id}` : '#'}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {conversation.otherUser?.avatarUrl ? (
              <Image
                src={conversation.otherUser.avatarUrl}
                alt={conversation.otherUser.nickname || ''}
                width={40}
                height={40}
                className="rounded-full"
              />
            ) : (
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                <span className="text-muted-foreground">
                  {conversation.otherUser?.nickname?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <span className="font-medium">
              {conversation.otherUser?.nickname || '削除されたユーザー'}
            </span>
          </Link>
        </div>

        {/* メッセージ一覧 */}
        <MessageList
          initialMessages={messages}
          conversationId={conversationId}
          currentUserId={currentUserId}
        />

        {/* 入力フォーム */}
        <MessageForm conversationId={conversationId} />
      </div>
    </div>
  )
}
