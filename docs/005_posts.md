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
  - [x] 画像: 5MB/枚
  - [x] 動画: 512MB

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
- [x] 画像付き投稿が正常に動作する
- [x] 動画付き投稿が正常に動作する
- [x] ジャンル選択が正常に動作する
- [x] 投稿削除が正常に動作する
- [x] 引用投稿が正常に動作する
- [x] リポストが正常に動作する
- [x] 投稿制限が正常に機能する

## Supabase Storage設定（要手動設定）
Supabaseダッシュボードで以下のバケットを作成してください：

1. `post-images` - 投稿画像用
2. `post-videos` - 投稿動画用

各バケットの設定：
- Public bucket: ON
- Allowed MIME types:
  - post-images: image/jpeg, image/png, image/webp, image/gif
  - post-videos: video/mp4, video/quicktime
- File size limit:
  - post-images: 5MB
  - post-videos: 512MB
