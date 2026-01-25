/**
 * @fileoverview 設定トップページ
 *
 * このファイルはユーザー設定のトップページコンポーネントです。
 * 各設定カテゴリ（プロフィール、アカウント、プラン管理）へのナビゲーションメニューと
 * テーマ切り替え機能を提供します。
 *
 * 主な機能:
 * - 設定カテゴリへのリンク一覧表示
 * - 各カテゴリのアイコンと説明文の表示
 * - ダークモード/ライトモードの切り替え機能
 *
 * @route /settings
 */

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'

// テーマ選択コンポーネント（ダーク/ライト/システム設定の切り替え用）
import { ThemeSelect } from '@/components/theme/ThemeToggle'

/**
 * 右矢印アイコンコンポーネント
 * リストアイテムの右端に表示し、クリック可能であることを示す
 *
 * @param {Object} props - コンポーネントのプロパティ
 * @param {string} [props.className] - 追加のCSSクラス
 * @returns {JSX.Element} SVGアイコン要素
 */
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

/**
 * ユーザーアイコンコンポーネント
 * プロフィール編集メニューのアイコンとして使用
 *
 * @param {Object} props - コンポーネントのプロパティ
 * @param {string} [props.className] - 追加のCSSクラス
 * @returns {JSX.Element} SVGアイコン要素
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
 * 設定アイコンコンポーネント
 * アカウント設定メニューのアイコンとして使用（歯車の形状）
 *
 * @param {Object} props - コンポーネントのプロパティ
 * @param {string} [props.className] - 追加のCSSクラス
 * @returns {JSX.Element} SVGアイコン要素
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
 * 王冠アイコンコンポーネント
 * プラン管理メニューのアイコンとして使用（プレミアム会員を表現）
 *
 * @param {Object} props - コンポーネントのプロパティ
 * @param {string} [props.className] - 追加のCSSクラス
 * @returns {JSX.Element} SVGアイコン要素
 */
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  )
}

/**
 * ユーザーリクエストアイコンコンポーネント
 * フォローリクエスト管理メニューのアイコンとして使用
 *
 * @param {Object} props - コンポーネントのプロパティ
 * @param {string} [props.className] - 追加のCSSクラス
 * @returns {JSX.Element} SVGアイコン要素
 */
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

/**
 * 静的メタデータの定義
 * ページタイトルの設定
 */
export const metadata = {
  title: '設定 - BON-LOG',
}

/**
 * 設定トップページのメインコンポーネント
 *
 * Server Componentとして動作し、設定メニューとテーマ切り替え機能を表示します。
 * 各メニューアイテムは対応する設定ページへのリンクになっています。
 *
 * @returns {JSX.Element} 設定ページのJSX要素
 */
export default function SettingsPage() {
  // 設定メニューアイテムの定義
  // 各アイテムはリンク先、アイコンコンポーネント、タイトル、説明を持つ
  const menuItems = [
    {
      href: '/settings/profile',      // プロフィール編集ページ
      icon: UserIcon,                  // ユーザーアイコン
      title: 'プロフィール編集',
      description: 'ニックネーム、自己紹介、プロフィール画像などを編集',
    },
    {
      href: '/settings/account',      // アカウント設定ページ
      icon: SettingsIcon,             // 歯車アイコン
      title: 'アカウント設定',
      description: '公開設定、アカウント削除など',
    },
    {
      href: '/settings/follow-requests', // フォローリクエスト管理ページ
      icon: UsersIcon,                   // ユーザーアイコン
      title: 'フォローリクエスト',
      description: '受信したフォローリクエストの確認・承認',
    },
    {
      href: '/settings/subscription', // プラン管理ページ
      icon: CrownIcon,                // 王冠アイコン
      title: 'プラン管理',
      description: 'プレミアム会員への登録、支払い履歴の確認',
    },
  ]

  // 設定ページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* メインメニューセクション */}
      <div className="bg-card rounded-lg border">
        <h1 className="px-4 py-3 font-bold text-lg border-b">設定</h1>

        {/* メニューアイテムリスト */}
        <div className="divide-y">
          {menuItems.map((item) => (
            // 各メニューアイテムは設定サブページへのリンク
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
            >
              {/* アイコン表示エリア */}
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <item.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              {/* タイトルと説明 */}
              <div className="flex-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              {/* 右矢印アイコン（クリック可能であることを示す） */}
              <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>

      {/* 表示設定セクション（テーマ切り替え） */}
      <div className="bg-card rounded-lg border">
        <h2 className="px-4 py-3 font-bold border-b">表示設定</h2>
        <div className="p-4">
          {/* テーマ選択コンポーネント（ダーク/ライト/システム設定） */}
          <ThemeSelect />
        </div>
      </div>
    </div>
  )
}
