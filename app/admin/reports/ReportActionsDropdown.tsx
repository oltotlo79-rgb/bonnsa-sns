'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateReportStatus, deleteReportedContent } from '@/lib/actions/report'

function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1"/>
      <circle cx="12" cy="5" r="1"/>
      <circle cx="12" cy="19" r="1"/>
    </svg>
  )
}

interface ReportActionsDropdownProps {
  reportId: string
  currentStatus: string
  targetType: string
  targetId: string
}

const targetTypeLabels: Record<string, string> = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  review: 'レビュー',
  user: 'ユーザー',
}

export function ReportActionsDropdown({
  reportId,
  currentStatus,
  targetType,
  targetId,
}: ReportActionsDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < 200

      if (openUpward) {
        setMenuStyle({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.right - 180,
        })
      } else {
        setMenuStyle({
          top: rect.bottom + 4,
          left: rect.right - 180,
        })
      }
    }
    setIsOpen(!isOpen)
  }

  const handleStatusUpdate = async (newStatus: 'pending' | 'reviewed' | 'resolved' | 'dismissed') => {
    setIsSubmitting(true)
    const result = await updateReportStatus(reportId, newStatus)
    setIsSubmitting(false)

    if (result.error) {
      alert(result.error)
      return
    }

    setIsOpen(false)
    router.refresh()
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    const result = await deleteReportedContent(targetType as 'post' | 'comment' | 'event' | 'shop' | 'review' | 'user', targetId)
    setIsSubmitting(false)

    if (result.error) {
      alert(result.error)
      return
    }

    setIsOpen(false)
    setShowDeleteConfirm(false)
    router.refresh()
  }

  const getTargetLink = () => {
    switch (targetType) {
      case 'post':
        return `/posts/${targetId}`
      case 'event':
        return `/events/${targetId}`
      case 'shop':
        return `/shops/${targetId}`
      case 'user':
        return `/users/${targetId}`
      default:
        return null
    }
  }

  const targetLink = getTargetLink()

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="p-2 hover:bg-muted rounded-lg"
        disabled={isSubmitting}
      >
        <MoreVerticalIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed bg-card border rounded-lg shadow-lg py-1 z-[101] min-w-[180px]"
            style={menuStyle}
          >
            {targetLink && (
              <>
                <Link
                  href={targetLink}
                  target="_blank"
                  className="block px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => setIsOpen(false)}
                >
                  対象を確認
                </Link>
                <div className="border-t my-1" />
              </>
            )}

            {currentStatus !== 'reviewed' && (
              <button
                onClick={() => handleStatusUpdate('reviewed')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-blue-600"
              >
                確認中にする
              </button>
            )}

            {currentStatus !== 'resolved' && (
              <button
                onClick={() => handleStatusUpdate('resolved')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-green-600"
              >
                対応完了にする
              </button>
            )}

            {currentStatus !== 'dismissed' && (
              <button
                onClick={() => handleStatusUpdate('dismissed')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-gray-600"
              >
                却下する
              </button>
            )}

            {currentStatus !== 'pending' && (
              <button
                onClick={() => handleStatusUpdate('pending')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-yellow-600"
              >
                未対応に戻す
              </button>
            )}

            <div className="border-t my-1" />

            {showDeleteConfirm ? (
              <div className="px-4 py-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {targetTypeLabels[targetType]}を{targetType === 'user' ? '停止' : '削除'}しますか？
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="flex-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                  >
                    {isSubmitting ? '処理中...' : (targetType === 'user' ? '停止' : '削除')}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-2 py-1 text-xs border rounded hover:bg-muted"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-950 text-red-600"
              >
                {targetType === 'user' ? 'アカウントを停止' : `${targetTypeLabels[targetType]}を削除`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
