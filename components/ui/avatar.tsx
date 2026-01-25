/**
 * アバターコンポーネント群 (Avatar)
 *
 * ユーザーのプロフィール画像を表示するためのコンポーネント。
 * 画像が読み込めない場合のフォールバック（代替表示）機能を備えています。
 * Radix UIの@radix-ui/react-avatarをベースにしています。
 *
 * @example 基本的な使い方
 * ```tsx
 * <Avatar>
 *   <AvatarImage src="/user.jpg" alt="ユーザー名" />
 *   <AvatarFallback>U</AvatarFallback>
 * </Avatar>
 * ```
 *
 * @example サイズを変更（classNameで上書き）
 * ```tsx
 * <Avatar className="h-16 w-16">
 *   <AvatarImage src="/user.jpg" alt="ユーザー名" />
 *   <AvatarFallback>UN</AvatarFallback>
 * </Avatar>
 * ```
 *
 * @example 画像なし（フォールバックのみ）
 * ```tsx
 * <Avatar>
 *   <AvatarFallback>田中</AvatarFallback>
 * </Avatar>
 * ```
 */

// ============================================================
// "use client" ディレクティブ
// ============================================================
// このコンポーネントはクライアントサイドで動作する必要があります
// （画像の読み込み状態の監視、フォールバック表示の制御のため）
"use client"

// ============================================================
// インポート
// ============================================================

// React本体をインポート
import * as React from "react"

// Radix UIのAvatarプリミティブ
// 画像読み込み状態の管理とフォールバック機能を提供
import * as AvatarPrimitive from "@radix-ui/react-avatar"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

// ============================================================
// Avatar（アバター本体）
// ============================================================

/**
 * Avatar - アバターのルートコンポーネント
 *
 * アバター全体を囲むコンテナ。サイズと形状を定義。
 * デフォルトは32px×32pxの円形。
 *
 * @param className - 追加のCSSクラス（サイズ変更などに使用）
 * @param props - Radix UIのAvatar.Rootのプロパティ
 */
function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        // relative: 相対配置（AvatarFallbackの絶対配置用）
        // flex: フレックスボックス
        // size-8: 32px×32px
        // shrink-0: フレックスアイテムの縮小を防止
        // overflow-hidden: はみ出す部分を非表示（円形にするため）
        // rounded-full: 完全な円形
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// AvatarImage（アバター画像）
// ============================================================

/**
 * AvatarImage - アバターの画像
 *
 * ユーザーのプロフィール画像を表示。
 * 画像が読み込めない場合は自動的にAvatarFallbackが表示されます。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのAvatar.Imageのプロパティ（src, altなど）
 */
function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        // aspect-square: アスペクト比1:1（正方形）
        // size-full: 親要素いっぱいに広がる
        "aspect-square size-full",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// AvatarFallback（フォールバック表示）
// ============================================================

/**
 * AvatarFallback - 画像読み込み失敗時の代替表示
 *
 * 画像が読み込めない場合や読み込み中に表示されるコンポーネント。
 * 通常、ユーザー名のイニシャルやアイコンを表示します。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのAvatar.Fallbackのプロパティ
 */
function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        // bg-muted: グレーの背景色
        // flex: フレックスボックス
        // size-full: 親要素いっぱいに広がる
        // items-center justify-center: 中央揃え
        // rounded-full: 完全な円形
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// エクスポート
// ============================================================

export { Avatar, AvatarImage, AvatarFallback }
