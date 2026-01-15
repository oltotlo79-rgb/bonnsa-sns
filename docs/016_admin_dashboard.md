# 016: 管理者ダッシュボード

## 概要
管理者向けのダッシュボード機能を実装する。
ユーザー管理、投稿管理、通報管理、統計情報の表示を含む。

## 優先度
**中** - Phase 7

## 依存チケット
- 003: 認証システム
- 015: 通報・モデレーション機能

---

## Todo

### 管理者認証
- [x] `admin_users` テーブルでの管理者判定
- [x] 管理者専用Middleware
- [x] 権限チェックユーティリティ

### 管理者ページ
- [x] `app/admin/layout.tsx` - 管理者レイアウト
- [x] `app/admin/page.tsx` - ダッシュボードトップ
- [x] `app/admin/users/page.tsx` - ユーザー管理
- [x] `app/admin/users/[id]/page.tsx` - ユーザー詳細
- [x] `app/admin/posts/page.tsx` - 投稿管理
- [x] `app/admin/reports/page.tsx` - 通報管理
- [x] `app/admin/events/page.tsx` - イベント管理
- [x] `app/admin/shops/page.tsx` - 盆栽園管理
- [x] `app/admin/stats/page.tsx` - 統計情報（Recharts導入済み）

### ダッシュボードトップ
- [x] `components/admin/Dashboard.tsx`
  - [x] 総ユーザー数
  - [x] 本日の新規ユーザー数
  - [x] 総投稿数
  - [x] 本日の投稿数
  - [x] 未対応通報数
  - [ ] アクティブユーザー数（DAU）

### ユーザー管理
- [x] `components/admin/UserTable.tsx` - ユーザー一覧テーブル
  - [x] ユーザーID
  - [x] ニックネーム
  - [x] メールアドレス
  - [x] 登録日
  - [x] 投稿数
  - [x] ステータス（アクティブ/停止）
- [x] `components/admin/UserDetail.tsx` - ユーザー詳細（ページに統合）
- [x] `components/admin/UserActions.tsx` - ユーザーアクション
  - [x] アカウント停止
  - [x] アカウント再開
  - [x] アカウント削除
- [x] ユーザー検索機能
- [ ] ソート機能（登録日、投稿数等）

### 投稿管理
- [x] `components/admin/PostTable.tsx` - 投稿一覧テーブル
  - [x] 投稿ID
  - [x] 投稿者
  - [x] 内容（プレビュー）
  - [x] 投稿日
  - [x] いいね数
  - [x] 通報数
- [ ] `components/admin/PostDetail.tsx` - 投稿詳細
- [x] `components/admin/PostActions.tsx` - 投稿アクション
  - [x] 投稿削除
  - [ ] 投稿者への警告
- [x] 投稿検索機能
- [x] 通報された投稿のフィルター

### 通報管理
- [x] `components/admin/ReportTable.tsx` - 通報一覧テーブル
  - [x] 通報ID
  - [x] 通報者
  - [x] 対象タイプ
  - [x] 通報理由
  - [x] ステータス
  - [x] 通報日
- [x] `components/admin/ReportDetail.tsx` - 通報詳細
  - [x] 通報対象のプレビュー
  - [x] 通報理由詳細
  - [ ] 対応履歴
- [x] `components/admin/ReportActions.tsx` - 通報アクション
  - [x] 対象コンテンツ削除
  - [x] 通報却下
  - [x] ステータス更新
- [x] ステータスフィルター（未対応/確認済み/完了/却下）

### イベント管理
- [x] `components/admin/EventTable.tsx` - イベント一覧
- [x] イベント削除機能
- [ ] 不適切なイベントの非表示

### 盆栽園管理
- [x] `components/admin/ShopTable.tsx` - 盆栽園一覧
- [ ] 盆栽園情報編集
- [x] 盆栽園削除
- [ ] 重複盆栽園のマージ

### 統計情報
- [x] `app/admin/stats/StatsCharts.tsx` - グラフコンポーネント（Recharts使用）
- [x] ユーザー数推移グラフ
- [x] 投稿数推移グラフ
- [x] コメント数推移グラフ
- [ ] アクティブユーザー数グラフ（DAU関数は実装済み）
- [x] 期間選択（7日/14日/30日）
- [x] グラフタイプ選択（エリア/ライン/バー）
- [x] 指標フィルタ（すべて/ユーザー/投稿/コメント）

### Server Actions
- [x] `lib/actions/admin.ts`
  - [x] `getAdminStats` - 統計情報取得
  - [x] `getUsers` - ユーザー一覧取得
  - [x] `suspendUser` - ユーザー停止
  - [x] `activateUser` - ユーザー再開
  - [x] `deleteUser` - ユーザー削除
  - [x] `deletePost` - 投稿削除
  - [x] `deleteEvent` - イベント削除
  - [x] `deleteShop` - 盆栽園削除
  - [x] `updateReportStatus` - 通報ステータス更新
  - [x] `getDailyActiveUsers` - DAU取得

### 管理者ログ
- [x] 管理者操作のログ記録
- [x] ログ一覧表示
- [x] ログ検索機能

### 権限管理
- [x] `admin` - 全機能アクセス可能
- [x] `moderator` - 通報対応、コンテンツ削除のみ

### UI/UX
- [x] サイドバーナビゲーション
- [x] データテーブルのページネーション
- [x] 検索・フィルター機能
- [x] 確認ダイアログ（削除操作時）
- [x] 成功/エラートースト表示

### セキュリティ
- [x] 管理者権限チェック
- [x] 操作ログの記録
- [x] 管理者専用Middleware

---

## 完了条件
- [x] 管理者のみダッシュボードにアクセスできる
- [x] ユーザー管理が正常に動作する
- [x] 投稿管理が正常に動作する
- [x] 通報管理が正常に動作する
- [x] 統計情報が正常に表示される
- [x] 管理者操作がログに記録される

## 参考コード
```typescript
// middleware.ts (管理者認証部分)
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth(async (req) => {
  const isLoggedIn = !!req.auth

  // 管理者ページへのアクセスチェック
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', req.nextUrl))
    }

    // 注: 管理者権限チェックはServer Actionsで行う
    // Middlewareでは認証のみチェック
  }
})
```

```typescript
// lib/actions/admin.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

async function checkAdminPermission() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('認証が必要です')
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    throw new Error('管理者権限が必要です')
  }

  return { user: session.user, role: adminUser.role }
}

export async function getAdminStats() {
  await checkAdminPermission()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [totalUsers, todayUsers, totalPosts, todayPosts, pendingReports] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.post.count(),
      prisma.post.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.report.count({
        where: { status: 'pending' },
      }),
    ])

  return {
    totalUsers,
    todayUsers,
    totalPosts,
    todayPosts,
    pendingReports,
  }
}

export async function suspendUser(userId: string, reason: string) {
  const { user: adminUser } = await checkAdminPermission()

  // ユーザー停止
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: true,
      suspendedAt: new Date(),
    },
  })

  // 管理者ログ記録
  await prisma.adminLog.create({
    data: {
      adminId: adminUser.id,
      action: 'suspend_user',
      targetType: 'user',
      targetId: userId,
      details: { reason },
    },
  })

  return { success: true }
}

export async function deletePost(postId: string, reason: string) {
  const { user: adminUser } = await checkAdminPermission()

  // 投稿削除
  await prisma.post.delete({
    where: { id: postId },
  })

  // 管理者ログ記録
  await prisma.adminLog.create({
    data: {
      adminId: adminUser.id,
      action: 'delete_post',
      targetType: 'post',
      targetId: postId,
      details: { reason },
    },
  })

  return { success: true }
}
```

```typescript
// app/admin/page.tsx
import { getAdminStats } from '@/lib/actions/admin'

export default async function AdminDashboard() {
  const stats = await getAdminStats()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">管理者ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-gray-500">総ユーザー数</h2>
          <p className="text-3xl font-bold">{stats.totalUsers}</p>
          <p className="text-sm text-green-500">+{stats.todayUsers} 今日</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-gray-500">総投稿数</h2>
          <p className="text-3xl font-bold">{stats.totalPosts}</p>
          <p className="text-sm text-green-500">+{stats.todayPosts} 今日</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-gray-500">未対応通報</h2>
          <p className="text-3xl font-bold text-red-500">{stats.pendingReports}</p>
          <a href="/admin/reports" className="text-sm text-blue-500">確認する →</a>
        </div>
      </div>
    </div>
  )
}
```
