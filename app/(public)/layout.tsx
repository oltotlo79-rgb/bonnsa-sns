/**
 * @file app/(public)/layout.tsx
 * @description 公開ページ（ヘルプ等）用のレイアウトコンポーネント
 *
 * このレイアウトは認証不要でアクセス可能な公開ページに適用されます。
 * ただし、サービス開始前（ユーザーが1人も登録されていない状態）では
 * トップページにリダイレクトします。
 *
 * Route Groupsを使用しており、URLに(public)は含まれません。
 *
 * 適用されるページ:
 * - /help（ヘルプセンター）
 *
 * 特徴:
 * - Server Componentとして動作し、サーバーサイドでユーザー存在確認を実行
 * - 動的レンダリング（force-dynamic）でリクエストごとにチェック
 */

// Next.jsのクライアントサイドナビゲーション用Linkコンポーネント
import Link from 'next/link'
// Next.jsのサーバーサイドリダイレクト関数
import { redirect } from 'next/navigation'
// Prismaデータベースクライアント
import { prisma } from '@/lib/db'

/**
 * ページの動的レンダリングを強制
 * キャッシュを無効にし、リクエストごとにユーザー存在確認を実行
 */
export const dynamic = 'force-dynamic'

/**
 * ユーザーの存在確認を行う非同期関数
 *
 * サービス開始前（ユーザーが0人の場合）は、
 * 公開ページを表示せずにトップページへリダイレクトします。
 * これにより、サービス未開始状態でヘルプページ等にアクセスすることを防ぎます。
 *
 * @returns void（ユーザーが存在する場合）
 * @throws redirect（ユーザーが存在しない場合、トップページへリダイレクト）
 */
async function checkUsersExist() {
  // ユーザーテーブルのレコード数をカウント
  const userCount = await prisma.user.count()
  // ユーザーが1人も存在しない場合はトップページへリダイレクト
  if (userCount === 0) {
    redirect('/')
  }
}

/**
 * BON-LOGのロゴアイコンコンポーネント
 * SVGで盆栽の木をモチーフにしたロゴを描画します
 *
 * @param className - アイコンに適用するCSSクラス名（サイズ、色など）
 * @returns SVGロゴアイコン要素
 */
function LogoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 盆栽の幹を表現する縦線 */}
      <path d="M12 3v18" />
      {/* 盆栽の枝葉を表現する曲線 */}
      <path d="M8 6c0-1 .5-3 4-3s4 2 4 3c0 2-2 3-4 3s-4 1-4 3c0 1 .5 3 4 3s4-2 4-3" />
      {/* 鉢または地面を表現する横線 */}
      <path d="M2 21h20" />
    </svg>
  )
}

/**
 * 公開ページ用レイアウトコンポーネント（非同期Server Component）
 *
 * レンダリング前にユーザーの存在確認を行い、
 * サービス開始前の場合はトップページへリダイレクトします。
 *
 * 構成:
 * - ヘッダー: ロゴ、ログイン・新規登録リンク
 * - メインコンテンツ: 各ページのコンテンツ
 * - フッター: 関連ページへのリンク、コピーライト
 *
 * @param children - レイアウト内に表示する子コンポーネント（各ページのコンテンツ）
 * @returns 公開ページ用のレイアウト要素
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // usersテーブルが空の場合はトップページへリダイレクト
  await checkUsersExist()

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー: サイトロゴとナビゲーションリンク */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* ロゴリンク: トップページへ遷移 */}
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">BON-LOG</span>
          </Link>
          {/* 認証関連リンク */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ログイン
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              新規登録
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツエリア: 各ページの内容が挿入される */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* フッター: 関連ページリンクとコピーライト */}
      <footer className="border-t bg-card mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* 関連ページへのクイックリンク */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mb-4">
            <Link href="/about" className="hover:text-foreground">BON-LOGについて</Link>
            <Link href="/terms" className="hover:text-foreground">利用規約</Link>
            <Link href="/privacy" className="hover:text-foreground">プライバシーポリシー</Link>
            <Link href="/help" className="hover:text-foreground">ヘルプ</Link>
            <Link href="/contact" className="hover:text-foreground">お問い合わせ</Link>
          </div>
          {/* コピーライト表示 */}
          <p className="text-center text-xs text-muted-foreground">
            &copy; 2024 BON-LOG. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
