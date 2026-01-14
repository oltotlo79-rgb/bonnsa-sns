'use client'

import { useQuery } from '@tanstack/react-query'
import { getUnreadCount } from '@/lib/actions/notification'

type NotificationBadgeProps = {
  className?: string
}

export function NotificationBadge({ className }: NotificationBadgeProps) {
  const { data } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: async () => {
      return await getUnreadCount()
    },
    refetchInterval: 30000, // 30秒ごとに更新
  })

  const count = data?.count || 0

  if (count === 0) {
    return null
  }

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium bg-red-500 text-white rounded-full ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

// サーバーコンポーネント用の未読数表示
export async function NotificationBadgeServer() {
  const { count } = await getUnreadCount()

  if (count === 0) {
    return null
  }

  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium bg-red-500 text-white rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  )
}
