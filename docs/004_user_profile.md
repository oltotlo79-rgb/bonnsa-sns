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
- [ ] `app/(main)/users/[id]/page.tsx` - ユーザープロフィールページ
- [ ] `app/(main)/users/[id]/posts/page.tsx` - ユーザーの投稿一覧
- [ ] `app/(main)/users/[id]/likes/page.tsx` - ユーザーのいいね一覧
- [ ] `app/(main)/users/[id]/followers/page.tsx` - フォロワー一覧
- [ ] `app/(main)/users/[id]/following/page.tsx` - フォロー中一覧

### 設定ページ
- [ ] `app/(main)/settings/page.tsx` - 設定トップページ
- [ ] `app/(main)/settings/profile/page.tsx` - プロフィール編集
- [ ] `app/(main)/settings/account/page.tsx` - アカウント設定

### プロフィールコンポーネント
- [ ] `components/user/ProfileHeader.tsx` - プロフィールヘッダー
  - [ ] ヘッダー画像表示
  - [ ] アバター画像表示
  - [ ] ニックネーム表示
  - [ ] 自己紹介表示
  - [ ] 居住地域表示
  - [ ] フォロー数/フォロワー数表示
  - [ ] フォローボタン（他ユーザーの場合）
  - [ ] 編集ボタン（自分の場合）
- [ ] `components/user/ProfileEditForm.tsx` - プロフィール編集フォーム
- [ ] `components/user/AvatarUploader.tsx` - アバター画像アップロード
- [ ] `components/user/HeaderUploader.tsx` - ヘッダー画像アップロード
- [ ] `components/user/UserCard.tsx` - ユーザーカード（一覧表示用）
- [ ] `components/user/UserList.tsx` - ユーザー一覧

### Server Actions
- [ ] `lib/actions/user.ts`
  - [ ] `getUser` - ユーザー情報取得
  - [ ] `updateProfile` - プロフィール更新
  - [ ] `uploadAvatar` - アバター画像アップロード
  - [ ] `uploadHeader` - ヘッダー画像アップロード
  - [ ] `deleteAccount` - アカウント削除

### プロフィール編集項目
- [ ] ニックネーム（必須、最大50文字）
- [ ] 居住地域（任意）
- [ ] 自己紹介（任意、最大200文字）
- [ ] プロフィール画像（任意）
- [ ] ヘッダー画像（任意）

### アカウント設定
- [ ] 公開/非公開設定
- [ ] アカウント削除機能
  - [ ] 確認ダイアログ
  - [ ] 関連データの削除（投稿、コメント等）

### 画像アップロード
- [ ] Supabase Storageバケット作成（avatars, headers）
- [ ] 画像リサイズ処理
- [ ] 許可ファイル形式チェック（JPEG, PNG, WebP）
- [ ] ファイルサイズ制限（5MB）

### バリデーション
- [ ] ニックネーム必須チェック
- [ ] 文字数制限チェック
- [ ] 画像形式・サイズチェック

### UI/UX
- [ ] プロフィール編集モーダル or ページ
- [ ] 画像プレビュー機能
- [ ] 保存中のローディング表示
- [ ] 成功/エラートースト表示
- [ ] レスポンシブデザイン

### データ取得
- [ ] ユーザー情報取得（投稿数、フォロー数含む）
- [ ] 自分かどうかの判定
- [ ] フォロー状態の取得

---

## 完了条件
- [ ] プロフィールページが正常に表示される
- [ ] プロフィール編集が正常に動作する
- [ ] 画像アップロードが正常に動作する
- [ ] 公開/非公開設定が正常に動作する
- [ ] アカウント削除が正常に動作する

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
