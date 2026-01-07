'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createPost, uploadPostMedia } from '@/lib/actions/post'
import { GenreSelector } from './GenreSelector'

type Genre = {
  id: string
  name: string
  category: string
}

type PostFormProps = {
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

export function PostForm({ genres }: PostFormProps) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const maxChars = 500
  const remainingChars = maxChars - content.length

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const isVideo = file.type.startsWith('video/')

    // 画像と動画の同時投稿禁止
    if (mediaFiles.length > 0) {
      const existingIsVideo = mediaFiles[0].type === 'video'
      if (isVideo !== existingIsVideo) {
        setError('画像と動画を同時に投稿することはできません')
        return
      }
    }

    // 画像は4枚まで
    if (!isVideo && mediaFiles.length >= 4) {
      setError('画像は4枚まで添付できます')
      return
    }

    // 動画は1本まで
    if (isVideo && mediaFiles.length >= 1) {
      setError('動画は1本まで添付できます')
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
    mediaFiles.forEach(m => formData.append('mediaUrls', m.url))
    if (mediaFiles.length > 0) {
      formData.append('mediaType', mediaFiles[0].type)
    }

    const result = await createPost(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setContent('')
      setSelectedGenres([])
      setMediaFiles([])
      router.refresh()
      setLoading(false)
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
            disabled={uploading || mediaFiles.length >= 4}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          {uploading && <span className="text-sm text-muted-foreground">アップロード中...</span>}
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {remainingChars}
          </span>
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
