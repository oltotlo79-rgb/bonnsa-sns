'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { deleteBonsaiRecord } from '@/lib/actions/bonsai'

// 成長記録の型
interface BonsaiRecord {
  id: string
  content: string | null
  recordAt: Date
  createdAt: Date
  images: { id: string; url: string }[]
}

// 投稿の型
type PostUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

type PostMedia = {
  id: string
  url: string
  type: string
  sortOrder: number
}

type PostGenre = {
  postId: string
  genreId: string
  genre: {
    id: string
    name: string
    category: string
  }
}

interface Post {
  id: string
  content: string | null
  createdAt: string | Date
  user: PostUser
  media: PostMedia[]
  genres: PostGenre[]
  _count: {
    likes: number
    comments: number
  }
}

// 統合タイムラインアイテムの型
type TimelineItem =
  | { type: 'record'; data: BonsaiRecord; date: Date }
  | { type: 'post'; data: Post; date: Date }

interface BonsaiTimelineProps {
  records: BonsaiRecord[]
  posts: Post[]
  isOwner: boolean
  currentUserId?: string
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
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

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}

export function BonsaiTimeline({ records, posts, isOwner }: BonsaiTimelineProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // 成長記録と投稿を統合してソート
  const timelineItems: TimelineItem[] = [
    ...records.map((record) => ({
      type: 'record' as const,
      data: record,
      date: new Date(record.recordAt || record.createdAt),
    })),
    ...posts.map((post) => ({
      type: 'post' as const,
      data: post,
      date: new Date(post.createdAt),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('この記録を削除しますか？')) return

    setDeletingId(recordId)
    try {
      const result = await deleteBonsaiRecord(recordId)
      if (result.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    } catch {
      alert('削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  if (timelineItems.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ImageIcon className="w-12 h-12 mx-auto mb-3" />
        <p>まだ記録や投稿がありません</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y">
        {timelineItems.map((item) => {
          if (item.type === 'record') {
            const record = item.data
            return (
              <div key={`record-${record.id}`} className="p-4">
                <div className="flex items-start gap-3">
                  {/* 成長記録アイコン */}
                  <div className="flex-shrink-0 w-10 h-10 bg-bonsai-green/10 rounded-full flex items-center justify-center">
                    <LeafIcon className="w-5 h-5 text-bonsai-green" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-bonsai-green">成長記録</span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(item.date, { addSuffix: true, locale: ja })}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          disabled={deletingId === record.id}
                          className="ml-auto p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                          title="削除"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {record.content && (
                      <p className="mt-1 text-sm whitespace-pre-wrap">{record.content}</p>
                    )}

                    {record.images.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {record.images.map((image) => (
                          <button
                            key={image.id}
                            onClick={() => setSelectedImage(image.url)}
                            className="relative w-20 h-20 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                          >
                            <Image
                              src={image.url}
                              alt="成長記録画像"
                              fill
                              className="object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          } else {
            const post = item.data
            return (
              <Link
                key={`post-${post.id}`}
                href={`/posts/${post.id}`}
                className="block p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex gap-3">
                  {/* アバター */}
                  <div className="flex-shrink-0">
                    {post.user.avatarUrl ? (
                      <Image
                        src={post.user.avatarUrl}
                        alt={post.user.nickname}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">
                          {post.user.nickname.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold truncate">{post.user.nickname}</span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(item.date, { addSuffix: true, locale: ja })}
                      </span>
                    </div>

                    {post.content && (
                      <p className="mt-1 text-sm whitespace-pre-wrap break-words line-clamp-3">
                        {post.content}
                      </p>
                    )}

                    {post.media.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {post.media.slice(0, 4).map((media, index) => (
                          <div key={media.id} className="relative w-16 h-16 bg-muted rounded overflow-hidden">
                            {media.type === 'video' ? (
                              <video src={media.url} className="w-full h-full object-cover" />
                            ) : (
                              <Image src={media.url} alt="" fill className="object-cover" />
                            )}
                            {index === 3 && post.media.length > 4 && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold">
                                +{post.media.length - 4}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {post.genres.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {post.genres.map((pg) => (
                          <span
                            key={pg.genreId}
                            className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground"
                          >
                            {pg.genre.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HeartIcon className="w-4 h-4" />
                        {post._count.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircleIcon className="w-4 h-4" />
                        {post._count.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          }
        })}
      </div>

      {/* 画像モーダル */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
            <Image
              src={selectedImage}
              alt="成長記録画像"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  )
}
