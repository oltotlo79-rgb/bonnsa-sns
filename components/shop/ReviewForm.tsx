'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createReview } from '@/lib/actions/review'
import { StarRating } from './StarRating'
import { prepareFileForUpload, formatFileSize, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'

interface ReviewFormProps {
  shopId: string
  onSuccess?: () => void
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

export function ReviewForm({ shopId, onSuccess }: ReviewFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (images.length >= 3) {
      setError('画像は3枚までです')
      return
    }

    // 画像のファイルサイズチェック（圧縮前）
    if (file.size > MAX_IMAGE_SIZE) {
      setError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      e.target.value = ''
      return
    }

    setUploading(true)
    setError(null)

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
        setError(result.error)
      } else if (result.url) {
        setImages([...images, result.url])
      }
    } catch {
      setError('アップロードに失敗しました')
    }

    setUploading(false)
    e.target.value = ''
  }

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (rating === 0) {
      setError('評価を選択してください')
      return
    }

    const formData = new FormData()
    formData.append('shopId', shopId)
    formData.append('rating', rating.toString())
    if (content.trim()) {
      formData.append('content', content.trim())
    }
    images.forEach((url) => formData.append('imageUrls', url))

    startTransition(async () => {
      const result = await createReview(formData)

      if (result.error) {
        setError(result.error)
      } else {
        setRating(0)
        setContent('')
        setImages([])
        router.refresh()
        onSuccess?.()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* 評価 */}
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

      {/* コメント */}
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

      {/* 画像プレビュー */}
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

      {/* 画像追加・送信 */}
      <div className="flex items-center gap-3">
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
        <span className="text-xs text-muted-foreground">
          {images.length}/3枚
        </span>
        <div className="flex-1" />
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
