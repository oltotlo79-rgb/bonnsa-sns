/**
 * テーマ切り替えコンポーネント
 *
 * このファイルは、ライト/ダーク/システムのテーマを切り替える
 * ボタンとセレクターを提供します。
 *
 * ## 機能概要
 * - ThemeToggle: クリックでテーマを順番に切り替え
 * - ThemeSelect: 3つのボタンで直接テーマを選択
 *
 * ## テーマ種類
 * - light: ライトモード
 * - dark: ダークモード
 * - system: OSの設定に従う
 *
 * @module components/theme/ThemeToggle
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * テーマコンテキストのカスタムHook
 * 現在のテーマ取得と変更に使用
 */
import { useTheme } from './ThemeProvider'

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 太陽アイコン（ライトモード用）
 *
 * @param className - 追加のCSSクラス
 */
function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

/**
 * 月アイコン（ダークモード用）
 *
 * @param className - 追加のCSSクラス
 */
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

/**
 * モニターアイコン（システム設定用）
 *
 * @param className - 追加のCSSクラス
 */
function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  )
}

// ============================================================
// 型定義
// ============================================================

/**
 * ThemeToggleコンポーネントのprops型
 *
 * @property showLabel - ラベルを表示するか
 * @property className - 追加のCSSクラス
 */
interface ThemeToggleProps {
  showLabel?: boolean
  className?: string
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * テーマトグルボタンコンポーネント
 *
 * ## 機能
 * - クリックでテーマを順番に切り替え
 * - light → dark → system → light の順
 * - 現在のテーマに応じたアイコンを表示
 *
 * @param showLabel - ラベル表示フラグ
 * @param className - 追加のCSSクラス
 *
 * @example
 * ```tsx
 * <ThemeToggle />
 * <ThemeToggle showLabel />
 * ```
 */
export function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * テーマコンテキストから現在のテーマと設定関数を取得
   */
  const { theme, setTheme } = useTheme()

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * テーマを順番に切り替え
   *
   * light → dark → system → light の順で循環
   */
  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  // ------------------------------------------------------------
  // ヘルパー関数
  // ------------------------------------------------------------

  /**
   * 現在のテーマに対応する日本語ラベルを取得
   */
  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'ライト'
      case 'dark':
        return 'ダーク'
      case 'system':
        return 'システム'
    }
  }

  /**
   * 現在のテーマに対応するアイコンコンポーネントを選択
   */
  const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <button
      onClick={cycleTheme}
      className={`flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors ${className}`}
      title={`現在: ${getLabel()}モード`}
    >
      <Icon className="w-5 h-5" />
      {showLabel && <span className="text-sm">{getLabel()}</span>}
    </button>
  )
}

// ============================================================
// テーマ選択コンポーネント
// ============================================================

/**
 * ThemeSelectコンポーネントのprops型
 *
 * @property className - 追加のCSSクラス
 */
interface ThemeSelectProps {
  className?: string
}

/**
 * テーマ選択コンポーネント
 *
 * ## 機能
 * - 3つのボタンで直接テーマを選択
 * - 設定画面などで使用
 *
 * ## 表示
 * - ライト（太陽アイコン）
 * - ダーク（月アイコン）
 * - 自動（モニターアイコン）
 *
 * @param className - 追加のCSSクラス
 *
 * @example
 * ```tsx
 * <ThemeSelect />
 * ```
 */
export function ThemeSelect({ className = '' }: ThemeSelectProps) {
  /**
   * テーマコンテキストから現在のテーマと設定関数を取得
   */
  const { theme, setTheme } = useTheme()

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* ラベル */}
      <label className="text-sm font-medium text-muted-foreground">テーマ</label>

      {/* テーマ選択ボタン群 */}
      <div className="flex gap-2">
        {/* ライトモードボタン */}
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'light'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          <SunIcon className="w-4 h-4" />
          <span className="text-sm">ライト</span>
        </button>

        {/* ダークモードボタン */}
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'dark'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          <MoonIcon className="w-4 h-4" />
          <span className="text-sm">ダーク</span>
        </button>

        {/* システム設定に従うボタン */}
        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'system'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          <MonitorIcon className="w-4 h-4" />
          <span className="text-sm">自動</span>
        </button>
      </div>
    </div>
  )
}
