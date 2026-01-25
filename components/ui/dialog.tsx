/**
 * ダイアログコンポーネント群 (Dialog)
 *
 * モーダルダイアログを表示するためのコンポーネント。
 * フォームの入力、詳細情報の表示、設定の編集などに使用します。
 * Radix UIの@radix-ui/react-dialogをベースにしています。
 *
 * AlertDialogとの違い:
 * - 背景クリックやEscキーで閉じることができる（よりカジュアルな用途）
 * - 閉じるボタン（X）が表示される
 *
 * @example 基本的な使い方
 * ```tsx
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>プロフィール編集</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>プロフィール編集</DialogTitle>
 *       <DialogDescription>
 *         プロフィール情報を編集できます。
 *       </DialogDescription>
 *     </DialogHeader>
 *     <form>
 *       {/* フォームの内容 *\/}
 *     </form>
 *     <DialogFooter>
 *       <Button type="submit">保存</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 *
 * @example 閉じるボタンを非表示
 * ```tsx
 * <DialogContent showCloseButton={false}>
 *   {/* 内容 *\/}
 * </DialogContent>
 * ```
 */

// ============================================================
// "use client" ディレクティブ
// ============================================================
// このコンポーネントはクライアントサイドで動作する必要があります
// （ダイアログの開閉状態管理、アニメーション、イベントハンドリングのため）
"use client"

// ============================================================
// インポート
// ============================================================

// React本体をインポート
import * as React from "react"

// Radix UIのDialogプリミティブ
// アクセシビリティ対応のダイアログ機能を提供
import * as DialogPrimitive from "@radix-ui/react-dialog"

// lucide-reactからXアイコンをインポート（閉じるボタン用）
import { XIcon } from "lucide-react"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

// ============================================================
// Dialog（ルートコンポーネント）
// ============================================================

/**
 * Dialog - ダイアログのルートコンポーネント
 *
 * ダイアログの開閉状態を管理するコンテナ。
 * 直接スタイルは持たず、状態管理のみを担当。
 *
 * @param props - Radix UIのDialog.Rootのプロパティ
 */
function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

// ============================================================
// DialogTrigger（トリガーボタン）
// ============================================================

/**
 * DialogTrigger - ダイアログを開くトリガー要素
 *
 * このコンポーネントをクリックするとダイアログが開きます。
 * asChildプロパティを使用して、既存のボタンをトリガーとして使用可能。
 *
 * @param props - Radix UIのDialog.Triggerのプロパティ
 */
function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

// ============================================================
// DialogPortal（ポータル）
// ============================================================

/**
 * DialogPortal - ダイアログをDOMの別の場所にレンダリング
 *
 * ダイアログをbody直下にレンダリングすることで、
 * z-indexの問題やスタイルの継承問題を回避します。
 *
 * @param props - Radix UIのDialog.Portalのプロパティ
 */
function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

// ============================================================
// DialogClose（閉じるボタン）
// ============================================================

/**
 * DialogClose - ダイアログを閉じるボタン
 *
 * このコンポーネントをクリックするとダイアログが閉じます。
 * DialogContent内のXボタンとは別に、追加の閉じるボタンが必要な場合に使用。
 *
 * @param props - Radix UIのDialog.Closeのプロパティ
 */
function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

// ============================================================
// DialogOverlay（オーバーレイ）
// ============================================================

/**
 * DialogOverlay - ダイアログの背景オーバーレイ
 *
 * ダイアログが開いているときに背景を暗くする半透明のレイヤー。
 * クリックするとダイアログが閉じます。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのDialog.Overlayのプロパティ
 */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        // ============================================================
        // アニメーション
        // ============================================================
        // data-[state=open]:animate-in: 開く時のアニメーション
        // data-[state=closed]:animate-out: 閉じる時のアニメーション
        // fade-in-0 / fade-out-0: フェード効果
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",

        // ============================================================
        // 配置とスタイル
        // ============================================================
        // fixed inset-0: 画面全体を覆う固定配置
        // z-50: 高いz-indexで他の要素より前面に
        // bg-black/50: 50%透明の黒背景
        "fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// DialogContent（コンテンツ）
// ============================================================

/**
 * DialogContent - ダイアログのメインコンテンツ
 *
 * ダイアログの本体部分。タイトル、フォーム、アクションボタンなどを含みます。
 * 画面中央に配置され、開閉時にアニメーションを伴います。
 * デフォルトで右上に閉じるボタン（X）が表示されます。
 *
 * @param className - 追加のCSSクラス
 * @param children - ダイアログの内容
 * @param showCloseButton - 閉じるボタンを表示するか（デフォルト: true）
 * @param props - Radix UIのDialog.Contentのプロパティ
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // ============================================================
          // 基本スタイル
          // ============================================================
          // bg-background: 背景色
          // fixed: 固定配置
          // top-[50%] left-[50%]: 画面中央に配置
          // translate-x-[-50%] translate-y-[-50%]: 中央寄せの調整
          // z-50: 高いz-index
          // grid: グリッドレイアウト
          // w-full max-w-[calc(100%-2rem)]: 幅（モバイルで余白確保）
          // sm:max-w-lg: デスクトップでの最大幅
          // gap-4: 子要素間のスペース
          // rounded-lg: 大きめの角丸
          // border: ボーダー
          // p-6: 内側の余白
          // shadow-lg: 影
          // duration-200: アニメーション時間
          // outline-none: アウトラインを削除
          "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",

          // ============================================================
          // 開閉アニメーション
          // ============================================================
          // フェード + ズーム効果
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {/* 閉じるボタン（showCloseButtonがtrueの場合のみ表示） */}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              // 配置: 右上に絶対配置
              "absolute top-4 right-4",
              // フォーカススタイル
              "ring-offset-background focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-hidden",
              // 通常スタイル
              "rounded-xs opacity-70 transition-opacity hover:opacity-100",
              // 開いている状態のスタイル
              "data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
              // 無効時のスタイル
              "disabled:pointer-events-none",
              // SVGアイコンのスタイル
              "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            )}
          >
            <XIcon />
            {/* スクリーンリーダー用のテキスト */}
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

// ============================================================
// DialogHeader（ヘッダー）
// ============================================================

/**
 * DialogHeader - ダイアログのヘッダー部分
 *
 * タイトルと説明文を配置するエリア。
 *
 * @param className - 追加のCSSクラス
 * @param props - div要素のプロパティ
 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        // flex flex-col: 縦方向のフレックスボックス
        // gap-2: 要素間のスペース
        // text-center sm:text-left: モバイルは中央揃え、デスクトップは左揃え
        "flex flex-col gap-2 text-center sm:text-left",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// DialogFooter（フッター）
// ============================================================

/**
 * DialogFooter - ダイアログのフッター部分
 *
 * アクションボタン（保存、キャンセルなど）を配置するエリア。
 *
 * @param className - 追加のCSSクラス
 * @param props - div要素のプロパティ
 */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // flex flex-col-reverse: モバイルでは縦方向で逆順
        // gap-2: ボタン間のスペース
        // sm:flex-row sm:justify-end: デスクトップでは横並びで右寄せ
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// DialogTitle（タイトル）
// ============================================================

/**
 * DialogTitle - ダイアログのタイトル
 *
 * ダイアログの主要なタイトルを表示。
 * アクセシビリティのため、スクリーンリーダーに適切に読み上げられます。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのDialog.Titleのプロパティ
 */
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        // text-lg: 大きめのフォントサイズ
        // leading-none: 行間なし
        // font-semibold: 太字
        "text-lg leading-none font-semibold",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// DialogDescription（説明文）
// ============================================================

/**
 * DialogDescription - ダイアログの説明文
 *
 * タイトルの補足説明を表示。
 * ダイアログの目的や使い方を伝えるために使用。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのDialog.Descriptionのプロパティ
 */
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        // text-muted-foreground: グレーのテキスト色
        // text-sm: 小さめのフォントサイズ
        "text-muted-foreground text-sm",
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
