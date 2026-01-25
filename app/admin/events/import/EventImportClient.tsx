'use client'

import { useState, useTransition } from 'react'
import {
  scrapeExternalEvents,
  scrapeEventsByRegion,
  importSelectedEvents,
  type ImportableEvent,
} from '@/lib/actions/event-import'
import { BONSAI_EVENT_SOURCES } from '@/lib/scraping/bonsai-events'

/**
 * 外部イベントインポートのクライアントコンポーネント
 */
export function EventImportClient() {
  // スクレイピング結果
  const [events, setEvents] = useState<ImportableEvent[]>([])
  // 選択されたイベントID
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 処理中フラグ
  const [isPending, startTransition] = useTransition()
  // スクレイピング中フラグ
  const [isScraping, setIsScraping] = useState(false)
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null)
  // 成功メッセージ
  const [success, setSuccess] = useState<string | null>(null)
  // 選択された地方
  const [selectedRegion, setSelectedRegion] = useState<string>('all')

  /**
   * スクレイピング実行
   */
  const handleScrape = async () => {
    setIsScraping(true)
    setError(null)
    setSuccess(null)
    setEvents([])
    setSelectedIds(new Set())

    try {
      const result = selectedRegion === 'all'
        ? await scrapeExternalEvents()
        : await scrapeEventsByRegion(selectedRegion)

      if ('error' in result) {
        setError(result.error)
      } else {
        setEvents(result.events)
        // 重複でないイベントを初期選択
        const nonDuplicateIds = new Set(
          result.events
            .filter((e) => !e.isDuplicate && e.startDate)
            .map((e) => e.id)
        )
        setSelectedIds(nonDuplicateIds)
      }
    } catch {
      setError('スクレイピング中にエラーが発生しました')
    } finally {
      setIsScraping(false)
    }
  }

  /**
   * イベント選択切り替え
   */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  /**
   * 全選択/全解除
   */
  const toggleSelectAll = () => {
    if (selectedIds.size === events.filter((e) => e.startDate).length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(events.filter((e) => e.startDate).map((e) => e.id)))
    }
  }

  /**
   * インポート実行
   */
  const handleImport = () => {
    if (selectedIds.size === 0) {
      setError('インポートするイベントを選択してください')
      return
    }

    startTransition(async () => {
      setError(null)
      setSuccess(null)

      const selectedEvents = events.filter((e) => selectedIds.has(e.id))
      const result = await importSelectedEvents(selectedEvents)

      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(`${result.importedCount}件のイベントをインポートしました`)
        // インポート済みを除去
        setEvents((prev) => prev.filter((e) => !selectedIds.has(e.id)))
        setSelectedIds(new Set())
      }
    })
  }

  /**
   * 日付フォーマット
   */
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '日付なし'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* 操作パネル */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* 地方選択 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">取得する地方:</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              disabled={isScraping}
              className="px-3 py-2 border rounded-lg bg-background"
            >
              <option value="all">全地方</option>
              {BONSAI_EVENT_SOURCES.map((source) => (
                <option key={source.region} value={source.region}>
                  {source.region}
                </option>
              ))}
            </select>
          </div>

          {/* スクレイピングボタン */}
          <button
            onClick={handleScrape}
            disabled={isScraping}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isScraping ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                取得中...
              </span>
            ) : (
              'イベント情報を取得'
            )}
          </button>

          {/* インポートボタン（イベントがある場合のみ） */}
          {events.length > 0 && (
            <button
              onClick={handleImport}
              disabled={isPending || selectedIds.size === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  インポート中...
                </span>
              ) : (
                `選択した${selectedIds.size}件をインポート`
              )}
            </button>
          )}
        </div>
      </div>

      {/* メッセージ */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
          {success}
        </div>
      )}

      {/* イベント一覧 */}
      {events.length > 0 && (
        <div className="bg-card rounded-lg border">
          {/* ヘッダー */}
          <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.size === events.filter((e) => e.startDate).length}
                onChange={toggleSelectAll}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">
                取得結果: {events.length}件
                {selectedIds.size > 0 && ` (${selectedIds.size}件選択中)`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded">黄色</span>
              <span>= 重複の可能性あり</span>
            </div>
          </div>

          {/* イベントリスト */}
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className={`p-4 hover:bg-muted/30 ${
                  event.isDuplicate ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                } ${!event.startDate ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {/* チェックボックス */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(event.id)}
                    onChange={() => toggleSelect(event.id)}
                    disabled={!event.startDate}
                    className="w-4 h-4 mt-1"
                  />

                  {/* イベント情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm">{event.title}</h3>
                      {event.isDuplicate && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded flex-shrink-0">
                          重複？
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        📅 {formatDate(event.startDate)}
                        {event.endDate && ` 〜 ${formatDate(event.endDate)}`}
                      </span>
                      {event.prefecture && (
                        <span>📍 {event.prefecture}{event.city && ` ${event.city}`}</span>
                      )}
                      {event.venue && <span>🏛️ {event.venue}</span>}
                    </div>

                    {event.organizer && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        主催: {event.organizer}
                      </p>
                    )}

                    {event.description && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-muted rounded">
                        {event.sourceRegion}
                      </span>
                      {event.hasSales && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                          即売あり
                        </span>
                      )}
                      {event.externalUrl && (
                        <a
                          href={event.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          詳細 →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空の状態 */}
      {!isScraping && events.length === 0 && (
        <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">
          <p>「イベント情報を取得」ボタンを押してイベントを取得してください</p>
        </div>
      )}
    </div>
  )
}
