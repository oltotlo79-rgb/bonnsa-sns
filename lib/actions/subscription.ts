'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { stripe, STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_YEARLY } from '@/lib/stripe'

/**
 * Checkout Session作成（決済ページへリダイレクト）
 */
export async function createCheckoutSession(priceType: 'monthly' | 'yearly' = 'monthly') {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, stripeCustomerId: true, isPremium: true },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (user.isPremium) {
    return { error: 'すでに有料会員です' }
  }

  const priceId = priceType === 'yearly' ? STRIPE_PRICE_ID_YEARLY : STRIPE_PRICE_ID_MONTHLY

  if (!priceId) {
    return { error: '価格設定が見つかりません' }
  }

  // 既存のStripe顧客があれば使用、なければ作成
  let customerId = user.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { userId: session.user.id },
    })
    customerId = customer.id

    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    })
  }

  // Checkout Session作成
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

  return { url: checkoutSession.url }
}

/**
 * カスタマーポータル（プラン管理・解約）
 */
export async function createCustomerPortalSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) {
    return { error: 'サブスクリプション情報が見つかりません' }
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription`,
  })

  return { url: portalSession.url }
}

/**
 * サブスクリプション状態取得
 */
export async function getSubscriptionStatus() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

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

  let subscription = null
  if (user.stripeSubscriptionId) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
      const subData = stripeSubscription as unknown as {
        status: string
        current_period_end: number
        cancel_at_period_end: boolean
      }
      subscription = {
        status: subData.status,
        currentPeriodEnd: new Date(subData.current_period_end * 1000),
        cancelAtPeriodEnd: subData.cancel_at_period_end,
      }
    } catch {
      // サブスクリプションが見つからない場合は無視
    }
  }

  return {
    isPremium: user.isPremium,
    premiumExpiresAt: user.premiumExpiresAt,
    subscription,
  }
}

/**
 * 支払い履歴を取得
 */
export async function getPaymentHistory() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const payments = await prisma.payment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return { payments }
}

/**
 * サブスクリプションをキャンセル（即時解約）
 */
export async function cancelSubscriptionImmediately() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeSubscriptionId: true },
  })

  if (!user?.stripeSubscriptionId) {
    return { error: 'サブスクリプションが見つかりません' }
  }

  try {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId)

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
    console.error('Failed to cancel subscription:', error)
    return { error: 'サブスクリプションのキャンセルに失敗しました' }
  }
}

/**
 * 会員種別に応じた制限を取得（クライアント用）
 */
export async function getMembershipInfo() {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      isPremium: false,
      limits: {
        maxPostLength: 500,
        maxImages: 4,
        maxVideos: 2,
        canSchedulePost: false,
        canViewAnalytics: false,
      },
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPremium: true, premiumExpiresAt: true },
  })

  const isPremium = user?.isPremium &&
    (!user.premiumExpiresAt || user.premiumExpiresAt > new Date())

  return {
    isPremium,
    limits: isPremium ? {
      maxPostLength: 2000,
      maxImages: 6,
      maxVideos: 3,
      canSchedulePost: true,
      canViewAnalytics: true,
    } : {
      maxPostLength: 500,
      maxImages: 4,
      maxVideos: 2,
      canSchedulePost: false,
      canViewAnalytics: false,
    },
  }
}
