/**
 * @file 盆栽園新規登録ページ
 * @description 新しい盆栽園を登録するためのフォームページ。
 * ログインユーザーが盆栽園の名前、住所、連絡先、営業情報などを
 * 入力して新規登録できる。住所から緯度経度を自動取得する機能も備える。
 */

// Next.jsのLinkコンポーネント: ページ間ナビゲーション用
import Link from 'next/link'
// 盆栽園ジャンル取得用のServer Action
import { getShopGenres } from '@/lib/actions/shop'
// 盆栽園登録・編集用フォームコンポーネント
import { ShopForm } from '@/components/shop/ShopForm'

/**
 * ページメタデータ
 * SEO対策としてタイトルを設定
 */
export const metadata = {
  title: '盆栽園を登録 - BON-LOG',
}

/**
 * 左矢印アイコンコンポーネント
 * 「戻る」ボタンに使用するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

/**
 * 盆栽園新規登録ページコンポーネント
 *
 * このServer Componentは以下の処理を行う:
 * 1. 利用可能なジャンル一覧をサーバーから取得
 * 2. 新規作成モードでShopFormコンポーネントをレンダリング
 *
 * 認証チェックはShopFormコンポーネント内のServer Actionで行われる。
 */
export default async function NewShopPage() {
  // フォームで選択可能なジャンル一覧を取得
  const { genres } = await getShopGenres()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 戻るボタン: 盆栽園マップページへのナビゲーション */}
      <Link
        href="/shops"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>盆栽園マップに戻る</span>
      </Link>

      {/* フォームカード: 新規登録フォームを含むカードUI */}
      <div className="bg-card rounded-lg border p-6">
        <h1 className="text-2xl font-bold mb-6">盆栽園を登録</h1>
        {/* ShopFormに新規作成モードとジャンル一覧を渡す */}
        <ShopForm genres={genres} mode="create" />
      </div>
    </div>
  )
}
