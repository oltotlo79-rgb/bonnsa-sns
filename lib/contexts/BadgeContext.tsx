'use client'

import { createContext, useContext, ReactNode } from 'react'
import { usePolling } from '@/lib/hooks/usePolling'

type BadgeCounts = {
  notifications: number
  messages: number
}

type BadgeContextType = {
  counts: BadgeCounts
  isLoading: boolean
  refresh: () => void
}

const BadgeContext = createContext<BadgeContextType>({
  counts: { notifications: 0, messages: 0 },
  isLoading: false,
  refresh: () => {},
})

async function fetchBadges(): Promise<BadgeCounts> {
  try {
    const res = await fetch('/api/badges')
    if (!res.ok) {
      return { notifications: 0, messages: 0 }
    }
    return res.json()
  } catch {
    return { notifications: 0, messages: 0 }
  }
}

type BadgeProviderProps = {
  children: ReactNode
  initialCounts?: BadgeCounts
}

export function BadgeProvider({ children, initialCounts }: BadgeProviderProps) {
  const { data, isLoading, refresh } = usePolling<BadgeCounts>({
    fetcher: fetchBadges,
    interval: 30000, // 30秒ごとにポーリング
    enabled: true,
  })

  const counts = data || initialCounts || { notifications: 0, messages: 0 }

  return (
    <BadgeContext.Provider value={{ counts, isLoading, refresh }}>
      {children}
    </BadgeContext.Provider>
  )
}

export function useBadges() {
  return useContext(BadgeContext)
}
