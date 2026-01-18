'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const STORAGE_KEY = 'event-filter-settings'

interface FilterSettings {
  region?: string
  prefecture?: string
  view?: string
  showPast?: string
}

export function EventFilterPersistence() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // フィルター設定をlocalStorageに保存
  useEffect(() => {
    const currentSettings: FilterSettings = {}

    const region = searchParams.get('region')
    const prefecture = searchParams.get('prefecture')
    const view = searchParams.get('view')
    const showPast = searchParams.get('showPast')

    if (region) currentSettings.region = region
    if (prefecture) currentSettings.prefecture = prefecture
    if (view) currentSettings.view = view
    if (showPast) currentSettings.showPast = showPast

    // URLにパラメータがある場合は保存
    if (Object.keys(currentSettings).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings))
    }
  }, [searchParams])

  // 初回アクセス時にlocalStorageから復元
  useEffect(() => {
    // URLにパラメータがなく、localStorageに保存された設定がある場合
    const hasParams = searchParams.toString().length > 0

    if (!hasParams) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const settings: FilterSettings = JSON.parse(saved)
          const params = new URLSearchParams()

          if (settings.region) params.set('region', settings.region)
          if (settings.prefecture) params.set('prefecture', settings.prefecture)
          if (settings.view) params.set('view', settings.view)
          if (settings.showPast) params.set('showPast', settings.showPast)

          if (params.toString()) {
            router.replace(`/events?${params.toString()}`)
          }
        }
      } catch {
        // localStorageエラーは無視
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
