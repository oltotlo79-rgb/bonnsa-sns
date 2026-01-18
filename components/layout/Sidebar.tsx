/**
 * サイドバーナビゲーションコンポーネント
 *
 * このファイルは、デスクトップ版のサイドバーナビゲーションを提供します。
 * 画面左側に固定表示され、主要なページへのナビゲーションリンクを含みます。
 *
 * ## 機能概要
 * - ロゴとキャッチコピーの表示
 * - メインナビゲーションメニュー
 * - 通知・メッセージのバッジ表示
 * - プレミアム会員専用メニュー
 * - ログアウトボタン
 *
 * ## レスポンシブ対応
 * - lg（1024px）以上: サイドバーを表示
 * - lg未満: 非表示（MobileNavを使用）
 *
 * ## スタイリング
 * - 和風デザイン（shadow-washi、落ち着いた色調）
 * - アクティブ状態のハイライト
 * - ホバー時のアニメーション
 *
 * @module components/layout/Sidebar
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * Next.js Linkコンポーネント
 * クライアントサイドナビゲーションを提供
 */
import Link from 'next/link'

/**
 * Next.js Imageコンポーネント
 * ロゴ画像の最適化表示
 */
import Image from 'next/image'

/**
 * 現在のパスを取得するHook
 * アクティブなナビゲーション項目のハイライトに使用
 */
import { usePathname } from 'next/navigation'

/**
 * NextAuth.jsのサインアウト関数
 * ログアウト機能を提供
 */
import { signOut } from 'next-auth/react'

/**
 * 通知バッジコンポーネント
 * 未読通知数を表示
 */
import { NotificationBadge } from '@/components/notification/NotificationBadge'

/**
 * メッセージバッジコンポーネント
 * 未読メッセージ数を表示
 */
import { MessageBadge } from '@/components/message/MessageBadge'

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * ログアウトアイコン
 *
 * ドアから出る矢印のデザイン
 *
 * @param className - 追加のCSSクラス
 */
function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  )
}

/**
 * ホームアイコン
 *
 * 家の形をしたナビゲーションアイコン
 * タイムラインへのリンクに使用
 *
 * @param className - 追加のCSSクラス
 */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

/**
 * 検索アイコン
 *
 * 虫眼鏡の形をしたアイコン
 * 検索ページへのリンクに使用
 *
 * @param className - 追加のCSSクラス
 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/**
 * 通知アイコン
 *
 * ベルの形をしたアイコン
 * 通知ページへのリンクに使用
 *
 * @param className - 追加のCSSクラス
 */
function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

/**
 * ブックマークアイコン
 *
 * しおりの形をしたアイコン
 * ブックマークページへのリンクに使用
 *
 * @param className - 追加のCSSクラス
 */
function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  )
}

/**
 * マップピンアイコン
 *
 * 地図上の位置マーカーの形をしたアイコン
 * 盆栽園マップへのリンクに使用
 *
 * @param className - 追加のCSSクラス
 */
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

/**
 * カレンダーアイコン
 *
 * カレンダーの形をしたアイコン
 * イベントページへのリンクに使用
 *
 * @param className - 追加のCSSクラス
 */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

/**
 * ユーザーアイコン
 *
 * 人のシルエットの形をしたアイコン
 * プロフィールページへのリンクに使用
 *
 * @param className - 追加のCSSクラス
 */
function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

/**
 * 設定アイコン
 *
 * 歯車の形をしたアイコン
 * 設定ページへのリンクに使用
 *
 * @param className - 追加のCSSクラス
 */
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/**
 * メッセージアイコン
 *
 * 吹き出しの形をしたアイコン
 * メッセージページへのリンクに使用
 *
 * @param className - 追加のCSSクラス
 */
function MessageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

/**
 * カレンダープラスアイコン
 *
 * カレンダーにプラス記号が付いた形のアイコン
 * 予約投稿ページへのリンクに使用（プレミアム機能）
 *
 * @param className - 追加のCSSクラス
 */
function CalendarPlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
      <path d="M3 10h18" />
      <path d="M16 19h6" />
      <path d="M19 16v6" />
    </svg>
  )
}

/**
 * 棒グラフアイコン
 *
 * 3本の棒グラフの形をしたアイコン
 * 投稿分析ページへのリンクに使用（プレミアム機能）
 *
 * @param className - 追加のCSSクラス
 */
function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  )
}

/**
 * 王冠アイコン
 *
 * 王冠の形をしたアイコン
 * プレミアム機能の識別に使用
 *
 * @param className - 追加のCSSクラス
 */
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  )
}

// ============================================================
// 型定義
// ============================================================

/**
 * ナビゲーション項目の型
 *
 * @property href - リンク先のURL
 * @property icon - アイコンコンポーネント
 * @property label - 表示テキスト
 * @property premium - プレミアム機能かどうか（オプション）
 */
type NavItem = {
  href: string
  icon: React.FC<{ className?: string }>
  label: string
  premium?: boolean
}

// ============================================================
// 定数
// ============================================================

/**
 * 基本ナビゲーション項目
 *
 * 全ユーザーが利用可能なナビゲーションリンク
 */
const navItems: NavItem[] = [
  { href: '/feed', icon: HomeIcon, label: 'ホーム' },
  { href: '/search', icon: SearchIcon, label: '検索' },
  { href: '/notifications', icon: BellIcon, label: '通知' },
  { href: '/messages', icon: MessageIcon, label: 'メッセージ' },
  { href: '/bookmarks', icon: BookmarkIcon, label: 'ブックマーク' },
  { href: '/shops', icon: MapPinIcon, label: '盆栽園マップ' },
  { href: '/events', icon: CalendarIcon, label: 'イベント' },
]

/**
 * プレミアム会員専用ナビゲーション項目
 *
 * プレミアム会員のみ表示されるリンク
 * 各項目には王冠アイコンが付与される
 */
const premiumNavItems: NavItem[] = [
  { href: '/posts/scheduled', icon: CalendarPlusIcon, label: '予約投稿', premium: true },
  { href: '/analytics', icon: BarChartIcon, label: '投稿分析', premium: true },
]

/**
 * Sidebarコンポーネントのprops型
 *
 * @property userId - ユーザーID（プロフィールリンクに使用）
 * @property isPremium - プレミアム会員かどうか
 */
type SidebarProps = {
  userId?: string
  isPremium?: boolean
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * サイドバーナビゲーションコンポーネント
 *
 * ## 機能
 * - ロゴとキャッチコピーの表示
 * - メインナビゲーションメニュー
 * - プレミアム会員専用メニュー（isPremium=trueの場合）
 * - ユーザープロフィールへのリンク
 * - ログアウトボタン
 *
 * ## アクティブ状態の判定
 * - 完全一致: パスが完全に一致
 * - 前方一致: パスで始まる（子ルートも含む）
 *
 * ## レスポンシブ
 * - lg以上で表示、lg未満では非表示
 *
 * @param userId - ユーザーID（プロフィールリンク用）
 * @param isPremium - プレミアム会員フラグ
 *
 * @example
 * ```tsx
 * <Sidebar userId="user123" isPremium={true} />
 * ```
 */
export function Sidebar({ userId, isPremium }: SidebarProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * 現在のパス名を取得
   * アクティブなナビゲーション項目を判定するために使用
   */
  const pathname = usePathname()

  // ------------------------------------------------------------
  // ナビゲーション項目の構築
  // ------------------------------------------------------------

  /**
   * 全ナビゲーション項目を動的に構築
   *
   * 1. 基本ナビゲーション
   * 2. プレミアム会員専用（isPremiumの場合）
   * 3. プロフィールリンク（userIdがある場合）
   * 4. 設定リンク
   */
  const allNavItems: NavItem[] = [
    ...navItems,
    ...(isPremium ? premiumNavItems : []),
    ...(userId ? [{ href: `/users/${userId}`, icon: UserIcon, label: 'プロフィール' }] : []),
    { href: '/settings', icon: SettingsIcon, label: '設定' },
  ]

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <aside className="sticky top-0 h-screen w-64 border-r bg-card/95 backdrop-blur-sm hidden lg:flex flex-col shadow-washi">
      {/* ロゴ */}
      <div className="p-5 border-b border-border/50">
        <Link href="/feed" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={120}
            height={48}
            className="h-10 w-auto"
            priority
          />
        </Link>
        <p className="text-[10px] text-muted-foreground mt-1 tracking-wider">盆栽愛好家のコミュニティ</p>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {allNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                      : 'text-foreground hover:bg-muted/70 hover:translate-x-1'
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {item.href === '/notifications' && (
                      <NotificationBadge className="absolute -top-2 -right-2" />
                    )}
                    {item.href === '/messages' && (
                      <MessageBadge className="absolute -top-2 -right-2" />
                    )}
                  </div>
                  <span className="text-sm flex items-center gap-1.5">
                    {item.label}
                    {item.premium && (
                      <CrownIcon className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 装飾ライン */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ログアウトボタン */}
      <div className="p-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-4 py-3 w-full rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all duration-200"
        >
          <LogOutIcon className="w-5 h-5" />
          <span className="text-sm">ログアウト</span>
        </button>
      </div>
    </aside>
  )
}
