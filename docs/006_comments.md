# 006: コメント機能

## 概要
投稿へのコメント・返信機能を実装する。
スレッド形式で返信を表示する。

## 優先度
**高** - Phase 2

## 依存チケット
- 005: 投稿機能

---

## Todo

### コメントコンポーネント
- [x] `components/comment/CommentForm.tsx` - コメント入力フォーム
  - [x] テキスト入力
  - [x] 文字数カウンター
  - [x] 送信ボタン
- [x] `components/comment/CommentCard.tsx` - コメントカード
  - [x] ユーザー情報
  - [x] コメント内容
  - [x] 投稿日時
  - [x] いいねボタン
  - [x] 返信ボタン
  - [x] 削除ボタン（自分のコメントのみ）
- [x] `components/comment/CommentList.tsx` - コメント一覧
- [x] `components/comment/CommentThread.tsx` - スレッド表示
- [x] `components/comment/ReplyForm.tsx` - 返信フォーム

### スレッド表示
- [x] 親コメント表示
- [x] 子コメント（返信）のインデント表示
- [x] 返信の展開/折りたたみ
- [x] 「返信を表示」リンク

### Server Actions
- [x] `lib/actions/comment.ts`
  - [x] `createComment` - コメント作成
  - [x] `deleteComment` - コメント削除
  - [x] `getComments` - 投稿のコメント取得
  - [x] `getReplies` - コメントへの返信取得

### コメント制限
- [x] 1日100件のコメント制限チェック
- [x] 制限超過時のエラーメッセージ

### バリデーション
- [x] テキスト必須
- [x] テキスト最大500文字

### 通知連携
- [x] コメント作成時に投稿者へ通知
- [x] 返信作成時にコメント投稿者へ通知

### UI/UX
- [x] コメント送信中のローディング
- [x] 送信成功時のフィードバック
- [x] コメント削除確認ダイアログ
- [x] Optimistic UI（即座に表示）
- [x] 無限スクロールでの追加読み込み

### データ取得
- [x] コメント数の取得
- [x] 最新コメントの取得
- [x] ページネーション対応

---

## 完了条件
- [x] コメント投稿が正常に動作する
- [x] 返信投稿が正常に動作する
- [x] スレッド形式で表示される
- [x] コメント削除が正常に動作する
- [x] コメント制限が正常に機能する
- [x] 通知が正常に作成される

## 参考コード
```typescript
// lib/actions/comment.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createComment(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const postId = formData.get('postId') as string
  const parentId = formData.get('parentId') as string | null
  const content = formData.get('content') as string

  // コメント制限チェック
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', `${today}T00:00:00`)

  if (count && count >= 100) {
    return { error: '1日のコメント上限（100件）に達しました' }
  }

  // コメント作成
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: user.id,
      parent_id: parentId || null,
      content,
    })
    .select()
    .single()

  if (error) {
    return { error: 'コメントに失敗しました' }
  }

  // 通知作成（投稿者へ）
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single()

  if (post && post.user_id !== user.id) {
    await supabase.from('notifications').insert({
      user_id: post.user_id,
      actor_id: user.id,
      type: parentId ? 'reply' : 'comment',
      post_id: postId,
      comment_id: comment.id,
    })
  }

  revalidatePath(`/posts/${postId}`)
  return { success: true }
}
```
