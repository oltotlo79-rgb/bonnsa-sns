/**
 * @file 盆栽園マップページ
 * @description 盆栽園の一覧表示とマップ表示を提供するメインページ。
 * 検索、ジャンルフィルタリング、ソート機能を備え、
 * ユーザーは盆栽園を地図上で確認したり、新規登録することができる。
 */

// Next.jsのLinkコンポーネント: クライアントサイドナビゲーションを実現
import Link from 'next/link'
// 盆栽園データ取得用のServer Actions
import { getShops, getShopGenres } from '@/lib/actions/shop'
// 盆栽園リスト表示コンポーネント
import { ShopList } from '@/components/shop/ShopList'
// 検索・フィルターフォームコンポーネント（クライアントコンポーネント）
import { ShopSearchForm } from './ShopSearchForm'
// 地図表示用ラッパーコンポーネント（Leafletを使用）
import { MapWrapper } from '@/components/shop/MapWrapper'

/**
 * ページメタデータ
 * SEO対策としてタイトルを設定
 */
export const metadata = {
  title: '盆栽園マップ - BON-LOG',
}

/**
 * ページコンポーネントのProps型定義
 * URLのクエリパラメータを受け取る
 */
interface ShopsPageProps {
  searchParams: Promise<{
    search?: string   // 検索キーワード
    genre?: string    // 選択されたジャンルID
    sort?: string     // ソート順（rating, name, newest）
  }>
}

/**
 * プラスアイコンコンポーネント
 * 新規登録ボタンに使用するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

/**
 * 盆栽園マップページコンポーネント
 *
 * このServer Componentは以下の機能を提供する:
 * 1. 盆栽園データとジャンルデータの並列取得
 * 2. 検索・フィルター条件に基づいた盆栽園の表示
 * 3. 地図上での盆栽園位置の可視化
 * 4. 盆栽園一覧のリスト表示
 *
 * @param searchParams - URLクエリパラメータ（検索、ジャンル、ソート）
 */
export default async function ShopsPage({ searchParams }: ShopsPageProps) {
  // URLパラメータを非同期で取得
  const params = await searchParams

  // 盆栽園データとジャンルデータを並列で取得
  // Promise.allを使用することでパフォーマンスを最適化
  const [{ shops }, { genres }] = await Promise.all([
    getShops({
      search: params.search,          // 検索キーワードでフィルタ
      genreId: params.genre,          // ジャンルでフィルタ
      sortBy: params.sort as 'rating' | 'name' | 'newest' | undefined,  // ソート順
    }),
    getShopGenres(),  // 全ジャンルを取得（フィルター用）
  ])

  return (
    <div className="space-y-6">
      {/* ヘッダー: ページタイトルと新規登録ボタン */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">盆栽園マップ</h1>
        <Link
          href="/shops/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <PlusIcon className="w-4 h-4" />
          <span>盆栽園を登録</span>
        </Link>
      </div>

      {/* マップ: Leafletを使用した地図表示 */}
      <MapWrapper shops={shops} />

      {/* 検索・フィルターフォーム: キーワード検索、ジャンル選択、ソート */}
      <ShopSearchForm
        genres={genres}
        initialSearch={params.search}
        initialGenre={params.genre}
        initialSort={params.sort}
      />

      {/* 盆栽園リスト: カード形式で一覧表示 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          盆栽園一覧
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({shops.length}件)
          </span>
        </h2>
        <ShopList shops={shops} />
      </div>
    </div>
  )
}
