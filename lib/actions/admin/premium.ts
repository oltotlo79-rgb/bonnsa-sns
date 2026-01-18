/**
 * 管理者用プレミアム会員管理Server Actions
 *
 * このファイルは、管理者がプレミアム（有料）会員を管理するための
 * サーバーサイド処理を提供します。
 *
 * ## 機能概要
 * - プレミアム会員の付与・取り消し・延長
 * - プレミアム会員一覧の取得
 * - プレミアム統計情報の取得
 * - ユーザー検索（プレミアム付与用）
 *
 * ## 認可
 * 全ての操作は管理者権限（AdminUser）が必要です。
 * 一般ユーザーからのアクセスは拒否されます。
 *
 * ## 監査ログ
 * 全ての管理操作は AdminLog テーブルに記録されます。
 * これにより、誰がいつ何をしたかを追跡できます。
 *
 * ## Stripeとの関係
 * このファイルの操作は手動によるプレミアム管理です。
 * Stripe経由の自動サブスクリプションとは独立しています。
 * - 手動付与: プロモーション、テスト、カスタマーサポート用
 * - Stripe: 通常の課金フロー
 *
 * @module lib/actions/admin/premium
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
 * 現在のセッション情報を取得
 */
import { auth } from '@/lib/auth'

/**
 * パス再検証
 * 管理画面のキャッシュを更新するために使用
 */
import { revalidatePath } from 'next/cache'

// ============================================================
// 内部ヘルパー関数
// ============================================================

/**
 * 管理者権限チェック
 *
 * ## 機能概要
 * 現在のユーザーが管理者権限を持っているかを確認します。
 *
 * ## 認証フロー
 * 1. セッションからユーザーIDを取得
 * 2. AdminUserテーブルで管理者かどうかを確認
 * 3. 結果を返す
 *
 * ## 戻り値
 * - 成功時: { adminUser, userId }
 * - 失敗時: { error: "エラーメッセージ" }
 *
 * ## 使用例
 * ```typescript
 * const authResult = await checkAdminAuth()
 * if ('error' in authResult) {
 *   return authResult // エラーをそのまま返す
 * }
 * const { adminUser, userId } = authResult
 * ```
 */
async function checkAdminAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  return { adminUser, userId: session.user.id }
}

// ============================================================
// プレミアム会員管理
// ============================================================

/**
 * プレミアム（有料）会員を付与
 *
 * ## 機能概要
 * 指定したユーザーにプレミアム会員資格を付与します。
 *
 * ## パラメータ
 * @param targetUserId - 対象ユーザーのID
 * @param durationDays - 有効期間（日数）。デフォルト: 30日
 *
 * ## 戻り値
 * @returns { success: true, expiresAt: Date } - 成功時
 * @returns { error: string } - 失敗時
 *
 * ## 処理フロー
 * 1. 管理者権限チェック
 * 2. 対象ユーザーの存在確認
 * 3. 有効期限を計算（現在日時 + durationDays日）
 * 4. ユーザーのプレミアム状態を更新
 * 5. 管理者ログを記録
 * 6. 管理画面のキャッシュを更新
 *
 * ## 使用例
 * ```typescript
 * // 30日間のプレミアムを付与
 * const result = await grantPremium('user123')
 *
 * // 1年間のプレミアムを付与
 * const result = await grantPremium('user123', 365)
 *
 * if (result.success) {
 *   console.log(`期限: ${result.expiresAt}`)
 * }
 * ```
 */
export async function grantPremium(targetUserId: string, durationDays: number = 30) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return authResult
  }

  const { userId: adminId } = authResult

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  })

  if (!targetUser) {
    return { error: 'ユーザーが見つかりません' }
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + durationDays)

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      isPremium: true,
      premiumExpiresAt: expiresAt,
    },
  })

  // 管理者ログを記録
  await prisma.adminLog.create({
    data: {
      adminId,
      action: 'grant_premium',
      targetType: 'user',
      targetId: targetUserId,
      details: { durationDays, expiresAt: expiresAt.toISOString() },
    },
  })

  /**
   * 管理画面のキャッシュを更新
   * revalidatePath: 指定したパスのキャッシュを無効化
   */
  revalidatePath('/admin/premium')
  return { success: true, expiresAt }
}

/**
 * プレミアム（有料）会員を取り消し
 *
 * ## 機能概要
 * 指定したユーザーのプレミアム会員資格を取り消します。
 *
 * ## パラメータ
 * @param targetUserId - 対象ユーザーのID
 *
 * ## 戻り値
 * @returns { success: true } - 成功時
 * @returns { error: string } - 失敗時
 *
 * ## 処理フロー
 * 1. 管理者権限チェック
 * 2. 対象ユーザーの存在確認
 * 3. プレミアム状態の確認
 * 4. プレミアム状態を解除
 * 5. 管理者ログを記録
 *
 * ## 注意事項
 * - Stripe連携情報（stripeCustomerId, stripeSubscriptionId）は残す
 * - 再登録時に同じStripe顧客として扱えるようにするため
 * - 返金処理は別途対応が必要
 *
 * ## 使用例
 * ```typescript
 * const result = await revokePremium('user123')
 * if (result.success) {
 *   toast.success('プレミアム会員を取り消しました')
 * }
 * ```
 */
export async function revokePremium(targetUserId: string) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return authResult
  }

  const { userId: adminId } = authResult

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isPremium: true },
  })

  if (!targetUser) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (!targetUser.isPremium) {
    return { error: 'このユーザーは有料会員ではありません' }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      isPremium: false,
      premiumExpiresAt: null,
      // Stripe連携は残す（再登録時に使用可能）
    },
  })

  // 管理者ログを記録
  await prisma.adminLog.create({
    data: {
      adminId,
      action: 'revoke_premium',
      targetType: 'user',
      targetId: targetUserId,
    },
  })

  revalidatePath('/admin/premium')
  return { success: true }
}

/**
 * プレミアム会員期限を延長
 *
 * ## 機能概要
 * 既存のプレミアム会員の有効期限を延長します。
 *
 * ## パラメータ
 * @param targetUserId - 対象ユーザーのID
 * @param additionalDays - 追加する日数
 *
 * ## 戻り値
 * @returns { success: true, newExpiresAt: Date } - 成功時
 * @returns { error: string } - 失敗時
 *
 * ## 期限延長のロジック
 * - 現在プレミアムで期限が未来: 現在の期限 + additionalDays
 * - 期限切れまたは非プレミアム: 現在日時 + additionalDays
 *
 * ## 使用例
 * ```typescript
 * // 現在の期限から30日延長
 * const result = await extendPremium('user123', 30)
 *
 * // 例: 現在の期限が1/15の場合
 * // → 新しい期限は2/14
 * ```
 *
 * ## 使用場面
 * - カスタマーサポート対応
 * - プロモーション特典
 * - 障害発生時の補償
 */
export async function extendPremium(targetUserId: string, additionalDays: number) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return authResult
  }

  const { userId: adminId } = authResult

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isPremium: true, premiumExpiresAt: true },
  })

  if (!targetUser) {
    return { error: 'ユーザーが見つかりません' }
  }

  // 現在の期限から延長（期限切れの場合は現在時刻から）
  const baseDate = targetUser.premiumExpiresAt && targetUser.premiumExpiresAt > new Date()
    ? targetUser.premiumExpiresAt
    : new Date()

  const newExpiresAt = new Date(baseDate)
  newExpiresAt.setDate(newExpiresAt.getDate() + additionalDays)

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      isPremium: true,
      premiumExpiresAt: newExpiresAt,
    },
  })

  // 管理者ログを記録
  await prisma.adminLog.create({
    data: {
      adminId,
      action: 'extend_premium',
      targetType: 'user',
      targetId: targetUserId,
      details: { additionalDays, newExpiresAt: newExpiresAt.toISOString() },
    },
  })

  revalidatePath('/admin/premium')
  return { success: true, newExpiresAt }
}

// ============================================================
// プレミアム会員データ取得
// ============================================================

/**
 * プレミアム会員一覧を取得
 *
 * ## 機能概要
 * 現在プレミアム会員であるユーザーの一覧を取得します。
 *
 * ## パラメータ
 * @param options.search - 検索クエリ（メール/ニックネーム）
 * @param options.limit - 取得件数（デフォルト: 20）
 * @param options.offset - オフセット（ページネーション用）
 *
 * ## 戻り値
 * @returns { users: User[], total: number } - 成功時
 * @returns { error: string } - 失敗時
 *
 * ## ソート順
 * premiumExpiresAt の昇順（期限が近い順）
 * → 期限切れ間近のユーザーを優先表示
 *
 * ## 使用例
 * ```typescript
 * // 全件取得
 * const { users, total } = await getPremiumUsers()
 *
 * // 検索
 * const { users } = await getPremiumUsers({ search: 'test@' })
 *
 * // ページネーション
 * const { users } = await getPremiumUsers({ limit: 10, offset: 20 })
 * ```
 */
export async function getPremiumUsers(options: { search?: string; limit?: number; offset?: number } = {}) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return { error: authResult.error }
  }

  const { search, limit = 20, offset = 0 } = options

  const where = {
    isPremium: true,
    ...(search && {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { nickname: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        isPremium: true,
        premiumExpiresAt: true,
        stripeSubscriptionId: true,
        createdAt: true,
      },
      orderBy: { premiumExpiresAt: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where }),
  ])

  return { users, total }
}

/**
 * プレミアム会員の統計情報を取得
 *
 * ## 機能概要
 * プレミアム会員に関する各種統計データを取得します。
 * 管理ダッシュボードでの表示に使用します。
 *
 * ## 戻り値
 * @returns {
 *   totalPremiumUsers: number,  // プレミアム会員総数
 *   newThisMonth: number,       // 今月の新規会員数
 *   expiringIn7Days: number,    // 7日以内に期限切れになる会員数
 *   totalRevenue: number        // 累計売上（成功した支払いの合計）
 * }
 *
 * ## 統計の詳細
 * - **totalPremiumUsers**: isPremium: true のユーザー数
 * - **newThisMonth**: 今月1日以降に作成されたプレミアムユーザー
 * - **expiringIn7Days**: 期限が今日〜7日後のユーザー
 * - **totalRevenue**: Paymentテーブルの成功分の合計額
 *
 * ## 使用例
 * ```typescript
 * const stats = await getPremiumStats()
 * if ('error' in stats) return
 *
 * console.log(`会員数: ${stats.totalPremiumUsers}`)
 * console.log(`売上: ¥${stats.totalRevenue.toLocaleString()}`)
 * ```
 */
export async function getPremiumStats() {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return { error: authResult.error }
  }

  const now = new Date()
  const sevenDaysLater = new Date()
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalPremiumUsers, expiringIn7Days, newThisMonth, totalPayments] = await Promise.all([
    // 有料会員総数
    prisma.user.count({
      where: { isPremium: true },
    }),
    // 7日以内に期限切れになるユーザー
    prisma.user.count({
      where: {
        isPremium: true,
        premiumExpiresAt: {
          gte: now,
          lte: sevenDaysLater,
        },
      },
    }),
    // 今月の新規有料会員
    prisma.user.count({
      where: {
        isPremium: true,
        createdAt: { gte: monthStart },
      },
    }),
    // 総支払い額（成功分のみ）
    prisma.payment.aggregate({
      where: { status: 'succeeded' },
      _sum: { amount: true },
    }),
  ])

  return {
    totalPremiumUsers,
    newThisMonth,
    expiringIn7Days,
    /**
     * 総売上
     * _sum.amount が null の場合は 0 を返す
     */
    totalRevenue: totalPayments._sum.amount || 0,
  }
}

/**
 * ユーザーを検索してプレミアム状態を確認
 *
 * ## 機能概要
 * メールアドレスまたはニックネームでユーザーを検索し、
 * プレミアム状態を含む情報を返します。
 *
 * ## 用途
 * プレミアム付与・取り消し操作の前に、対象ユーザーを検索するために使用。
 *
 * ## パラメータ
 * @param query - 検索クエリ（2文字以上必要）
 *
 * ## 戻り値
 * @returns { users: User[] } - 成功時（最大10件）
 * @returns { error: string } - 失敗時
 *
 * ## 検索条件
 * - メールアドレスに部分一致 OR
 * - ニックネームに部分一致
 * - 大文字小文字を区別しない
 *
 * ## 使用例
 * ```typescript
 * const { users } = await searchUserForPremium('test@')
 *
 * users.forEach(user => {
 *   console.log(`${user.nickname}: ${user.isPremium ? 'プレミアム' : '無料'}`)
 * })
 * ```
 */
export async function searchUserForPremium(query: string) {
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return authResult
  }

  if (!query || query.length < 2) {
    return { users: [] }
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { nickname: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      isPremium: true,
      premiumExpiresAt: true,
    },
    take: 10,
  })

  return { users }
}
