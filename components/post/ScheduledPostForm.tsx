'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createScheduledPost, updateScheduledPost } from '@/lib/actions/scheduled-post'
import { uploadPostMedia } from '@/lib/actions/post'
import { GenreSelector } from './GenreSelector'
import { Calendar, Clock, ImageIcon, X } from 'lucide-react'
import { MembershipLimits } from '@/lib/premium'

type Genre = {
  id: string
  name: string
  category: string
}

type ScheduledPostFormProps = {
  genres: Record<string, Genre[]>
  limits: MembershipLimits
  editData?: {
    id: string
    content: string | null
    scheduledAt: Date
    genreIds: string[]
    media: { url: string; type: string }[]
  }
}

export function ScheduledPostForm({ genres, limits, editData }: ScheduledPostFormProps) {
  const router = useRouter()
  const [content, setContent] = useState(editData?.content || '')
  const [selectedGenres, setSelectedGenres] = useState<string[]>(editData?.genreIds || [])
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>(editData?.media || [])
  const [scheduledDate, setScheduledDate] = useState(
    editData?.scheduledAt
      ? new Date(editData.scheduledAt).toISOString().split('T')[0]
      : ''
  )
  const [scheduledTime, setScheduledTime] = useState(
    editData?.scheduledAt
      ? new Date(editData.scheduledAt).toTimeString().slice(0, 5)
      : ''
  )
  const [loading, setLoading] = useState(false)
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

    const currentImageCount = mediaFiles.filter(m => m.type === 'image').length
    const currentVideoCount = mediaFiles.filter(m => m.type === 'video').length

    if (!isVideo && currentImageCount >= limits.maxImages) {
      setError(`画像は${limits.maxImages}枚まで添付できます`)
      return
    }

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

    if (!scheduledDate || !scheduledTime) {
      setError('予約日時を指定してください')
      setLoading(false)
      return
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
    if (scheduledAt <= new Date()) {
      setError('予約日時は未来の日時を指定してください')
      setLoading(false)
      return
    }

    const formData = new FormData()
    formData.append('content', content)
    formData.append('scheduledAt', scheduledAt.toISOString())
    selectedGenres.forEach(id => formData.append('genreIds', id))
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    const result = editData
      ? await updateScheduledPost(editData.id, formData)
      : await createScheduledPost(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/posts/scheduled')
      router.refresh()
    }
  }

  // 最小日時（現在から）
  const now = new Date()
  const minDate = now.toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-4 space-y-4">
      <div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="予約投稿の内容を入力..."
          rows={5}
          maxLength={maxChars}
          className="resize-none border-0 focus-visible:ring-0 p-0 text-base"
        />
        <div className="flex justify-end mt-1">
          <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < 100 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {remainingChars} / {maxChars}
          </span>
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
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* メディア追加ボタン */}
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
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || mediaFiles.length >= (limits.maxImages + limits.maxVideos)}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          メディア追加
        </Button>
        {uploading && <span className="text-sm text-muted-foreground">アップロード中...</span>}
        <span className="text-xs text-muted-foreground">
          画像: {mediaFiles.filter(m => m.type === 'image').length}/{limits.maxImages}枚,
          動画: {mediaFiles.filter(m => m.type === 'video').length}/{limits.maxVideos}本
        </span>
      </div>

      {/* ジャンル選択 */}
      <div>
        <Label className="text-sm font-medium mb-2 block">ジャンル</Label>
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {/* 予約日時 */}
      <div className="space-y-3 pt-4 border-t">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          予約日時
        </Label>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={minDate}
              required
            />
          </div>
          <div className="flex-1">
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          disabled={loading || uploading || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0 || !scheduledDate || !scheduledTime}
          className="bg-bonsai-green hover:bg-bonsai-green/90"
        >
          {loading ? '保存中...' : editData ? '更新する' : '予約する'}
        </Button>
      </div>
    </form>
  )
}
