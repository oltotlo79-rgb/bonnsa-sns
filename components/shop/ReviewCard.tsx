'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { deleteReview, updateReview } from '@/lib/actions/review'
import { StarRatingDisplay, StarRatingInput } from './StarRating'

interface ReviewCardProps {
  review: {
    id: string
    rating: number
    content: string | null
    createdAt: Date | string
    user: {
      id: string
      nickname: string
      avatarUrl: string | null
    }
    images: { id: string; url: string }[]
  }
  currentUserId?: string
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editRating, setEditRating] = useState(review.rating)
  const [editContent, setEditContent] = useState(review.content || '')
  const [editError, setEditError] = useState<string | null>(null)

  const isOwner = currentUserId === review.user.id

  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteReview(review.id)
      if (result.success) {
        router.refresh()
      }
    })
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditRating(review.rating)
    setEditContent(review.content || '')
    setEditError(null)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditError(null)
  }

  const handleSaveEdit = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('rating', editRating.toString())
      formData.append('content', editContent)

      const result = await updateReview(review.id, formData)
      if (result.error) {
        setEditError(result.error)
      } else {
        setIsEditing(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="p-4 border-b last:border-b-0">
      {/* ヘッダー */}
      <div className="flex items-start gap-3 mb-3">
        <Link href={`/users/${review.user.id}`} className="flex-shrink-0">
          {review.user.avatarUrl ? (
            <Image
              src={review.user.avatarUrl}
              alt={review.user.nickname}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                {review.user.nickname.charAt(0)}
              </span>
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/users/${review.user.id}`}
              className="font-medium hover:underline"
            >
              {review.user.nickname}
            </Link>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          <StarRatingDisplay rating={review.rating} size="sm" />
        </div>
        {isOwner && !isEditing && (
          <div className="flex items-center gap-1">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  {isPending ? '削除中...' : '削除する'}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleEdit}
                  className="p-1 text-muted-foreground hover:text-primary"
                  title="編集"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  title="削除"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 編集フォーム */}
      {isEditing ? (
        <div className="space-y-3">
          {editError && (
            <p className="text-sm text-destructive">{editError}</p>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">評価</label>
            <StarRatingInput value={editRating} onChange={setEditRating} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">コメント</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="レビューコメント（任意）"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isPending}
              className="px-3 py-1 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isPending}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* コンテンツ */}
          {review.content && (
            <p className="text-sm whitespace-pre-wrap mb-3">{review.content}</p>
          )}

          {/* 画像 */}
          {review.images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {review.images.map((image) => (
                <div key={image.id} className="relative w-24 h-24">
                  <Image
                    src={image.url}
                    alt="レビュー画像"
                    fill
                    className="object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
