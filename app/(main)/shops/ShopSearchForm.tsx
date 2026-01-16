'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

interface Genre {
  id: string
  name: string
  category: string
}

interface ShopSearchFormProps {
  genres: Genre[]
  initialSearch?: string
  initialGenre?: string
  initialSort?: string
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function ShopSearchForm({
  genres,
  initialSearch = '',
  initialGenre = '',
  initialSort = 'newest',
}: ShopSearchFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(initialSearch)
  const [genre, setGenre] = useState(initialGenre)
  const [sort, setSort] = useState(initialSort)

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())

    if (search.trim()) {
      params.set('search', search.trim())
    } else {
      params.delete('search')
    }

    if (genre) {
      params.set('genre', genre)
    } else {
      params.delete('genre')
    }

    if (sort && sort !== 'newest') {
      params.set('sort', sort)
    } else {
      params.delete('sort')
    }

    startTransition(() => {
      router.push(`/shops?${params.toString()}`)
    })
  }

  const handleReset = () => {
    setSearch('')
    setGenre('')
    setSort('newest')
    startTransition(() => {
      router.push('/shops')
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // ジャンルをカテゴリごとにグループ化
  const groupedGenres = genres.reduce((acc: Record<string, Genre[]>, g: Genre) => {
    if (!acc[g.category]) {
      acc[g.category] = []
    }
    acc[g.category].push(g)
    return acc
  }, {})

  return (
    <div className="bg-card rounded-lg border p-4 space-y-4">
      {/* 検索入力 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="名前または住所で検索..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? '検索中...' : '検索'}
        </button>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-4">
        {/* ジャンルフィルター */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">ジャンル:</label>
          <select
            value={genre}
            onChange={(e) => {
              setGenre(e.target.value)
              // 選択時に自動で検索
              const params = new URLSearchParams(searchParams.toString())
              if (e.target.value) {
                params.set('genre', e.target.value)
              } else {
                params.delete('genre')
              }
              startTransition(() => {
                router.push(`/shops?${params.toString()}`)
              })
            }}
            className="px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="">すべて</option>
            {Object.entries(groupedGenres).map(([category, categoryGenres]) => (
              <optgroup key={category} label={category}>
                {categoryGenres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* ソート */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">並び順:</label>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              // 選択時に自動で検索
              const params = new URLSearchParams(searchParams.toString())
              if (e.target.value && e.target.value !== 'newest') {
                params.set('sort', e.target.value)
              } else {
                params.delete('sort')
              }
              startTransition(() => {
                router.push(`/shops?${params.toString()}`)
              })
            }}
            className="px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="newest">新着順</option>
            <option value="rating">評価順</option>
            <option value="name">名前順</option>
          </select>
        </div>

        {/* リセット */}
        {(search || genre || sort !== 'newest') && (
          <button
            onClick={handleReset}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            リセット
          </button>
        )}
      </div>
    </div>
  )
}
