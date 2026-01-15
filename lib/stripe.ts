import Stripe from 'stripe'

// ビルド時はStripeクライアントを初期化しない
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  })
}

// 遅延初期化でビルド時のエラーを回避
let _stripe: Stripe | null = null
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripe) {
      _stripe = getStripe()
    }
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// 価格ID
export const STRIPE_PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY
export const STRIPE_PRICE_ID_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY
