/**
 * @file マイ盆栽一覧ページコンポーネント
 * @description ユーザーが登録した盆栽コレクションを一覧表示するページ
 *              - 認証済みユーザーのみアクセス可能
 *              - Server Componentとして実装し、盆栽一覧をサーバーサイドで取得
 *              - 盆栽の追加、詳細表示、管理機能への導線を提供
 */

// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'

// Next.js のリダイレクト関数 - 未認証ユーザーをログインページへ誘導
import { redirect } from 'next/navigation'

// 盆栽一覧を取得するServer Action
import { getBonsais } from '@/lib/actions/bonsai'

// 盆栽リストのクライアントコンポーネント - グリッド表示とインタラクションを担当
import { BonsaiListClient } from '@/components/bonsai/BonsaiListClient'

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルと説明文を設定
 */
export const metadata = {
  title: 'マイ盆栽 - BON-LOG',
  description: 'あなたの盆栽コレクションを管理',
}

/**
 * マイ盆栽一覧ページのメインコンポーネント
 *
 * @description
 * - 認証チェックを行い、未ログインユーザーはログインページへリダイレクト
 * - ユーザーが登録した盆栽一覧をサーバーサイドで取得
 * - BonsaiListClientコンポーネントでグリッド表示
 *
 * @returns マイ盆栽一覧ページのJSX
 */
export default async function BonsaiListPage() {
  // 現在のセッション情報を取得
  const session = await auth()

  // 未認証の場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect('/login')
  }

  // ユーザーの盆栽一覧を取得
  const result = await getBonsais()

  // エラー時は空配列をデフォルト値として使用
  const bonsais = result.bonsais || []

  // クライアントコンポーネントに初期データを渡して表示
  return <BonsaiListClient initialBonsais={bonsais} />
}
