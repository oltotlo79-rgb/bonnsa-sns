'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createPost, uploadPostMedia } from '@/lib/actions/post'
import { saveDraft } from '@/lib/actions/draft'
import { GenreSelector } from './GenreSelector'

type Genre = {
  id: string
  name: string
  category: string
}

type MembershipLimits = {
  maxPostLength: number
  maxImages: number
  maxVideos: number
}

type PostFormProps = {
  genres: Record<string, Genre[]>
  limits?: MembershipLimits
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

const DEFAULT_LIMITS: MembershipLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 2,
}

export function PostForm({ genres, limits = DEFAULT_LIMITS }: PostFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const maxChars = limits.maxPostLength
  const remainingChars = maxChars - content.length

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const isVideo = file.type.startsWith('video/')

    // 現在の画像数と動画数をカウント
    const currentImageCount = mediaFiles.filter(m => m.type === 'image').length
    const currentVideoCount = mediaFiles.filter(m => m.type === 'video').length

    // 画像上限チェック
    if (!isVideo && currentImageCount >= limits.maxImages) {
      setError(`画像は${limits.maxImages}枚まで添付できます`)
      return
    }

    // 動画上限チェック
    if (isVideo && currentVideoCount >= limits.maxVideos) {
      setError(`動画は${limits.maxVideos}本まで添付できます`)
      return
    }

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadPostMedia(formData)

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
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('content', content)
    selectedGenres.forEach(id => formData.append('genreIds', id))
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    const result = await createPost(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setContent('')
      setSelectedGenres([])
      setMediaFiles([])
      // React Queryのタイムラインキャッシュを無効化して再取得
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      router.refresh()
      setLoading(false)
    }
  }

  async function handleSaveDraft() {
    if (content.length === 0 && mediaFiles.length === 0) {
      setError('テキストまたは画像を入力してください')
      return
    }

    setSavingDraft(true)
    setError(null)

    try {
      const result = await saveDraft({
        content: content || undefined,
        mediaUrls: mediaFiles.map((m) => m.url),
        genreIds: selectedGenres,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setContent('')
        setSelectedGenres([])
        setMediaFiles([])
        setError(null)
        router.push('/drafts')
      }
    } catch {
      setError('下書きの保存に失敗しました')
    } finally {
      setSavingDraft(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="いまどうしてる？"
        rows={3}
        maxLength={maxChars}
        className="resize-none border-0 focus-visible:ring-0 p-0 text-base"
      />

      {/* メディアプレビュー */}
      {mediaFiles.length > 0 && (
        <div className={`grid gap-2 mt-3 ${mediaFiles.length === 1 ? '' : mediaFiles.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
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

      {/* ジャンル選択 */}
      <div className="mt-3">
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive mt-3">{error}</p>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
            disabled={uploading || mediaFiles.length >= (limits.maxImages + limits.maxVideos)}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          {uploading && <span className="text-sm text-muted-foreground">アップロード中...</span>}
          {limits.maxPostLength > 500 && (
            <span className="text-xs text-amber-600 font-medium">Premium</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {remainingChars}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={savingDraft || uploading || (content.length === 0 && mediaFiles.length === 0)}
          >
            {savingDraft ? '保存中...' : '下書き'}
          </Button>
          <Button
            type="submit"
            disabled={loading || uploading || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
            className="bg-bonsai-green hover:bg-bonsai-green/90"
          >
            {loading ? '投稿中...' : '投稿する'}
          </Button>
        </div>
      </div>
    </form>
  )
}
