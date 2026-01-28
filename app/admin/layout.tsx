/**
 * @file 管理者ダッシュボードのレイアウトコンポーネント
 * @description 管理者専用ページ全体を包むレイアウト。サイドバーナビゲーションと認証チェックを提供する。
 *              管理者権限を持つユーザーのみがアクセス可能。
 */

// Next.jsのナビゲーションユーティリティ（リダイレクト処理用）
import { redirect } from 'next/navigation'
// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'
// NextAuth.jsの認証関数とサインアウト関数
import { auth, signOut } from '@/lib/auth'
// 管理者権限チェック用のServer Action
import { isAdmin } from '@/lib/actions/admin'
// Prismaデータベースクライアント
import { prisma } from '@/lib/db'

// ビルド時の静的生成を無効化（データベース接続が必要なため）
export const dynamic = 'force-dynamic'

/**
 * ホームアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

/**
 * ユーザーアイコンコンポーネント（複数人）
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

/**
 * ファイル/テキストアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" x2="8" y1="13" y2="13"/>
      <line x1="16" x2="8" y1="17" y2="17"/>
      <line x1="10" x2="8" y1="9" y2="9"/>
    </svg>
  )
}

/**
 * 警告三角アイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" x2="12" y1="9" y2="13"/>
      <line x1="12" x2="12.01" y1="17" y2="17"/>
    </svg>
  )
}

/**
 * カレンダーアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}

/**
 * マップピンアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

/**
 * スクロールテキスト/ログアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function ScrollTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/>
      <path d="M19 17V5a2 2 0 0 0-2-2H4"/>
      <path d="M15 8h-5"/>
      <path d="M15 12h-5"/>
    </svg>
  )
}

/**
 * シールドアイコンコンポーネント（ブラックリスト用）
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function ShieldBanIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      <path d="m4.243 5.21 14.39 12.472"/>
    </svg>
  )
}

/**
 * トレンド上昇アイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  )
}

/**
 * ゲージ/メーターアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function GaugeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 14 4-4"/>
      <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
    </svg>
  )
}

/**
 * 工具アイコンコンポーネント（メンテナンス用）
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )
}

/**
 * 非表示アイコンコンポーネント（目に斜線）
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
  )
}

/**
 * メッセージ/コメントアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

/**
 * 左矢印アイコンコンポーネント（戻る用）
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7"/>
      <path d="M19 12H5"/>
    </svg>
  )
}

/**
 * サイドバーナビゲーション項目の定義
 * 各項目はURL、ラベル、アイコンコンポーネントを持つ
 */
const navItems = [
  { href: '/admin', label: 'ダッシュボード', icon: HomeIcon },
  { href: '/admin/users', label: 'ユーザー管理', icon: UsersIcon },
  { href: '/admin/posts', label: '投稿管理', icon: FileTextIcon },
  { href: '/admin/reports', label: '通報管理', icon: AlertTriangleIcon },
  { href: '/admin/hidden', label: '非表示コンテンツ', icon: EyeOffIcon },
  { href: '/admin/blacklist', label: 'ブラックリスト', icon: ShieldBanIcon },
  { href: '/admin/events', label: 'イベント管理', icon: CalendarIcon },
  { href: '/admin/shops', label: '盆栽園管理', icon: MapPinIcon },
  { href: '/admin/shop-requests', label: '変更リクエスト', icon: MessageSquareIcon },
  { href: '/admin/stats', label: '統計情報', icon: TrendUpIcon },
  { href: '/admin/usage', label: 'サービス使用量', icon: GaugeIcon },
  { href: '/admin/maintenance', label: 'メンテナンス', icon: WrenchIcon },
  { href: '/admin/logs', label: '操作ログ', icon: ScrollTextIcon },
]

/**
 * 管理者レイアウトコンポーネント
 * 管理者ページ全体のレイアウトを定義し、認証・権限チェックを行う
 *
 * @param children - 子コンポーネント（各管理ページのコンテンツ）
 * @returns レイアウトを適用したJSX要素
 *
 * 処理内容:
 * 1. ユーザーテーブルが空の場合はサインアウトしてトップへリダイレクト
 * 2. 未認証の場合はログインページへリダイレクト
 * 3. 管理者権限がない場合はフィードページへリダイレクト
 * 4. サイドバーナビゲーションとメインコンテンツエリアを表示
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // usersテーブルが空の場合はログアウトしてトップページへ
  const userCount = await prisma.user.count()
  if (userCount === 0) {
    await signOut({ redirect: false })
    redirect('/')
  }

  // 現在のセッション情報を取得
  const session = await auth()

  // 未認証の場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect('/login')
  }

  // 管理者権限をチェック
  const isAdminUser = await isAdmin()

  // 管理者でない場合はフィードページへリダイレクト
  if (!isAdminUser) {
    redirect('/feed')
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* サイドバー - 固定表示のナビゲーションメニュー */}
      <aside className="fixed top-0 left-0 w-64 h-full bg-card border-r z-50">
        {/* ヘッダー部分 - ロゴとタイトル */}
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">BON-LOG 管理</h1>
          <p className="text-sm text-muted-foreground">管理者ダッシュボード</p>
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* フッター部分 - サイトへ戻るリンク */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <Link
            href="/feed"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>サイトに戻る</span>
          </Link>
        </div>
      </aside>

      {/* メインコンテンツエリア - サイドバーの幅分オフセット */}
      <main className="ml-64 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
