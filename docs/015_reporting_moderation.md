# 015: 通報・モデレーション機能

## 概要
不適切なコンテンツの通報機能と、管理者による対応機能を実装する。

## 優先度
**中** - Phase 7

## 依存チケット
- 005: 投稿機能
- 006: コメント機能
- 013: 盆栽園マップ機能
- 014: イベント機能

---

## Todo

### 通報コンポーネント
- [x] `components/report/ReportButton.tsx` - 通報ボタン
- [x] `components/report/ReportModal.tsx` - 通報モーダル
  - [x] 通報対象表示
  - [x] 通報理由選択
  - [x] 詳細説明入力
  - [x] 送信ボタン
- [x] `components/report/ReportReasonSelector.tsx` - 通報理由選択

### 通報対象
- [x] 投稿の通報
- [x] コメントの通報
- [x] イベントの通報
- [x] 盆栽園情報の通報
- [x] ユーザープロフィールの通報

### 通報理由
- [x] スパム
- [x] 不適切な内容
- [x] 誹謗中傷
- [x] 著作権侵害
- [x] その他（自由記述）

### Server Actions
- [x] `lib/actions/report.ts`
  - [x] `createReport` - 通報作成
  - [x] `getReports` - 通報一覧取得（管理者用）
  - [x] `getReportsByStatus` - ステータス別通報取得
  - [x] `updateReportStatus` - 通報ステータス更新
  - [x] `getReportStats` - 通報統計取得

### 通報ステータス管理
- [x] `pending` - 未対応
- [x] `reviewed` - 確認済み
- [x] `resolved` - 対応完了
- [x] `dismissed` - 却下

### 通報処理フロー
1. [x] ユーザーが通報送信
2. [x] 管理者が通報を確認
3. [x] 対応を決定（削除/警告/却下）
4. [x] ステータス更新
5. [x] 対応ログ記録

### 通報メニュー統合
- [x] 投稿カードに通報オプション追加
- [x] コメントカードに通報オプション追加
- [x] イベント詳細に通報オプション追加
- [x] 盆栽園詳細に通報オプション追加
- [x] ユーザープロフィールに通報オプション追加

### バリデーション
- [x] 自分自身のコンテンツは通報不可
- [x] 同一対象への重複通報チェック
- [x] 通報理由必須

### UI/UX
- [x] ドロップダウンメニューから通報
- [x] 通報確認ダイアログ
- [x] 通報完了メッセージ
- [x] 匿名性の説明表示

### 通知（管理者向け）
- [x] 新規通報時の管理者通知
- [x] 未対応通報数の表示

---

## 完了条件
- [x] 各種コンテンツへの通報が正常に動作する
- [x] 通報理由を選択して送信できる
- [x] 管理者が通報を確認できる
- [x] 通報ステータスが更新できる

## 参考コード
```typescript
// components/report/ReportModal.tsx
'use client'

import { useState } from 'react'
import { createReport } from '@/lib/actions/report'

interface ReportModalProps {
  targetType: 'post' | 'comment' | 'event' | 'shop' | 'user'
  targetId: string
  onClose: () => void
}

const REPORT_REASONS = [
  { value: 'spam', label: 'スパム' },
  { value: 'inappropriate', label: '不適切な内容' },
  { value: 'harassment', label: '誹謗中傷' },
  { value: 'copyright', label: '著作権侵害' },
  { value: 'other', label: 'その他' },
]

export function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await createReport({
      targetType,
      targetId,
      reason,
      description,
    })

    if (result.success) {
      setSuccess(true)
      setTimeout(onClose, 2000)
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="p-4 text-center">
        <p className="text-green-600">通報を受け付けました。ご協力ありがとうございます。</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <h2 className="text-lg font-bold mb-4">通報する</h2>

      <div className="mb-4">
        <label className="block mb-2 font-medium">通報理由</label>
        {REPORT_REASONS.map((r) => (
          <label key={r.value} className="flex items-center mb-2">
            <input
              type="radio"
              name="reason"
              value={r.value}
              checked={reason === r.value}
              onChange={(e) => setReason(e.target.value)}
              className="mr-2"
            />
            {r.label}
          </label>
        ))}
      </div>

      {reason === 'other' && (
        <div className="mb-4">
          <label className="block mb-2 font-medium">詳細</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded p-2"
            rows={3}
            placeholder="詳細を入力してください"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 border rounded">
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!reason || loading}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
        >
          {loading ? '送信中...' : '通報する'}
        </button>
      </div>
    </form>
  )
}
```

```typescript
// lib/actions/report.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

interface CreateReportParams {
  targetType: 'post' | 'comment' | 'event' | 'shop' | 'user'
  targetId: string
  reason: string
  description?: string
}

export async function createReport(params: CreateReportParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 重複チェック
  const existing = await prisma.report.findFirst({
    where: {
      reporterId: session.user.id,
      targetType: params.targetType,
      targetId: params.targetId,
    },
  })

  if (existing) {
    return { error: '既に通報済みです' }
  }

  await prisma.report.create({
    data: {
      reporterId: session.user.id,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      description: params.description,
      status: 'pending',
    },
  })

  return { success: true }
}

export async function getReports(status?: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 管理者権限チェック（実際の実装では管理者テーブルを確認）
  const reports = await prisma.report.findMany({
    where: status ? { status } : undefined,
    include: {
      reporter: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { reports }
}

export async function updateReportStatus(reportId: string, status: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  await prisma.report.update({
    where: { id: reportId },
    data: { status },
  })

  return { success: true }
}
```
