/**
 * ボタンコンポーネント (Button)
 *
 * アプリケーション全体で使用する再利用可能なボタンコンポーネント。
 * variant（見た目のスタイル）とsize（サイズ）をプロパティで指定できます。
 * shadcn/uiベースで、class-variance-authority (cva) を使用してバリアントを管理しています。
 *
 * @example 基本的な使い方
 * ```tsx
 * // デフォルトボタン
 * <Button>クリック</Button>
 *
 * // アウトラインスタイル、大きいサイズ
 * <Button variant="outline" size="lg">保存</Button>
 *
 * // 削除ボタン（危険なアクション用）
 * <Button variant="destructive">削除</Button>
 *
 * // リンクとして使用（asChildを使ってNextのLinkコンポーネントをラップ）
 * <Button asChild>
 *   <Link href="/profile">プロフィール</Link>
 * </Button>
 * ```
 */

// ============================================================
// インポート
// ============================================================

// React本体をインポート - コンポーネント作成に必要
import * as React from "react"

// Radix UIのSlotコンポーネント - asChildパターンを実現するために使用
// asChildがtrueの場合、Buttonは子要素にpropsを渡すラッパーとして機能する
import { Slot } from "@radix-ui/react-slot"

// class-variance-authority (cva) - 条件付きクラス名を管理するユーティリティ
// VariantPropsは、cvaで定義したバリアントの型を取得するための型ヘルパー
import { cva, type VariantProps } from "class-variance-authority"

// クラス名を結合するユーティリティ関数
// Tailwind CSSのクラスを安全にマージできる（重複を解決）
import { cn } from "@/lib/utils"

// ============================================================
// ボタンのスタイル定義 (cva)
// ============================================================

/**
 * buttonVariants - ボタンのスタイルバリエーションを定義
 *
 * cva()の第1引数: 全てのボタンに共通で適用されるベーススタイル
 * cva()の第2引数: バリアント（variant, size）ごとの追加スタイル
 */
const buttonVariants = cva(
  // ============================================================
  // ベーススタイル（全ボタン共通）
  // ============================================================
  // inline-flex: インラインのフレックスボックスとして表示
  // items-center: 子要素を縦方向中央に配置
  // justify-center: 子要素を横方向中央に配置
  // gap-2: 子要素間にスペース（0.5rem）
  // whitespace-nowrap: テキストの折り返しを防止
  // rounded: 角丸（デフォルトの丸み）
  // text-sm: フォントサイズ小（14px）
  // font-medium: フォントの太さ中程度（500）
  // transition-all duration-200: 全プロパティに200msのアニメーション
  // disabled:pointer-events-none: 無効時はクリック不可
  // disabled:opacity-50: 無効時は半透明
  // [&_svg]:pointer-events-none: 内部のSVGアイコンはクリック不可
  // [&_svg:not([class*='size-'])]:size-4: sizeクラスがないSVGは16px四方
  // shrink-0: フレックスアイテムの縮小を防止
  // outline-none: デフォルトのアウトラインを削除
  // focus-visible:*: キーボードフォーカス時のスタイル
  // aria-invalid:*: バリデーションエラー時のスタイル
  // active:scale-[0.98]: クリック時に少し縮小するエフェクト
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    // ============================================================
    // バリアント定義
    // ============================================================
    variants: {
      /**
       * variant - ボタンの見た目のスタイル
       */
      variant: {
        // default: メインのアクションボタン（塗りつぶし、プライマリカラー）
        default: "bg-primary text-primary-foreground hover:bg-primary/85 shadow-sm hover:shadow",

        // destructive: 削除など危険なアクション用（赤系）
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",

        // outline: 枠線のみのボタン（セカンダリアクション向け）
        outline:
          "border border-border/80 bg-background shadow-xs hover:bg-muted/50 hover:border-primary/50 dark:bg-input/30 dark:border-input dark:hover:bg-input/50",

        // secondary: サブアクション用ボタン（グレー系の塗りつぶし）
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border/50",

        // ghost: 背景なしのボタン（ホバー時のみ背景表示）
        ghost:
          "hover:bg-muted/60 hover:text-foreground dark:hover:bg-accent/50",

        // link: リンクスタイル（下線付き、アクセントカラー）
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
      },

      /**
       * size - ボタンのサイズ
       */
      size: {
        // default: 通常サイズ（高さ36px）
        default: "h-9 px-4 py-2 has-[>svg]:px-3",

        // sm: 小さいサイズ（高さ32px）
        sm: "h-8 rounded gap-1.5 px-3 has-[>svg]:px-2.5",

        // lg: 大きいサイズ（高さ40px）
        lg: "h-10 rounded px-6 has-[>svg]:px-4",

        // icon: アイコンのみのボタン（正方形36px）
        icon: "size-9",

        // icon-sm: 小さいアイコンボタン（正方形32px）
        "icon-sm": "size-8",

        // icon-lg: 大きいアイコンボタン（正方形40px）
        "icon-lg": "size-10",
      },
    },

    // デフォルト値の設定
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// ============================================================
// Buttonコンポーネント
// ============================================================

/**
 * Button コンポーネント
 *
 * @param className - 追加のCSSクラス
 * @param variant - ボタンのスタイル種類 ("default" | "destructive" | "outline" | "secondary" | "ghost" | "link")
 * @param size - ボタンのサイズ ("default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg")
 * @param asChild - trueの場合、子要素をボタンとしてレンダリング（Linkコンポーネントなどと組み合わせ可能）
 * @param props - その他のHTML button要素の属性（onClick, disabled, typeなど）
 */
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &  // HTMLボタン要素の全プロパティを継承
  VariantProps<typeof buttonVariants> & {  // cvaで定義したvariantとsizeの型
    asChild?: boolean  // 子要素をボタンとして扱うかどうか
  }) {
  // asChildがtrueならSlot（子要素にpropsを渡す）、falseなら通常のbutton要素を使用
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      // data属性: CSSセレクタやテスト用に使用
      data-slot="button"
      data-variant={variant}
      data-size={size}
      // cn()でベースクラス、バリアントクラス、カスタムクラスを結合
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// ============================================================
// エクスポート
// ============================================================

// Button: コンポーネントとして使用
// buttonVariants: 他のコンポーネントでボタンスタイルを再利用する場合に使用
export { Button, buttonVariants }
