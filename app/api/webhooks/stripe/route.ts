import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      // 決済完了 → 有料会員有効化
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const subscriptionId = session.subscription as string

        if (userId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const currentPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end

          await prisma.user.update({
            where: { id: userId },
            data: {
              isPremium: true,
              stripeSubscriptionId: subscriptionId,
              premiumExpiresAt: new Date(currentPeriodEnd * 1000),
            },
          })

          // 支払い履歴を記録
          if (session.payment_intent) {
            const paymentIntent = await stripe.paymentIntents.retrieve(
              session.payment_intent as string
            )
            await prisma.payment.create({
              data: {
                userId,
                stripePaymentId: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
                description: 'プレミアム会員登録',
              },
            })
          }

          console.log(`User ${userId} upgraded to premium`)
        }
        break
      }

      // サブスクリプション更新（更新・期限延長）
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const subscriptionData = subscription as unknown as { current_period_end: number }
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isPremium: subscription.status === 'active',
              premiumExpiresAt: new Date(subscriptionData.current_period_end * 1000),
            },
          })

          console.log(`User ${user.id} subscription updated: ${subscription.status}`)
        }
        break
      }

      // サブスクリプション解約
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isPremium: false,
              stripeSubscriptionId: null,
              premiumExpiresAt: null,
            },
          })

          console.log(`User ${user.id} subscription deleted`)
        }
        break
      }

      // 支払い失敗
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceData = invoice as unknown as { subscription: string | null }
        const subscriptionId = invoiceData.subscription as string

        if (subscriptionId) {
          const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          })

          if (user) {
            // 支払い失敗の通知を作成
            await prisma.notification.create({
              data: {
                userId: user.id,
                actorId: user.id,
                type: 'system',
              },
            })

            console.log(`Payment failed for user ${user.id}`)
          }
        }
        break
      }

      // 請求書支払い成功（継続課金）
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceData = invoice as unknown as {
          subscription: string | null
          billing_reason: string | null
          payment_intent: string | null
          amount_paid: number
          currency: string
        }
        const subscriptionId = invoiceData.subscription

        // 継続課金の場合のみ記録（初回は checkout.session.completed で処理）
        if (subscriptionId && invoiceData.billing_reason === 'subscription_cycle') {
          const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          })

          if (user && invoiceData.payment_intent) {
            // 支払い履歴を記録
            await prisma.payment.create({
              data: {
                userId: user.id,
                stripePaymentId: invoiceData.payment_intent,
                amount: invoiceData.amount_paid,
                currency: invoiceData.currency,
                status: 'succeeded',
                description: 'プレミアム会員更新',
              },
            })

            // 期限を延長
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end
            await prisma.user.update({
              where: { id: user.id },
              data: {
                premiumExpiresAt: new Date(periodEnd * 1000),
              },
            })

            console.log(`User ${user.id} subscription renewed`)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
