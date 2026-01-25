/**
 * テーマ切り替えコンポーネント
 *
 * このファイルは、ライト/ダーク/システムのテーマを切り替える
 * ボタンとセレクターを提供します。
 *
 * ## 機能概要
 * - ThemeToggle: クリックでテーマを順番に切り替え（トグルボタン）
 * - ThemeSelect: 3つのボタンで直接テーマを選択（設定画面用）
 *
 * ## テーマ種類
 * - light: ライトモード（明るい背景）
 * - dark: ダークモード（暗い背景）
 * - system: OSの設定に従う
 *
 * ## 使用例
 * ```tsx
 * // ヘッダーでのトグルボタン使用
 * import { ThemeToggle } from '@/components/theme/ThemeToggle'
 *
 * function Header() {
 *   return (
 *     <header>
 *       <ThemeToggle />
 *       <ThemeToggle showLabel />
 *     </header>
 *   )
 * }
 *
 * // 設定画面でのセレクター使用
 * import { ThemeSelect } from '@/components/theme/ThemeToggle'
 *
 * function SettingsPage() {
 *   return (
 *     <div>
 *       <h2>表示設定</h2>
 *       <ThemeSelect />
 *     </div>
 *   )
 * }
 * ```
 *
 * @module components/theme/ThemeToggle
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * テーマコンテキストのカスタムHook
 *
 * @description
 * ThemeProviderから提供されるテーマ情報にアクセスするためのフック
 * - theme: 現在のテーマ設定（light/dark/system）
 * - resolvedTheme: 実際に適用されているテーマ（light/dark）
 * - setTheme: テーマを変更する関数
 *
 * @see ThemeProvider.tsx
 */
import { useTheme } from './ThemeProvider'

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 太陽アイコン（ライトモード用）
 *
 * @description
 * SVGで描画された太陽のアイコン
 * ライトモードを示すために使用される
 * 中央の円と放射状の8本の光線で構成
 *
 * @param className - 追加のCSSクラス（サイズ調整などに使用）
 * @returns SVG要素
 *
 * @example
 * ```tsx
 * <SunIcon className="w-5 h-5" />
 * ```
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
      {/* 太陽の本体（円） */}
      <circle cx="12" cy="12" r="4" />
      {/* 光線（上下左右および斜め4方向） */}
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
 * @description
 * SVGで描画された三日月のアイコン
 * ダークモードを示すために使用される
 * 円弧を組み合わせた三日月形状
 *
 * @param className - 追加のCSSクラス（サイズ調整などに使用）
 * @returns SVG要素
 *
 * @example
 * ```tsx
 * <MoonIcon className="w-5 h-5" />
 * ```
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
      {/* 三日月形状のパス */}
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

/**
 * モニターアイコン（システム設定用）
 *
 * @description
 * SVGで描画されたPCモニターのアイコン
 * システム設定に従う（自動）モードを示すために使用される
 * モニター本体とスタンドで構成
 *
 * @param className - 追加のCSSクラス（サイズ調整などに使用）
 * @returns SVG要素
 *
 * @example
 * ```tsx
 * <MonitorIcon className="w-5 h-5" />
 * ```
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
      {/* モニター画面部分 */}
      <rect width="20" height="14" x="2" y="3" rx="2" />
      {/* スタンドの底辺 */}
      <line x1="8" x2="16" y1="21" y2="21" />
      {/* スタンドの支柱 */}
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
 * @property showLabel - テーマ名のラベルを表示するかどうか
 *                       true: アイコンの横にテーマ名を表示
 *                       false: アイコンのみ表示（デフォルト）
 * @property className - 追加のCSSクラス
 *                       ボタンの外観をカスタマイズする際に使用
 */
interface ThemeToggleProps {
  /** テーマ名のラベルを表示するかどうか（デフォルト: false） */
  showLabel?: boolean
  /** 追加のCSSクラス */
  className?: string
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * テーマトグルボタンコンポーネント
 *
 * クリックするたびにテーマが順番に切り替わるトグルボタン。
 * ヘッダーやサイドバーに配置して、ユーザーが手軽にテーマを
 * 切り替えられるようにするために使用します。
 *
 * ## 動作
 * - クリックでテーマを順番に切り替え
 * - light → dark → system → light の順で循環
 * - 現在のテーマに応じたアイコンを表示
 *
 * ## アイコン
 * - light: 太陽アイコン
 * - dark: 月アイコン
 * - system: モニターアイコン
 *
 * @param showLabel - ラベル表示フラグ（デフォルト: false）
 * @param className - 追加のCSSクラス
 * @returns テーマトグルボタンのJSX
 *
 * @example
 * ```tsx
 * // アイコンのみ
 * <ThemeToggle />
 *
 * // ラベル付き
 * <ThemeToggle showLabel />
 *
 * // カスタムクラス付き
 * <ThemeToggle className="ml-4" />
 * ```
 */
export function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  // ============================================================
  // Hooks
  // ============================================================

  /**
   * テーマコンテキストから現在のテーマと設定関数を取得
   *
   * @description
   * - theme: 現在選択されているテーマ（light/dark/system）
   * - setTheme: テーマを変更する関数
   */
  const { theme, setTheme } = useTheme()

  // ============================================================
  // イベントハンドラ
  // ============================================================

  /**
   * テーマを順番に切り替えるイベントハンドラ
   *
   * @description
   * ボタンクリック時に呼び出され、テーマを次の状態に切り替える
   * 循環順序: light → dark → system → light
   *
   * この循環順序の理由:
   * 1. light と dark は直感的な対比
   * 2. system は「どちらでもない」中間的な選択肢として最後に配置
   * 3. 3回クリックで元のテーマに戻れる
   */
  const cycleTheme = () => {
    if (theme === 'light') {
      // ライト → ダーク
      setTheme('dark')
    } else if (theme === 'dark') {
      // ダーク → システム
      setTheme('system')
    } else {
      // システム → ライト
      setTheme('light')
    }
  }

  // ============================================================
  // ヘルパー関数
  // ============================================================

  /**
   * 現在のテーマに対応する日本語ラベルを取得
   *
   * @returns 'ライト' | 'ダーク' | 'システム'
   *
   * @description
   * UIに表示するための日本語テキストを返す
   * showLabel=true の場合と title属性 に使用
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
   *
   * @description
   * テーマに応じて適切なアイコンコンポーネントを返す
   * - light → SunIcon（太陽）
   * - dark → MoonIcon（月）
   * - system → MonitorIcon（モニター）
   */
  const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon

  // ============================================================
  // レンダリング
  // ============================================================

  return (
    <button
      onClick={cycleTheme}
      className={`flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors ${className}`}
      title={`現在: ${getLabel()}モード`}
      aria-label={`テーマを切り替える（現在: ${getLabel()}モード）`}
    >
      {/* テーマに応じたアイコンを表示 */}
      <Icon className="w-5 h-5" />
      {/* showLabel=true の場合のみラベルを表示 */}
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
 *                       コンテナの外観をカスタマイズする際に使用
 */
interface ThemeSelectProps {
  /** 追加のCSSクラス */
  className?: string
}

/**
 * テーマ選択コンポーネント
 *
 * 3つのボタンで直接テーマを選択できるセレクターコンポーネント。
 * 設定画面など、ユーザーがテーマを明確に選択する場面で使用します。
 *
 * ## 表示
 * - 「テーマ」ラベル
 * - ライト（太陽アイコン）- 明るい背景
 * - ダーク（月アイコン）- 暗い背景
 * - 自動（モニターアイコン）- OSの設定に従う
 *
 * ## スタイル
 * - 選択中のボタンはprimary色で強調表示
 * - 未選択のボタンはmuted色で表示
 * - ホバー時に背景色が変化
 *
 * @param className - 追加のCSSクラス
 * @returns テーマ選択UIのJSX
 *
 * @example
 * ```tsx
 * // 基本的な使用
 * <ThemeSelect />
 *
 * // カスタムクラス付き
 * <ThemeSelect className="mt-4" />
 * ```
 */
export function ThemeSelect({ className = '' }: ThemeSelectProps) {
  /**
   * テーマコンテキストから現在のテーマと設定関数を取得
   *
   * @description
   * - theme: 現在選択されているテーマ（light/dark/system）
   * - setTheme: テーマを変更する関数
   */
  const { theme, setTheme } = useTheme()

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* セクションラベル */}
      <label className="text-sm font-medium text-muted-foreground">テーマ</label>

      {/* テーマ選択ボタン群 */}
      <div className="flex gap-2">
        {/* ライトモードボタン */}
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'light'
              ? 'bg-primary text-primary-foreground' // 選択中: primary色
              : 'bg-muted hover:bg-muted/80'          // 未選択: muted色
          }`}
          aria-pressed={theme === 'light'}
          aria-label="ライトモードに設定"
        >
          <SunIcon className="w-4 h-4" />
          <span className="text-sm">ライト</span>
        </button>

        {/* ダークモードボタン */}
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'dark'
              ? 'bg-primary text-primary-foreground' // 選択中: primary色
              : 'bg-muted hover:bg-muted/80'          // 未選択: muted色
          }`}
          aria-pressed={theme === 'dark'}
          aria-label="ダークモードに設定"
        >
          <MoonIcon className="w-4 h-4" />
          <span className="text-sm">ダーク</span>
        </button>

        {/* システム設定に従うボタン */}
        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'system'
              ? 'bg-primary text-primary-foreground' // 選択中: primary色
              : 'bg-muted hover:bg-muted/80'          // 未選択: muted色
          }`}
          aria-pressed={theme === 'system'}
          aria-label="システム設定に従う"
        >
          <MonitorIcon className="w-4 h-4" />
          <span className="text-sm">自動</span>
        </button>
      </div>
    </div>
  )
}
