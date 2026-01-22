'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

type Bonsai = {
  id: string
  name: string
  species: string | null
}

type PostFormModalProps = {
  genres: Record<string, Genre[]>
  limits?: MembershipLimits
  isOpen: boolean
  onClose: () => void
  draftCount?: number
  bonsais?: Bonsai[]
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

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  )
}

const DEFAULT_LIMITS: MembershipLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 2,
}

export function PostFormModal({ genres, limits = DEFAULT_LIMITS, isOpen, onClose, draftCount = 0, bonsais = [] }: PostFormModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>([])
  const [selectedBonsaiId, setSelectedBonsaiId] = useState<string>('')
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

    const formData = new FormData()
    formData.append('content', content)
    selectedGenres.forEach(id => formData.append('genreIds', id))
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })
    if (selectedBonsaiId) {
      formData.append('bonsaiId', selectedBonsaiId)
    }

    const result = await createPost(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setContent('')
      setSelectedGenres([])
      setMediaFiles([])
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      router.refresh()
      setLoading(false)
      onClose()
    }
  }

  function handleClose() {
    if (content.length > 0 || mediaFiles.length > 0) {
      if (!confirm('入力内容が破棄されます。閉じてもよろしいですか？')) {
        return
      }
    }
    setContent('')
    setSelectedGenres([])
    setMediaFiles([])
    setError(null)
    onClose()
  }

  function handleMediaButtonClick() {
    fileInputRef.current?.click()
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
        onClose()
        router.push('/drafts')
      }
    } catch {
      setError('下書きの保存に失敗しました')
    } finally {
      setSavingDraft(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {draftCount > 0 && (
              <Link
                href="/drafts"
                onClick={onClose}
                className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                title="下書き一覧"
              >
                <FileTextIcon className="w-4 h-4" />
                <span className="hidden sm:inline">下書き一覧</span>
              </Link>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft || uploading || (content.length === 0 && mediaFiles.length === 0)}
            >
              {savingDraft ? '保存中...' : '下書き保存'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || uploading || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
              className="bg-bonsai-green hover:bg-bonsai-green/90"
            >
              {loading ? '投稿中...' : '投稿する'}
            </Button>
          </div>
        </div>
      </div>

      {/* フォーム */}
      <div className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit}>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="いまどうしてる？"
            rows={6}
            maxLength={maxChars}
            autoFocus
            className="resize-none border-0 focus-visible:ring-0 p-0 text-lg"
          />

          {/* メディアプレビュー */}
          {mediaFiles.length > 0 && (
            <div className={`grid gap-2 mt-4 ${mediaFiles.length === 1 ? '' : 'grid-cols-2'}`}>
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
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
                  >
                    <XIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* メディア追加・文字数 */}
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
                onClick={handleMediaButtonClick}
                disabled={uploading || mediaFiles.length >= (limits.maxImages + limits.maxVideos)}
              >
                <ImageIcon className="w-5 h-5" />
                <span className="ml-1 text-sm">画像/動画</span>
              </Button>
              {uploading && <span className="text-sm text-muted-foreground">アップロード中...</span>}
            </div>

            <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
              {remainingChars}
            </span>
          </div>

          {/* マイ盆栽選択 */}
          {bonsais.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                関連する盆栽（任意）
              </label>
              <select
                value={selectedBonsaiId}
                onChange={(e) => setSelectedBonsaiId(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">選択しない</option>
                {bonsais.map((bonsai) => (
                  <option key={bonsai.id} value={bonsai.id}>
                    {bonsai.name}{bonsai.species ? ` (${bonsai.species})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ジャンル選択 */}
          <div className="mt-4">
            <GenreSelector
              genres={genres}
              selectedIds={selectedGenres}
              onChange={setSelectedGenres}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive mt-4">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
