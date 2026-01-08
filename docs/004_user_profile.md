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
  - [x] `getCurrentUser` - 現在のユーザー取得
  - [x] `updateProfile` - プロフィール更新
  - [x] `updatePrivacy` - 公開/非公開設定
  - [x] `uploadAvatar` - アバター画像アップロード
  - [x] `uploadHeader` - ヘッダー画像アップロード
  - [x] `deleteAccount` - アカウント削除
  - [x] `getFollowers` - フォロワー一覧
  - [x] `getFollowing` - フォロー中一覧

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
  - [x] 関連データの削除（Prismaカスケード削除）

### 画像アップロード
- [x] 許可ファイル形式チェック（JPEG, PNG, WebP）
- [x] ファイルサイズ制限（5MB）
- [ ] Azure Blob Storageへのアップロード実装（TODO）

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
- [ ] 画像アップロードが正常に動作する（TODO: Azure Blob Storage実装）
- [x] 公開/非公開設定が正常に動作する
- [x] アカウント削除が正常に動作する

## Azure Blob Storage設定（TODO）
本番環境では Azure Blob Storage を使用してファイルをアップロードします。
現在は仮のローカルパスを返しています。

## 参考コード
```typescript
// lib/actions/user.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const profileSchema = z.object({
  nickname: z.string().min(1, 'ニックネームは必須です').max(50),
  bio: z.string().max(200).optional(),
  location: z.string().max(100).optional(),
})

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  return {
    user: {
      ...user,
      postsCount: user._count.posts,
      followersCount: user._count.followers,
      followingCount: user._count.following,
    },
  }
}

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const result = profileSchema.safeParse({
    nickname: formData.get('nickname'),
    bio: formData.get('bio') || '',
    location: formData.get('location') || '',
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      nickname: result.data.nickname,
      bio: result.data.bio || null,
      location: result.data.location || null,
    },
  })

  revalidatePath(`/users/${session.user.id}`)
  revalidatePath('/settings/profile')
  return { success: true }
}

export async function deleteAccount() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // Prismaのカスケード削除により関連データも削除される
  await prisma.user.delete({
    where: { id: session.user.id },
  })

  return { success: true }
}
```
