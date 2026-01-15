'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deletePostByAdmin } from '@/lib/actions/admin'

function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1"/>
      <circle cx="12" cy="5" r="1"/>
      <circle cx="12" cy="19" r="1"/>
    </svg>
  )
}

interface PostActionsDropdownProps {
  postId: string
}

export function PostActionsDropdown({ postId }: PostActionsDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDelete = async () => {
    if (!reason.trim()) {
      alert('削除理由を入力してください')
      return
    }

    setIsSubmitting(true)
    const result = await deletePostByAdmin(postId, reason)
    setIsSubmitting(false)

    if (result.error) {
      alert(result.error)
      return
    }

    setShowDeleteModal(false)
    setReason('')
    router.refresh()
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-muted rounded-lg"
        >
          <MoreVerticalIcon className="w-4 h-4" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg py-1 z-20 min-w-[150px]">
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowDeleteModal(true)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-red-600"
              >
                投稿を削除
              </button>
            </div>
          </>
        )}
      </div>

      {/* 削除モーダル */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">投稿を削除</h3>
            <p className="text-sm text-muted-foreground mb-4">
              この投稿を削除します。削除理由を入力してください。
            </p>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="削除理由"
              className="w-full px-3 py-2 border rounded-lg bg-background min-h-[100px] mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setReason('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {isSubmitting ? '処理中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
