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
- [ ] Service Roleキー使用（RLSバイパス）

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
import { createClient } from '@/lib/supabase/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // ... 既存の認証処理 ...

  // 管理者ページへのアクセスチェック
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // 管理者権限チェック
    const supabase = createAdminClient()
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!adminUser) {
      return NextResponse.redirect(new URL('/feed', request.url))
    }
  }

  return supabaseResponse
}
```

```typescript
// lib/actions/admin.ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function checkAdminPermission() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('認証が必要です')
  }

  const adminSupabase = createAdminClient()
  const { data: adminUser } = await adminSupabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!adminUser) {
    throw new Error('管理者権限が必要です')
  }

  return { user, role: adminUser.role }
}

export async function getAdminStats() {
  await checkAdminPermission()

  const supabase = createAdminClient()

  const today = new Date().toISOString().split('T')[0]

  const [
    { count: totalUsers },
    { count: todayUsers },
    { count: totalPosts },
    { count: todayPosts },
    { count: pendingReports },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`),
    supabase.from('reports').select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  return {
    totalUsers: totalUsers ?? 0,
    todayUsers: todayUsers ?? 0,
    totalPosts: totalPosts ?? 0,
    todayPosts: todayPosts ?? 0,
    pendingReports: pendingReports ?? 0,
  }
}

export async function suspendUser(userId: string, reason: string) {
  const { user: adminUser } = await checkAdminPermission()

  const supabase = createAdminClient()

  // ユーザー停止
  await supabase
    .from('users')
    .update({ is_suspended: true, suspended_at: new Date().toISOString() })
    .eq('id', userId)

  // 管理者ログ記録
  await supabase.from('admin_logs').insert({
    admin_id: adminUser.id,
    action: 'suspend_user',
    target_type: 'user',
    target_id: userId,
    details: { reason },
  })

  return { success: true }
}

export async function deletePost(postId: string, reason: string) {
  const { user: adminUser } = await checkAdminPermission()

  const supabase = createAdminClient()

  // 投稿削除
  await supabase.from('posts').delete().eq('id', postId)

  // 管理者ログ記録
  await supabase.from('admin_logs').insert({
    admin_id: adminUser.id,
    action: 'delete_post',
    target_type: 'post',
    target_id: postId,
    details: { reason },
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
