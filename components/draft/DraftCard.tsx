'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { deleteDraft, publishDraft } from '@/lib/actions/draft'

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
  createdAt: Date
  updatedAt: Date
  media: DraftMedia[]
  genres: DraftGenre[]
}

interface DraftCardProps {
  draft: Draft
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
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
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

export function DraftCard({ draft }: DraftCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const handleDelete = async () => {
    if (!confirm('この下書きを削除しますか？')) return

    setIsDeleting(true)
    try {
      const result = await deleteDraft(draft.id)
      if (result.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    } catch {
      alert('削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePublish = async () => {
    if (!confirm('この下書きを投稿しますか？')) return

    setIsPublishing(true)
    try {
      const result = await publishDraft(draft.id)
      if (result.error) {
        alert(result.error)
      } else {
        router.push('/feed')
        router.refresh()
      }
    } catch {
      alert('投稿に失敗しました')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="p-4">
        {/* 更新日時 */}
        <p className="text-xs text-muted-foreground mb-2">
          最終更新: {new Date(draft.updatedAt).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        {/* 本文 */}
        {draft.content ? (
          <p className="whitespace-pre-wrap line-clamp-3">{draft.content}</p>
        ) : (
          <p className="text-muted-foreground italic">テキストなし</p>
        )}

        {/* 画像プレビュー */}
        {draft.media.length > 0 && (
          <div className="mt-3 flex gap-2">
            {draft.media.slice(0, 4).map((media) => (
              <div key={media.id} className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted">
                {media.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                ) : (
                  <Image
                    src={media.url}
                    alt=""
                    fill
                    className="object-cover"
                  />
                )}
              </div>
            ))}
            {draft.media.length > 4 && (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">
                +{draft.media.length - 4}
              </div>
            )}
          </div>
        )}

        {/* ジャンルタグ */}
        {draft.genres.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {draft.genres.map((g) => (
              <span
                key={g.genreId}
                className="px-2 py-1 text-xs bg-muted rounded-full"
              >
                {g.genre.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
        <div className="flex gap-2">
          <Link
            href={`/drafts/${draft.id}/edit`}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            編集
          </Link>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <TrashIcon className="w-4 h-4" />
            {isDeleting ? '削除中...' : '削除'}
          </button>
        </div>
        <button
          onClick={handlePublish}
          disabled={isPublishing}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <SendIcon className="w-4 h-4" />
          {isPublishing ? '投稿中...' : '投稿する'}
        </button>
      </div>
    </div>
  )
}
