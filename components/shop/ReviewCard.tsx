/**
 * @file ReviewCard.tsx
 * @description 個別レビューカードコンポーネント
 *
 * 機能概要:
 * - レビューの詳細（評価、コメント、画像）を表示
 * - 投稿者情報と投稿日時を表示
 * - 自分のレビューの場合は編集・削除機能を提供
 * - 他人のレビューの場合は通報ボタンを表示
 * - 編集モードでは評価、コメント、画像の変更が可能
 * - 画像のアップロード・削除機能を実装
 *
 * 使用例:
 * ```tsx
 * <ReviewCard
 *   review={reviewData}
 *   currentUserId={session?.user?.id}
 * />
 * ```
 */
'use client'

// React hooks
// useState: 編集モード、削除確認、画像管理などの状態を管理
// useTransition: 削除・更新処理の非同期状態を管理
import { useState, useTransition } from 'react'

// Next.jsのルーターフック
// 削除・更新後のページ更新に使用
import { useRouter } from 'next/navigation'

// Next.jsの画像最適化コンポーネント
// レビュー画像とアバター画像の表示に使用
import Image from 'next/image'

// Next.jsのリンクコンポーネント
// ユーザープロフィールページへのリンクに使用
import Link from 'next/link'

// date-fnsの相対時間フォーマット関数
// 「3時間前」のような表示形式に変換
import { formatDistanceToNow } from 'date-fns'

// 日本語ロケール設定
import { ja } from 'date-fns/locale'

// Server Actions - レビュー操作
// deleteReview: レビューの削除
// updateReview: レビューの更新
import { deleteReview, updateReview } from '@/lib/actions/review'

// クライアントサイド画像圧縮ユーティリティ
// prepareFileForUpload: 画像をアップロード前に圧縮
// formatFileSize: ファイルサイズを人間が読みやすい形式に変換
// MAX_IMAGE_SIZE: 最大アップロードサイズ（定数）
import { prepareFileForUpload, formatFileSize, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'

// 星評価コンポーネント
// StarRatingDisplay: 読み取り専用の星評価表示
// StarRatingInput: 編集可能な星評価入力
import { StarRatingDisplay, StarRatingInput } from './StarRating'

// 通報ボタンコンポーネント
// 不適切なレビューを通報する機能
import { ReportButton } from '@/components/report/ReportButton'

/**
 * ReviewCardコンポーネントのプロパティ定義
 */
interface ReviewCardProps {
  /** レビューデータ */
  review: {
    /** レビューID */
    id: string
    /** 評価（1〜5） */
    rating: number
    /** コメント（任意） */
    content: string | null
    /** 投稿日時 */
    createdAt: Date | string
    /** 投稿者情報 */
    user: {
      /** ユーザーID */
      id: string
      /** ニックネーム */
      nickname: string
      /** アバター画像URL */
      avatarUrl: string | null
    }
    /** 添付画像の配列 */
    images: { id: string; url: string }[]
  }
  /** 現在ログインしているユーザーのID */
  currentUserId?: string
}

/**
 * ゴミ箱アイコンコンポーネント
 * 削除ボタンに使用
 *
 * @param className - 追加のCSSクラス名
 */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

/**
 * 鉛筆アイコンコンポーネント
 * 編集ボタンに使用
 *
 * @param className - 追加のCSSクラス名
 */
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

/**
 * Xアイコンコンポーネント
 * 画像削除ボタンに使用
 *
 * @param className - 追加のCSSクラス名
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * 画像アイコンコンポーネント
 * 画像追加ボタンに使用
 *
 * @param className - 追加のCSSクラス名
 */
function ImageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

/**
 * 個別レビューカードコンポーネント
 *
 * レビューの内容を表示し、投稿者本人には編集・削除機能を提供する。
 * 他のユーザーには通報ボタンが表示される。
 * 編集モードでは、評価の変更、コメントの編集、画像の追加/削除が可能。
 *
 * @param review - レビューデータ
 * @param currentUserId - 現在のユーザーID
 */
export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  // ルーターインスタンス（操作後のページ更新用）
  const router = useRouter()

  // 削除・更新の非同期処理状態を管理
  const [isPending, startTransition] = useTransition()

  // 削除確認ダイアログの表示状態
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 編集モードの状態
  const [isEditing, setIsEditing] = useState(false)

  // 編集中の評価値
  const [editRating, setEditRating] = useState(review.rating)

  // 編集中のコメント
  const [editContent, setEditContent] = useState(review.content || '')

  // 編集時のエラーメッセージ
  const [editError, setEditError] = useState<string | null>(null)

  // --- 画像編集用の状態管理 ---

  // 既存の画像リスト（編集開始時にレビューの画像で初期化）
  const [existingImages, setExistingImages] = useState(review.images)

  // 削除対象としてマークされた画像IDの配列
  const [deleteImageIds, setDeleteImageIds] = useState<string[]>([])

  // 新規追加する画像URLの配列
  const [newImages, setNewImages] = useState<string[]>([])

  // 画像アップロード中の状態
  const [uploading, setUploading] = useState(false)

  // 現在のユーザーがこのレビューの投稿者かどうか
  const isOwner = currentUserId === review.user.id

  // 投稿日時を相対時間形式（「3時間前」など）に変換
  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  // 現在の合計画像数（既存で削除されていないもの + 新規追加分）
  // 最大3枚の制限判定に使用
  const remainingExistingCount = existingImages.filter(img => !deleteImageIds.includes(img.id)).length
  const totalImageCount = remainingExistingCount + newImages.length

  /**
   * レビュー削除処理のハンドラ
   * 確認ダイアログで「削除する」を選択した場合に実行
   */
  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteReview(review.id)
      if (result.success) {
        router.refresh() // ページを更新して削除を反映
      }
    })
  }

  /**
   * 編集モード開始のハンドラ
   * 現在のレビュー内容で編集フォームを初期化
   */
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

  /**
   * 編集キャンセルのハンドラ
   * 編集内容を破棄して表示モードに戻る
   */
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditError(null)
    // 画像の状態をリセット
    setDeleteImageIds([])
    setNewImages([])
  }

  /**
   * 既存画像を削除対象としてマークするハンドラ
   *
   * @param imageId - 削除対象の画像ID
   */
  const handleDeleteExistingImage = (imageId: string) => {
    setDeleteImageIds([...deleteImageIds, imageId])
  }

  /**
   * 既存画像の削除マークを取り消すハンドラ
   *
   * @param imageId - 復元する画像ID
   */
  const handleRestoreExistingImage = (imageId: string) => {
    setDeleteImageIds(deleteImageIds.filter(id => id !== imageId))
  }

  /**
   * 新規追加画像を削除するハンドラ
   *
   * @param index - 削除する画像のインデックス
   */
  const handleRemoveNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index))
  }

  /**
   * 画像アップロードのハンドラ
   * ファイル選択時に呼び出され、圧縮してサーバーにアップロード
   *
   * @param e - ファイル入力の変更イベント
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 最大3枚の制限チェック
    if (totalImageCount >= 3) {
      setEditError('画像は3枚までです')
      return
    }

    // ファイルサイズチェック（圧縮前）
    if (file.size > MAX_IMAGE_SIZE) {
      setEditError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      e.target.value = ''
      return
    }

    setUploading(true)
    setEditError(null)

    try {
      // 画像を圧縮（1MB以下、最大1920px）
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

      // FormDataを作成してアップロード
      const formData = new FormData()
      formData.append('file', compressedFile)

      // XMLHttpRequestでアップロード（進捗表示対応）
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
        // アップロード成功 - 新規画像リストに追加
        setNewImages([...newImages, result.url])
      }
    } catch {
      setEditError('アップロードに失敗しました')
    }

    setUploading(false)
    e.target.value = '' // 同じファイルを再選択可能にする
  }

  /**
   * 編集内容保存のハンドラ
   * 評価、コメント、画像の変更をサーバーに送信
   */
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
        router.refresh() // ページを更新して変更を反映
      }
    })
  }

  return (
    <div className="p-4 border-b last:border-b-0">
      {/* ヘッダー: ユーザー情報、投稿日時、アクションボタン */}
      <div className="flex items-start gap-3 mb-3">
        {/* ユーザーアバター */}
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
            // アバターがない場合はニックネームの頭文字を表示
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                {review.user.nickname.charAt(0)}
              </span>
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* ユーザー名リンク */}
            <Link
              href={`/users/${review.user.id}`}
              className="font-medium hover:underline"
            >
              {review.user.nickname}
            </Link>
            {/* 投稿日時 */}
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          {/* 星評価表示 */}
          <StarRatingDisplay rating={review.rating} size="sm" />
        </div>

        {/* アクションボタンエリア（編集モードでない場合のみ表示） */}
        {!isEditing && (
          <div className="flex items-center gap-1">
            {isOwner ? (
              // 投稿者本人の場合
              showDeleteConfirm ? (
                // 削除確認中
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
                // 通常時（編集・削除ボタン）
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
          {/* エラーメッセージ */}
          {editError && (
            <p className="text-sm text-destructive">{editError}</p>
          )}

          {/* 評価入力 */}
          <div>
            <label className="text-sm font-medium mb-1 block">評価</label>
            <StarRatingInput value={editRating} onChange={setEditRating} />
          </div>

          {/* コメント入力 */}
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
                        // 削除マークされている場合は「元に戻す」ボタン
                        <button
                          type="button"
                          onClick={() => handleRestoreExistingImage(image.id)}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg text-white text-xs"
                        >
                          元に戻す
                        </button>
                      ) : (
                        // 通常時は削除ボタン
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

            {/* 新しく追加する画像（プレビュー） */}
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
                    {/* 「新規」ラベル */}
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

          {/* 保存・キャンセルボタン */}
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
        // 表示モード
        <>
          {/* コメント表示 */}
          {review.content && (
            <p className="text-sm whitespace-pre-wrap mb-3">{review.content}</p>
          )}

          {/* 画像表示 */}
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
