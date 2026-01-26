/**
 * プレミアム会員管理ユーティリティ
 *
 * このファイルは、有料会員（プレミアムメンバーシップ）の判定と
 * 会員種別に応じた機能制限の管理を提供します。
 *
 * ## プレミアム会員とは？
 * このアプリケーションでは、無料会員とプレミアム会員の2種類があります。
 * プレミアム会員は月額または年額の課金により、
 * より多くの機能や緩い制限を利用できます。
 *
 * ## 主な機能
 * - 会員種別の判定（無料/プレミアム）
 * - 会員種別に応じた制限値の取得
 * - プレミアム期限の管理と自動失効
 *
 * ## 使用場所
 * - 投稿作成時の文字数・画像枚数チェック
 * - 機能の表示/非表示の制御
 * - Stripeとの連携によるサブスクリプション管理
 *
 * @module lib/premium
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * prisma: データベースクライアント
 *
 * ユーザーのプレミアム状態を取得・更新するために使用
 */
import { prisma } from '@/lib/db'

// ============================================================
// 型定義
// ============================================================

/**
 * 会員種別の型
 *
 * ## リテラル型とは？
 * 特定の文字列だけを許可する型
 * 'free' か 'premium' 以外の値はコンパイルエラーになる
 *
 * ## なぜ文字列リテラル型を使うか？
 * - タイプミスを防げる（'preimum' などはエラー）
 * - エディタの補完が効く
 * - コードの意図が明確になる
 */
export type MembershipType = 'free' | 'premium'

/**
 * 会員種別に応じた制限値の型
 *
 * ## 各プロパティの説明
 * - maxPostLength: 投稿の最大文字数
 * - maxImages: 1投稿あたりの最大画像枚数
 * - maxVideos: 1投稿あたりの最大動画数
 * - maxDailyPosts: 1日の最大投稿数
 * - canSchedulePost: 予約投稿機能が使えるか
 * - canViewAnalytics: 分析機能が使えるか
 */
export interface MembershipLimits {
  maxPostLength: number      // 投稿の最大文字数
  maxImages: number          // 最大画像枚数
  maxVideos: number          // 最大動画数
  maxDailyPosts: number      // 1日の最大投稿数
  canSchedulePost: boolean   // 予約投稿の可否
  canViewAnalytics: boolean  // 分析機能の可否
}

// ============================================================
// 定数定義
// ============================================================

/**
 * 無料会員の制限値
 *
 * ## 設定値の根拠
 * - maxPostLength: 500文字（Twitterと同程度）
 * - maxImages: 4枚（一般的なSNSの標準）
 * - maxVideos: 1本（ストレージコスト考慮）
 * - maxDailyPosts: 20件（スパム対策）
 * - canSchedulePost: false（プレミアム限定機能）
 * - canViewAnalytics: false（プレミアム限定機能）
 */
const FREE_LIMITS: MembershipLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  maxDailyPosts: 20,
  canSchedulePost: false,
  canViewAnalytics: false,
}

/**
 * プレミアム会員の制限値
 *
 * ## 設定値の根拠
 * - maxPostLength: 2000文字（長文投稿が可能）
 * - maxImages: 6枚（より多くの写真を共有可能）
 * - maxVideos: 3本（動画投稿の自由度向上）
 * - maxDailyPosts: 40件（無料会員の2倍）
 * - canSchedulePost: true（予約投稿機能を解放）
 * - canViewAnalytics: true（投稿の分析機能を解放）
 */
const PREMIUM_LIMITS: MembershipLimits = {
  maxPostLength: 2000,
  maxImages: 6,
  maxVideos: 3,
  maxDailyPosts: 40,
  canSchedulePost: true,
  canViewAnalytics: true,
}

// ============================================================
// メイン関数
// ============================================================

/**
 * ユーザーがプレミアム会員かどうかを判定
 *
 * ## 機能概要
 * ユーザーIDを受け取り、プレミアム会員かどうかを判定します。
 * 期限切れの場合は自動的にフラグを更新（失効処理）します。
 *
 * ## パラメータ
 * @param userId - 判定対象のユーザーID
 *
 * ## 戻り値
 * @returns Promise<boolean> - プレミアム会員ならtrue、それ以外はfalse
 *
 * ## 処理フロー
 * 1. データベースからユーザーのプレミアム情報を取得
 * 2. ユーザーが存在しない or isPremiumがfalseならfalseを返す
 * 3. 期限が設定されていて期限切れの場合、isPremiumをfalseに更新
 * 4. それ以外はtrueを返す
 *
 * ## 期限切れの自動処理
 * premiumExpiresAtが現在時刻より前の場合、
 * isPremiumフラグを自動的にfalseに更新します。
 * これにより、サブスクリプションが終了した際に
 * 手動でフラグを更新する必要がありません。
 *
 * ## 使用例
 * ```typescript
 * const isPremium = await isPremiumUser(session.user.id)
 * if (isPremium) {
 *   // プレミアム機能を表示
 * }
 * ```
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  /**
   * データベースからユーザーのプレミアム情報を取得
   *
   * select: 必要なフィールドのみを取得（パフォーマンス最適化）
   */
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true, premiumExpiresAt: true },
  })

  /**
   * ユーザーが存在しない、またはプレミアムでない場合
   */
  if (!user || !user.isPremium) return false

  /**
   * 期限切れチェック
   *
   * premiumExpiresAtが設定されていて、
   * かつ現在時刻より前（過去）の場合は期限切れ
   *
   * new Date(): 現在時刻のDateオブジェクトを生成
   */
  if (user.premiumExpiresAt && user.premiumExpiresAt < new Date()) {
    /**
     * 期限切れの場合はフラグを更新
     *
     * 次回以降のチェックで高速に判定できるように、
     * データベースのフラグを更新しておく
     */
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
    })
    return false
  }

  return true
}

/**
 * 会員種別に応じた制限値を取得
 *
 * ## 機能概要
 * ユーザーの会員種別に応じた制限値オブジェクトを返します。
 * 投稿作成時の文字数チェックなどに使用します。
 *
 * ## パラメータ
 * @param userId - ユーザーID
 *
 * ## 戻り値
 * @returns Promise<MembershipLimits> - 制限値オブジェクト
 *
 * ## 使用例
 * ```typescript
 * const limits = await getMembershipLimits(userId)
 * if (content.length > limits.maxPostLength) {
 *   return { error: `投稿は${limits.maxPostLength}文字以内にしてください` }
 * }
 * ```
 */
export async function getMembershipLimits(userId: string): Promise<MembershipLimits> {
  const isPremium = await isPremiumUser(userId)
  return isPremium ? PREMIUM_LIMITS : FREE_LIMITS
}

/**
 * 会員種別を取得
 *
 * ## 機能概要
 * ユーザーの会員種別を文字列で返します。
 * UI表示や条件分岐に使用します。
 *
 * ## パラメータ
 * @param userId - ユーザーID
 *
 * ## 戻り値
 * @returns Promise<MembershipType> - 'free' または 'premium'
 *
 * ## 使用例
 * ```typescript
 * const type = await getMembershipType(userId)
 * if (type === 'premium') {
 *   // プレミアムバッジを表示
 * }
 * ```
 */
export async function getMembershipType(userId: string): Promise<MembershipType> {
  const isPremium = await isPremiumUser(userId)
  return isPremium ? 'premium' : 'free'
}

/**
 * 有料会員の詳細ステータスを取得
 *
 * ## 機能概要
 * プレミアム会員の詳細情報（期限、Stripe連携状態など）を取得します。
 * 設定画面やサブスクリプション管理画面で使用します。
 *
 * ## パラメータ
 * @param userId - ユーザーID
 *
 * ## 戻り値
 * @returns ステータスオブジェクト、またはnull（ユーザーが存在しない場合）
 *   - isPremium: プレミアム会員かどうか
 *   - premiumExpiresAt: 期限日時（nullの場合は無期限）
 *   - hasStripeSubscription: Stripeサブスクリプションが紐付いているか
 *
 * ## Stripe連携について
 * hasStripeSubscriptionがtrueの場合、
 * Stripeのサブスクリプションが有効です。
 * Stripeのポータルで解約やカード変更ができます。
 *
 * ## 使用例
 * ```typescript
 * const status = await getPremiumStatus(userId)
 * if (status?.hasStripeSubscription) {
 *   // Stripeポータルへのリンクを表示
 * }
 * ```
 */
export async function getPremiumStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      premiumExpiresAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  })

  if (!user) {
    return null
  }

  return {
    isPremium: user.isPremium,
    premiumExpiresAt: user.premiumExpiresAt,
    /**
     * Stripeサブスクリプションの有無
     *
     * !! (二重否定): 値をboolean型に変換
     * - stripeSubscriptionIdが存在する → true
     * - null/undefined → false
     */
    hasStripeSubscription: !!user.stripeSubscriptionId,
  }
}

// ============================================================
// バッチ処理用関数
// ============================================================

/**
 * 期限切れのプレミアム会員を一括で無効化
 *
 * ## 機能概要
 * Cronジョブ等で定期実行し、期限切れの会員を一括で失効させます。
 * 個別チェック時の負荷を軽減し、データの整合性を保ちます。
 *
 * ## 戻り値
 * @returns Promise<number> - 更新されたユーザー数
 *
 * ## Prisma updateManyについて
 * 複数レコードを一括更新するメソッド
 * where: 更新対象の条件
 * data: 更新内容
 * result.count: 更新されたレコード数
 *
 * ## クエリの条件
 * - isPremium: true（現在プレミアム会員）
 * - premiumExpiresAt < 現在時刻（期限切れ）
 *
 * ## 使用例（Cronジョブ）
 * ```typescript
 * // 毎日0時に実行
 * export async function POST() {
 *   const count = await checkPremiumExpiry()
 *   console.log(`${count}件のプレミアム会員を失効させました`)
 * }
 * ```
 *
 * ## 注意点
 * この関数は管理者APIまたはCronジョブからのみ呼び出してください。
 * 一般ユーザーからの呼び出しを防ぐため、適切な認証を設けてください。
 */
export async function checkPremiumExpiry(): Promise<number> {
  const result = await prisma.user.updateMany({
    where: {
      isPremium: true,
      premiumExpiresAt: {
        lt: new Date(),  // lt: less than（より小さい）= 期限切れ
      },
    },
    data: {
      isPremium: false,
    },
  })

  return result.count
}

// ============================================================
// エクスポート
// ============================================================

/**
 * 制限値の定数をエクスポート
 *
 * ## なぜ定数をエクスポートするか？
 * - フォームのバリデーションで使用
 * - UIでの表示（「プレミアムなら○○文字まで投稿可能」など）
 * - テストでの検証
 *
 * ## 使用例
 * ```typescript
 * import { FREE_LIMITS, PREMIUM_LIMITS } from '@/lib/premium'
 *
 * // プランの比較表を表示
 * <p>無料: {FREE_LIMITS.maxPostLength}文字</p>
 * <p>プレミアム: {PREMIUM_LIMITS.maxPostLength}文字</p>
 * ```
 */
export { FREE_LIMITS, PREMIUM_LIMITS }
