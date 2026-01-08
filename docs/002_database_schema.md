# 002: データベーススキーマ設計

## 概要
Prisma ORMを使用してPostgreSQLのテーブル設計とスキーマを定義する。
開発環境ではローカルPostgreSQL、本番環境ではAzure Database for PostgreSQLを使用。

## 優先度
**最高** - Phase 1

## 依存チケット
- 001: プロジェクトセットアップ

---

## Todo

### Prismaセットアップ
- [x] `prisma` パッケージインストール
- [x] `@prisma/client` インストール
- [x] `prisma/schema.prisma` 作成
- [x] `lib/db.ts` Prismaクライアントシングルトン作成

### ユーザー関連テーブル
- [x] `User` モデル作成
  - [x] id (String, cuid())
  - [x] email (String, @unique)
  - [x] emailVerified (DateTime?)
  - [x] password (String?, bcryptハッシュ)
  - [x] nickname (String)
  - [x] avatarUrl (String?)
  - [x] headerUrl (String?)
  - [x] bio (String?)
  - [x] location (String?)
  - [x] isPublic (Boolean, @default(true))
  - [x] createdAt (DateTime)
  - [x] updatedAt (DateTime)

### NextAuth.js関連テーブル
- [x] `Account` モデル作成（OAuth用）
- [x] `Session` モデル作成（JWTのため実質不使用）
- [x] `VerificationToken` モデル作成

### 投稿関連テーブル
- [x] `Post` モデル作成
  - [x] id (String, cuid())
  - [x] userId (String, @relation User)
  - [x] content (String?, MAX 500文字)
  - [x] quotePostId (String?, 引用投稿)
  - [x] repostPostId (String?, リポスト)
  - [x] createdAt (DateTime)
  - [x] updatedAt (DateTime)
- [x] `PostMedia` モデル作成
  - [x] id (String, cuid())
  - [x] postId (String, @relation Post)
  - [x] url (String)
  - [x] type (String, 'image' or 'video')
  - [x] sortOrder (Int)
- [x] `Genre` モデル作成（マスターデータ）
  - [x] id (String, cuid())
  - [x] name (String)
  - [x] category (String)
  - [x] sortOrder (Int)
- [x] `PostGenre` モデル作成（中間テーブル）
  - [x] postId (String)
  - [x] genreId (String)

### インタラクション関連テーブル
- [x] `Comment` モデル作成
  - [x] id (String, cuid())
  - [x] postId (String, @relation Post)
  - [x] userId (String, @relation User)
  - [x] parentId (String?, 返信先コメント)
  - [x] content (String)
  - [x] createdAt (DateTime)
- [x] `Like` モデル作成
  - [x] id (String, cuid())
  - [x] userId (String, @relation User)
  - [x] postId (String?)
  - [x] commentId (String?)
  - [x] createdAt (DateTime)
  - [x] @@unique([userId, postId])
  - [x] @@unique([userId, commentId])
- [x] `Bookmark` モデル作成
  - [x] id (String, cuid())
  - [x] userId (String, @relation User)
  - [x] postId (String, @relation Post)
  - [x] createdAt (DateTime)

### フォロー・ブロック関連テーブル
- [x] `Follow` モデル作成
  - [x] followerId (String, フォローする人)
  - [x] followingId (String, フォローされる人)
  - [x] createdAt (DateTime)
  - [x] @@id([followerId, followingId])
- [x] `Block` モデル作成
  - [x] blockerId (String, ブロックする人)
  - [x] blockedId (String, ブロックされる人)
  - [x] createdAt (DateTime)
- [x] `Mute` モデル作成
  - [x] muterId (String, ミュートする人)
  - [x] mutedId (String, ミュートされる人)
  - [x] createdAt (DateTime)

### 通知テーブル
- [x] `Notification` モデル作成
  - [x] id (String, cuid())
  - [x] userId (String, 通知先ユーザー)
  - [x] actorId (String, アクションを起こしたユーザー)
  - [x] type (String, 'like', 'comment', 'follow', 'quote', 'reply')
  - [x] postId (String?)
  - [x] commentId (String?)
  - [x] isRead (Boolean, @default(false))
  - [x] createdAt (DateTime)

### 盆栽園関連テーブル
- [x] `BonsaiShop` モデル作成
  - [x] id (String, cuid())
  - [x] name (String)
  - [x] address (String)
  - [x] latitude (Decimal)
  - [x] longitude (Decimal)
  - [x] phone (String?)
  - [x] website (String?)
  - [x] businessHours (String?)
  - [x] closedDays (String?)
  - [x] createdById (String, @relation User)
  - [x] createdAt (DateTime)
  - [x] updatedAt (DateTime)
- [x] `ShopGenre` モデル作成（取り扱いジャンル）
- [x] `ShopReview` モデル作成
- [x] `ShopReviewImage` モデル作成

### イベント関連テーブル
- [x] `Event` モデル作成
  - [x] id (String, cuid())
  - [x] title (String)
  - [x] description (String?)
  - [x] startDate (DateTime)
  - [x] endDate (DateTime?)
  - [x] prefecture (String)
  - [x] city (String?)
  - [x] venue (String?)
  - [x] organizer (String?)
  - [x] admissionFee (String?)
  - [x] hasSales (Boolean)
  - [x] externalUrl (String?)
  - [x] createdById (String, @relation User)
  - [x] createdAt (DateTime)

### 通報関連テーブル
- [x] `Report` モデル作成
  - [x] id (String, cuid())
  - [x] reporterId (String, @relation User)
  - [x] targetType (String, 'post', 'comment', 'event', 'shop', 'user')
  - [x] targetId (String)
  - [x] reason (String)
  - [x] description (String?)
  - [x] status (String, @default('pending'))
  - [x] createdAt (DateTime)

### 管理者関連テーブル
- [x] `AdminUser` モデル作成
  - [x] userId (String, @id, @relation User)
  - [x] role (String, 'admin', 'moderator')
  - [x] createdAt (DateTime)
- [x] `AdminLog` モデル作成

### インデックス作成
- [x] Post.userId インデックス（@@index）
- [x] Post.createdAt インデックス
- [x] Comment.postId インデックス
- [x] Like.postId インデックス
- [x] Follow.followerId インデックス
- [x] Follow.followingId インデックス
- [x] Notification.userId インデックス
- [x] Event.startDate インデックス
- [x] Event.prefecture インデックス

### データアクセスパターン
- [x] リレーション取得（include）
- [x] 集計クエリ（_count）
- [x] カーソルベースページネーション
- [x] トランザクション

### ジャンルマスターデータ投入
- [x] 松柏類（黒松、赤松、五葉松、真柏、杜松等）
- [x] 雑木類（紅葉、楓、銀杏、梅、長寿梅等）
- [x] 用品・道具（道具、薬剤、鉢、その他盆栽用品）
- [x] 施設・イベント（盆栽園、展示会・イベント）
- [x] その他（草もの）

### Prismaクライアント生成
- [x] `npx prisma generate` 実行
- [x] 型の自動生成確認

---

## 完了条件
- [x] Prismaスキーマが作成されている
- [x] すべてのモデルが定義されている
- [x] インデックスが適切に設定されている
- [x] マスターデータが投入されている
- [x] Prismaクライアントが生成されている

## メモ

### Prismaクエリ例
```typescript
// リレーション付きで取得
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    user: { select: { id: true, nickname: true, avatarUrl: true } },
    media: { orderBy: { sortOrder: 'asc' } },
    _count: { select: { likes: true, comments: true } },
  },
})

// カーソルベースページネーション
const posts = await prisma.post.findMany({
  take: 20,
  ...(cursor && {
    cursor: { id: cursor },
    skip: 1,
  }),
  orderBy: { createdAt: 'desc' },
})

// トランザクション
await prisma.$transaction([
  prisma.like.create({ data: { postId, userId } }),
  prisma.notification.create({ data: { ... } }),
])
```

### 開発コマンド
```bash
# スキーマをDBに反映（開発用）
npx prisma db push

# マイグレーション作成
npx prisma migrate dev --name init

# Prismaクライアント再生成
npx prisma generate

# DB管理GUI
npx prisma studio
```

### アクセス制御について
Server Actions内で認証チェックとアクセス制御を行う：
```typescript
export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 所有者チェック
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true },
  })

  if (post?.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  await prisma.post.delete({ where: { id: postId } })
  return { success: true }
}
```
