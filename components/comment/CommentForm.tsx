'use client'

import { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createComment, uploadCommentMedia } from '@/lib/actions/comment'

type CommentFormProps = {
  postId: string
  parentId?: string
  onSuccess?: () => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

export function CommentForm({
  postId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = 'コメントを入力...',
  autoFocus = false,
}: CommentFormProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const maxLength = 500
  const remainingChars = maxLength - content.length
  const isOverLimit = remainingChars < 0
  const canSubmit = (content.trim().length > 0 || mediaFiles.length > 0) && !isOverLimit

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const isVideo = file.type.startsWith('video/')

    // 現在の画像数と動画数をカウント
    const currentImageCount = mediaFiles.filter(m => m.type === 'image').length
    const currentVideoCount = mediaFiles.filter(m => m.type === 'video').length

    // 画像は2枚まで
    if (!isVideo && currentImageCount >= 2) {
      setError('画像は2枚まで添付できます')
      return
    }

    // 動画は1本まで
    if (isVideo && currentVideoCount >= 1) {
      setError('動画は1本まで添付できます')
      return
    }

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadCommentMedia(formData)

    if (result.error) {
      setError(result.error)
    } else if (result.url) {
      setMediaFiles([...mediaFiles, { url: result.url, type: result.type || 'image' }])
    }

    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function removeMedia(index: number) {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || isPending) return

    setError(null)

    const formData = new FormData()
    formData.append('postId', postId)
    formData.append('content', content)
    if (parentId) {
      formData.append('parentId', parentId)
    }
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    startTransition(async () => {
      const result = await createComment(formData)

      if (result.error) {
        setError(result.error)
      } else {
        setContent('')
        setMediaFiles([])
        onSuccess?.()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] resize-none pr-16"
          disabled={isPending}
          autoFocus={autoFocus}
        />
        <div
          className={`absolute bottom-2 right-2 text-xs ${
            isOverLimit
              ? 'text-destructive'
              : remainingChars <= 50
              ? 'text-yellow-500'
              : 'text-muted-foreground'
          }`}
        >
          {remainingChars}
        </div>
      </div>

      {/* メディアプレビュー */}
      {mediaFiles.length > 0 && (
        <div className={`grid gap-2 ${mediaFiles.length === 1 ? '' : 'grid-cols-2'}`}>
          {mediaFiles.map((media, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              {media.type === 'video' ? (
                <video src={media.url} className="w-full h-full object-cover" />
              ) : (
                <Image src={media.url} alt="" fill className="object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
              >
                <XIcon className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isPending || mediaFiles.length >= 3}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          {uploading && <span className="text-sm text-muted-foreground">アップロード中...</span>}
        </div>

        <div className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isPending}
            >
              キャンセル
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit || isPending || uploading}
          >
            {isPending ? '送信中...' : parentId ? '返信する' : 'コメントする'}
          </Button>
        </div>
      </div>
    </form>
  )
}
