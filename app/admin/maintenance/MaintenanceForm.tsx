'use client'

/**
 * メンテナンス設定フォームコンポーネント
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateMaintenanceSettings,
  type MaintenanceSettings,
} from '@/lib/actions/maintenance'
import { Button } from '@/components/ui/button'

interface MaintenanceFormProps {
  settings: MaintenanceSettings
}

/**
 * ISO形式の日時文字列をdatetime-local用の形式に変換
 */
function toLocalDateTimeString(isoString: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  // ローカルタイムゾーンでの日時を取得
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

/**
 * datetime-local形式をISO形式に変換
 */
function toISOString(localDateTime: string): string | null {
  if (!localDateTime) return null
  return new Date(localDateTime).toISOString()
}

export function MaintenanceForm({ settings }: MaintenanceFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [enabled, setEnabled] = useState(settings.enabled)
  const [startTime, setStartTime] = useState(
    toLocalDateTimeString(settings.startTime)
  )
  const [endTime, setEndTime] = useState(
    toLocalDateTimeString(settings.endTime)
  )
  const [message, setMessage] = useState(settings.message)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await updateMaintenanceSettings({
        enabled,
        startTime: toISOString(startTime),
        endTime: toISOString(endTime),
        message,
      })

      if (result.success) {
        setSuccess(true)
        router.refresh()
        // 3秒後に成功メッセージを消す
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error || '更新に失敗しました')
      }
    })
  }

  const handleQuickEnable = () => {
    setEnabled(true)
    setStartTime('')
    setEndTime('')
  }

  const handleQuickDisable = () => {
    setEnabled(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* クイックアクション */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant={enabled ? 'default' : 'outline'}
          onClick={handleQuickEnable}
          className={enabled ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          メンテナンス開始
        </Button>
        <Button
          type="button"
          variant={!enabled ? 'default' : 'outline'}
          onClick={handleQuickDisable}
          className={!enabled ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          通常運用に戻す
        </Button>
      </div>

      {/* メンテナンス期間設定 */}
      <div className="border-t pt-6">
        <h3 className="font-medium mb-4">メンテナンス期間（任意）</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              開始日時
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              空の場合は即座に開始
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              終了予定日時
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              設定すると自動で終了
            </p>
          </div>
        </div>
      </div>

      {/* メッセージ設定 */}
      <div className="border-t pt-6">
        <h3 className="font-medium mb-4">表示メッセージ</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="メンテナンス中に表示するメッセージを入力..."
        />
      </div>

      {/* エラー/成功メッセージ */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          設定を保存しました
        </div>
      )}

      {/* 保存ボタン */}
      <div className="border-t pt-6">
        <Button
          type="submit"
          disabled={isPending}
          className="w-full md:w-auto"
        >
          {isPending ? '保存中...' : '設定を保存'}
        </Button>
      </div>
    </form>
  )
}
