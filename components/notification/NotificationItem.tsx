'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { markAsRead } from '@/lib/actions/notification'

type Notification = {
  id: string
  type: string
  isRead: boolean
  createdAt: Date | string
  actor: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  post?: {
    id: string
    content: string | null
  } | null
  comment?: {
    id: string
    content: string | null
  } | null
}

type NotificationItemProps = {
  notification: Notification
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function MessageCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  )
}

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function ReplyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  )
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'like':
    case 'comment_like':
      return <HeartIcon className="w-5 h-5 text-red-500" />
    case 'comment':
      return <MessageCircleIcon className="w-5 h-5 text-blue-500" />
    case 'follow':
      return <UserPlusIcon className="w-5 h-5 text-green-500" />
    case 'quote':
      return <RepeatIcon className="w-5 h-5 text-purple-500" />
    case 'reply':
      return <ReplyIcon className="w-5 h-5 text-orange-500" />
    default:
      return <MessageCircleIcon className="w-5 h-5 text-muted-foreground" />
  }
}

function getNotificationMessage(type: string, actorName: string) {
  switch (type) {
    case 'like':
      return <><strong>{actorName}</strong>さんがあなたの投稿にいいねしました</>
    case 'comment_like':
      return <><strong>{actorName}</strong>さんがあなたのコメントにいいねしました</>
    case 'comment':
      return <><strong>{actorName}</strong>さんがあなたの投稿にコメントしました</>
    case 'follow':
      return <><strong>{actorName}</strong>さんがあなたをフォローしました</>
    case 'quote':
      return <><strong>{actorName}</strong>さんがあなたの投稿を引用しました</>
    case 'reply':
      return <><strong>{actorName}</strong>さんがあなたのコメントに返信しました</>
    default:
      return <><strong>{actorName}</strong>さんからの通知</>
  }
}

function getNotificationLink(notification: Notification) {
  const { type, post, comment, actor } = notification

  if (type === 'follow') {
    return `/users/${actor.id}`
  }

  if (post) {
    if (comment) {
      return `/posts/${post.id}#comment-${comment.id}`
    }
    return `/posts/${post.id}`
  }

  return `/users/${actor.id}`
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  const handleClick = async () => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }
  }

  const link = getNotificationLink(notification)
  const contentPreview = notification.comment?.content || notification.post?.content

  return (
    <Link
      href={link}
      onClick={handleClick}
      className={`flex gap-3 p-4 hover:bg-muted/50 transition-colors border-b ${
        !notification.isRead ? 'bg-primary/5' : ''
      }`}
    >
      {/* アイコン */}
      <div className="flex-shrink-0 w-10 h-10 relative">
        {notification.actor.avatarUrl ? (
          <Image
            src={notification.actor.avatarUrl}
            alt={notification.actor.nickname}
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-sm">
              {notification.actor.nickname.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 p-1 bg-card rounded-full">
          {getNotificationIcon(notification.type)}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          {getNotificationMessage(notification.type, notification.actor.nickname)}
        </p>
        {contentPreview && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
            {contentPreview}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
      </div>

      {/* 未読インジケーター */}
      {!notification.isRead && (
        <div className="flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-primary" />
        </div>
      )}
    </Link>
  )
}
