/**
 * @file StatCard.tsx
 * @description 統計カードコンポーネント
 *
 * 数値統計を視覚的に表示するためのカードコンポーネント。
 * アイコン、タイトル、数値、オプションの説明文を組み合わせて
 * 統計情報をわかりやすく表示する。
 *
 * @features
 * - アイコン付きの統計表示
 * - 数値または文字列の表示に対応
 * - オプションで追加説明文を表示
 * - レスポンシブデザイン対応
 *
 * @example
 * // 数値を表示する場合
 * <StatCard
 *   title="投稿数"
 *   value={123}
 *   icon={FileText}
 * />
 *
 * // 文字列を表示する場合（小数点付き数値など）
 * <StatCard
 *   title="平均エンゲージメント"
 *   value="4.5"
 *   icon={TrendingUp}
 *   description="前月比 +12%"
 * />
 */
'use client'

// UIコンポーネント: shadcn/uiのカードコンポーネント
// Card: カード全体のコンテナ、CardContent: カードの内容部分
import { Card, CardContent } from '@/components/ui/card'

// アイコン型定義: lucide-reactのアイコンコンポーネントの型
// 動的にアイコンを受け取るために使用
import { LucideIcon } from 'lucide-react'

/**
 * StatCardコンポーネントのProps型定義
 */
type StatCardProps = {
  /** 統計項目のタイトル（例: "投稿数", "いいね"） */
  title: string
  /** 表示する統計値（数値または文字列） */
  value: number | string
  /** 統計項目を表すアイコンコンポーネント（lucide-reactのアイコン） */
  icon: LucideIcon
  /** オプションの追加説明文（例: "前月比 +12%"） */
  description?: string
}

/**
 * 統計カードコンポーネント
 *
 * アイコンと数値を組み合わせて統計情報を視覚的に表示する。
 * ダッシュボードのKPI表示やサマリー表示に最適。
 *
 * @param props - StatCardProps
 * @param props.title - 統計項目のラベル
 * @param props.value - 表示する値
 * @param props.icon - 表示するアイコン（Iconという名前でリネームして使用）
 * @param props.description - オプションの補足説明
 * @returns 統計カードのJSX要素
 */
export function StatCard({ title, value, icon: Icon, description }: StatCardProps) {
  return (
    <Card>
      {/* カードコンテンツ: パディングを設定してコンパクトに */}
      <CardContent className="p-4">
        {/* アイコンとテキストを横並びに配置 */}
        <div className="flex items-center gap-3">
          {/*
            アイコンコンテナ
            - 円形の背景（プライマリカラーの10%透明度）
            - アイコンを中央配置
          */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            {/* 動的に渡されたアイコンをレンダリング */}
            <Icon className="w-5 h-5 text-primary" />
          </div>
          {/* テキストコンテナ */}
          <div>
            {/* タイトル: 小さいグレーテキスト */}
            <p className="text-xs text-muted-foreground">{title}</p>
            {/* 値: 大きく太字で目立たせる */}
            <p className="text-2xl font-bold">{value}</p>
            {/* 説明文: descriptionが存在する場合のみ表示 */}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
