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
- [ ] `admin_users` テーブルでの管理者判定
- [ ] 管理者専用Middleware
- [ ] 権限チェックユーティリティ

### 管理者ページ
- [ ] `app/admin/layout.tsx` - 管理者レイアウト
- [ ] `app/admin/page.tsx` - ダッシュボードトップ
- [ ] `app/admin/users/page.tsx` - ユーザー管理
- [ ] `app/admin/users/[id]/page.tsx` - ユーザー詳細
- [ ] `app/admin/posts/page.tsx` - 投稿管理
- [ ] `app/admin/reports/page.tsx` - 通報管理
- [ ] `app/admin/events/page.tsx` - イベント管理
- [ ] `app/admin/shops/page.tsx` - 盆栽園管理
- [ ] `app/admin/stats/page.tsx` - 統計情報

### ダッシュボードトップ
- [ ] `components/admin/Dashboard.tsx`
  - [ ] 総ユーザー数
  - [ ] 本日の新規ユーザー数
  - [ ] 総投稿数
  - [ ] 本日の投稿数
  - [ ] 未対応通報数
  - [ ] アクティブユーザー数（DAU）

### ユーザー管理
- [ ] `components/admin/UserTable.tsx` - ユーザー一覧テーブル
  - [ ] ユーザーID
  - [ ] ニックネーム
  - [ ] メールアドレス
  - [ ] 登録日
  - [ ] 投稿数
  - [ ] ステータス（アクティブ/停止）
- [ ] `components/admin/UserDetail.tsx` - ユーザー詳細
- [ ] `components/admin/UserActions.tsx` - ユーザーアクション
  - [ ] アカウント停止
  - [ ] アカウント再開
  - [ ] アカウント削除
- [ ] ユーザー検索機能
- [ ] ソート機能（登録日、投稿数等）

### 投稿管理
- [ ] `components/admin/PostTable.tsx` - 投稿一覧テーブル
  - [ ] 投稿ID
  - [ ] 投稿者
  - [ ] 内容（プレビュー）
  - [ ] 投稿日
  - [ ] いいね数
  - [ ] 通報数
- [ ] `components/admin/PostDetail.tsx` - 投稿詳細
- [ ] `components/admin/PostActions.tsx` - 投稿アクション
  - [ ] 投稿削除
  - [ ] 投稿者への警告
- [ ] 投稿検索機能
- [ ] 通報された投稿のフィルター

### 通報管理
- [ ] `components/admin/ReportTable.tsx` - 通報一覧テーブル
  - [ ] 通報ID
  - [ ] 通報者
  - [ ] 対象タイプ
  - [ ] 通報理由
  - [ ] ステータス
  - [ ] 通報日
- [ ] `components/admin/ReportDetail.tsx` - 通報詳細
  - [ ] 通報対象のプレビュー
  - [ ] 通報理由詳細
  - [ ] 対応履歴
- [ ] `components/admin/ReportActions.tsx` - 通報アクション
  - [ ] 対象コンテンツ削除
  - [ ] 通報却下
  - [ ] ステータス更新
- [ ] ステータスフィルター（未対応/確認済み/完了/却下）

### イベント管理
- [ ] `components/admin/EventTable.tsx` - イベント一覧
- [ ] イベント削除機能
- [ ] 不適切なイベントの非表示

### 盆栽園管理
- [ ] `components/admin/ShopTable.tsx` - 盆栽園一覧
- [ ] 盆栽園情報編集
- [ ] 盆栽園削除
- [ ] 重複盆栽園のマージ

### 統計情報
- [ ] `components/admin/StatsChart.tsx` - グラフコンポーネント
- [ ] ユーザー数推移グラフ
- [ ] 投稿数推移グラフ
- [ ] アクティブユーザー数グラフ
- [ ] 期間選択（日/週/月）

### Server Actions
- [ ] `lib/actions/admin.ts`
  - [ ] `getAdminStats` - 統計情報取得
  - [ ] `getUsers` - ユーザー一覧取得
  - [ ] `suspendUser` - ユーザー停止
  - [ ] `activateUser` - ユーザー再開
  - [ ] `deleteUser` - ユーザー削除
  - [ ] `deletePost` - 投稿削除
  - [ ] `deleteEvent` - イベント削除
  - [ ] `deleteShop` - 盆栽園削除
  - [ ] `updateReportStatus` - 通報ステータス更新

### 管理者ログ
- [ ] 管理者操作のログ記録
- [ ] ログ一覧表示
- [ ] ログ検索機能

### 権限管理
- [ ] `admin` - 全機能アクセス可能
- [ ] `moderator` - 通報対応、コンテンツ削除のみ

### UI/UX
- [ ] サイドバーナビゲーション
- [ ] データテーブルのページネーション
- [ ] 検索・フィルター機能
- [ ] 確認ダイアログ（削除操作時）
- [ ] 成功/エラートースト表示

### セキュリティ
- [ ] 管理者権限チェック
- [ ] 操作ログの記録
- [ ] 管理者専用Middleware

---

## 完了条件
- [ ] 管理者のみダッシュボードにアクセスできる
- [ ] ユーザー管理が正常に動作する
- [ ] 投稿管理が正常に動作する
- [ ] 通報管理が正常に動作する
- [ ] 統計情報が正常に表示される
- [ ] 管理者操作がログに記録される

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
