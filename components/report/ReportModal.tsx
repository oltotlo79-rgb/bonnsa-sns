'use client'

import { useState, useTransition } from 'react'
import { createReport } from '@/lib/actions/report'
import { REPORT_REASONS, TARGET_TYPE_LABELS, type ReportTargetType, type ReportReason } from '@/lib/constants/report'

interface ReportModalProps {
  targetType: ReportTargetType
  targetId: string
  onClose: () => void
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}

export function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [description, setDescription] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return

    setError(null)
    startTransition(async () => {
      const result = await createReport({
        targetType,
        targetId,
        reason,
        description: description || undefined,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      setSuccess(true)
      setTimeout(onClose, 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* モーダル */}
      <div className="relative bg-card rounded-lg border shadow-lg w-full max-w-md">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {TARGET_TYPE_LABELS[targetType]}を通報
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        {success ? (
          <div className="p-8 text-center">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">通報を受け付けました</p>
            <p className="text-sm text-muted-foreground">
              ご協力ありがとうございます。内容を確認し、適切に対応いたします。
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-lg">
                  {error}
                </div>
              )}

              {/* 説明 */}
              <p className="text-sm text-muted-foreground">
                この{TARGET_TYPE_LABELS[targetType]}に問題がある場合は、以下から該当する理由を選択してください。
                通報内容は匿名で処理されます。
              </p>

              {/* 通報理由 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  通報理由 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        reason === r.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={(e) => setReason(e.target.value as ReportReason)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                          reason === r.value
                            ? 'border-primary'
                            : 'border-muted-foreground'
                        }`}
                      >
                        {reason === r.value && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 詳細説明 */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  詳細説明（任意）
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="問題の詳細があれば入力してください"
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {description.length}/500
                </p>
              </div>
            </div>

            {/* フッター */}
            <div className="flex gap-3 p-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border rounded-lg hover:bg-muted transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!reason || isPending}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {isPending ? '送信中...' : '通報する'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
