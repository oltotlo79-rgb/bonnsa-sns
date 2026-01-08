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
  - [x] `getCommentCount` - コメント数取得

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

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// コメント作成
export async function createComment(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const postId = formData.get('postId') as string
  const parentId = formData.get('parentId') as string | null
  const content = formData.get('content') as string

  // バリデーション
  if (!content || content.trim().length === 0) {
    return { error: 'コメント内容を入力してください' }
  }

  if (content.length > 500) {
    return { error: 'コメントは500文字以内で入力してください' }
  }

  // コメント制限チェック（1日100件）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.comment.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 100) {
    return { error: '1日のコメント上限（100件）に達しました' }
  }

  // コメント作成
  const comment = await prisma.comment.create({
    data: {
      postId,
      userId: session.user.id,
      parentId: parentId || null,
      content: content.trim(),
    },
  })

  // 通知作成
  if (parentId) {
    // 返信の場合：親コメントの投稿者へ通知
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { userId: true },
    })

    if (parentComment && parentComment.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: parentComment.userId,
          actorId: session.user.id,
          type: 'reply',
          postId,
          commentId: comment.id,
        },
      })
    }
  } else {
    // 通常コメントの場合：投稿者へ通知
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (post && post.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          actorId: session.user.id,
          type: 'comment',
          postId,
          commentId: comment.id,
        },
      })
    }
  }

  revalidatePath(`/posts/${postId}`)
  return { success: true, comment }
}

// コメント削除
export async function deleteComment(commentId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // コメント取得して所有者確認
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, postId: true },
  })

  if (!comment) {
    return { error: 'コメントが見つかりません' }
  }

  if (comment.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  // 子コメント（返信）も含めて削除（Prismaのカスケード削除で自動的に処理）
  await prisma.comment.delete({
    where: { id: commentId },
  })

  revalidatePath(`/posts/${comment.postId}`)
  return { success: true }
}

// 投稿のコメント取得
export async function getComments(postId: string, cursor?: string, limit = 20) {
  const comments = await prisma.comment.findMany({
    where: {
      postId,
      parentId: null, // 親コメントのみ
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      _count: {
        select: { likes: true, replies: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const hasMore = comments.length === limit

  return {
    comments: comments.map((comment) => ({
      ...comment,
      likeCount: comment._count.likes,
      replyCount: comment._count.replies,
    })),
    nextCursor: hasMore ? comments[comments.length - 1]?.id : undefined,
  }
}

// コメントへの返信取得
export async function getReplies(commentId: string, cursor?: string, limit = 10) {
  const replies = await prisma.comment.findMany({
    where: { parentId: commentId },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      _count: {
        select: { likes: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const hasMore = replies.length === limit

  return {
    replies: replies.map((reply) => ({
      ...reply,
      likeCount: reply._count.likes,
    })),
    nextCursor: hasMore ? replies[replies.length - 1]?.id : undefined,
  }
}
```
