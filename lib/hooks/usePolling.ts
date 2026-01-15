'use client'

import { useState, useEffect, useCallback } from 'react'

type UsePollingOptions<T> = {
  fetcher: () => Promise<T>
  interval?: number // ミリ秒
  enabled?: boolean
}

export function usePolling<T>({
  fetcher,
  interval = 30000, // デフォルト30秒
  enabled = true,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setIsLoading(true)
      const result = await fetcher()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [fetcher, enabled])

  // 初回フェッチ
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ポーリング
  useEffect(() => {
    if (!enabled) return

    const intervalId = setInterval(fetchData, interval)

    return () => clearInterval(intervalId)
  }, [fetchData, interval, enabled])

  // 手動リフレッシュ
  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  return { data, error, isLoading, refresh }
}
