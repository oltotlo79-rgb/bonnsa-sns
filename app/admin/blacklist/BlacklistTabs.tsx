/**
 * ブラックリストタブコンポーネント
 *
 * メールとデバイスのブラックリストをタブで切り替えて表示します。
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addEmailToBlacklist,
  removeEmailFromBlacklist,
  addDeviceToBlacklist,
  removeDeviceFromBlacklist,
} from '@/lib/actions/blacklist'

// ============================================================
// アイコン
// ============================================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14"/>
      <path d="M12 5v14"/>
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18"/>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="3" rx="2"/>
      <line x1="8" x2="16" y1="21" y2="21"/>
      <line x1="12" x2="12" y1="17" y2="21"/>
    </svg>
  )
}

// ============================================================
// 型定義
// ============================================================

interface EmailBlacklistItem {
  id: string
  email: string
  reason: string | null
  createdBy: string
  createdAt: Date
}

interface DeviceBlacklistItem {
  id: string
  fingerprint: string
  reason: string | null
  originalEmail: string | null
  createdBy: string
  createdAt: Date
}

interface BlacklistTabsProps {
  tab: 'email' | 'device'
  search: string
  page: number
  limit: number
  emailItems: EmailBlacklistItem[]
  emailTotal: number
  deviceItems: DeviceBlacklistItem[]
  deviceTotal: number
}

// ============================================================
// メインコンポーネント
// ============================================================

export function BlacklistTabs({
  tab,
  search,
  page,
  limit,
  emailItems,
  emailTotal,
  deviceItems,
  deviceTotal,
}: BlacklistTabsProps) {
  const router = useRouter()
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 追加フォームの状態
  const [newEmail, setNewEmail] = useState('')
  const [newFingerprint, setNewFingerprint] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newOriginalEmail, setNewOriginalEmail] = useState('')

  const totalPages = Math.ceil((tab === 'email' ? emailTotal : deviceTotal) / limit)

  // タブを切り替える
  const handleTabChange = (newTab: 'email' | 'device') => {
    router.push(`/admin/blacklist?tab=${newTab}`)
  }

  // メールアドレスを追加
  const handleAddEmail = async () => {
    if (!newEmail.trim()) return

    setLoading(true)
    setError(null)

    const result = await addEmailToBlacklist(newEmail, newReason || undefined)

    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }

    setNewEmail('')
    setNewReason('')
    setShowAddModal(false)
    setLoading(false)
    router.refresh()
  }

  // デバイスを追加
  const handleAddDevice = async () => {
    if (!newFingerprint.trim()) return

    setLoading(true)
    setError(null)

    const result = await addDeviceToBlacklist(
      newFingerprint,
      newReason || undefined,
      newOriginalEmail || undefined
    )

    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }

    setNewFingerprint('')
    setNewReason('')
    setNewOriginalEmail('')
    setShowAddModal(false)
    setLoading(false)
    router.refresh()
  }

  // メールアドレスを削除
  const handleRemoveEmail = async (id: string) => {
    if (!confirm('このメールアドレスをブラックリストから削除しますか？')) return

    const result = await removeEmailFromBlacklist(id)
    if ('error' in result) {
      alert(result.error)
      return
    }

    router.refresh()
  }

  // デバイスを削除
  const handleRemoveDevice = async (id: string) => {
    if (!confirm('このデバイスをブラックリストから削除しますか？')) return

    const result = await removeDeviceFromBlacklist(id)
    if ('error' in result) {
      alert(result.error)
      return
    }

    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* タブ */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => handleTabChange('email')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            tab === 'email'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MailIcon className="w-4 h-4" />
          メールアドレス
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{emailTotal}</span>
        </button>
        <button
          onClick={() => handleTabChange('device')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            tab === 'device'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MonitorIcon className="w-4 h-4" />
          デバイス
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{deviceTotal}</span>
        </button>
      </div>

      {/* フィルター & 追加ボタン */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-wrap gap-4">
          <form className="flex-1 min-w-[200px]">
            <input type="hidden" name="tab" value={tab} />
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                placeholder={tab === 'email' ? 'メールアドレスで検索' : 'フィンガープリント・メールで検索'}
                defaultValue={search}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
              />
            </div>
          </form>

          <Button onClick={() => setShowAddModal(true)}>
            <PlusIcon className="w-4 h-4 mr-2" />
            追加
          </Button>
        </div>
      </div>

      {/* 追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">
              {tab === 'email' ? 'メールアドレスを追加' : 'デバイスを追加'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {tab === 'email' ? (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    メールアドレス <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@example.com"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      デバイスフィンガープリント <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={newFingerprint}
                      onChange={(e) => setNewFingerprint(e.target.value)}
                      placeholder="フィンガープリント"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      ユーザー詳細画面からコピーできます
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      関連メールアドレス（任意）
                    </label>
                    <Input
                      type="email"
                      value={newOriginalEmail}
                      onChange={(e) => setNewOriginalEmail(e.target.value)}
                      placeholder="元ユーザーのメールアドレス"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">理由（任意）</label>
                <Input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="ブロックの理由"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false)
                  setError(null)
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={tab === 'email' ? handleAddEmail : handleAddDevice}
                disabled={loading || (tab === 'email' ? !newEmail.trim() : !newFingerprint.trim())}
              >
                {loading ? '追加中...' : '追加'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* テーブル */}
      <div className="bg-card rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              {tab === 'email' ? (
                <>
                  <th className="text-left px-4 py-3 text-sm font-medium">メールアドレス</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">理由</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">登録日</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
                </>
              ) : (
                <>
                  <th className="text-left px-4 py-3 text-sm font-medium">フィンガープリント</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">関連メール</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">理由</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">登録日</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tab === 'email' ? (
              emailItems.length > 0 ? (
                emailItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-sm">{item.email}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemoveEmail(item.id)}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="削除"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    メールアドレスのブラックリストは空です
                  </td>
                </tr>
              )
            ) : deviceItems.length > 0 ? (
              deviceItems.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <span title={item.fingerprint}>
                      {item.fingerprint.slice(0, 20)}...
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.originalEmail || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.reason || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemoveDevice(item.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="削除"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  デバイスのブラックリストは空です
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/blacklist?tab=${tab}&search=${search}&page=${page - 1}`}
              className="px-3 py-1 border rounded hover:bg-muted"
            >
              前へ
            </Link>
          )}

          <span className="px-3 py-1">
            {page} / {totalPages}
          </span>

          {page < totalPages && (
            <Link
              href={`/admin/blacklist?tab=${tab}&search=${search}&page=${page + 1}`}
              className="px-3 py-1 border rounded hover:bg-muted"
            >
              次へ
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
