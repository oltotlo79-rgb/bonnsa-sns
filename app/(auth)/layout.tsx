/**
 * @file 認証関連ページの共通レイアウト
 * @description ログイン、新規登録、パスワードリセットなど認証関連ページで共通使用されるレイアウトコンポーネント
 *
 * 機能概要:
 * - 認証ページ全体の外観を統一
 * - 中央配置のカードレイアウト
 * - ロゴと装飾的なデザイン要素の表示
 * - 和風テイストの背景パターン（青海波）
 *
 * @remarks
 * このレイアウトはRoute Group「(auth)」配下の全ページに適用されます。
 * Next.js App Routerのレイアウト機能により、ページ遷移時も再レンダリングされません。
 * これにより、認証ページ間のスムーズな遷移が実現されています。
 */

// Next.jsの画像最適化コンポーネント
// 自動的にWebP変換、遅延読み込み、サイズ最適化を行う
import Image from 'next/image'

/**
 * 認証関連ページの共通レイアウトコンポーネント
 *
 * 処理内容:
 * 1. 画面中央にコンテンツを配置
 * 2. ロゴと説明テキストを表示
 * 3. 装飾的な角枠でメインカードを囲む
 * 4. 子コンポーネント（各ページのコンテンツ）をレンダリング
 *
 * @param children - 各ページのコンテンツ（login/page.tsx、register/page.tsxなど）
 * @returns 認証ページ共通レイアウトのJSX要素
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // 全画面高さでFlexboxによる中央配置
    // 背景: 盆栽クリーム色 + 青海波パターン
    <div className="min-h-screen flex items-center justify-center bg-bonsai-cream seigaiha-pattern p-4">
      {/* コンテンツ幅を制限するコンテナ（最大幅: md = 448px） */}
      <div className="w-full max-w-md">

        {/* 装飾的な上部ライン - ダイヤモンド形状を中心に配置 */}
        <div className="flex items-center justify-center mb-6">
          {/* 左側のグラデーションライン */}
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/40" />
          {/* 中央のダイヤモンド形状（45度回転した正方形） */}
          <div className="mx-4 w-2 h-2 rotate-45 border border-primary/40" />
          {/* 右側のグラデーションライン */}
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/40" />
        </div>

        {/* ロゴとキャッチコピーのセクション */}
        <div className="text-center mb-8">
          {/* アプリケーションロゴ画像 */}
          {/* priorityを指定してLCP（Largest Contentful Paint）を最適化 */}
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={200}
            height={80}
            className="mx-auto"
            priority
          />
          {/* アプリケーションの説明テキスト */}
          <p className="text-muted-foreground mt-3 text-sm tracking-wider">
            盆栽愛好家のためのコミュニティ
          </p>
        </div>

        {/* メインカード - 各ページのコンテンツを囲む装飾枠 */}
        <div className="relative">
          {/* 装飾的な角 - 4隅に配置されたL字型の線 */}
          {/* 左上の角 */}
          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary/30" />
          {/* 右上の角 */}
          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary/30" />
          {/* 左下の角 */}
          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary/30" />
          {/* 右下の角 */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary/30" />

          {/* 子コンポーネント（各ページのコンテンツ）をレンダリング */}
          {children}
        </div>

      </div>
    </div>
  )
}
