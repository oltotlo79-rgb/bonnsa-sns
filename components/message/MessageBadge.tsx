'use client'

import { useQuery } from '@tanstack/react-query'
import { getUnreadMessageCount } from '@/lib/actions/message'

type MessageBadgeProps = {
  className?: string
}

export function MessageBadge({ className }: MessageBadgeProps) {
  const { data } = useQuery({
    queryKey: ['unreadMessageCount'],
    queryFn: async () => {
      return await getUnreadMessageCount()
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
