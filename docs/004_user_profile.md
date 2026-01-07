# 004: ユーザープロフィール

## 概要
ユーザープロフィールの表示・編集機能を実装する。

## 優先度
**高** - Phase 1

## 依存チケット
- 001: プロジェクトセットアップ
- 002: データベーススキーマ設計
- 003: 認証システム

---

## Todo

### プロフィールページ
- [x] `app/(main)/users/[id]/page.tsx` - ユーザープロフィールページ
- [x] `app/(main)/users/[id]/posts/page.tsx` - ユーザーの投稿一覧
- [x] `app/(main)/users/[id]/likes/page.tsx` - ユーザーのいいね一覧
- [x] `app/(main)/users/[id]/followers/page.tsx` - フォロワー一覧
- [x] `app/(main)/users/[id]/following/page.tsx` - フォロー中一覧

### 設定ページ
- [x] `app/(main)/settings/page.tsx` - 設定トップページ
- [x] `app/(main)/settings/profile/page.tsx` - プロフィール編集
- [x] `app/(main)/settings/account/page.tsx` - アカウント設定

### プロフィールコンポーネント
- [x] `components/user/ProfileHeader.tsx` - プロフィールヘッダー
  - [x] ヘッダー画像表示
  - [x] アバター画像表示
  - [x] ニックネーム表示
  - [x] 自己紹介表示
  - [x] 居住地域表示
  - [x] フォロー数/フォロワー数表示
  - [x] フォローボタン（他ユーザーの場合）
  - [x] 編集ボタン（自分の場合）
- [x] `components/user/ProfileEditForm.tsx` - プロフィール編集フォーム
- [x] `components/user/AvatarUploader.tsx` - アバター画像アップロード
- [x] `components/user/HeaderUploader.tsx` - ヘッダー画像アップロード
- [x] `components/user/UserCard.tsx` - ユーザーカード（一覧表示用）
- [x] `components/user/UserList.tsx` - ユーザー一覧

### Server Actions
- [x] `lib/actions/user.ts`
  - [x] `getUser` - ユーザー情報取得
  - [x] `updateProfile` - プロフィール更新
  - [x] `uploadAvatar` - アバター画像アップロード
  - [x] `uploadHeader` - ヘッダー画像アップロード
  - [x] `deleteAccount` - アカウント削除

### プロフィール編集項目
- [x] ニックネーム（必須、最大50文字）
- [x] 居住地域（任意）
- [x] 自己紹介（任意、最大200文字）
- [x] プロフィール画像（任意）
- [x] ヘッダー画像（任意）

### アカウント設定
- [x] 公開/非公開設定
- [x] アカウント削除機能
  - [x] 確認ダイアログ
  - [x] 関連データの削除（投稿、コメント等）

### 画像アップロード
- [x] Supabase Storageバケット作成（avatars, headers）※要手動設定
- [x] 許可ファイル形式チェック（JPEG, PNG, WebP）
- [x] ファイルサイズ制限（5MB）

### バリデーション
- [x] ニックネーム必須チェック
- [x] 文字数制限チェック
- [x] 画像形式・サイズチェック

### UI/UX
- [x] プロフィール編集ページ
- [x] 画像プレビュー機能
- [x] 保存中のローディング表示
- [x] 成功/エラーメッセージ表示
- [x] レスポンシブデザイン

### データ取得
- [x] ユーザー情報取得（投稿数、フォロー数含む）
- [x] 自分かどうかの判定
- [x] フォロー状態の取得

---

## 完了条件
- [x] プロフィールページが正常に表示される
- [x] プロフィール編集が正常に動作する
- [x] 画像アップロードが正常に動作する
- [x] 公開/非公開設定が正常に動作する
- [x] アカウント削除が正常に動作する

## Supabase Storage設定（要手動設定）
Supabaseダッシュボードで以下のバケットを作成してください：

1. `avatars` - プロフィール画像用
2. `headers` - ヘッダー画像用

各バケットの設定：
- Public bucket: ON
- Allowed MIME types: image/jpeg, image/png, image/webp
- File size limit: 5MB

## 参考コード
```typescript
// lib/actions/user.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const nickname = formData.get('nickname') as string
  const bio = formData.get('bio') as string
  const location = formData.get('location') as string

  const { error } = await supabase
    .from('users')
    .update({
      nickname,
      bio,
      location,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: 'プロフィールの更新に失敗しました' }
  }

  revalidatePath(`/users/${user.id}`)
  return { success: true }
}
```
