'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const RECENT_SEARCHES_KEY = 'bonsai-sns-recent-searches'
const MAX_RECENT_SEARCHES = 10

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

// 検索履歴をローカルストレージから取得
function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// 検索履歴をローカルストレージに保存
function saveRecentSearch(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return
  try {
    const searches = getRecentSearches()
    // 重複を削除して先頭に追加
    const filtered = searches.filter(s => s !== query)
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // ローカルストレージエラーは無視
  }
}

// 検索履歴から削除
function removeRecentSearch(query: string) {
  if (typeof window === 'undefined') return
  try {
    const searches = getRecentSearches()
    const updated = searches.filter(s => s !== query)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // ローカルストレージエラーは無視
  }
}

// 検索履歴を全削除
function clearRecentSearches() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch {
    // ローカルストレージエラーは無視
  }
}

type SearchBarProps = {
  defaultValue?: string
  onSearch?: (query: string) => void
  placeholder?: string
}

export function SearchBar({ defaultValue = '', onSearch, placeholder = '検索...' }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(defaultValue)
  const [isFocused, setIsFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 検索履歴を読み込み（クライアントサイドのローカルストレージから）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentSearches(getRecentSearches())
  }, [])

  // URLパラメータの変更を監視してクエリを更新
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(q)
    }
  }, [searchParams])

  // キーボードショートカット（/で検索フォーカス）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 外側クリックで候補を閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = useCallback((searchQuery?: string) => {
    const q = searchQuery ?? query
    if (q.trim()) {
      saveRecentSearch(q.trim())
      setRecentSearches(getRecentSearches())
    }
    if (onSearch) {
      onSearch(q)
    } else {
      const params = new URLSearchParams(searchParams.toString())
      if (q) {
        params.set('q', q)
      } else {
        params.delete('q')
      }
      router.push(`/search?${params.toString()}`)
    }
    setIsFocused(false)
  }, [query, onSearch, router, searchParams])

  const handleClear = useCallback(() => {
    setQuery('')
    if (onSearch) {
      onSearch('')
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('q')
      router.push(`/search?${params.toString()}`)
    }
  }, [onSearch, router, searchParams])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearch()
      } else if (e.key === 'Escape') {
        setIsFocused(false)
        inputRef.current?.blur()
      }
    },
    [handleSearch]
  )

  const handleRecentSearchClick = (search: string) => {
    setQuery(search)
    handleSearch(search)
  }

  const handleRemoveRecentSearch = (search: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeRecentSearch(search)
    setRecentSearches(getRecentSearches())
  }

  const handleClearAll = () => {
    clearRecentSearches()
    setRecentSearches([])
  }

  const showDropdown = isFocused && recentSearches.length > 0 && !query

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative flex items-center">
        <SearchIcon className="absolute left-3 w-5 h-5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 p-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 最近の検索 */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium text-muted-foreground">最近の検索</span>
            <button
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              すべて削除
            </button>
          </div>
          <ul>
            {recentSearches.map((search) => (
              <li key={search}>
                <button
                  onClick={() => handleRecentSearchClick(search)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors"
                >
                  <ClockIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{search}</span>
                  <button
                    onClick={(e) => handleRemoveRecentSearch(search, e)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
