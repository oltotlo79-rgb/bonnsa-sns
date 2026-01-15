'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteEvent } from '@/lib/actions/event'

interface DeleteEventButtonProps {
  eventId: string
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18"/>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      <line x1="10" x2="10" y1="11" y2="17"/>
      <line x1="14" x2="14" y1="11" y2="17"/>
    </svg>
  )
}

export function DeleteEventButton({ eventId }: DeleteEventButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteEvent(eventId)
      if (result.success) {
        router.push('/events')
        router.refresh()
      }
    })
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">削除しますか？</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          {isPending ? '削除中...' : '削除'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="px-3 py-1 text-sm border rounded hover:bg-muted"
        >
          キャンセル
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
    >
      <TrashIcon className="w-4 h-4" />
      <span>削除</span>
    </button>
  )
}
