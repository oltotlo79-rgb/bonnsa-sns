# 002: データベーススキーマ設計

## 概要
Supabase PostgreSQLのテーブル設計とRow Level Security (RLS) ポリシーを設定する。

## 優先度
**最高** - Phase 1

## 依存チケット
- 001: プロジェクトセットアップ

---

## Todo

### ユーザー関連テーブル
- [x] `users` テーブル作成
  - [x] id (UUID, auth.usersと連携)
  - [x] email (TEXT, UNIQUE)
  - [x] nickname (TEXT, NOT NULL)
  - [x] avatar_url (TEXT)
  - [x] header_url (TEXT)
  - [x] bio (TEXT, 自己紹介)
  - [x] location (TEXT, 居住地域)
  - [x] is_public (BOOLEAN, DEFAULT true)
  - [x] created_at (TIMESTAMPTZ)
  - [x] updated_at (TIMESTAMPTZ)

### 投稿関連テーブル
- [x] `posts` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] user_id (UUID, REFERENCES users)
  - [x] content (TEXT, MAX 500文字)
  - [x] quote_post_id (UUID, 引用投稿)
  - [x] repost_post_id (UUID, リポスト)
  - [x] created_at (TIMESTAMPTZ)
- [x] `post_media` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] post_id (UUID, REFERENCES posts)
  - [x] url (TEXT, NOT NULL)
  - [x] type (TEXT, 'image' or 'video')
  - [x] order (INTEGER)
- [x] `genres` テーブル作成（マスターデータ）
  - [x] id (UUID, PRIMARY KEY)
  - [x] name (TEXT, NOT NULL)
  - [x] category (TEXT, カテゴリ分類)
  - [x] order (INTEGER, 表示順)
- [x] `post_genres` テーブル作成（中間テーブル）
  - [x] post_id (UUID, REFERENCES posts)
  - [x] genre_id (UUID, REFERENCES genres)

### インタラクション関連テーブル
- [x] `comments` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] post_id (UUID, REFERENCES posts)
  - [x] user_id (UUID, REFERENCES users)
  - [x] parent_id (UUID, 返信先コメント)
  - [x] content (TEXT, NOT NULL)
  - [x] created_at (TIMESTAMPTZ)
- [x] `likes` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] user_id (UUID, REFERENCES users)
  - [x] post_id (UUID, NULLABLE)
  - [x] comment_id (UUID, NULLABLE)
  - [x] created_at (TIMESTAMPTZ)
  - [x] UNIQUE(user_id, post_id) / UNIQUE(user_id, comment_id)
- [x] `bookmarks` テーブル作成
  - [x] user_id (UUID, REFERENCES users)
  - [x] post_id (UUID, REFERENCES posts)
  - [x] created_at (TIMESTAMPTZ)

### フォロー・ブロック関連テーブル
- [x] `follows` テーブル作成
  - [x] follower_id (UUID, フォローする人)
  - [x] following_id (UUID, フォローされる人)
  - [x] created_at (TIMESTAMPTZ)
- [x] `blocks` テーブル作成
  - [x] blocker_id (UUID, ブロックする人)
  - [x] blocked_id (UUID, ブロックされる人)
  - [x] created_at (TIMESTAMPTZ)
- [x] `mutes` テーブル作成
  - [x] muter_id (UUID, ミュートする人)
  - [x] muted_id (UUID, ミュートされる人)
  - [x] created_at (TIMESTAMPTZ)

### 通知テーブル
- [x] `notifications` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] user_id (UUID, 通知先ユーザー)
  - [x] actor_id (UUID, アクションを起こしたユーザー)
  - [x] type (TEXT, 'like', 'comment', 'follow', 'quote', 'reply')
  - [x] post_id (UUID, NULLABLE)
  - [x] comment_id (UUID, NULLABLE)
  - [x] is_read (BOOLEAN, DEFAULT false)
  - [x] created_at (TIMESTAMPTZ)

### 盆栽園関連テーブル
- [x] `bonsai_shops` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] name (TEXT, NOT NULL)
  - [x] address (TEXT, NOT NULL)
  - [x] latitude (DECIMAL)
  - [x] longitude (DECIMAL)
  - [x] phone (TEXT)
  - [x] website (TEXT)
  - [x] business_hours (TEXT)
  - [x] closed_days (TEXT)
  - [x] created_by (UUID, REFERENCES users)
  - [x] created_at (TIMESTAMPTZ)
  - [x] updated_at (TIMESTAMPTZ)
- [x] `shop_genres` テーブル作成（取り扱いジャンル）
  - [x] shop_id (UUID, REFERENCES bonsai_shops)
  - [x] genre (TEXT, '道具', '鉢', 'ミニ盆栽'等)
- [x] `shop_reviews` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] shop_id (UUID, REFERENCES bonsai_shops)
  - [x] user_id (UUID, REFERENCES users)
  - [x] rating (INTEGER, 1-5)
  - [x] content (TEXT)
  - [x] created_at (TIMESTAMPTZ)
- [x] `shop_review_images` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] review_id (UUID, REFERENCES shop_reviews)
  - [x] url (TEXT, NOT NULL)

### イベント関連テーブル
- [x] `events` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] title (TEXT, NOT NULL)
  - [x] description (TEXT)
  - [x] start_date (DATE, NOT NULL)
  - [x] end_date (DATE)
  - [x] prefecture (TEXT, 都道府県)
  - [x] city (TEXT, 市区町村)
  - [x] venue (TEXT, 会場名)
  - [x] organizer (TEXT, 主催者)
  - [x] admission_fee (TEXT, 入場料)
  - [x] has_sales (BOOLEAN, 即売の有無)
  - [x] external_url (TEXT)
  - [x] created_by (UUID, REFERENCES users)
  - [x] created_at (TIMESTAMPTZ)

### 通報関連テーブル
- [x] `reports` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] reporter_id (UUID, REFERENCES users)
  - [x] target_type (TEXT, 'post', 'comment', 'event', 'shop', 'user')
  - [x] target_id (UUID)
  - [x] reason (TEXT, 'spam', 'inappropriate', 'harassment', 'copyright', 'other')
  - [x] description (TEXT)
  - [x] status (TEXT, 'pending', 'reviewed', 'resolved')
  - [x] created_at (TIMESTAMPTZ)

### 管理者関連テーブル
- [x] `admin_users` テーブル作成
  - [x] user_id (UUID, PRIMARY KEY, REFERENCES users)
  - [x] role (TEXT, 'admin', 'moderator')
  - [x] created_at (TIMESTAMPTZ)
- [x] `admin_logs` テーブル作成
  - [x] id (UUID, PRIMARY KEY)
  - [x] admin_id (UUID, REFERENCES admin_users)
  - [x] action (TEXT)
  - [x] target_type (TEXT)
  - [x] target_id (UUID)
  - [x] details (JSONB)
  - [x] created_at (TIMESTAMPTZ)

### インデックス作成
- [x] posts.user_id インデックス
- [x] posts.created_at インデックス
- [x] comments.post_id インデックス
- [x] likes.post_id インデックス
- [x] follows.follower_id インデックス
- [x] follows.following_id インデックス
- [x] notifications.user_id インデックス
- [x] bonsai_shops 位置情報インデックス
- [x] events.start_date インデックス
- [x] events.prefecture インデックス

### Row Level Security (RLS)
- [x] 全テーブルでRLS有効化
- [x] users: 自分のプロフィールのみ編集可能
- [x] posts: 公開ユーザーの投稿は誰でも閲覧可能
- [x] posts: 非公開ユーザーの投稿はフォロワーのみ
- [x] posts: 削除は本人のみ
- [x] comments: 投稿閲覧可能なユーザーはコメントも閲覧可能
- [x] likes/bookmarks: 自分のデータのみ操作可能
- [x] follows: 自分のフォロー関係のみ操作可能
- [x] blocks/mutes: 自分のデータのみ操作可能
- [x] notifications: 自分への通知のみ閲覧可能
- [x] bonsai_shops: 誰でも閲覧可能、編集は作成者のみ
- [x] shop_reviews: 誰でも閲覧可能、削除は本人のみ
- [x] events: 誰でも閲覧可能、削除は作成者のみ
- [x] reports: 自分の通報のみ閲覧可能

### ジャンルマスターデータ投入
- [x] 松柏類（黒松、赤松、五葉松、真柏、杜松等）
- [x] 雑木類（紅葉、楓、銀杏、梅、長寿梅等）
- [x] 用品・道具（道具、薬剤、鉢、その他盆栽用品）
- [x] 施設・イベント（盆栽園、展示会・イベント）
- [x] その他（草もの）

### Supabase型生成
- [x] `npx supabase gen types typescript` 実行
- [x] `types/supabase.ts` 生成・配置

---

## 完了条件
- [x] すべてのテーブルが作成されている
- [x] すべてのRLSポリシーが設定されている
- [x] インデックスが適切に作成されている
- [x] マスターデータが投入されている
- [x] TypeScript型が生成されている

## メモ
```sql
-- RLS有効化の例
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- ポリシー作成の例
CREATE POLICY "Public posts are viewable by everyone"
ON posts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = posts.user_id
    AND users.is_public = true
  )
);
```
