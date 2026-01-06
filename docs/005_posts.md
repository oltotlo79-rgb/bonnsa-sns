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
- [ ] `components/post/PostForm.tsx` - 投稿フォーム
  - [ ] テキスト入力（最大500文字）
  - [ ] 文字数カウンター
  - [ ] 画像添付（最大4枚）
  - [ ] 動画添付（最大1本、画像と同時不可）
  - [ ] ジャンル選択（最大3つ）
  - [ ] 投稿ボタン
- [ ] `components/post/MediaUploader.tsx` - メディアアップローダー
- [ ] `components/post/GenreSelector.tsx` - ジャンル選択コンポーネント
- [ ] `components/post/MediaPreview.tsx` - メディアプレビュー

### 投稿表示
- [ ] `components/post/PostCard.tsx` - 投稿カード
  - [ ] ユーザー情報（アバター、ニックネーム）
  - [ ] 投稿日時
  - [ ] テキスト内容
  - [ ] メディア表示（画像/動画）
  - [ ] ジャンルタグ表示
  - [ ] いいねボタン
  - [ ] コメントボタン
  - [ ] リポストボタン
  - [ ] ブックマークボタン
  - [ ] 削除ボタン（自分の投稿のみ）
- [ ] `components/post/PostList.tsx` - 投稿リスト
- [ ] `components/post/PostDetail.tsx` - 投稿詳細

### 投稿詳細ページ
- [ ] `app/(main)/posts/[id]/page.tsx` - 投稿詳細ページ
- [ ] `app/(main)/posts/[id]/loading.tsx` - ローディング
- [ ] `app/(main)/posts/[id]/not-found.tsx` - 404

### メディア表示
- [ ] `components/post/ImageGallery.tsx` - 画像ギャラリー（1〜4枚対応）
- [ ] `components/post/VideoPlayer.tsx` - 動画プレイヤー
- [ ] 画像クリックで拡大モーダル

### 引用投稿・リポスト
- [ ] `components/post/QuotePostForm.tsx` - 引用投稿フォーム
- [ ] `components/post/QuotedPost.tsx` - 引用された投稿表示
- [ ] リポスト機能（コメントなしで共有）

### Server Actions
- [ ] `lib/actions/post.ts`
  - [ ] `createPost` - 投稿作成
  - [ ] `deletePost` - 投稿削除
  - [ ] `getPost` - 投稿取得
  - [ ] `getPosts` - 投稿一覧取得
  - [ ] `getUserPosts` - ユーザーの投稿取得
  - [ ] `createQuotePost` - 引用投稿作成
  - [ ] `createRepost` - リポスト作成

### メディアアップロード
- [ ] Supabase Storageバケット作成（post-images, post-videos）
- [ ] 画像圧縮・リサイズ処理
- [ ] 動画形式チェック（MP4, MOV）
- [ ] ファイルサイズ制限
  - [ ] 画像: 5MB/枚
  - [ ] 動画: 512MB（X準拠）

### 投稿制限
- [ ] 1日20件の投稿制限チェック
- [ ] 制限超過時のエラーメッセージ

### ジャンル選択
- [ ] ジャンルマスター取得
- [ ] カテゴリ別表示
- [ ] 選択済みジャンルのハイライト
- [ ] 3つ以上選択時の制限

### バリデーション
- [ ] テキスト必須 or メディア必須
- [ ] テキスト最大500文字
- [ ] 画像最大4枚
- [ ] 動画最大1本
- [ ] 画像と動画の同時投稿禁止
- [ ] ジャンル最大3つ

### UI/UX
- [ ] 投稿中のローディング表示
- [ ] 投稿成功時のフィードバック
- [ ] 投稿削除確認ダイアログ
- [ ] ドラッグ&ドロップでの画像添付
- [ ] 画像の並び替え機能
- [ ] レスポンシブデザイン

### ハッシュタグ対応
- [ ] テキスト内のハッシュタグ検出
- [ ] ハッシュタグをリンク化
- [ ] ハッシュタグクリックで検索

---

## 完了条件
- [ ] テキスト投稿が正常に動作する
- [ ] 画像付き投稿が正常に動作する
- [ ] 動画付き投稿が正常に動作する
- [ ] ジャンル選択が正常に動作する
- [ ] 投稿削除が正常に動作する
- [ ] 引用投稿が正常に動作する
- [ ] リポストが正常に動作する
- [ ] 投稿制限が正常に機能する

## 参考コード
```typescript
// lib/actions/post.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createPostSchema = z.object({
  content: z.string().min(1).max(500),
  genreIds: z.array(z.string()).max(3),
})

export async function createPost(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // 投稿制限チェック
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', `${today}T00:00:00`)

  if (count && count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  // 投稿作成
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      content: formData.get('content') as string,
    })
    .select()
    .single()

  if (error) {
    return { error: '投稿に失敗しました' }
  }

  // ジャンル紐付け
  const genreIds = formData.getAll('genreIds') as string[]
  if (genreIds.length > 0) {
    await supabase
      .from('post_genres')
      .insert(genreIds.map(genreId => ({
        post_id: post.id,
        genre_id: genreId,
      })))
  }

  revalidatePath('/feed')
  return { success: true, postId: post.id }
}
```
