/**
 * @file メインレイアウトコンポーネント
 * @description 認証済みユーザー向けのメインアプリケーションレイアウト
 *
 * このファイルは(main)ルートグループ配下の全ページに適用される共通レイアウトを定義します。
 * 3カラムレイアウト（左サイドバー、メインコンテンツ、右サイドバー）を構成し、
 * モバイル向けにはヘッダーとボトムナビゲーションを提供します。
 *
 * @features
 * - 認証チェック（未認証ユーザーはログインページへリダイレクト）
 * - プレミアム会員判定
 * - レスポンシブデザイン（デスクトップ3カラム、モバイル1カラム）
 * - トースト通知の表示基盤
 */

// NextAuth.jsの認証ヘルパー関数
// セッション情報の取得に使用
import { auth } from '@/lib/auth'

// Next.jsのリダイレクト関数
// 認証されていないユーザーをログインページへ誘導
import { redirect } from 'next/navigation'

// トースト通知コンポーネント
// アプリケーション全体でのフィードバック表示に使用
import { Toaster } from '@/components/ui/toaster'

// 左サイドバーコンポーネント（デスクトップ表示）
// ナビゲーションメニュー、ユーザー情報を表示
import { Sidebar } from '@/components/layout/Sidebar'

// 右サイドバーコンポーネント（デスクトップ表示）
// おすすめユーザー、トレンド情報などを表示
import { RightSidebar } from '@/components/layout/RightSidebar'

// モバイル用ボトムナビゲーション
// スマートフォン画面下部に固定表示されるナビゲーション
import { MobileNav } from '@/components/layout/MobileNav'

// モバイル用ヘッダー
// スマートフォン画面上部に表示されるヘッダー
import { Header } from '@/components/layout/Header'

// プレミアム会員判定関数
// ユーザーが有料会員かどうかを判定
import { isPremiumUser } from '@/lib/premium'

/**
 * メインレイアウトコンポーネント
 *
 * 認証済みユーザー向けの共通レイアウトを提供するServer Componentです。
 * セッション確認後、認証されていない場合はログインページへリダイレクトします。
 *
 * レイアウト構成:
 * - デスクトップ: 左サイドバー | メインコンテンツ | 右サイドバー
 * - モバイル: ヘッダー + メインコンテンツ + ボトムナビ
 *
 * @param children - ルーティングによって決定される子ページコンポーネント
 * @returns レイアウトが適用されたJSX要素
 */
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // セッション情報を取得（Server Componentで直接認証状態を確認）
  const session = await auth()

  // 未認証ユーザーをログインページへリダイレクト
  if (!session?.user) {
    redirect('/login')
  }

  // プレミアム会員かどうかを判定
  // サイドバーやヘッダーでプレミアム機能の表示制御に使用
  const isPremium = await isPremiumUser(session.user.id)

  return (
    <div className="min-h-screen bg-background asanoha-pattern">
      {/* モバイルヘッダー - スマートフォン向けの上部ナビゲーション */}
      <Header userId={session.user.id} isPremium={isPremium} />

      <div className="flex">
        {/* 左サイドバー（デスクトップのみ表示）
            ナビゲーションメニュー、投稿ボタン、ユーザープロフィールリンクを含む */}
        <Sidebar userId={session.user.id} isPremium={isPremium} />

        {/* メインコンテンツエリア
            pb-16: モバイルボトムナビ用の余白（lgサイズ以上では不要）*/}
        <main className="flex-1 min-h-screen pb-16 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 py-4 lg:py-6">
            {children}
          </div>
        </main>

        {/* 右サイドバー（デスクトップのみ表示）
            おすすめユーザー、検索、トレンドなどの補助情報を表示 */}
        <RightSidebar />
      </div>

      {/* モバイルボトムナビ - スマートフォン向けの下部固定ナビゲーション */}
      <MobileNav userId={session.user.id} />

      {/* トースト通知表示領域
          useToastフックからの通知メッセージをここに表示 */}
      <Toaster />
    </div>
  )
}
