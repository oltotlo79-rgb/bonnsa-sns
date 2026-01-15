# 013: 盆栽園マップ機能

## 概要
Leaflet + OpenStreetMapを使用した盆栽園マップ機能を実装する。
盆栽園の登録・検索・レビュー機能を含む。

## 優先度
**中** - Phase 4

## 依存チケット
- 001: プロジェクトセットアップ
- 003: 認証システム
- 004: ユーザープロフィール

---

## Todo

### パッケージインストール
- [x] Leaflet (`leaflet`, `react-leaflet`)
- [x] 型定義 (`@types/leaflet`)

### マップページ
- [x] `app/(main)/shops/page.tsx` - 盆栽園マップページ
- [x] `app/(main)/shops/[id]/page.tsx` - 盆栽園詳細ページ
- [x] `app/(main)/shops/new/page.tsx` - 盆栽園登録ページ
- [x] `app/(main)/shops/[id]/edit/page.tsx` - 盆栽園編集ページ

### マップコンポーネント
- [x] `components/shop/Map.tsx` - メインマップコンポーネント
  - [x] SSR無効化（dynamic import）
  - [x] OpenStreetMapタイル設定
  - [x] マーカー表示
  - [x] マーカークリックでポップアップ
- [x] `components/shop/MapWrapper.tsx` - Client Componentラッパー

### 盆栽園コンポーネント
- [x] `components/shop/ShopCard.tsx` - 盆栽園カード
- [x] `components/shop/ShopList.tsx` - 盆栽園リスト
- [x] `components/shop/ShopForm.tsx` - 盆栽園登録/編集フォーム

### レビューコンポーネント
- [x] `components/shop/ReviewForm.tsx` - レビューフォーム
  - [x] 星5段階評価
  - [x] テキスト入力
  - [ ] 画像添付（最大3枚）- 構造は準備済み、アップロードAPI未実装
- [x] `components/shop/ReviewCard.tsx` - レビューカード
- [x] `components/shop/ReviewList.tsx` - レビュー一覧
- [x] `components/shop/StarRating.tsx` - 星評価コンポーネント

### 盆栽園登録項目
**必須項目:**
- [x] 名称入力
- [x] 住所入力
- [x] 住所から緯度経度取得（Geocoding）

**任意項目:**
- [x] 営業時間
- [x] 定休日
- [x] 電話番号
- [x] ウェブサイトURL
- [ ] 写真アップロード
- [x] 取り扱いジャンル選択

### Server Actions
- [x] `lib/actions/shop.ts`
  - [x] `createShop` - 盆栽園登録
  - [x] `updateShop` - 盆栽園更新
  - [x] `deleteShop` - 盆栽園削除
  - [x] `getShop` - 盆栽園詳細取得
  - [x] `getShops` - 盆栽園一覧取得（検索・フィルター含む）
  - [x] `geocodeAddress` - 住所から緯度経度取得
  - [x] `getShopGenres` - ジャンル一覧取得
- [x] `lib/actions/review.ts`
  - [x] `createReview` - レビュー投稿
  - [x] `deleteReview` - レビュー削除
  - [x] `getReviews` - レビュー一覧取得

### 重複処理
- [x] 住所による重複チェック
- [x] 既存盆栽園へのレビュー追加誘導

### Geocoding
- [x] 住所→緯度経度変換API設定
- [x] OpenStreetMap Nominatim使用
- [x] 変換失敗時のエラーハンドリング

### 検索・フィルター
- [x] 名称で検索
- [x] 取り扱いジャンルでフィルター
- [x] 評価順ソート
- [x] 名前順ソート
- [x] 新着順ソート

### 現在地機能
- [x] ブラウザGeolocation API使用
- [x] 現在地へマップ移動

### 権限管理
- [x] 自分が登録した盆栽園のみ編集可能
- [x] レビューは誰でも投稿可能
- [x] 自分のレビューのみ削除可能
- [x] 同一盆栽園への重複レビュー防止

### UI/UX
- [x] マップのスムーズな操作
- [x] レスポンシブ対応
- [x] ローディングスケルトン

### 未実装（将来対応）
- [ ] マーカークラスタリング（盆栽園が多い場合）
- [ ] 画像アップロード（Azure Blob Storage）
- [ ] 盆栽園写真アップロード
- [ ] レビュー画像アップロード

---

## 完了条件
- [x] マップが正常に表示される
- [x] 盆栽園の登録が正常に動作する
- [x] 盆栽園の検索が正常に動作する
- [x] レビュー投稿が正常に動作する
- [x] 重複チェックが正常に機能する
- [x] 現在地機能が正常に動作する

## 実装ファイル一覧

### Pages
- `app/(main)/shops/page.tsx` - マップページ
- `app/(main)/shops/[id]/page.tsx` - 詳細ページ
- `app/(main)/shops/new/page.tsx` - 登録ページ
- `app/(main)/shops/[id]/edit/page.tsx` - 編集ページ
- `app/(main)/shops/loading.tsx` - ローディング
- `app/(main)/shops/ShopSearchForm.tsx` - 検索フォーム

### Components
- `components/shop/Map.tsx` - マップコンポーネント
- `components/shop/MapWrapper.tsx` - SSR無効化ラッパー
- `components/shop/StarRating.tsx` - 星評価
- `components/shop/ShopCard.tsx` - 盆栽園カード
- `components/shop/ShopList.tsx` - 盆栽園リスト
- `components/shop/ShopForm.tsx` - 登録/編集フォーム
- `components/shop/ReviewForm.tsx` - レビューフォーム
- `components/shop/ReviewCard.tsx` - レビューカード
- `components/shop/ReviewList.tsx` - レビュー一覧

### Server Actions
- `lib/actions/shop.ts` - 盆栽園CRUD
- `lib/actions/review.ts` - レビューCRUD
