'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { suspendUser, activateUser, deleteUserByAdmin } from '@/lib/actions/admin'

type UserDetailActionsProps = {
  userId: string
  isSuspended: boolean
  nickname: string
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  )
}

export function UserDetailActions({ userId, isSuspended, nickname }: UserDetailActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [reason, setReason] = useState('')

  async function handleSuspend() {
    if (!reason.trim()) {
      setError('理由を入力してください')
      return
    }

    setLoading('suspend')
    setError(null)

    const result = await suspendUser(userId, reason)

    if (result.error) {
      setError(result.error)
    } else {
      setReason('')
      router.refresh()
    }

    setLoading(null)
  }

  async function handleActivate() {
    setLoading('activate')
    setError(null)

    const result = await activateUser(userId)

    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }

    setLoading(null)
  }

  async function handleDelete() {
    if (!reason.trim()) {
      setError('理由を入力してください')
      return
    }

    setLoading('delete')
    setError(null)

    const result = await deleteUserByAdmin(userId, reason)

    if (result.error) {
      setError(result.error)
      setLoading(null)
    } else {
      router.push('/admin/users')
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 text-red-500 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* 停止/復帰 */}
      {isSuspended ? (
        <button
          onClick={handleActivate}
          disabled={loading === 'activate'}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
        >
          {loading === 'activate' ? '処理中...' : 'アカウントを復帰'}
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            placeholder="停止理由を入力..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2 border rounded-lg bg-background text-sm resize-none"
            rows={2}
          />
          <button
            onClick={handleSuspend}
            disabled={loading === 'suspend' || !reason.trim()}
            className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {loading === 'suspend' ? '処理中...' : 'アカウントを停止'}
          </button>
        </div>
      )}

      <hr className="border-muted" />

      {/* 削除 */}
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-500/10"
        >
          アカウントを削除
        </button>
      ) : (
        <div className="space-y-3 p-3 bg-red-500/10 rounded-lg">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangleIcon className="w-5 h-5" />
            <span className="font-semibold">アカウント削除の確認</span>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>{nickname}</strong> のアカウントを削除します。
            この操作は取り消せません。すべての投稿、コメント、関連データが削除されます。
          </p>
          {!isSuspended && (
            <textarea
              placeholder="削除理由を入力..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border rounded-lg bg-background text-sm resize-none"
              rows={2}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-3 py-2 border rounded-lg hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              onClick={handleDelete}
              disabled={loading === 'delete' || (!isSuspended && !reason.trim())}
              className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {loading === 'delete' ? '削除中...' : '削除する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
