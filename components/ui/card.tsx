/**
 * カードコンポーネント群 (Card)
 *
 * 情報をグループ化して表示するためのコンテナコンポーネント。
 * 投稿、プロフィール、設定項目など、関連する情報をまとめて表示する際に使用します。
 * 和紙のような質感の影（shadow-washi）を持つ、盆栽SNSのデザインに合わせた外観です。
 *
 * @example 基本的な使い方
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>投稿タイトル</CardTitle>
 *     <CardDescription>投稿の説明文</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     ここにメインコンテンツを配置
 *   </CardContent>
 *   <CardFooter>
 *     <Button>アクション</Button>
 *   </CardFooter>
 * </Card>
 * ```
 *
 * @example アクションボタン付きカード
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>設定</CardTitle>
 *     <CardDescription>アカウント設定</CardDescription>
 *     <CardAction>
 *       <Button variant="outline" size="sm">編集</Button>
 *     </CardAction>
 *   </CardHeader>
 *   <CardContent>設定内容...</CardContent>
 * </Card>
 * ```
 */

// ============================================================
// インポート
// ============================================================

// React本体をインポート - コンポーネント作成に必要
import * as React from "react"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

// ============================================================
// Card（カード本体）
// ============================================================

/**
 * Card - カードのルートコンポーネント
 *
 * カード全体を囲むコンテナ。背景色、ボーダー、影などの外観を定義。
 * 上部にプライマリカラーのグラデーションラインが入る装飾付き。
 *
 * @param className - 追加のCSSクラス
 * @param props - その他のdiv要素の属性
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        // ============================================================
        // 基本スタイル
        // ============================================================
        // bg-card/95: カード背景色（95%不透明）
        // backdrop-blur-sm: 背景のぼかし効果
        // text-card-foreground: カード内テキスト色
        // flex flex-col: 縦方向のフレックスボックス
        // gap-6: 子要素間のスペース（1.5rem）
        // rounded: 角丸
        // border border-border/60: 薄めのボーダー
        // py-6: 上下の内側余白（1.5rem）
        // shadow-washi: 和紙風の柔らかい影（カスタム定義）
        // relative overflow-hidden: 装飾用の疑似要素のため
        "bg-card/95 backdrop-blur-sm text-card-foreground flex flex-col gap-6 rounded border border-border/60 py-6 shadow-washi relative overflow-hidden",

        // ============================================================
        // 装飾: 上部のグラデーションライン
        // ============================================================
        // before:*: CSS疑似要素（::before）でラインを描画
        // 左右から透明、中央がプライマリカラーのグラデーション
        "before:absolute before:top-0 before:left-2 before:right-2 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-primary/50 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// CardHeader（カードヘッダー）
// ============================================================

/**
 * CardHeader - カードのヘッダー部分
 *
 * タイトル、説明文、アクションボタンを配置するエリア。
 * CSS Gridを使用して、タイトル・説明（左）とアクション（右）を配置。
 *
 * @param className - 追加のCSSクラス
 * @param props - その他のdiv要素の属性
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        // @container/card-header: コンテナクエリ用のコンテナ定義
        // grid: CSSグリッドレイアウト
        // auto-rows-min: 行の高さを自動で最小に
        // grid-rows-[auto_auto]: 2行のグリッド
        // items-start: 子要素を上揃え
        // gap-2: 要素間のスペース
        // px-6: 左右の内側余白
        // has-data-[slot=card-action]:grid-cols-[1fr_auto]:
        //   CardActionがある場合は2カラム（メイン+アクション）に
        // [.border-b]:pb-6: border-bクラスがある場合は下余白追加
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// CardTitle（カードタイトル）
// ============================================================

/**
 * CardTitle - カードのタイトル
 *
 * カードのメインタイトルを表示するコンポーネント。
 *
 * @param className - 追加のCSSクラス
 * @param props - その他のdiv要素の属性
 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        // leading-none: 行間なし
        // font-semibold: 太字（600）
        "leading-none font-semibold",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// CardDescription（カード説明文）
// ============================================================

/**
 * CardDescription - カードの説明文
 *
 * タイトルの補足説明を表示するコンポーネント。
 * グレーの小さめのテキストで表示。
 *
 * @param className - 追加のCSSクラス
 * @param props - その他のdiv要素の属性
 */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        // text-muted-foreground: グレーのテキスト色
        // text-sm: 小さいフォントサイズ
        "text-muted-foreground text-sm",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// CardAction（カードアクション）
// ============================================================

/**
 * CardAction - カードのアクションボタン配置エリア
 *
 * CardHeader内で右上に配置されるアクションボタン用のコンテナ。
 * 編集ボタン、メニューボタンなどを配置。
 *
 * @param className - 追加のCSSクラス
 * @param props - その他のdiv要素の属性
 */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        // col-start-2: グリッドの2列目に配置
        // row-span-2: 2行分の高さを占める
        // row-start-1: 1行目から開始
        // self-start: 上揃え
        // justify-self-end: 右揃え
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// CardContent（カードコンテンツ）
// ============================================================

/**
 * CardContent - カードのメインコンテンツエリア
 *
 * カードの主要な内容を配置するエリア。
 *
 * @param className - 追加のCSSクラス
 * @param props - その他のdiv要素の属性
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        // px-6: 左右の内側余白
        "px-6",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// CardFooter（カードフッター）
// ============================================================

/**
 * CardFooter - カードのフッター部分
 *
 * カードの最下部に配置するアクションボタンや補足情報用のエリア。
 *
 * @param className - 追加のCSSクラス
 * @param props - その他のdiv要素の属性
 */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        // flex items-center: フレックスボックスで縦方向中央揃え
        // px-6: 左右の内側余白
        // [.border-t]:pt-6: border-tクラスがある場合は上余白追加
        "flex items-center px-6 [.border-t]:pt-6",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// エクスポート
// ============================================================

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
