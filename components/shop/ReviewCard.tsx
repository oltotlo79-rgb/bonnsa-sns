'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { deleteReview, updateReview } from '@/lib/actions/review'
import { prepareFileForUpload, formatFileSize, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'
import { StarRatingDisplay, StarRatingInput } from './StarRating'
import { ReportButton } from '@/components/report/ReportButton'

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

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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

export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editRating, setEditRating] = useState(review.rating)
  const [editContent, setEditContent] = useState(review.content || '')
  const [editError, setEditError] = useState<string | null>(null)
  // 画像編集用の状態
  const [existingImages, setExistingImages] = useState(review.images)
  const [deleteImageIds, setDeleteImageIds] = useState<string[]>([])
  const [newImages, setNewImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const isOwner = currentUserId === review.user.id

  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  // 現在の合計画像数（既存で削除されていないもの + 新規追加分）
  const remainingExistingCount = existingImages.filter(img => !deleteImageIds.includes(img.id)).length
  const totalImageCount = remainingExistingCount + newImages.length

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
    // 画像の状態をリセット
    setExistingImages(review.images)
    setDeleteImageIds([])
    setNewImages([])
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditError(null)
    // 画像の状態をリセット
    setDeleteImageIds([])
    setNewImages([])
  }

  const handleDeleteExistingImage = (imageId: string) => {
    setDeleteImageIds([...deleteImageIds, imageId])
  }

  const handleRestoreExistingImage = (imageId: string) => {
    setDeleteImageIds(deleteImageIds.filter(id => id !== imageId))
  }

  const handleRemoveNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index))
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (totalImageCount >= 3) {
      setEditError('画像は3枚までです')
      return
    }

    // 画像のファイルサイズチェック（圧縮前）
    if (file.size > MAX_IMAGE_SIZE) {
      setEditError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      e.target.value = ''
      return
    }

    setUploading(true)
    setEditError(null)

    try {
      // 画像を圧縮
      const originalSize = file.size
      const compressedFile = await prepareFileForUpload(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
      })
      const compressedSize = compressedFile.size
      const ratio = Math.round((1 - compressedSize / originalSize) * 100)
      if (ratio > 0) {
        console.log(`圧縮: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${ratio}%削減)`)
      }

      const formData = new FormData()
      formData.append('file', compressedFile)

      // XMLHttpRequestでアップロード
      const result = await new Promise<{ url?: string; error?: string }>((resolve) => {
        const xhr = new XMLHttpRequest()

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              resolve(response)
            } catch {
              resolve({ error: 'アップロードに失敗しました' })
            }
          } else {
            resolve({ error: 'アップロードに失敗しました' })
          }
        })

        xhr.addEventListener('error', () => {
          resolve({ error: 'アップロードに失敗しました' })
        })

        xhr.open('POST', '/api/upload')
        xhr.send(formData)
      })

      if (result.error) {
        setEditError(result.error)
      } else if (result.url) {
        setNewImages([...newImages, result.url])
      }
    } catch {
      setEditError('アップロードに失敗しました')
    }

    setUploading(false)
    e.target.value = ''
  }

  const handleSaveEdit = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('rating', editRating.toString())
      formData.append('content', editContent)
      // 削除する画像ID
      deleteImageIds.forEach(id => formData.append('deleteImageIds', id))
      // 新しく追加する画像URL
      newImages.forEach(url => formData.append('imageUrls', url))

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
        {!isEditing && (
          <div className="flex items-center gap-1">
            {isOwner ? (
              showDeleteConfirm ? (
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
              )
            ) : currentUserId ? (
              // 非オーナーのログインユーザーには通報ボタン
              <ReportButton
                targetType="review"
                targetId={review.id}
                variant="icon"
              />
            ) : null}
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

          {/* 画像編集エリア */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              画像 ({totalImageCount}/3枚)
            </label>

            {/* 既存の画像 */}
            {existingImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {existingImages.map((image) => {
                  const isMarkedForDelete = deleteImageIds.includes(image.id)
                  return (
                    <div key={image.id} className="relative w-20 h-20">
                      <Image
                        src={image.url}
                        alt="レビュー画像"
                        fill
                        className={`object-cover rounded-lg ${isMarkedForDelete ? 'opacity-30' : ''}`}
                      />
                      {isMarkedForDelete ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreExistingImage(image.id)}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg text-white text-xs"
                        >
                          元に戻す
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteExistingImage(image.id)}
                          className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 新しく追加する画像 */}
            {newImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {newImages.map((url, index) => (
                  <div key={`new-${index}`} className="relative w-20 h-20">
                    <Image
                      src={url}
                      alt={`新規画像 ${index + 1}`}
                      fill
                      className="object-cover rounded-lg border-2 border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNewImage(index)}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-xs text-center py-0.5 rounded-b-lg">
                      新規
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 画像追加ボタン */}
            <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted ${totalImageCount >= 3 || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <ImageIcon className="w-4 h-4" />
              <span className="text-sm">
                {uploading ? 'アップロード中...' : '画像を追加'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={totalImageCount >= 3 || uploading}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isPending || uploading}
              className="px-3 py-1 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isPending || uploading}
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
