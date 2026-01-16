'use client'

import { useState } from 'react'
import Image from 'next/image'
import { deleteBonsaiRecord } from '@/lib/actions/bonsai'
import { useRouter } from 'next/navigation'

interface BonsaiRecord {
  id: string
  content: string | null
  createdAt: Date
  images: { id: string; url: string }[]
}

interface BonsaiRecordListProps {
  records: BonsaiRecord[]
  isOwner: boolean
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
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

export function BonsaiRecordList({ records, isOwner }: BonsaiRecordListProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const handleDelete = async (recordId: string) => {
    if (!confirm('この記録を削除しますか？')) return

    setDeletingId(recordId)
    try {
      const result = await deleteBonsaiRecord(recordId)
      if (result.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    } catch {
      alert('削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  if (records.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ImageIcon className="w-12 h-12 mx-auto mb-3" />
        <p>まだ成長記録がありません</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y">
        {records.map((record) => (
          <div key={record.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-2">
                  {new Date(record.createdAt).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {record.content && (
                  <p className="text-sm whitespace-pre-wrap">{record.content}</p>
                )}
              </div>
              {isOwner && (
                <button
                  onClick={() => handleDelete(record.id)}
                  disabled={deletingId === record.id}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  title="削除"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {record.images.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {record.images.map((image) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(image.url)}
                    className="relative w-24 h-24 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <Image
                      src={image.url}
                      alt="成長記録画像"
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 画像モーダル */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
            <Image
              src={selectedImage}
              alt="成長記録画像"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  )
}
