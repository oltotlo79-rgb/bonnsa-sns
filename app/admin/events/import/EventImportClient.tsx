'use client'

import { useState, useTransition } from 'react'
import {
  scrapeExternalEvents,
  scrapeEventsByRegion,
  importSelectedEvents,
  type ImportableEvent,
} from '@/lib/actions/event-import'
import { BONSAI_EVENT_SOURCES } from '@/lib/scraping/bonsai-events'
import { PREFECTURES } from '@/lib/prefectures'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

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
  // 編集中のイベント
  const [editingEvent, setEditingEvent] = useState<ImportableEvent | null>(null)

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
   * イベント更新
   */
  const handleUpdateEvent = (updatedEvent: ImportableEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
    )
    setEditingEvent(null)
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
                      <button
                        type="button"
                        onClick={() => setEditingEvent(event)}
                        className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        編集
                      </button>
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

      {/* 編集モーダル */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>イベント情報を編集</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <EventEditForm
              event={editingEvent}
              onSave={handleUpdateEvent}
              onCancel={() => setEditingEvent(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * イベント編集フォーム
 */
function EventEditForm({
  event,
  onSave,
  onCancel,
}: {
  event: ImportableEvent
  onSave: (event: ImportableEvent) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<ImportableEvent>(event)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const updateField = <K extends keyof ImportableEvent>(
    field: K,
    value: ImportableEvent[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // ISO日付文字列をinput[type="date"]用にフォーマット
  const formatDateForInput = (dateStr: string | null): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0]
  }

  // input[type="date"]の値をISO文字列に変換
  const parseDateInput = (value: string): string | null => {
    if (!value) return null
    return new Date(value).toISOString()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* タイトル */}
      <div>
        <label className="block text-sm font-medium mb-1">タイトル *</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          required
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />
      </div>

      {/* 日付 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">開始日 *</label>
          <input
            type="date"
            value={formatDateForInput(formData.startDate)}
            onChange={(e) => updateField('startDate', parseDateInput(e.target.value))}
            required
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">終了日</label>
          <input
            type="date"
            value={formatDateForInput(formData.endDate)}
            onChange={(e) => updateField('endDate', parseDateInput(e.target.value))}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
      </div>

      {/* 場所 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">都道府県</label>
          <select
            value={formData.prefecture || ''}
            onChange={(e) => updateField('prefecture', e.target.value || null)}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">市区町村</label>
          <input
            type="text"
            value={formData.city || ''}
            onChange={(e) => updateField('city', e.target.value || null)}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
      </div>

      {/* 会場 */}
      <div>
        <label className="block text-sm font-medium mb-1">会場</label>
        <input
          type="text"
          value={formData.venue || ''}
          onChange={(e) => updateField('venue', e.target.value || null)}
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />
      </div>

      {/* 主催者 */}
      <div>
        <label className="block text-sm font-medium mb-1">主催者</label>
        <input
          type="text"
          value={formData.organizer || ''}
          onChange={(e) => updateField('organizer', e.target.value || null)}
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />
      </div>

      {/* 入場料・即売 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">入場料</label>
          <input
            type="text"
            value={formData.admissionFee || ''}
            onChange={(e) => updateField('admissionFee', e.target.value || null)}
            placeholder="例: 無料、500円"
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
        <div className="flex items-center pt-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.hasSales}
              onChange={(e) => updateField('hasSales', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">即売あり</span>
          </label>
        </div>
      </div>

      {/* 説明 */}
      <div>
        <label className="block text-sm font-medium mb-1">説明</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
        />
      </div>

      {/* 外部URL */}
      <div>
        <label className="block text-sm font-medium mb-1">外部URL</label>
        <input
          type="url"
          value={formData.externalUrl || ''}
          onChange={(e) => updateField('externalUrl', e.target.value || null)}
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />
      </div>

      {/* ボタン */}
      <DialogFooter>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg hover:bg-muted"
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          保存
        </button>
      </DialogFooter>
    </form>
  )
}
