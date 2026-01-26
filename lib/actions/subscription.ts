/**
 * サブスクリプション機能のServer Actions
 *
 * このファイルは、有料会員（プレミアム会員）のサブスクリプション管理に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - Checkout Session作成（決済ページへリダイレクト）
 * - カスタマーポータル（プラン管理・解約）
 * - サブスクリプション状態取得
 * - 支払い履歴の取得
 * - サブスクリプションのキャンセル
 * - 会員情報の取得
 *
 * ## 決済システム
 * Stripeを使用した定期課金システムです。
 *
 * ## プラン種別
 * - monthly: 月額プラン
 * - yearly: 年額プラン
 *
 * ## 会員種別
 * - 無料会員: 基本機能のみ
 * - プレミアム会員: 拡張機能（予約投稿、アナリティクス等）
 *
 * @module lib/actions/subscription
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * Stripeクライアントと価格ID
 *
 * stripe: Stripe APIクライアント
 * STRIPE_PRICE_ID_MONTHLY: 月額プランの価格ID
 * STRIPE_PRICE_ID_YEARLY: 年額プランの価格ID
 */
import { stripe, STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_YEARLY } from '@/lib/stripe'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

// ============================================================
// Checkout Session作成
// ============================================================

/**
 * Checkout Session作成（決済ページへリダイレクト）
 *
 * ## 機能概要
 * Stripeの決済ページ（Checkout）へリダイレクトするためのURLを取得します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. ユーザー情報を取得
 * 3. Stripe顧客が存在しなければ作成
 * 4. Checkout Sessionを作成
 * 5. リダイレクトURLを返却
 *
 * ## Stripeの役割
 * - 決済ページの表示
 * - カード情報の入力
 * - 定期課金の設定
 *
 * @param priceType - プラン種別（'monthly' | 'yearly'）
 * @returns { url: string } または { error: string }
 *
 * @example
 * ```typescript
 * const result = await createCheckoutSession('monthly')
 *
 * if (result.url) {
 *   // Stripe決済ページにリダイレクト
 *   window.location.href = result.url
 * }
 * ```
 */
export async function createCheckoutSession(priceType: 'monthly' | 'yearly' = 'monthly') {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // ユーザー情報を取得
  // ------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, stripeCustomerId: true, isPremium: true },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  /**
   * すでに有料会員の場合はエラー
   */
  if (user.isPremium) {
    return { error: 'すでに有料会員です' }
  }

  // ------------------------------------------------------------
  // 価格IDを取得
  // ------------------------------------------------------------

  /**
   * プラン種別に応じた価格IDを選択
   */
  const priceId = priceType === 'yearly' ? STRIPE_PRICE_ID_YEARLY : STRIPE_PRICE_ID_MONTHLY

  if (!priceId) {
    return { error: '価格設定が見つかりません' }
  }

  // ------------------------------------------------------------
  // Stripe顧客を取得または作成
  // ------------------------------------------------------------

  /**
   * 既存のStripe顧客があれば使用、なければ作成
   */
  let customerId = user.stripeCustomerId

  if (!customerId) {
    /**
     * Stripe顧客を新規作成
     *
     * metadata にユーザーIDを保存
     * → Webhookで誰の支払いか識別するため
     */
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { userId: session.user.id },
    })
    customerId = customer.id

    /**
     * ユーザーにStripe顧客IDを保存
     */
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    })
  }

  // ------------------------------------------------------------
  // Checkout Sessionを作成
  // ------------------------------------------------------------

  /**
   * Stripe Checkout Sessionを作成
   *
   * - customer: 顧客ID
   * - mode: 'subscription' で定期課金
   * - success_url: 決済成功時のリダイレクト先
   * - cancel_url: 決済キャンセル時のリダイレクト先
   */
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?canceled=true`,
    metadata: {
      userId: session.user.id,
    },
  })

  // ------------------------------------------------------------
  // リダイレクトURLを返却
  // ------------------------------------------------------------

  return { url: checkoutSession.url }
}

// ============================================================
// カスタマーポータル
// ============================================================

/**
 * カスタマーポータル（プラン管理・解約）
 *
 * ## 機能概要
 * StripeのカスタマーポータルへリダイレクトするためのURLを取得します。
 *
 * ## カスタマーポータルでできること
 * - 支払い方法の変更
 * - プランの変更
 * - サブスクリプションの解約
 * - 請求履歴の確認
 *
 * @returns { url: string } または { error: string }
 *
 * @example
 * ```typescript
 * const result = await createCustomerPortalSession()
 *
 * if (result.url) {
 *   // Stripeカスタマーポータルにリダイレクト
 *   window.location.href = result.url
 * }
 * ```
 */
export async function createCustomerPortalSession() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // Stripe顧客IDを取得
  // ------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) {
    return { error: 'サブスクリプション情報が見つかりません' }
  }

  // ------------------------------------------------------------
  // ポータルセッションを作成
  // ------------------------------------------------------------

  /**
   * Stripe Billing Portal Sessionを作成
   *
   * return_url: ポータルから戻る先のURL
   */
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription`,
  })

  return { url: portalSession.url }
}

// ============================================================
// サブスクリプション状態取得
// ============================================================

/**
 * サブスクリプション状態取得
 *
 * ## 機能概要
 * 現在のサブスクリプション状態を取得します。
 *
 * ## 取得内容
 * - isPremium: プレミアム会員かどうか
 * - premiumExpiresAt: 有効期限
 * - subscription: Stripeサブスクリプション情報
 *   - status: 状態（active, canceled, etc.）
 *   - currentPeriodEnd: 現在の課金期間の終了日
 *   - cancelAtPeriodEnd: 期間終了時にキャンセルするか
 *
 * @returns サブスクリプション状態、または { error: string }
 *
 * @example
 * ```typescript
 * const status = await getSubscriptionStatus()
 *
 * if (status.isPremium) {
 *   console.log('プレミアム会員です')
 *   console.log(`有効期限: ${status.premiumExpiresAt}`)
 * }
 * ```
 */
export async function getSubscriptionStatus() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // ユーザー情報を取得
  // ------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isPremium: true,
      premiumExpiresAt: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
    },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  // ------------------------------------------------------------
  // Stripeサブスクリプション情報を取得
  // ------------------------------------------------------------

  let subscription = null
  if (user.stripeSubscriptionId) {
    try {
      /**
       * Stripe APIからサブスクリプション情報を取得
       */
      const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)

      /**
       * 必要な情報を抽出
       */
      const subData = stripeSubscription as unknown as {
        status: string
        current_period_end: number
        cancel_at_period_end: boolean
      }

      subscription = {
        status: subData.status,
        /**
         * UNIXタイムスタンプからDateに変換
         */
        currentPeriodEnd: new Date(subData.current_period_end * 1000),
        cancelAtPeriodEnd: subData.cancel_at_period_end,
      }
    } catch {
      /**
       * サブスクリプションが見つからない場合は無視
       */
    }
  }

  // ------------------------------------------------------------
  // 結果を返却
  // ------------------------------------------------------------

  return {
    isPremium: user.isPremium,
    premiumExpiresAt: user.premiumExpiresAt,
    subscription,
  }
}

// ============================================================
// 支払い履歴取得
// ============================================================

/**
 * 支払い履歴を取得
 *
 * ## 機能概要
 * ユーザーの支払い履歴を取得します。
 *
 * ## 取得内容
 * - 支払いID
 * - 金額
 * - 状態
 * - 支払い日時
 *
 * @returns { payments: Payment[] } または { error: string }
 *
 * @example
 * ```typescript
 * const { payments } = await getPaymentHistory()
 *
 * return (
 *   <table>
 *     {payments.map(payment => (
 *       <tr key={payment.id}>
 *         <td>{payment.createdAt}</td>
 *         <td>{payment.amount}円</td>
 *       </tr>
 *     ))}
 *   </table>
 * )
 * ```
 */
export async function getPaymentHistory() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 支払い履歴を取得
  // ------------------------------------------------------------

  const payments = await prisma.payment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,  // 最新20件
  })

  return { payments }
}

// ============================================================
// サブスクリプション即時解約
// ============================================================

/**
 * サブスクリプションをキャンセル（即時解約）
 *
 * ## 機能概要
 * サブスクリプションを即時解約します。
 *
 * ## 即時解約の注意点
 * - すぐにプレミアム機能が使えなくなります
 * - 残りの期間の返金はありません
 *
 * ## 通常の解約との違い
 * - 即時解約: すぐに解約
 * - 通常の解約: 次回更新日に解約（カスタマーポータルで設定）
 *
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await cancelSubscriptionImmediately()
 *
 * if (result.success) {
 *   toast.success('サブスクリプションを解約しました')
 * }
 * ```
 */
export async function cancelSubscriptionImmediately() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // サブスクリプションIDを取得
  // ------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeSubscriptionId: true },
  })

  if (!user?.stripeSubscriptionId) {
    return { error: 'サブスクリプションが見つかりません' }
  }

  try {
    // ------------------------------------------------------------
    // Stripeサブスクリプションをキャンセル
    // ------------------------------------------------------------

    await stripe.subscriptions.cancel(user.stripeSubscriptionId)

    // ------------------------------------------------------------
    // ユーザー情報を更新
    // ------------------------------------------------------------

    /**
     * プレミアム状態を解除
     */
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        isPremium: false,
        stripeSubscriptionId: null,
        premiumExpiresAt: null,
      },
    })

    return { success: true }
  } catch (error) {
    logger.error('Failed to cancel subscription:', error)
    return { error: 'サブスクリプションのキャンセルに失敗しました' }
  }
}

// ============================================================
// 会員情報取得
// ============================================================

/**
 * 会員種別に応じた制限を取得（クライアント用）
 *
 * ## 機能概要
 * 現在のユーザーの会員種別と、それに応じた機能制限を取得します。
 *
 * ## 制限項目
 * - maxPostLength: 最大投稿文字数
 * - maxImages: 最大画像枚数
 * - maxVideos: 最大動画本数
 * - canSchedulePost: 予約投稿の可否
 * - canViewAnalytics: アナリティクスの可否
 *
 * ## 無料会員の制限
 * - 投稿: 500文字
 * - 画像: 4枚
 * - 動画: 1本
 * - 予約投稿: 不可
 * - アナリティクス: 不可
 *
 * ## プレミアム会員の制限
 * - 投稿: 2000文字
 * - 画像: 6枚
 * - 動画: 3本
 * - 予約投稿: 可
 * - アナリティクス: 可
 *
 * @returns 会員情報と制限
 *
 * @example
 * ```typescript
 * const { isPremium, limits } = await getMembershipInfo()
 *
 * if (content.length > limits.maxPostLength) {
 *   setError(`投稿は${limits.maxPostLength}文字以内で入力してください`)
 * }
 * ```
 */
export async function getMembershipInfo() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    /**
     * 未ログイン時は無料会員の制限を返す
     */
    return {
      isPremium: false,
      limits: {
        maxPostLength: 500,
        maxImages: 4,
        maxVideos: 1,
        canSchedulePost: false,
        canViewAnalytics: false,
      },
    }
  }

  // ------------------------------------------------------------
  // ユーザー情報を取得
  // ------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPremium: true, premiumExpiresAt: true },
  })

  /**
   * プレミアム会員かどうかを判定
   *
   * 条件:
   * 1. isPremium が true
   * 2. premiumExpiresAt が null または未来の日時
   */
  const isPremium = user?.isPremium &&
    (!user.premiumExpiresAt || user.premiumExpiresAt > new Date())

  // ------------------------------------------------------------
  // 会員種別に応じた制限を返却
  // ------------------------------------------------------------

  return {
    isPremium,
    limits: isPremium ? {
      /**
       * プレミアム会員の制限
       */
      maxPostLength: 2000,
      maxImages: 6,
      maxVideos: 3,
      canSchedulePost: true,
      canViewAnalytics: true,
    } : {
      /**
       * 無料会員の制限
       */
      maxPostLength: 500,
      maxImages: 4,
      maxVideos: 1,
      canSchedulePost: false,
      canViewAnalytics: false,
    },
  }
}
