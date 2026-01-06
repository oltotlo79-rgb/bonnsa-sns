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
- [ ] Leaflet (`leaflet`, `react-leaflet`)
- [ ] 型定義 (`@types/leaflet`)

### マップページ
- [ ] `app/(main)/shops/page.tsx` - 盆栽園マップページ
- [ ] `app/(main)/shops/[id]/page.tsx` - 盆栽園詳細ページ
- [ ] `app/(main)/shops/new/page.tsx` - 盆栽園登録ページ
- [ ] `app/(main)/shops/[id]/edit/page.tsx` - 盆栽園編集ページ

### マップコンポーネント
- [ ] `components/shop/Map.tsx` - メインマップコンポーネント
  - [ ] SSR無効化（dynamic import）
  - [ ] OpenStreetMapタイル設定
  - [ ] マーカー表示
  - [ ] マーカークリックでポップアップ
- [ ] `components/shop/MapMarker.tsx` - カスタムマーカー
- [ ] `components/shop/MapPopup.tsx` - マーカーポップアップ
- [ ] `components/shop/MapControls.tsx` - ズーム・現在地ボタン

### 盆栽園コンポーネント
- [ ] `components/shop/ShopCard.tsx` - 盆栽園カード
- [ ] `components/shop/ShopList.tsx` - 盆栽園リスト
- [ ] `components/shop/ShopDetail.tsx` - 盆栽園詳細
- [ ] `components/shop/ShopForm.tsx` - 盆栽園登録/編集フォーム
- [ ] `components/shop/ShopGenreSelector.tsx` - 取り扱いジャンル選択

### レビューコンポーネント
- [ ] `components/shop/ReviewForm.tsx` - レビューフォーム
  - [ ] 星5段階評価
  - [ ] テキスト入力
  - [ ] 画像添付（最大3枚）
- [ ] `components/shop/ReviewCard.tsx` - レビューカード
- [ ] `components/shop/ReviewList.tsx` - レビュー一覧
- [ ] `components/shop/StarRating.tsx` - 星評価コンポーネント

### 盆栽園登録項目
**必須項目:**
- [ ] 名称入力
- [ ] 住所入力
- [ ] 住所から緯度経度取得（Geocoding）

**任意項目:**
- [ ] 営業時間
- [ ] 定休日
- [ ] 電話番号
- [ ] ウェブサイトURL
- [ ] 写真アップロード
- [ ] 取り扱いジャンル選択
  - [ ] 道具
  - [ ] 鉢
  - [ ] 展示用具
  - [ ] ミニ盆栽
  - [ ] 小品盆栽
  - [ ] 中品盆栽
  - [ ] 貴風盆栽
  - [ ] 大品盆栽

### Server Actions
- [ ] `lib/actions/shop.ts`
  - [ ] `createShop` - 盆栽園登録
  - [ ] `updateShop` - 盆栽園更新
  - [ ] `deleteShop` - 盆栽園削除
  - [ ] `getShop` - 盆栽園詳細取得
  - [ ] `getShops` - 盆栽園一覧取得
  - [ ] `searchShops` - 盆栽園検索
  - [ ] `getNearbyShops` - 近くの盆栽園取得
- [ ] `lib/actions/review.ts`
  - [ ] `createReview` - レビュー投稿
  - [ ] `deleteReview` - レビュー削除
  - [ ] `getReviews` - レビュー一覧取得

### 重複処理
- [ ] 住所による重複チェック
- [ ] 重複時の自動マージ処理
- [ ] 既存盆栽園へのレビュー追加誘導

### Geocoding
- [ ] 住所→緯度経度変換API設定
- [ ] OpenStreetMap Nominatim使用
- [ ] 変換失敗時のエラーハンドリング

### 検索・フィルター
- [ ] 名称で検索
- [ ] 地域で検索
- [ ] 取り扱いジャンルでフィルター
- [ ] 評価順ソート

### 現在地機能
- [ ] ブラウザGeolocation API使用
- [ ] 現在地から近い順でソート
- [ ] 現在地へマップ移動

### 権限管理
- [ ] 自分が登録した盆栽園のみ編集可能
- [ ] レビューは誰でも投稿可能
- [ ] 自分のレビューのみ削除可能

### UI/UX
- [ ] マップのスムーズな操作
- [ ] マーカークラスタリング（盆栽園が多い場合）
- [ ] レスポンシブ対応
- [ ] モバイルでのタッチ操作

### 画像アップロード
- [ ] Supabase Storageバケット作成（shop-images, review-images）
- [ ] 画像リサイズ・圧縮
- [ ] ファイルサイズ制限（5MB）

---

## 完了条件
- [ ] マップが正常に表示される
- [ ] 盆栽園の登録が正常に動作する
- [ ] 盆栽園の検索が正常に動作する
- [ ] レビュー投稿が正常に動作する
- [ ] 重複チェックが正常に機能する
- [ ] 現在地機能が正常に動作する

## 参考コード
```typescript
// components/shop/Map.tsx
'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// デフォルトマーカーアイコンの修正
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
})

interface Shop {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string
}

export function Map({ shops }: { shops: Shop[] }) {
  return (
    <MapContainer
      center={[35.6762, 139.6503]} // 東京
      zoom={10}
      className="h-[600px] w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {shops.map((shop) => (
        <Marker
          key={shop.id}
          position={[shop.latitude, shop.longitude]}
        >
          <Popup>
            <div>
              <h3 className="font-bold">{shop.name}</h3>
              <p>{shop.address}</p>
              <a href={`/shops/${shop.id}`}>詳細を見る</a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
```

```typescript
// app/(main)/shops/page.tsx
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'

// SSR無効化
const Map = dynamic(
  () => import('@/components/shop/Map').then((mod) => mod.Map),
  { ssr: false, loading: () => <div>地図を読み込み中...</div> }
)

export default async function ShopsPage() {
  const supabase = await createClient()

  const { data: shops } = await supabase
    .from('bonsai_shops')
    .select(`
      *,
      shop_genres(genre),
      shop_reviews(rating)
    `)

  return (
    <div>
      <h1>盆栽園マップ</h1>
      <Map shops={shops ?? []} />
    </div>
  )
}
```
