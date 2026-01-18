/**
 * 検索バーコンポーネント
 *
 * このファイルは、検索機能を提供する入力コンポーネントを提供します。
 * ヘッダーや検索ページで使用されます。
 *
 * ## 機能概要
 * - テキスト入力による検索
 * - 検索履歴のローカルストレージ保存
 * - 最近の検索ドロップダウン表示
 * - キーボードショートカット（/キーでフォーカス）
 * - URLパラメータとの同期
 *
 * ## 検索履歴機能
 * - 最大10件まで保存
 * - 重複は削除して最新を先頭に
 * - 個別削除・全削除対応
 *
 * @module components/search/SearchBar
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 *
 * useState: 入力値とUI状態の管理
 * useCallback: イベントハンドラのメモ化
 * useEffect: 副作用（キーボード、クリック監視）
 * useRef: DOM要素への参照
 */
import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Next.js ナビゲーション
 *
 * useRouter: プログラム的なページ遷移
 * useSearchParams: URLクエリパラメータの取得
 */
import { useRouter, useSearchParams } from 'next/navigation'

// ============================================================
// 定数
// ============================================================

/**
 * ローカルストレージのキー名
 * 検索履歴を保存するために使用
 */
const RECENT_SEARCHES_KEY = 'bonsai-sns-recent-searches'

/**
 * 保存する検索履歴の最大件数
 * これを超えると古いものから削除
 */
const MAX_RECENT_SEARCHES = 10

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 検索アイコン（虫眼鏡）
 *
 * @param className - 追加のCSSクラス
 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/**
 * Xアイコン（クリア・閉じる用）
 *
 * @param className - 追加のCSSクラス
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * 時計アイコン（検索履歴用）
 *
 * @param className - 追加のCSSクラス
 */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

// ============================================================
// ローカルストレージ操作関数
// ============================================================

/**
 * 検索履歴をローカルストレージから取得
 *
 * ## 注意点
 * - SSR時（window未定義）は空配列を返す
 * - JSON.parseエラー時も空配列を返す
 *
 * @returns 検索履歴の文字列配列
 */
function getRecentSearches(): string[] {
  /**
   * SSR対策: サーバーサイドでは window が存在しない
   */
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * 検索履歴をローカルストレージに保存
 *
 * ## 処理フロー
 * 1. 既存の検索履歴を取得
 * 2. 重複を削除（同じクエリがあれば除去）
 * 3. 新しいクエリを先頭に追加
 * 4. 最大件数で切り詰め
 * 5. ローカルストレージに保存
 *
 * @param query - 保存する検索クエリ
 */
function saveRecentSearch(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return
  try {
    const searches = getRecentSearches()
    /**
     * 重複を削除して先頭に追加
     * これにより最近検索したものほど上に表示される
     */
    const filtered = searches.filter(s => s !== query)
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    /**
     * ローカルストレージエラー（容量超過等）は無視
     * ユーザー体験を損なわないため
     */
  }
}

/**
 * 検索履歴から特定のクエリを削除
 *
 * @param query - 削除する検索クエリ
 */
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

/**
 * 検索履歴を全て削除
 * 「すべて削除」ボタン用
 */
function clearRecentSearches() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch {
    // ローカルストレージエラーは無視
  }
}

// ============================================================
// 型定義
// ============================================================

/**
 * SearchBarコンポーネントのprops型
 *
 * @property defaultValue - 初期入力値（オプション）
 * @property onSearch - 検索実行時のコールバック（指定しない場合はURLナビゲーション）
 * @property placeholder - 入力フィールドのプレースホルダー
 */
type SearchBarProps = {
  defaultValue?: string
  onSearch?: (query: string) => void
  placeholder?: string
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 検索バーコンポーネント
 *
 * ## 機能
 * - テキスト入力による検索
 * - Enterキーで検索実行
 * - /キーでフォーカス（キーボードショートカット）
 * - Escapeキーでフォーカス解除
 * - 検索履歴のドロップダウン表示
 * - クリアボタンで入力をリセット
 *
 * ## 検索履歴
 * - ローカルストレージに保存
 * - フォーカス時に表示（入力が空の場合）
 * - 個別削除・全削除対応
 *
 * @param defaultValue - 初期値
 * @param onSearch - 検索コールバック
 * @param placeholder - プレースホルダー
 *
 * @example
 * ```tsx
 * <SearchBar
 *   defaultValue=""
 *   placeholder="投稿を検索..."
 *   onSearch={(query) => console.log(query)}
 * />
 * ```
 */
export function SearchBar({ defaultValue = '', onSearch, placeholder = '検索...' }: SearchBarProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * Next.jsルーター
   * 検索ページへの遷移に使用
   */
  const router = useRouter()

  /**
   * URLクエリパラメータ
   * 現在の検索クエリを取得・更新するために使用
   */
  const searchParams = useSearchParams()

  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * 検索入力値
   */
  const [query, setQuery] = useState(defaultValue)

  /**
   * 入力フィールドのフォーカス状態
   * 検索履歴ドロップダウンの表示制御に使用
   */
  const [isFocused, setIsFocused] = useState(false)

  /**
   * 検索履歴の配列
   * ローカルストレージから読み込んだ過去の検索クエリ
   */
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  /**
   * 入力フィールドへの参照
   * キーボードショートカットでフォーカスするために使用
   */
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * コンテナ要素への参照
   * 外側クリック検出に使用
   */
  const containerRef = useRef<HTMLDivElement>(null)

  // ------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------

  /**
   * 検索履歴の読み込み（初回マウント時）
   *
   * ローカルストレージからクライアントサイドで読み込む
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentSearches(getRecentSearches())
  }, [])

  /**
   * URLパラメータの変更を監視してクエリを更新
   *
   * ブラウザの戻る/進むや外部からのURLアクセス時に
   * 入力フィールドを同期させる
   */
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(q)
    }
  }, [searchParams])

  /**
   * キーボードショートカット（/キーで検索フォーカス）
   *
   * ## 動作条件
   * - INPUTやTEXTAREAにフォーカスがない状態
   * - /キーが押された時
   *
   * これにより素早く検索を開始できる
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      /**
       * 入力フィールド内でないことを確認
       * フォーム入力中は/をそのまま入力させる
       */
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  /**
   * 外側クリックで検索履歴ドロップダウンを閉じる
   *
   * ユーザーがドロップダウン以外の場所をクリックした時に
   * ドロップダウンを自動的に閉じる
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * 検索実行ハンドラ
   *
   * ## 処理フロー
   * 1. 検索クエリを検索履歴に保存
   * 2. コールバックが指定されていればそれを呼び出し
   * 3. 指定されていなければURLナビゲーション
   * 4. ドロップダウンを閉じる
   *
   * @param searchQuery - 検索クエリ（省略時は現在の入力値）
   */
  const handleSearch = useCallback((searchQuery?: string) => {
    const q = searchQuery ?? query
    /**
     * 空でない検索のみ履歴に保存
     */
    if (q.trim()) {
      saveRecentSearch(q.trim())
      setRecentSearches(getRecentSearches())
    }
    /**
     * コールバックが指定されていればそれを使用
     * 指定されていなければURLパラメータを更新して遷移
     */
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

  /**
   * 入力クリアハンドラ
   *
   * ×ボタンクリック時に入力をリセットし、
   * URLパラメータからもクエリを削除
   */
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

  /**
   * キー入力ハンドラ
   *
   * - Enter: 検索実行
   * - Escape: ドロップダウンを閉じてフォーカス解除
   */
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

  /**
   * 検索履歴アイテムクリックハンドラ
   *
   * 履歴からクエリを選択して即座に検索を実行
   *
   * @param search - 選択された検索履歴のクエリ
   */
  const handleRecentSearchClick = (search: string) => {
    setQuery(search)
    handleSearch(search)
  }

  /**
   * 検索履歴削除ハンドラ
   *
   * 個別の検索履歴を削除
   * イベント伝播を止めて親要素のクリックを防止
   *
   * @param search - 削除する検索クエリ
   * @param e - マウスイベント
   */
  const handleRemoveRecentSearch = (search: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeRecentSearch(search)
    setRecentSearches(getRecentSearches())
  }

  /**
   * 検索履歴全削除ハンドラ
   *
   * 「すべて削除」ボタン用
   */
  const handleClearAll = () => {
    clearRecentSearches()
    setRecentSearches([])
  }

  // ------------------------------------------------------------
  // 表示条件
  // ------------------------------------------------------------

  /**
   * ドロップダウン表示条件
   *
   * 以下の全てを満たす場合に検索履歴ドロップダウンを表示:
   * - 入力フィールドにフォーカスがある
   * - 検索履歴が存在する
   * - 入力が空（入力中は履歴を表示しない）
   */
  const showDropdown = isFocused && recentSearches.length > 0 && !query

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <div className="relative" ref={containerRef}>
      {/* 検索入力フィールド */}
      <div className="relative flex items-center">
        {/* 左側の検索アイコン（装飾用） */}
        <SearchIcon className="absolute left-3 w-5 h-5 text-muted-foreground pointer-events-none" />

        {/* テキスト入力 */}
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

        {/* クリアボタン（入力がある時のみ表示） */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 p-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 最近の検索ドロップダウン */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium text-muted-foreground">最近の検索</span>
            <button
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              すべて削除
            </button>
          </div>

          {/* 検索履歴リスト */}
          <ul>
            {recentSearches.map((search) => (
              <li key={search}>
                <button
                  onClick={() => handleRecentSearchClick(search)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors"
                >
                  {/* 履歴アイコン */}
                  <ClockIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                  {/* 検索クエリテキスト */}
                  <span className="flex-1 text-left truncate">{search}</span>

                  {/* 個別削除ボタン */}
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
