'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveDraft, publishDraft, deleteDraft } from '@/lib/actions/draft'
import { GenreSelector } from '@/components/post/GenreSelector'
import { prepareFileForUpload, isVideoFile, formatFileSize, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, uploadVideoToR2 } from '@/lib/client-image-compression'

type Genre = {
  id: string
  name: string
  category: string
}

type DraftMedia = {
  id: string
  url: string
  type: string
}

type DraftGenre = {
  genreId: string
  genre: {
    id: string
    name: string
  }
}

type Draft = {
  id: string
  content: string | null
  media: DraftMedia[]
  genres: DraftGenre[]
}

interface DraftEditFormProps {
  draft: Draft
  genres: Record<string, Genre[]>
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

export function DraftEditForm({ draft, genres }: DraftEditFormProps) {
  const router = useRouter()
  const [content, setContent] = useState(draft.content || '')
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    draft.genres.map((g) => g.genreId)
  )
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>(
    draft.media.map((m) => ({ url: m.url, type: m.type }))
  )
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const maxChars = 500
  const remainingChars = maxChars - content.length

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const isVideo = isVideoFile(file)

    if (mediaFiles.length >= 4) {
      setError('画像は4枚まで添付できます')
      return
    }

    // 動画のファイルサイズチェック（R2直接アップロードで256MBまで対応）
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      setError(`動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // 画像のファイルサイズチェック（圧縮前）
    if (!isVideo && file.size > MAX_IMAGE_SIZE) {
      setError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // 動画の場合はR2に直接アップロード
      if (isVideo) {
        const result = await uploadVideoToR2(file, 'drafts', (progress) => {
          setUploadProgress(progress)
        })

        if (result.error) {
          setError(result.error)
        } else if (result.url) {
          setMediaFiles(prev => [...prev, { url: result.url!, type: 'video' }])
        }
      } else {
        // 画像の場合はクライアントサイドで圧縮
        setError('画像を圧縮中...')
        const originalSize = file.size
        const fileToUpload = await prepareFileForUpload(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
        })
        const compressedSize = fileToUpload.size
        const ratio = Math.round((1 - compressedSize / originalSize) * 100)
        if (ratio > 0) {
          console.log(`圧縮完了: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${ratio}%削減)`)
        }
        setError(null)

        const formData = new FormData()
        formData.append('file', fileToUpload)

        // XMLHttpRequestを使用して進捗を追跡
        const result = await new Promise<{ url?: string; type?: string; error?: string }>((resolve) => {
          const xhr = new XMLHttpRequest()

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100)
              setUploadProgress(progress)
            }
          })

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
          setMediaFiles(prev => [...prev, { url: result.url!, type: result.type || 'image' }])
        }
      }
    } catch {
      setError('アップロードに失敗しました')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function removeMedia(index: number) {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      const result = await saveDraft({
        id: draft.id,
        content: content || undefined,
        mediaUrls: mediaFiles.map((m) => m.url),
        genreIds: selectedGenres,
      })

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/drafts')
        router.refresh()
      }
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!confirm('この下書きを投稿しますか？')) return

    setPublishing(true)
    setError(null)

    // まず保存してから投稿
    try {
      const saveResult = await saveDraft({
        id: draft.id,
        content: content || undefined,
        mediaUrls: mediaFiles.map((m) => m.url),
        genreIds: selectedGenres,
      })

      if (saveResult.error) {
        setError(saveResult.error)
        setPublishing(false)
        return
      }

      const result = await publishDraft(draft.id)

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/feed')
        router.refresh()
      }
    } catch {
      setError('投稿に失敗しました')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete() {
    if (!confirm('この下書きを削除しますか？')) return

    setDeleting(true)
    try {
      const result = await deleteDraft(draft.id)
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/drafts')
        router.refresh()
      }
    } catch {
      setError('削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="いまどうしてる？"
        rows={5}
        maxLength={maxChars}
        className="resize-none"
      />

      {/* 文字数カウント */}
      <div className="text-right">
        <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
          {remainingChars}
        </span>
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

      {/* 画像追加ボタン */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || mediaFiles.length >= 4}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          画像を追加
        </Button>
        {uploading && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-bonsai-green transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
          </div>
        )}
      </div>

      {/* ジャンル選択 */}
      <div>
        <label className="block text-sm font-medium mb-2">ジャンル</label>
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* アクションボタン */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          <TrashIcon className="w-4 h-4 mr-2" />
          {deleting ? '削除中...' : '削除'}
        </Button>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '下書き保存'}
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={publishing || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
            className="bg-bonsai-green hover:bg-bonsai-green/90"
          >
            {publishing ? '投稿中...' : '投稿する'}
          </Button>
        </div>
      </div>
    </div>
  )
}
