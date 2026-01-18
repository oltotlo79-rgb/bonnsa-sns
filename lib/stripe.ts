/**
 * Stripe決済クライアント設定
 *
 * このファイルは、Stripe決済サービスとの連携を提供します。
 * プレミアム会員のサブスクリプション決済に使用されます。
 *
 * ## Stripeとは？
 * オンライン決済プラットフォーム。以下の機能を提供：
 * - クレジットカード決済
 * - サブスクリプション（定期課金）管理
 * - 請求書・領収書の自動発行
 * - 決済フォームの提供（Stripe Elements）
 *
 * ## このファイルの設計
 * - 遅延初期化（Lazy Initialization）パターンを採用
 * - ビルド時のエラーを回避
 * - Proxyオブジェクトによる透過的なアクセス
 *
 * ## なぜ遅延初期化が必要か？
 * Next.jsはビルド時にすべてのファイルを評価します。
 * その際、STRIPE_SECRET_KEYが環境変数として設定されていない場合、
 * Stripeクライアントの初期化でエラーが発生します。
 * 遅延初期化により、実際に使用する時点まで初期化を遅らせることで、
 * このビルド時エラーを回避しています。
 *
 * @module lib/stripe
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * Stripe: Stripe公式Node.jsライブラリ
 *
 * サーバーサイドでStripe APIを呼び出すためのクライアント
 * https://stripe.com/docs/api
 */
import Stripe from 'stripe'

// ============================================================
// Stripeクライアント初期化
// ============================================================

/**
 * Stripeクライアントを取得する関数
 *
 * ## 機能概要
 * 環境変数をチェックし、Stripeクライアントを初期化して返します。
 *
 * ## 戻り値
 * @returns Stripe - 初期化されたStripeクライアント
 *
 * ## 例外
 * STRIPE_SECRET_KEYが設定されていない場合、Errorをスロー
 *
 * ## apiVersionについて
 * Stripe APIのバージョンを指定します。
 * APIの破壊的変更から保護するため、特定のバージョンを固定。
 * 新しいバージョンは十分にテストしてから更新してください。
 *
 * ## 注意
 * この関数は直接呼び出さず、exportされているstripeオブジェクトを
 * 使用してください（Proxy経由でアクセス）。
 */
const getStripe = () => {
  /**
   * 環境変数のチェック
   *
   * STRIPE_SECRET_KEYは秘密鍵なので、
   * NEXT_PUBLIC_プレフィックスをつけてはいけません。
   * サーバーサイドでのみアクセス可能です。
   */
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }

  /**
   * Stripeクライアントの初期化
   *
   * 第1引数: シークレットキー（sk_live_xxx または sk_test_xxx）
   * 第2引数: オプション
   *   - apiVersion: 使用するAPIバージョン
   */
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  })
}

// ============================================================
// 遅延初期化とProxyパターン
// ============================================================

/**
 * シングルトンインスタンス
 *
 * 初期化されたStripeクライアントをキャッシュ
 * 複数回の初期化を防ぎ、効率的なリソース使用を実現
 */
let _stripe: Stripe | null = null

/**
 * Proxyで包まれたStripeクライアント
 *
 * ## Proxyとは？
 * JavaScriptのオブジェクトへのアクセスを傍受（インターセプト）し、
 * カスタムの動作を定義できる機能です。
 *
 * ## この実装のポイント
 *
 * ### 1. 空オブジェクトをターゲットに
 * `{}` を Stripe 型としてキャストし、Proxyのターゲットにしています。
 * 実際の処理はすべてget trapで行われます。
 *
 * ### 2. get trap
 * プロパティにアクセスされた時に呼び出されるハンドラー
 * - _stripe が null なら getStripe() で初期化
 * - 初期化済みの _stripe から該当プロパティを返す
 *
 * ### 3. 遅延初期化
 * stripe.customers.create() のように実際に使用されるまで、
 * Stripeクライアントは初期化されません。
 *
 * ## 使用例
 * ```typescript
 * import { stripe } from '@/lib/stripe'
 *
 * // 実際に使用する時点で初期化される
 * const customer = await stripe.customers.create({
 *   email: 'user@example.com',
 * })
 *
 * // サブスクリプション作成
 * const subscription = await stripe.subscriptions.create({
 *   customer: customerId,
 *   items: [{ price: STRIPE_PRICE_ID_MONTHLY }],
 * })
 * ```
 *
 * ## 型安全性について
 * `as unknown as Record<string | symbol, unknown>`
 * TypeScriptの型システムを回避するための型アサーション。
 * Proxyの内部実装のため、外部からはStripe型として扱えます。
 */
export const stripe = new Proxy({} as Stripe, {
  /**
   * getハンドラー（トラップ）
   *
   * @param _ - ターゲットオブジェクト（未使用）
   * @param prop - アクセスされたプロパティ名
   * @returns プロパティの値
   *
   * ## 処理フロー
   * 1. _stripe が null かチェック
   * 2. null なら getStripe() で初期化
   * 3. _stripe の該当プロパティを返す
   */
  get(_, prop) {
    if (!_stripe) {
      _stripe = getStripe()
    }
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// ============================================================
// 価格ID設定
// ============================================================

/**
 * 月額プランの価格ID
 *
 * ## 価格IDとは？
 * Stripeダッシュボードで作成した価格（Price）の識別子。
 * 形式: price_xxx
 *
 * ## 設定方法
 * 1. Stripeダッシュボード → Products → 商品を作成
 * 2. 価格を追加（月額1000円など）
 * 3. 価格IDをコピーして環境変数に設定
 *
 * ## 環境変数
 * STRIPE_PRICE_ID_MONTHLY=price_xxx
 */
export const STRIPE_PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY

/**
 * 年額プランの価格ID
 *
 * ## 年額プランのメリット
 * - ユーザー: 通常、月額×12ヶ月より割引される
 * - サービス: 長期契約による収益の安定化
 *
 * ## 環境変数
 * STRIPE_PRICE_ID_YEARLY=price_xxx
 */
export const STRIPE_PRICE_ID_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY
