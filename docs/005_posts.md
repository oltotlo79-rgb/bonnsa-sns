# 005: 投稿機能

## 概要
テキスト・画像・動画の投稿機能を実装する。
引用投稿・リポスト機能も含む。

## 優先度
**高** - Phase 2

## 依存チケット
- 001: プロジェクトセットアップ
- 002: データベーススキーマ設計
- 003: 認証システム
- 004: ユーザープロフィール

---

## Todo

### 投稿作成
- [x] `components/post/PostForm.tsx` - 投稿フォーム
  - [x] テキスト入力（最大500文字）
  - [x] 文字数カウンター
  - [x] 画像添付（最大4枚）
  - [x] 動画添付（最大1本、画像と同時不可）
  - [x] ジャンル選択（最大3つ）
  - [x] 投稿ボタン
- [x] `components/post/GenreSelector.tsx` - ジャンル選択コンポーネント

### 投稿表示
- [x] `components/post/PostCard.tsx` - 投稿カード
  - [x] ユーザー情報（アバター、ニックネーム）
  - [x] 投稿日時
  - [x] テキスト内容
  - [x] メディア表示（画像/動画）
  - [x] ジャンルタグ表示
  - [x] いいねボタン（UI）
  - [x] コメントボタン（UI）
  - [x] リポストボタン（UI）
  - [x] ブックマークボタン（UI）
  - [x] 削除ボタン（自分の投稿のみ）
- [x] `components/post/PostList.tsx` - 投稿リスト
- [x] `components/post/DeletePostButton.tsx` - 削除ボタン

### 投稿詳細ページ
- [x] `app/(main)/posts/[id]/page.tsx` - 投稿詳細ページ
- [x] `app/(main)/posts/[id]/loading.tsx` - ローディング
- [x] `app/(main)/posts/[id]/not-found.tsx` - 404

### メディア表示
- [x] `components/post/ImageGallery.tsx` - 画像ギャラリー（1〜4枚対応）
- [x] 画像クリックで拡大モーダル

### 引用投稿・リポスト
- [x] `components/post/QuotedPost.tsx` - 引用された投稿表示
- [x] リポスト機能（Server Action）

### Server Actions
- [x] `lib/actions/post.ts`
  - [x] `createPost` - 投稿作成
  - [x] `deletePost` - 投稿削除
  - [x] `getPost` - 投稿取得
  - [x] `getPosts` - 投稿一覧取得
  - [x] `createQuotePost` - 引用投稿作成
  - [x] `createRepost` - リポスト作成
  - [x] `getGenres` - ジャンル取得
  - [x] `uploadPostMedia` - メディアアップロード

### メディアアップロード
- [x] 画像形式チェック（JPEG, PNG, WebP, GIF）
- [x] 動画形式チェック（MP4, MOV）
- [x] ファイルサイズ制限
  - [x] 画像: 4MB/枚
  - [x] 動画: 256MB
- [ ] Azure Blob Storageへのアップロード実装（TODO）

### 投稿制限
- [x] 1日20件の投稿制限チェック
- [x] 制限超過時のエラーメッセージ

### ジャンル選択
- [x] ジャンルマスター取得
- [x] カテゴリ別表示
- [x] 選択済みジャンルのハイライト
- [x] 3つ以上選択時の制限

### バリデーション
- [x] テキスト必須 or メディア必須
- [x] テキスト最大500文字
- [x] 画像最大4枚
- [x] 動画最大1本
- [x] 画像と動画の同時投稿禁止
- [x] ジャンル最大3つ

### UI/UX
- [x] 投稿中のローディング表示
- [x] 投稿削除確認ダイアログ
- [x] メディアプレビュー
- [x] レスポンシブデザイン

### ハッシュタグ対応
- [x] テキスト内のハッシュタグ検出
- [x] ハッシュタグをリンク化

---

## 完了条件
- [x] テキスト投稿が正常に動作する
- [ ] 画像付き投稿が正常に動作する（TODO: Azure Blob Storage実装）
- [ ] 動画付き投稿が正常に動作する（TODO: Azure Blob Storage実装）
- [x] ジャンル選択が正常に動作する
- [x] 投稿削除が正常に動作する
- [x] 引用投稿が正常に動作する
- [x] リポストが正常に動作する
- [x] 投稿制限が正常に機能する

## Azure Blob Storage設定（TODO）
本番環境では Azure Blob Storage を使用してメディアファイルをアップロードします。
現在は仮のローカルパスを返しています。

## 参考コード
```typescript
// lib/actions/post.ts
'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createPostSchema = z.object({
  content: z.string().max(500, '投稿は500文字以内で入力してください').optional(),
  genreIds: z.array(z.string()).max(3, 'ジャンルは3つまで選択できます'),
})

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const content = formData.get('content') as string
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaType = formData.get('mediaType') as string | null

  // バリデーション
  if (!content && mediaUrls.length === 0) {
    return { error: 'テキストまたはメディアを入力してください' }
  }

  const result = createPostSchema.safeParse({ content, genreIds })
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  // 投稿制限チェック（1日20件）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  // 投稿作成
  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      content: content || null,
      media: mediaUrls.length > 0 ? {
        create: mediaUrls.map((url, index) => ({
          url,
          type: mediaType || 'image',
          sortOrder: index,
        })),
      } : undefined,
      genres: genreIds.length > 0 ? {
        create: genreIds.map((genreId) => ({
          genreId,
        })),
      } : undefined,
    },
  })

  revalidatePath('/feed')
  return { success: true, postId: post.id }
}

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 投稿の所有者確認
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true },
  })

  if (!post || post.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  await prisma.post.delete({ where: { id: postId } })

  revalidatePath('/feed')
  return { success: true }
}

export async function getPost(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: { genre: true },
      },
      _count: {
        select: { likes: true, comments: true },
      },
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!post) {
    return { error: '投稿が見つかりません' }
  }

  return {
    post: {
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg) => pg.genre),
    },
  }
}
```
