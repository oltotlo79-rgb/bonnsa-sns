/**
 * バッジコンポーネント (Badge)
 *
 * ラベル、タグ、ステータス表示などに使用する小さなインジケーター。
 * カテゴリー、ジャンル、ステータス（新着、完了など）の表示に最適です。
 *
 * @example 基本的な使い方
 * ```tsx
 * // デフォルト（プライマリカラー）
 * <Badge>新着</Badge>
 *
 * // セカンダリ（グレー系）
 * <Badge variant="secondary">下書き</Badge>
 *
 * // アウトライン（枠線のみ）
 * <Badge variant="outline">松柏類</Badge>
 *
 * // 危険・エラー表示
 * <Badge variant="destructive">削除予定</Badge>
 * ```
 *
 * @example リンクとして使用（asChildパターン）
 * ```tsx
 * <Badge asChild>
 *   <Link href="/category/bonsai">盆栽</Link>
 * </Badge>
 * ```
 *
 * @example アイコン付き
 * ```tsx
 * <Badge>
 *   <TreesIcon className="h-3 w-3" />
 *   松柏類
 * </Badge>
 * ```
 */

// ============================================================
// インポート
// ============================================================

// React本体をインポート - コンポーネント作成に必要
import * as React from "react"

// Radix UIのSlotコンポーネント - asChildパターンを実現するために使用
import { Slot } from "@radix-ui/react-slot"

// class-variance-authority (cva) - 条件付きクラス名を管理するユーティリティ
import { cva, type VariantProps } from "class-variance-authority"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

// ============================================================
// バッジのスタイル定義 (cva)
// ============================================================

/**
 * badgeVariants - バッジのスタイルバリエーションを定義
 */
const badgeVariants = cva(
  // ============================================================
  // ベーススタイル（全バッジ共通）
  // ============================================================
  // inline-flex items-center justify-center: インラインフレックスで中央揃え
  // rounded-full: 完全な丸角（ピル型）
  // border: ボーダー
  // px-2 py-0.5: 内側の余白
  // text-xs: フォントサイズ極小
  // font-medium: 中太字
  // w-fit: 内容に合わせた幅
  // whitespace-nowrap: テキストの折り返しを防止
  // shrink-0: フレックスアイテムの縮小を防止
  // [&>svg]:size-3: アイコンサイズ12px
  // gap-1: アイコンとテキスト間のスペース
  // [&>svg]:pointer-events-none: アイコンはクリック不可
  // focus-visible:*: キーボードフォーカス時のスタイル
  // aria-invalid:*: バリデーションエラー時のスタイル
  // transition-[color,box-shadow]: 色と影のトランジション
  // overflow-hidden: はみ出す部分を非表示
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    // ============================================================
    // バリアント定義
    // ============================================================
    variants: {
      /**
       * variant - バッジの見た目のスタイル
       */
      variant: {
        // default: メインのバッジ（塗りつぶし、プライマリカラー）
        // [a&]:hover:bg-primary/90: リンクの場合のホバースタイル
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",

        // secondary: サブ的なバッジ（グレー系）
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",

        // destructive: 危険・エラー表示用（赤系）
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",

        // outline: 枠線のみのバッジ
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },

    // デフォルト値の設定
    defaultVariants: {
      variant: "default",
    },
  }
)

// ============================================================
// Badgeコンポーネント
// ============================================================

/**
 * Badge コンポーネント
 *
 * @param className - 追加のCSSクラス
 * @param variant - バッジのスタイル種類 ("default" | "secondary" | "destructive" | "outline")
 * @param asChild - trueの場合、子要素をバッジとしてレンダリング（Linkコンポーネントなどと組み合わせ可能）
 * @param props - その他のspan要素の属性
 */
function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  // asChildがtrueならSlot（子要素にpropsを渡す）、falseなら通常のspan要素を使用
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

// ============================================================
// エクスポート
// ============================================================

// Badge: コンポーネントとして使用
// badgeVariants: 他のコンポーネントでバッジスタイルを再利用する場合に使用
export { Badge, badgeVariants }
