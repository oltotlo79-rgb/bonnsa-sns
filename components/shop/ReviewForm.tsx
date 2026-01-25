/**
 * @file ReviewForm.tsx
 * @description 盆栽園レビュー投稿フォームコンポーネント
 *
 * 機能概要:
 * - 新規レビューの投稿フォームを提供
 * - 星評価（1〜5）の入力
 * - コメントの入力（任意）
 * - 最大3枚までの画像アップロード
 * - 画像はクライアントサイドで圧縮してからアップロード
 * - 投稿成功時にコールバックを呼び出し
 *
 * 使用例:
 * ```tsx
 * <ReviewForm
 *   shopId="shop-123"
 *   onSuccess={() => setShowForm(false)}
 * />
 * ```
 */
'use client'

// React hooks
// useState: フォームの入力値、エラー、画像リストなどを管理
// useTransition: 送信処理の非同期状態を管理
import { useState, useTransition } from 'react'

// Next.jsのルーターフック
// 送信後のページ更新に使用
import { useRouter } from 'next/navigation'

// Next.jsの画像最適化コンポーネント
// アップロードした画像のプレビュー表示に使用
import Image from 'next/image'

// Server Action - レビュー作成
import { createReview } from '@/lib/actions/review'

// 星評価入力コンポーネント
import { StarRating } from './StarRating'

// クライアントサイド画像圧縮ユーティリティ
// prepareFileForUpload: 画像をアップロード前に圧縮
// formatFileSize: ファイルサイズを人間が読みやすい形式に変換
// MAX_IMAGE_SIZE: 最大アップロードサイズ（定数）
import { prepareFileForUpload, formatFileSize, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'

/**
 * ReviewFormコンポーネントのプロパティ定義
 */
interface ReviewFormProps {
  /** レビュー対象の盆栽園ID */
  shopId: string
  /** 投稿成功時に呼び出されるコールバック関数（任意） */
  onSuccess?: () => void
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
 * レビュー投稿フォームコンポーネント
 *
 * 盆栽園に対するレビューを投稿するためのフォーム。
 * 星評価は必須、コメントと画像は任意。
 * 画像は最大3枚まで添付可能で、アップロード前にクライアントサイドで圧縮される。
 *
 * @param shopId - レビュー対象の盆栽園ID
 * @param onSuccess - 投稿成功時のコールバック
 */
export function ReviewForm({ shopId, onSuccess }: ReviewFormProps) {
  // ルーターインスタンス（送信後のページ更新用）
  const router = useRouter()

  // フォーム送信の非同期処理状態を管理
  const [isPending, startTransition] = useTransition()

  // エラーメッセージの状態
  const [error, setError] = useState<string | null>(null)

  // 星評価の値（0は未選択）
  const [rating, setRating] = useState(0)

  // コメントの内容
  const [content, setContent] = useState('')

  // アップロード済み画像URLの配列
  const [images, setImages] = useState<string[]>([])

  // 画像アップロード中の状態
  const [uploading, setUploading] = useState(false)

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
    if (images.length >= 3) {
      setError('画像は3枚までです')
      return
    }

    // ファイルサイズチェック（圧縮前）
    if (file.size > MAX_IMAGE_SIZE) {
      setError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      e.target.value = ''
      return
    }

    setUploading(true)
    setError(null)

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
        setError(result.error)
      } else if (result.url) {
        // アップロード成功 - 画像リストに追加
        setImages([...images, result.url])
      }
    } catch {
      setError('アップロードに失敗しました')
    }

    setUploading(false)
    e.target.value = '' // 同じファイルを再選択可能にする
  }

  /**
   * 画像削除のハンドラ
   * 指定されたインデックスの画像を配列から削除
   *
   * @param index - 削除する画像のインデックス
   */
  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  /**
   * フォーム送信のハンドラ
   * バリデーションを行い、Server Actionでレビューを作成
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // 評価が未選択の場合はエラー
    if (rating === 0) {
      setError('評価を選択してください')
      return
    }

    // FormDataを構築
    const formData = new FormData()
    formData.append('shopId', shopId)
    formData.append('rating', rating.toString())
    if (content.trim()) {
      formData.append('content', content.trim())
    }
    // 画像URLを追加
    images.forEach((url) => formData.append('imageUrls', url))

    startTransition(async () => {
      const result = await createReview(formData)

      if (result.error) {
        setError(result.error)
      } else {
        // 投稿成功 - フォームをリセット
        setRating(0)
        setContent('')
        setImages([])
        router.refresh() // ページを更新してレビュー一覧を更新
        onSuccess?.() // 成功コールバックを呼び出し
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* エラーメッセージ表示エリア */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* 評価入力（必須） */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          評価 <span className="text-destructive">*</span>
        </label>
        <StarRating
          rating={rating}
          size="lg"
          interactive
          onChange={setRating}
        />
      </div>

      {/* コメント入力（任意） */}
      <div className="space-y-2">
        <label htmlFor="review-content" className="text-sm font-medium">
          コメント
        </label>
        <textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="盆栽園の感想を書いてください..."
        />
      </div>

      {/* アップロード済み画像のプレビュー */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((url, index) => (
            <div key={index} className="relative w-20 h-20">
              <Image
                src={url}
                alt={`レビュー画像 ${index + 1}`}
                fill
                className="object-cover rounded-lg"
              />
              {/* 画像削除ボタン */}
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 画像追加・送信ボタンエリア */}
      <div className="flex items-center gap-3">
        {/* 画像追加ボタン */}
        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted ${images.length >= 3 || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <ImageIcon className="w-4 h-4" />
          <span className="text-sm">
            {uploading ? 'アップロード中...' : '画像を追加'}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={images.length >= 3 || uploading}
            className="hidden"
          />
        </label>

        {/* 画像枚数表示 */}
        <span className="text-xs text-muted-foreground">
          {images.length}/3枚
        </span>

        {/* スペーサー */}
        <div className="flex-1" />

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={isPending || rating === 0}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? '投稿中...' : 'レビューを投稿'}
        </button>
      </div>
    </form>
  )
}
