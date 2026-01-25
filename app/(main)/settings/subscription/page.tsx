/**
 * @fileoverview プラン管理（サブスクリプション）ページ
 *
 * このファイルはログインユーザーのプレミアム会員プランを管理するためのページコンポーネントです。
 * Stripeと連携した決済機能を提供し、月額/年額プランの選択と支払い履歴の確認ができます。
 *
 * 主な機能:
 * - 現在のサブスクリプション状態の表示
 * - プレミアムプランへの登録（月額350円/年額3,500円）
 * - 支払い成功/キャンセル時のフィードバック表示
 * - 支払い履歴の一覧表示
 * - プランの解約（サブスクリプションキャンセル）
 * - 認証チェックによるアクセス制御
 *
 * プレミアム会員の特典:
 * - 投稿の予約投稿機能
 * - 下書き保存数の上限解放
 * - 広告非表示
 * - 詳細なアナリティクス機能
 *
 * @route /settings/subscription
 * @requires 認証必須 - 未ログインユーザーはログインページへリダイレクト
 */

// Next.jsのナビゲーションユーティリティ（リダイレクト用）
import { redirect } from 'next/navigation'

// NextAuth.jsの認証ヘルパー（現在のセッション取得用）
import { auth } from '@/lib/auth'

// Prismaデータベースクライアント（支払い履歴取得用）
import { prisma } from '@/lib/db'

// サブスクリプション状態取得用のServer Action
import { getSubscriptionStatus } from '@/lib/actions/subscription'

// サブスクリプション状態表示コンポーネント（現在のプランと有効期限）
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus'

// 料金プラン選択カードコンポーネント（月額/年額プラン）
import { PricingCard } from '@/components/subscription/PricingCard'

// 支払い履歴一覧コンポーネント
import { PaymentHistory } from '@/components/subscription/PaymentHistory'

// shadcn/uiのアラートコンポーネント（成功/キャンセルメッセージ用）
import { Alert, AlertDescription } from '@/components/ui/alert'

// Lucideアイコン（チェック、×、王冠アイコン）
import { CheckCircle, XCircle, Crown } from 'lucide-react'

/**
 * 静的メタデータの定義
 * ページタイトルの設定
 */
export const metadata = {
  title: 'プラン管理 | BONLOG',
}

/**
 * ユーザーの支払い履歴を取得するヘルパー関数
 *
 * Stripeからの支払い記録をデータベースから取得します。
 * 最新10件を新しい順で返します。
 *
 * @param {string} userId - 対象ユーザーのID
 * @returns {Promise<Payment[]>} 支払い履歴の配列
 */
async function getPaymentHistory(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,  // 最新10件のみ取得
  })
}

/**
 * プラン管理ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. セッションの認証チェック
 * 2. URLパラメータから決済結果を確認（success/canceled）
 * 3. サブスクリプション状態と支払い履歴を並列で取得
 * 4. プレミアム会員でない場合は料金プランを表示
 * 5. プレミアム会員の場合は現在のプラン情報を表示
 *
 * @param {Object} props - コンポーネントのプロパティ
 * @param {Promise<{ success?: string; canceled?: string }>} props.searchParams - URLクエリパラメータ
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>
}) {
  // URLパラメータを非同期で取得（Next.js 15の新仕様）
  const params = await searchParams

  // 現在のセッションを取得（認証状態の確認）
  const session = await auth()

  // 未ログインの場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect('/login')
  }

  // サブスクリプション状態と支払い履歴を並列で取得（パフォーマンス最適化）
  const [statusResult, payments] = await Promise.all([
    getSubscriptionStatus(),                    // 現在のプラン状態
    getPaymentHistory(session.user.id),        // 支払い履歴
  ])

  // サブスクリプション状態のデータを整形（エラーハンドリング含む）
  const isPremium = 'error' in statusResult ? false : statusResult.isPremium
  const premiumExpiresAt = 'error' in statusResult ? null : statusResult.premiumExpiresAt
  const subscription = 'error' in statusResult ? null : statusResult.subscription

  // Stripe価格IDを環境変数から取得（月額/年額）
  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY || ''
  const yearlyPriceId = process.env.STRIPE_PRICE_ID_YEARLY || ''

  // プラン管理ページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      {/* ページヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <Crown className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">プラン管理</h1>
      </div>

      {/* 成功メッセージ（Stripe決済完了後のリダイレクト時に表示） */}
      {params.success === 'true' && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">
            プレミアム会員への登録が完了しました。すべての機能をご利用いただけます。
          </AlertDescription>
        </Alert>
      )}

      {/* キャンセルメッセージ（Stripe決済キャンセル時に表示） */}
      {params.canceled === 'true' && (
        <Alert className="mb-6 border-yellow-200 bg-yellow-50">
          <XCircle className="w-4 h-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            登録がキャンセルされました。いつでも再度お申し込みいただけます。
          </AlertDescription>
        </Alert>
      )}

      {/* 現在のプラン情報（プレミアム会員の場合のみ表示） */}
      {isPremium && (
        <div className="mb-6">
          <SubscriptionStatus
            isPremium={isPremium}
            premiumExpiresAt={premiumExpiresAt}
            subscription={subscription}
          />
        </div>
      )}

      {/* 料金プラン選択カード（プレミアム会員でない場合のみ表示） */}
      {!isPremium && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">料金プラン</h2>
          <div className="grid gap-4 md:grid-cols-2 pt-4">
            {/* 月額プランカード */}
            <PricingCard
              isPremium={isPremium}
              priceId={monthlyPriceId}
              priceType="monthly"
              planName="月額プラン"
              price={350}
              period="月"
              popular  // おすすめバッジ表示
            />
            {/* 年額プランカード（2ヶ月分お得） */}
            <PricingCard
              isPremium={isPremium}
              priceId={yearlyPriceId}
              priceType="yearly"
              planName="年額プラン"
              price={3500}
              period="年"
              description="2ヶ月分お得"
            />
          </div>
        </div>
      )}

      {/* 支払い履歴セクション（履歴がある場合のみ表示） */}
      {payments.length > 0 && (
        <PaymentHistory payments={payments} />
      )}

      {/* 注意事項（利用規約関連の説明） */}
      <div className="mt-8 text-xs text-muted-foreground space-y-1">
        <p>・ お支払いはクレジットカードで承ります</p>
        <p>・ サブスクリプションはいつでもキャンセルできます</p>
        <p>・ キャンセル後も期間終了まで機能をご利用いただけます</p>
        <p>・ 料金は税込表示です</p>
      </div>
    </div>
  )
}
