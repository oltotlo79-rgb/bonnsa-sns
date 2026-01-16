'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { markAllAdminNotificationsAsRead } from '@/lib/actions/admin/hidden'

interface AdminNotification {
  id: string
  type: string
  targetType: string
  targetId: string
  message: string
  reportCount: number
  isRead: boolean
  createdAt: Date
}

export function AdminNotificationBanner({
  notifications,
  unreadCount,
}: {
  notifications: AdminNotification[]
  unreadCount: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  async function handleMarkAllAsRead() {
    setIsProcessing(true)
    try {
      await markAllAdminNotificationsAsRead()
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="font-medium text-amber-800">
            {unreadCount}件の新しい通知があります
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '閉じる' : '表示'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isProcessing}
          >
            {isProcessing ? '処理中...' : 'すべて既読'}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-2">
          {notifications.slice(0, 5).map((notification) => (
            <div
              key={notification.id}
              className="bg-white p-3 rounded border border-amber-100"
            >
              <p className="text-sm">{notification.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(notification.createdAt).toLocaleString('ja-JP')}
              </p>
            </div>
          ))}
          {notifications.length > 5 && (
            <p className="text-sm text-muted-foreground text-center">
              他 {notifications.length - 5}件の通知
            </p>
          )}
        </div>
      )}
    </div>
  )
}
