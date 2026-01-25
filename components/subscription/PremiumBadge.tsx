/**
 * @file PremiumBadge.tsx
 * @description プレミアム会員バッジコンポーネント
 *
 * このコンポーネントは、プレミアム会員ユーザーを視覚的に識別するための
 * 王冠アイコンバッジを表示します。ツールチップでプレミアム会員であることを説明できます。
 *
 * @features
 * - 3段階のサイズバリエーション（sm/md/lg）
 * - オプションのツールチップ表示
 * - 琥珀色（amber）の王冠アイコン
 * - ユーザー名横やプロフィールカードで使用可能
 *
 * @usage
 * ```tsx
 * // 基本的な使用例（小サイズ、ツールチップあり）
 * <PremiumBadge />
 *
 * // 大きいサイズ
 * <PremiumBadge size="lg" />
 *
 * // ツールチップなし
 * <PremiumBadge showTooltip={false} />
 *
 * // ユーザー名と一緒に使用
 * <span className="flex items-center gap-1">
 *   <span>ユーザー名</span>
 *   <PremiumBadge size="sm" />
 * </span>
 * ```
 */

'use client'

// lucide-reactのアイコン
// Crown: 王冠アイコン（プレミアム会員を象徴）
import { Crown } from 'lucide-react'

// shadcn/uiのTooltipコンポーネント群: ホバー時の説明表示用
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * PremiumBadgeコンポーネントのプロパティ型定義
 */
type PremiumBadgeProps = {
  /** バッジのサイズ（'sm': 小, 'md': 中, 'lg': 大）、デフォルト: 'sm' */
  size?: 'sm' | 'md' | 'lg'
  /** ツールチップを表示するかどうか、デフォルト: true */
  showTooltip?: boolean
}

/**
 * サイズに対応するCSSクラスのマッピング
 * 各サイズに適切なwidth/heightクラスを定義
 */
const sizeClasses = {
  sm: 'w-3.5 h-3.5',  // 小サイズ: 14px x 14px
  md: 'w-4 h-4',      // 中サイズ: 16px x 16px
  lg: 'w-5 h-5',      // 大サイズ: 20px x 20px
}

/**
 * プレミアム会員バッジコンポーネント
 *
 * プレミアム会員ユーザーを視覚的に識別するための王冠アイコンバッジ。
 * ユーザー名の横やプロフィールカードで使用し、プレミアム会員であることを示す。
 *
 * @param props - コンポーネントのプロパティ
 * @returns プレミアムバッジのJSX要素
 */
export function PremiumBadge({ size = 'sm', showTooltip = true }: PremiumBadgeProps) {
  /**
   * バッジ本体: 琥珀色の王冠アイコン
   * fill="currentColor"で塗りつぶしスタイルを適用
   */
  const badge = (
    <span className="inline-flex items-center justify-center text-amber-500">
      <Crown className={sizeClasses[size]} fill="currentColor" />
    </span>
  )

  // ツールチップを表示しない場合はバッジのみを返す
  if (!showTooltip) {
    return badge
  }

  // ツールチップ付きでバッジを返す
  return (
    <TooltipProvider>
      <Tooltip>
        {/* ツールチップのトリガー要素: バッジ本体 */}
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        {/* ツールチップの内容: ホバー時に表示される説明 */}
        <TooltipContent>
          <p>プレミアム会員</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
