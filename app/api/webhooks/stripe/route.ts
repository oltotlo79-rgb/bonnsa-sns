import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

// Stripe APIレスポンスの型定義（current_period_endなどのプロパティにアクセスするため）
type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end: number
}

type InvoiceWithDetails = Stripe.Invoice & {
  subscription: string | null
  payment_intent: string | null
  amount_paid: number
  currency: string
  billing_reason: string | null
}

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
        const customerId = session.customer as string

        console.log('checkout.session.completed:', { userId, subscriptionId, customerId })

        if (userId && subscriptionId) {
          const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
          const subscription = subscriptionResponse as unknown as SubscriptionWithPeriod

          await prisma.user.update({
            where: { id: userId },
            data: {
              isPremium: true,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              premiumExpiresAt: new Date(subscription.current_period_end * 1000),
            },
          })

          // 支払い履歴を記録（サブスクリプションの場合、invoiceから取得）
          if (session.invoice) {
            const invoiceResponse = await stripe.invoices.retrieve(session.invoice as string)
            const invoice = invoiceResponse as unknown as InvoiceWithDetails
            if (invoice.payment_intent) {
              await prisma.payment.create({
                data: {
                  userId,
                  stripePaymentId: invoice.payment_intent,
                  amount: invoice.amount_paid,
                  currency: invoice.currency,
                  status: 'succeeded',
                  description: 'プレミアム会員登録',
                },
              })
            }
          }

          console.log(`User ${userId} upgraded to premium`)
        } else {
          console.error('Missing userId or subscriptionId:', { userId, subscriptionId })
        }
        break
      }

      // サブスクリプション更新（更新・期限延長）
      case 'customer.subscription.updated': {
        const subscriptionData = event.data.object as unknown as SubscriptionWithPeriod
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscriptionData.id },
        })

        console.log('customer.subscription.updated:', {
          subscriptionId: subscriptionData.id,
          status: subscriptionData.status,
          userId: user?.id
        })

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isPremium: subscriptionData.status === 'active',
              premiumExpiresAt: new Date(subscriptionData.current_period_end * 1000),
            },
          })

          console.log(`User ${user.id} subscription updated: ${subscriptionData.status}`)
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
        const invoice = event.data.object as unknown as InvoiceWithDetails
        const subscriptionId = invoice.subscription

        console.log('invoice.payment_failed:', { subscriptionId })

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
        const invoice = event.data.object as unknown as InvoiceWithDetails
        const subscriptionId = invoice.subscription

        console.log('invoice.payment_succeeded:', {
          subscriptionId,
          billingReason: invoice.billing_reason,
        })

        // 継続課金の場合のみ記録（初回は checkout.session.completed で処理）
        if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
          const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          })

          if (user && invoice.payment_intent) {
            // 支払い履歴を記録
            await prisma.payment.create({
              data: {
                userId: user.id,
                stripePaymentId: invoice.payment_intent,
                amount: invoice.amount_paid,
                currency: invoice.currency,
                status: 'succeeded',
                description: 'プレミアム会員更新',
              },
            })

            // 期限を延長
            const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
            const subscription = subscriptionResponse as unknown as SubscriptionWithPeriod
            await prisma.user.update({
              where: { id: user.id },
              data: {
                premiumExpiresAt: new Date(subscription.current_period_end * 1000),
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
    console.error('Event type:', event.type)
    console.error('Event data:', JSON.stringify(event.data.object, null, 2))
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
