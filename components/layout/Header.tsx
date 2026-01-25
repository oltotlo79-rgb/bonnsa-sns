/**
 * ヘッダーコンポーネント
 *
 * このファイルは、モバイル画面（lg未満）で表示される
 * 画面上部のヘッダーバーを提供します。
 *
 * ## 機能概要
 * - アプリロゴの表示とホームへのリンク
 * - プレミアム会員の場合は王冠アイコンを表示
 * - 設定ページへのリンク
 * - ログアウトボタン
 *
 * ## レスポンシブ対応
 * - lg未満: このコンポーネントを表示
 * - lg以上: 非表示（サイドバーナビゲーションを使用）
 *
 * ## 使用例
 * ```tsx
 * <Header userId={session?.user?.id} isPremium={user?.isPremium} />
 * ```
 *
 * @module components/layout/Header
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * Next.js リンクコンポーネント
 * クライアントサイドナビゲーションを提供し、
 * ページ遷移時のフルリロードを防ぐ
 */
import Link from 'next/link'

/**
 * Next.js 画像最適化コンポーネント
 * 自動的にWebP変換、遅延読み込み、サイズ最適化を行う
 */
import Image from 'next/image'

/**
 * ログアウトボタンコンポーネント
 * NextAuth.jsのsignOut機能をラップしたボタン
 */
import { LogoutButton } from '@/components/auth/LogoutButton'

// ============================================================
// 型定義
// ============================================================

/**
 * Headerコンポーネントのprops
 */
type HeaderProps = {
  /** 現在ログイン中のユーザーID（設定リンクの表示制御に使用） */
  userId?: string
  /** ユーザーがプレミアム会員かどうか（王冠アイコンの表示制御） */
  isPremium?: boolean
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 王冠アイコン
 *
 * プレミアム会員を示すために使用するSVGアイコン
 * 塗りつぶしと線の両方を使用した立体的なデザイン
 *
 * @param className - SVG要素に適用するCSSクラス
 */
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" className={className}>
      {/* 王冠の本体部分 */}
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      {/* 王冠の台座部分 */}
      <path d="M5 21h14" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * ヘッダーコンポーネント
 *
 * モバイル画面で表示される固定ヘッダー。
 * アプリロゴ、プレミアムバッジ、設定リンク、ログアウトボタンを含む。
 *
 * ## 表示条件
 * - lg未満の画面幅でのみ表示（lg以上ではhidden）
 *
 * ## スタイリング
 * - sticky positioning: スクロール時も画面上部に固定
 * - backdrop-blur: 背景のぼかし効果
 * - shadow-washi: 和紙風のシャドウ効果
 *
 * @param userId - ログイン中のユーザーID（設定リンクの表示制御）
 * @param isPremium - プレミアム会員フラグ（王冠アイコンの表示制御）
 */
export function Header({ userId, isPremium }: HeaderProps) {
  return (
    // ヘッダーコンテナ: sticky配置で画面上部に固定、lg以上で非表示
    <header className="sticky top-0 z-40 border-b border-border/50 bg-card/95 backdrop-blur-sm lg:hidden shadow-washi">
      {/* ヘッダー内部のレイアウト: 左右に分割 */}
      <div className="flex items-center justify-between h-14 px-4">
        {/* 左側: ロゴとプレミアムバッジ */}
        <Link href="/feed" className="flex items-center gap-2">
          {/* アプリロゴ: 優先読み込みで表示の遅延を防止 */}
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={100}
            height={40}
            className="h-8 w-auto"
            priority
          />
          {/* プレミアム会員の場合のみ王冠アイコンを表示 */}
          {isPremium && (
            <span className="text-amber-500" title="プレミアム会員">
              <CrownIcon className="w-4 h-4" />
            </span>
          )}
        </Link>

        {/* 右側: 設定リンクとログアウトボタン */}
        <div className="flex items-center gap-1">
          {/* 設定リンク: ログイン中のユーザーのみ表示 */}
          {userId && (
            <Link
              href="/settings"
              className="p-2.5 text-muted-foreground hover:text-primary hover:bg-muted/50 rounded transition-all duration-200"
            >
              {/* 設定アイコン（歯車） */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Link>
          )}
          {/* ログアウトボタン */}
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
