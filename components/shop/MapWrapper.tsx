/**
 * @file MapWrapper.tsx
 * @description 地図コンポーネントのラッパー
 *
 * 機能概要:
 * - Leaflet地図コンポーネントを動的インポートでラップ
 * - サーバーサイドレンダリング（SSR）を無効化
 * - 地図読み込み中のローディング表示
 * - 通常サイズと小サイズの2種類のラッパーを提供
 *
 * 使用例:
 * ```tsx
 * // 通常サイズ（一覧ページ向け、高さ500px）
 * <MapWrapper shops={shops} center={[35.6762, 139.6503]} zoom={10} />
 *
 * // 小サイズ（詳細ページ向け、高さ300px）
 * <MapWrapperSmall shops={[shop]} center={[shop.latitude, shop.longitude]} zoom={15} />
 * ```
 *
 * 技術的詳細:
 * - LeafletはDOMに依存するためSSRできない
 * - next/dynamicでクライアントサイドのみレンダリング
 * - ローディング中は「地図を読み込み中...」を表示
 */
'use client'

// Next.jsの動的インポート機能
// SSRを無効化してクライアントサイドのみでコンポーネントをロード
import dynamic from 'next/dynamic'

// 地図コンポーネントからShop型をインポート
// 地図上に表示する盆栽園の情報
import type { Shop } from './Map'

/**
 * 地図コンポーネントの動的インポート
 *
 * SSR無効化: Leafletはwindowオブジェクトに依存するため、
 * サーバーサイドでは実行できない。ssr: falseで無効化。
 *
 * loading: 地図コンポーネントの読み込み中に表示するフォールバック。
 * ユーザーに読み込み中であることを視覚的に伝える。
 */
const Map = dynamic(
  () => import('@/components/shop/Map').then((mod) => mod.Map),
  {
    ssr: false,
    loading: () => (
      <div className="h-[250px] md:h-[400px] w-full bg-muted flex items-center justify-center rounded-lg">
        <div className="text-muted-foreground">地図を読み込み中...</div>
      </div>
    ),
  }
)

/**
 * MapWrapperコンポーネントのプロパティ定義
 */
interface MapWrapperProps {
  /** 地図上に表示する盆栽園の配列 */
  shops: Shop[]
  /** 地図の中心座標 [緯度, 経度]（任意、デフォルトは東京） */
  center?: [number, number]
  /** 地図のズームレベル（任意、デフォルトは6） */
  zoom?: number
  /** 地図の高さ（CSSの値、デフォルトは'500px'） */
  height?: string
}

/**
 * 地図ラッパーコンポーネント（通常サイズ）
 *
 * 盆栽園一覧ページなど、広い表示エリアが必要な場面で使用。
 * スマホでは250px、タブレット以上では400pxの高さで表示。
 * heightプロパティを指定した場合はそちらが優先される。
 *
 * @param shops - 表示する盆栽園の配列
 * @param center - 地図の中心座標
 * @param zoom - ズームレベル
 * @param height - 地図の高さ（指定時はレスポンシブ無効）
 */
export function MapWrapper({ shops, center, zoom, height }: MapWrapperProps) {
  // heightが明示的に指定された場合はinline styleを使用
  // 指定がない場合はレスポンシブクラスを使用（スマホ: 250px、md以上: 400px）
  if (height) {
    return (
      <div style={{ height }}>
        <Map shops={shops} center={center} zoom={zoom} />
      </div>
    )
  }

  return (
    <div className="h-[250px] md:h-[400px]">
      <Map shops={shops} center={center} zoom={zoom} />
    </div>
  )
}

/**
 * 小サイズ地図ラッパーコンポーネント
 *
 * 盆栽園詳細ページなど、コンパクトな表示が必要な場面で使用。
 * 高さは300pxで固定。
 *
 * @param shops - 表示する盆栽園の配列
 * @param center - 地図の中心座標
 * @param zoom - ズームレベル
 */
export function MapWrapperSmall({ shops, center, zoom }: Omit<MapWrapperProps, 'height'>) {
  return (
    <div className="h-[300px]">
      <Map shops={shops} center={center} zoom={zoom} />
    </div>
  )
}
