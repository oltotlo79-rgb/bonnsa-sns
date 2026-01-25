/**
 * テキスト入力コンポーネント (Input)
 *
 * フォームで使用する単一行のテキスト入力フィールド。
 * HTML の <input> 要素をラップし、統一されたスタイルを適用しています。
 * テキスト、メール、パスワード、数値など様々なtypeに対応。
 *
 * @example 基本的な使い方
 * ```tsx
 * // 通常のテキスト入力
 * <Input placeholder="名前を入力" />
 *
 * // メールアドレス入力
 * <Input type="email" placeholder="example@email.com" />
 *
 * // パスワード入力
 * <Input type="password" placeholder="パスワード" />
 *
 * // 無効化された入力
 * <Input disabled placeholder="編集不可" />
 *
 * // バリデーションエラー状態
 * <Input aria-invalid="true" placeholder="エラー" />
 * ```
 */

// ============================================================
// インポート
// ============================================================

// React本体をインポート - コンポーネント作成に必要
import * as React from "react"

// クラス名を結合するユーティリティ関数
// 複数のTailwind CSSクラスを安全にマージできる
import { cn } from "@/lib/utils"

// ============================================================
// Inputコンポーネント
// ============================================================

/**
 * Input コンポーネント
 *
 * @param className - 追加のCSSクラス（デフォルトスタイルを上書き可能）
 * @param type - 入力タイプ（"text", "email", "password", "number"など）
 * @param props - その他のHTML input要素の属性（placeholder, disabled, onChange, valueなど）
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      // data-slot: CSSセレクタやJavaScriptでの要素特定用
      data-slot="input"
      className={cn(
        // ============================================================
        // 基本スタイル
        // ============================================================
        // file:text-foreground: ファイル入力のテキスト色
        // placeholder:text-muted-foreground/70: プレースホルダーは薄いグレー
        // selection:bg-primary selection:text-primary-foreground: テキスト選択時の色
        // dark:bg-input/30: ダークモード時の背景色
        // border-border/80: 少し薄めのボーダー色
        // h-9: 高さ36px
        // w-full: 幅100%
        // min-w-0: flexbox内で縮小可能に
        // rounded: 角丸
        // border: ボーダーあり
        // bg-card/50: 半透明の背景
        // px-3 py-1: 内側の余白
        // text-base: フォントサイズ（16px）- モバイルでズームを防ぐ
        // shadow-xs: 薄い影
        // transition-all duration-200: 全プロパティに200msのアニメーション
        // outline-none: デフォルトのアウトラインを削除
        "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-border/80 h-9 w-full min-w-0 rounded border bg-card/50 px-3 py-1 text-base shadow-xs transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",

        // ============================================================
        // フォーカス時のスタイル
        // ============================================================
        // focus-visible:border-primary: フォーカス時はプライマリカラーのボーダー
        // focus-visible:ring-primary/20: プライマリカラーの薄いリング
        // focus-visible:ring-[3px]: リングの太さ3px
        // focus-visible:bg-card: フォーカス時は背景を不透明に
        "focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px] focus-visible:bg-card",

        // ============================================================
        // ホバー時のスタイル
        // ============================================================
        // hover:border-border: ホバー時はボーダーを少し濃く
        // hover:bg-card/80: ホバー時は背景を少し濃く
        "hover:border-border hover:bg-card/80",

        // ============================================================
        // バリデーションエラー時のスタイル (aria-invalid="true" 使用時)
        // ============================================================
        // aria-invalid:ring-destructive/20: エラー時は赤いリング
        // aria-invalid:border-destructive: エラー時は赤いボーダー
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",

        // 追加のカスタムクラスを適用
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// エクスポート
// ============================================================

export { Input }
