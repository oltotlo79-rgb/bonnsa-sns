/**
 * モバイルナビゲーションコンポーネント
 *
 * このファイルは、モバイル画面（lg未満）で表示される
 * 画面下部のナビゲーションバーを提供します。
 *
 * ## 機能概要
 * - 主要ページへのナビゲーション（ホーム、検索、通知、メッセージ）
 * - 「もっと見る」メニューで追加のページにアクセス
 * - 通知/メッセージの未読バッジ表示
 * - 現在のページをハイライト表示
 *
 * ## レスポンシブ対応
 * - lg未満: このコンポーネントを表示
 * - lg以上: 非表示（サイドバーナビゲーションを使用）
 *
 * ## 使用例
 * ```tsx
 * <MobileNav userId={session?.user?.id} />
 * ```
 *
 * @module components/layout/MobileNav
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React hooks
 * - useState: コンポーネント内の状態管理
 * - useEffect: 副作用の処理（イベントリスナーなど）
 * - useRef: DOM要素への参照
 */
import { useState, useEffect, useRef } from 'react'

/**
 * Next.js リンクコンポーネント
 * クライアントサイドナビゲーションを提供
 */
import Link from 'next/link'

/**
 * Next.js 現在のパス取得フック
 * アクティブなナビゲーション項目の判定に使用
 */
import { usePathname } from 'next/navigation'

/**
 * 通知/メッセージバッジコンポーネント
 * 未読数を表示
 */
import { NotificationBadge } from '@/components/notification/NotificationBadge'
import { MessageBadge } from '@/components/message/MessageBadge'

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * ホームアイコン
 *
 * タイムライン/ホームページへのナビゲーションに使用
 */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

/** 検索アイコン */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/** ベルアイコン（通知用） */
function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

/** メッセージアイコン（DM用） */
function MessageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

/** もっと見るアイコン（縦三点リーダー） */
function MoreIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}

/** ユーザーアイコン（プロフィール用） */
function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

/** マップピンアイコン（盆栽園マップ用） */
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

/** カレンダーアイコン（イベント用） */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

/** ブックマークアイコン */
function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  )
}

/** 設定アイコン */
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** ファイルテキストアイコン（利用規約用） */
function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  )
}

/** シールドアイコン（プライバシー用） */
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  )
}

/** ヘルプアイコン */
function HelpCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}

/** 盆栽アイコン（マイ盆栽用） */
function BonsaiIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3c-3 2-5 5-5 8 0 2 1 3.5 3 4.5" />
      <path d="M12 3c3 2 5 5 5 8 0 2-1 3.5-3 4.5" />
      <path d="M12 15v4" />
      <rect x="7" y="19" width="10" height="3" rx="1" />
    </svg>
  )
}

/** カレンダープラスアイコン（予約投稿用） */
function CalendarPlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <line x1="19" x2="19" y1="16" y2="22" />
      <line x1="16" x2="22" y1="19" y2="19" />
    </svg>
  )
}

/** バーチャートアイコン（投稿分析用） */
function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  )
}

/** クラウンアイコン（プレミアム機能用） */
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  )
}

// ============================================================
// 型定義
// ============================================================

/**
 * ナビゲーション項目の型
 *
 * 各ナビゲーションリンクの情報を定義
 */
type NavItem = {
  /** リンク先のパス */
  href: string
  /** アイコンコンポーネント */
  icon: React.FC<{ className?: string }>
  /** 表示ラベル */
  label: string
  /** プレミアム機能かどうか */
  premium?: boolean
}

// ============================================================
// 定数
// ============================================================

/**
 * 基本ナビゲーション項目
 *
 * ナビゲーションバーに直接表示される主要な項目
 */
const baseNavItems: NavItem[] = [
  { href: '/feed', icon: HomeIcon, label: 'ホーム' },
  { href: '/search', icon: SearchIcon, label: '検索' },
  { href: '/notifications', icon: BellIcon, label: '通知' },
  { href: '/messages', icon: MessageIcon, label: 'メッセージ' },
]

/**
 * もっと見るメニュー内の項目
 *
 * 「もっと見る」ボタンをタップすると表示される追加メニュー
 */
const moreMenuItems: NavItem[] = [
  { href: '/bonsai', icon: BonsaiIcon, label: 'マイ盆栽' },
  { href: '/shops', icon: MapPinIcon, label: '盆栽園マップ' },
  { href: '/events', icon: CalendarIcon, label: 'イベント' },
  { href: '/bookmarks', icon: BookmarkIcon, label: 'ブックマーク' },
  { href: '/settings', icon: SettingsIcon, label: '設定' },
]

/**
 * フッターリンク
 *
 * もっと見るメニューの下部に表示される法的リンクなど
 */
const footerLinks: NavItem[] = [
  { href: '/terms', icon: FileTextIcon, label: '利用規約' },
  { href: '/privacy', icon: ShieldIcon, label: 'プライバシー' },
  { href: '/tokushoho', icon: FileTextIcon, label: '特商法表記' },
  { href: '/help', icon: HelpCircleIcon, label: 'ヘルプ' },
]

/**
 * MobileNavコンポーネントのProps
 */
type MobileNavProps = {
  /** 現在ログイン中のユーザーID（プロフィールリンクに使用） */
  userId?: string
  /** プレミアム会員かどうか */
  isPremium?: boolean
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * モバイルナビゲーションコンポーネント
 *
 * ## 機能
 * - 主要ページへのナビゲーションリンク
 * - 「もっと見る」ドロップダウンメニュー
 * - 通知/メッセージの未読バッジ
 * - 現在ページのハイライト表示
 *
 * ## 状態管理
 * - showMoreMenu: ドロップダウンメニューの表示状態
 *
 * ## 副作用
 * - メニュー外クリックで閉じる処理
 * - ページ遷移時にメニューを閉じる処理
 */
export function MobileNav({ userId, isPremium = false }: MobileNavProps) {
  const pathname = usePathname()
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // デバッグ用ログ
  console.log('[MobileNav] isPremium:', isPremium)

  // プレミアム会員専用メニュー項目
  const premiumMenuItems: NavItem[] = isPremium
    ? [
        { href: '/posts/scheduled', icon: CalendarPlusIcon, label: '予約投稿', premium: true },
        { href: '/analytics', icon: BarChartIcon, label: '投稿分析', premium: true },
      ]
    : []

  // メニュー外をクリックしたら閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMoreMenu])

  // ページ遷移時にメニューを閉じる（開いている場合のみ）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ナビゲーション時のメニュー閉じ処理
    setShowMoreMenu((prev) => (prev ? false : prev))
  }, [pathname])

  // もっと見るメニュー内のいずれかがアクティブかどうか
  const isMoreMenuActive = [...moreMenuItems, ...premiumMenuItems].some(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  ) || (userId && (pathname === `/users/${userId}` || pathname.startsWith(`/users/${userId}/`)))

  // プロフィールリンク（動的）
  const profileItem: NavItem = {
    href: userId ? `/users/${userId}` : '/settings',
    icon: UserIcon,
    label: 'プロフィール',
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border/50 lg:hidden z-50 shadow-washi">
      <div className="flex items-center justify-around h-16">
        {baseNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`relative p-1.5 rounded transition-all duration-200 ${
                isActive ? 'bg-primary/10' : ''
              }`}>
                <Icon className="w-5 h-5" />
                {item.href === '/notifications' && (
                  <NotificationBadge className="absolute -top-0.5 -right-1" />
                )}
                {item.href === '/messages' && (
                  <MessageBadge className="absolute -top-0.5 -right-1" />
                )}
              </div>
              <span className={`text-[10px] mt-0.5 ${isActive ? 'font-medium' : ''}`}>{item.label}</span>
            </Link>
          )
        })}

        {/* もっと見るボタン */}
        <div className="relative flex-1 h-full" ref={menuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${
              isMoreMenuActive || showMoreMenu
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className={`relative p-1.5 rounded transition-all duration-200 ${
              isMoreMenuActive || showMoreMenu ? 'bg-primary/10' : ''
            }`}>
              <MoreIcon className="w-5 h-5" />
            </div>
            <span className={`text-[10px] mt-0.5 ${isMoreMenuActive ? 'font-medium' : ''}`}>もっと見る</span>
          </button>

          {/* もっと見るメニュー */}
          {showMoreMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-card rounded-lg shadow-lg border overflow-hidden">
              {/* プロフィール */}
              <Link
                href={profileItem.href}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors ${
                  pathname === profileItem.href || pathname.startsWith(profileItem.href + '/')
                    ? 'text-primary bg-primary/5'
                    : ''
                }`}
              >
                <UserIcon className="w-5 h-5" />
                <span className="text-sm">{profileItem.label}</span>
              </Link>

              {/* プレミアム会員専用メニュー */}
              {premiumMenuItems.length > 0 && (
                <>
                  <div className="border-t" />
                  {premiumMenuItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = item.icon

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors ${
                          isActive ? 'text-primary bg-primary/5' : ''
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm flex-1">{item.label}</span>
                        <CrownIcon className="w-4 h-4 text-yellow-500" />
                      </Link>
                    )
                  })}
                </>
              )}

              <div className="border-t" />

              {/* その他のメニュー項目 */}
              {moreMenuItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors ${
                      isActive ? 'text-primary bg-primary/5' : ''
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                )
              })}

              <div className="border-t" />

              {/* フッターリンク */}
              {footerLinks.map((item) => {
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
