/**
 * 通報機能のServer Actions
 *
 * このファイルは、不適切なコンテンツの通報に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - ユーザーからの通報作成
 * - 通報一覧取得（管理者用）
 * - 通報ステータス更新（管理者用）
 * - 通報統計取得（管理者用）
 * - 自動非表示機能
 *
 * ## 通報対象
 * - post: 投稿
 * - comment: コメント
 * - event: イベント
 * - shop: 盆栽園
 * - review: レビュー
 * - user: ユーザー
 *
 * ## 通報ステータス
 * - pending: 未対応
 * - reviewed: 確認中
 * - resolved: 対応済み
 * - dismissed: 却下
 * - auto_hidden: 自動非表示
 *
 * ## 自動非表示機能
 * 同一コンテンツへの通報が一定数（しきい値）に達すると
 * 自動的に非表示にします。
 *
 * @module lib/actions/report
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
 * Next.jsのキャッシュ再検証
 */
import { revalidatePath } from 'next/cache'

/**
 * 通報関連の型と定数
 * - ReportReason: 通報理由
 * - ReportTargetType: 通報対象の種類
 * - ReportStatus: 通報のステータス
 * - AUTO_HIDE_THRESHOLD: 自動非表示のしきい値
 * - TARGET_TYPE_LABELS: 対象種類の日本語ラベル
 */
import type { ReportReason, ReportTargetType, ReportStatus } from '@/lib/constants/report'
import { AUTO_HIDE_THRESHOLD, TARGET_TYPE_LABELS } from '@/lib/constants/report'

// ============================================================
// 型定義
// ============================================================

/**
 * 通報作成パラメータ
 */
interface CreateReportParams {
  /** 通報対象の種類 */
  targetType: ReportTargetType
  /** 通報対象のID */
  targetId: string
  /** 通報理由 */
  reason: ReportReason
  /** 詳細説明（任意） */
  description?: string
}

// ============================================================
// 通報作成
// ============================================================

/**
 * 通報を作成
 *
 * ## 機能概要
 * ユーザーが不適切なコンテンツを通報します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. 対象の存在確認
 * 3. 自己通報チェック（自分のコンテンツは通報不可）
 * 4. 重複通報チェック
 * 5. 通報を作成
 * 6. 自動非表示チェック（しきい値に達したら非表示）
 *
 * ## 自動非表示
 * 同一コンテンツへの通報がAUTO_HIDE_THRESHOLDに達すると
 * 自動的にコンテンツを非表示にします。
 *
 * @param params - 通報パラメータ
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await createReport({
 *   targetType: 'post',
 *   targetId: 'post-123',
 *   reason: 'spam',
 *   description: '明らかな宣伝投稿です',
 * })
 * ```
 */
export async function createReport(params: CreateReportParams) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const { targetType, targetId, reason, description } = params

  // ------------------------------------------------------------
  // 対象の存在確認と所有者取得
  // ------------------------------------------------------------

  /**
   * 対象の所有者ID
   * 自己通報チェックに使用
   */
  let targetUserId: string | null = null

  /**
   * 対象の種類ごとに存在確認と所有者取得
   *
   * switch文で各種類に対応
   */
  switch (targetType) {
    case 'post': {
      /**
       * 投稿の存在確認
       */
      const post = await prisma.post.findUnique({
        where: { id: targetId },
        select: { userId: true },
      })
      if (!post) return { error: '対象が見つかりません' }
      targetUserId = post.userId
      break
    }
    case 'comment': {
      /**
       * コメントの存在確認
       */
      const comment = await prisma.comment.findUnique({
        where: { id: targetId },
        select: { userId: true },
      })
      if (!comment) return { error: '対象が見つかりません' }
      targetUserId = comment.userId
      break
    }
    case 'event': {
      /**
       * イベントの存在確認
       */
      const event = await prisma.event.findUnique({
        where: { id: targetId },
        select: { createdBy: true },
      })
      if (!event) return { error: '対象が見つかりません' }
      targetUserId = event.createdBy
      break
    }
    case 'shop': {
      /**
       * 盆栽園の存在確認
       */
      const shop = await prisma.bonsaiShop.findUnique({
        where: { id: targetId },
        select: { createdBy: true },
      })
      if (!shop) return { error: '対象が見つかりません' }
      targetUserId = shop.createdBy
      break
    }
    case 'review': {
      /**
       * レビューの存在確認
       */
      const review = await prisma.shopReview.findUnique({
        where: { id: targetId },
        select: { userId: true },
      })
      if (!review) return { error: '対象が見つかりません' }
      targetUserId = review.userId
      break
    }
    case 'user': {
      /**
       * ユーザーの存在確認
       */
      const user = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      })
      if (!user) return { error: '対象が見つかりません' }
      targetUserId = user.id
      break
    }
  }

  // ------------------------------------------------------------
  // 自己通報チェック
  // ------------------------------------------------------------

  /**
   * 自分自身のコンテンツは通報不可
   */
  if (targetUserId === session.user.id) {
    return { error: '自分自身のコンテンツは通報できません' }
  }

  // ------------------------------------------------------------
  // 重複通報チェック
  // ------------------------------------------------------------

  /**
   * 同じユーザーが同じ対象を既に通報していないか確認
   */
  const existing = await prisma.report.findFirst({
    where: {
      reporterId: session.user.id,
      targetType,
      targetId,
    },
  })

  if (existing) {
    return { error: '既に通報済みです' }
  }

  // ------------------------------------------------------------
  // 通報を作成
  // ------------------------------------------------------------

  await prisma.report.create({
    data: {
      reporterId: session.user.id,
      targetType,
      targetId,
      reason,
      description: description?.trim() || null,
      status: 'pending',  // 初期状態は「未対応」
    },
  })

  // ------------------------------------------------------------
  // 自動非表示チェック
  // ------------------------------------------------------------

  /**
   * 同一コンテンツへの通報者数をカウント
   * （ユニークな通報者数ではなく、通報レコード数）
   */
  const reportCount = await prisma.report.count({
    where: {
      targetType,
      targetId,
    },
  })

  /**
   * しきい値に達したら自動非表示
   */
  if (reportCount >= AUTO_HIDE_THRESHOLD) {
    await autoHideContent(targetType, targetId, reportCount)
  }

  return { success: true }
}

// ============================================================
// 自動非表示処理（内部関数）
// ============================================================

/**
 * コンテンツを自動非表示にする（内部関数）
 *
 * ## 機能概要
 * 通報がしきい値に達したコンテンツを自動的に非表示にします。
 *
 * ## 処理内容
 * 1. 対象コンテンツを非表示に更新
 * 2. 関連する通報のステータスを「auto_hidden」に更新
 * 3. 管理者通知を作成
 *
 * @param targetType - 対象の種類
 * @param targetId - 対象のID
 * @param reportCount - 通報数
 */
async function autoHideContent(
  targetType: ReportTargetType,
  targetId: string,
  reportCount: number
) {
  const now = new Date()

  // ------------------------------------------------------------
  // コンテンツを非表示に更新
  // ------------------------------------------------------------

  /**
   * 対象の種類ごとに非表示フラグを設定
   */
  switch (targetType) {
    case 'post':
      /**
       * 投稿を非表示に
       */
      await prisma.post.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'comment':
      /**
       * コメントを非表示に
       */
      await prisma.comment.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'event':
      /**
       * イベントを非表示に
       */
      await prisma.event.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'shop':
      /**
       * 盆栽園を非表示に
       */
      await prisma.bonsaiShop.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'review':
      /**
       * レビューを非表示に
       */
      await prisma.shopReview.update({
        where: { id: targetId },
        data: { isHidden: true, hiddenAt: now },
      })
      break
    case 'user':
      /**
       * ユーザーの場合はアカウント停止
       * （非表示ではなく停止処理）
       */
      await prisma.user.update({
        where: { id: targetId },
        data: { isSuspended: true, suspendedAt: now },
      })
      break
  }

  // ------------------------------------------------------------
  // 通報ステータスを更新
  // ------------------------------------------------------------

  /**
   * 該当する通報のステータスをauto_hiddenに更新
   *
   * updateMany: 条件に合う全レコードを一括更新
   */
  await prisma.report.updateMany({
    where: { targetType, targetId, status: 'pending' },
    data: { status: 'auto_hidden' },
  })

  // ------------------------------------------------------------
  // 管理者通知を作成
  // ------------------------------------------------------------

  /**
   * 対象種類の日本語ラベルを取得
   * 例: 'post' → '投稿'
   */
  const label = TARGET_TYPE_LABELS[targetType]

  /**
   * 管理者向けの通知を作成
   */
  await prisma.adminNotification.create({
    data: {
      type: 'auto_hidden',
      targetType,
      targetId,
      message: `${label}が${reportCount}件の通報を受け自動非表示になりました`,
      reportCount,
    },
  })
}

// ============================================================
// 通報一覧取得（管理者用）
// ============================================================

/**
 * 通報一覧を取得（管理者用）
 *
 * ## 機能概要
 * 管理者が通報一覧を確認するための関数です。
 *
 * ## フィルターオプション
 * - status: 通報ステータス
 * - targetType: 対象の種類
 * - limit: 取得件数
 * - offset: オフセット（ページネーション用）
 *
 * @param options - フィルターオプション
 * @returns 通報一覧と総数
 *
 * @example
 * ```typescript
 * // 未対応の通報を取得
 * const { reports, total } = await getReports({
 *   status: 'pending',
 *   limit: 20,
 * })
 * ```
 */
export async function getReports(options?: {
  status?: ReportStatus
  targetType?: ReportTargetType
  limit?: number
  offset?: number
}) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 管理者権限チェック
  // ------------------------------------------------------------

  /**
   * AdminUserテーブルで管理者かどうか確認
   */
  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  // ------------------------------------------------------------
  // オプションの展開
  // ------------------------------------------------------------

  const { status, targetType, limit = 50, offset = 0 } = options || {}

  // ------------------------------------------------------------
  // 通報一覧と総数を並列取得
  // ------------------------------------------------------------

  /**
   * Promise.all で並列実行
   * - 通報一覧の取得
   * - 通報総数のカウント
   */
  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where: {
        /**
         * スプレッド演算子で条件付きフィルター
         */
        ...(status && { status }),
        ...(targetType && { targetType }),
      },
      include: {
        /**
         * 通報者の情報を含める
         */
        reporter: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
      /**
       * 新しい通報から順に
       */
      orderBy: { createdAt: 'desc' },
      /**
       * ページネーション
       */
      take: limit,
      skip: offset,
    }),
    /**
     * 同じフィルター条件で総数をカウント
     */
    prisma.report.count({
      where: {
        ...(status && { status }),
        ...(targetType && { targetType }),
      },
    }),
  ])

  return { reports, total }
}

// ============================================================
// 通報ステータス更新（管理者用）
// ============================================================

/**
 * 通報ステータスを更新（管理者用）
 *
 * ## 機能概要
 * 管理者が通報のステータスを更新します。
 *
 * ## ステータス遷移
 * pending → reviewed → resolved/dismissed
 *
 * ## 管理ログ
 * 操作履歴をAdminLogテーブルに記録します。
 *
 * @param reportId - 通報ID
 * @param status - 新しいステータス
 * @param note - 管理者メモ（任意）
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await updateReportStatus(
 *   'report-123',
 *   'resolved',
 *   '投稿を削除しました'
 * )
 * ```
 */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  note?: string
) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 管理者権限チェック
  // ------------------------------------------------------------

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  // ------------------------------------------------------------
  // 通報の存在確認
  // ------------------------------------------------------------

  const report = await prisma.report.findUnique({
    where: { id: reportId },
  })

  if (!report) {
    return { error: '通報が見つかりません' }
  }

  // ------------------------------------------------------------
  // ステータス更新と管理ログ作成
  // ------------------------------------------------------------

  /**
   * $transaction でアトミックに実行
   * - 通報のステータス更新
   * - 管理ログの作成
   */
  await prisma.$transaction([
    /**
     * 通報のステータスを更新
     */
    prisma.report.update({
      where: { id: reportId },
      data: { status },
    }),
    /**
     * 管理ログを作成
     * 操作履歴として保存
     */
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'update_report_status',
        targetType: 'report',
        targetId: reportId,
        /**
         * 詳細をJSON形式で保存
         */
        details: JSON.stringify({
          previousStatus: report.status,
          newStatus: status,
          note,
        }),
      },
    }),
  ])

  // ページキャッシュを再検証
  revalidatePath('/admin/reports')

  return { success: true }
}

// ============================================================
// 通報対象コンテンツ削除（管理者用）
// ============================================================

/**
 * 通報対象のコンテンツを削除（管理者用）
 *
 * ## 機能概要
 * 管理者が通報されたコンテンツを削除します。
 *
 * ## 処理内容
 * 1. 管理者権限チェック
 * 2. 対象コンテンツを削除
 * 3. 関連する通報のステータスを「resolved」に更新
 * 4. 管理ログを作成
 *
 * ## 削除対象
 * - post: 投稿（関連するメディア、コメント、いいね等も連鎖削除）
 * - comment: コメント
 * - event: イベント
 * - shop: 盆栽園（関連するレビュー等も連鎖削除）
 * - review: レビュー
 * - user: ユーザーの場合は停止処理（削除ではない）
 *
 * @param targetType - 対象の種類
 * @param targetId - 対象のID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await deleteReportedContent('post', 'post-123')
 * ```
 */
export async function deleteReportedContent(
  targetType: ReportTargetType,
  targetId: string
) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 管理者権限チェック
  // ------------------------------------------------------------

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  // ------------------------------------------------------------
  // 対象コンテンツを削除
  // ------------------------------------------------------------

  try {
    switch (targetType) {
      case 'post': {
        // 投稿を削除（Prismaのカスケード削除で関連データも削除される）
        await prisma.post.delete({
          where: { id: targetId },
        })
        break
      }
      case 'comment': {
        // コメントを削除
        await prisma.comment.delete({
          where: { id: targetId },
        })
        break
      }
      case 'event': {
        // イベントを削除
        await prisma.event.delete({
          where: { id: targetId },
        })
        break
      }
      case 'shop': {
        // 盆栽園を削除（関連するレビュー等も連鎖削除）
        await prisma.bonsaiShop.delete({
          where: { id: targetId },
        })
        break
      }
      case 'review': {
        // レビューを削除
        await prisma.shopReview.delete({
          where: { id: targetId },
        })
        break
      }
      case 'user': {
        // ユーザーの場合は削除ではなくアカウント停止
        await prisma.user.update({
          where: { id: targetId },
          data: { isSuspended: true, suspendedAt: new Date() },
        })
        break
      }
    }

    // ------------------------------------------------------------
    // 関連する通報を削除
    // ------------------------------------------------------------

    await prisma.report.deleteMany({
      where: { targetType, targetId },
    })

    // ------------------------------------------------------------
    // 管理ログを作成
    // ------------------------------------------------------------

    const label = TARGET_TYPE_LABELS[targetType]
    await prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: targetType === 'user' ? 'suspend_user' : 'delete_content',
        targetType,
        targetId,
        details: JSON.stringify({
          action: targetType === 'user' ? 'アカウント停止' : `${label}を削除`,
        }),
      },
    })

    // ページキャッシュを再検証
    revalidatePath('/admin/reports')

    return { success: true }
  } catch {
    return { error: '削除に失敗しました' }
  }
}

// ============================================================
// 通報レコード削除（管理者用）
// ============================================================

/**
 * 通報レコードを削除（管理者用）
 *
 * コンテンツが既に削除されている場合など、
 * 通報レコードだけを削除したい場合に使用します。
 *
 * @param reportId - 通報ID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 */
export async function deleteReport(reportId: string) {
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

  try {
    await prisma.report.delete({
      where: { id: reportId },
    })

    await prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'delete_report',
        targetType: 'report',
        targetId: reportId,
        details: JSON.stringify({ action: '通報レコードを削除' }),
      },
    })

    revalidatePath('/admin/reports')

    return { success: true }
  } catch {
    return { error: '削除に失敗しました' }
  }
}

// ============================================================
// 通報統計取得（管理者用）
// ============================================================

/**
 * 通報統計を取得（管理者用）
 *
 * ## 機能概要
 * 管理ダッシュボード用の通報統計を取得します。
 *
 * ## 返却情報
 * - pending: 未対応の通報数
 * - reviewed: 確認中の通報数
 * - resolved: 対応済みの通報数
 * - dismissed: 却下した通報数
 * - total: 通報総数
 * - byType: 対象種類ごとの通報数
 *
 * @returns 通報統計
 *
 * @example
 * ```typescript
 * const { stats } = await getReportStats()
 *
 * console.log(`未対応: ${stats.pending}件`)
 * console.log(`対応済み: ${stats.resolved}件`)
 * ```
 */
export async function getReportStats() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 管理者権限チェック
  // ------------------------------------------------------------

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  // ------------------------------------------------------------
  // 各統計を並列取得
  // ------------------------------------------------------------

  /**
   * Promise.all で5つのクエリを並列実行
   */
  const [pending, reviewed, resolved, dismissed, byType] = await Promise.all([
    /**
     * 未対応の通報数
     */
    prisma.report.count({ where: { status: 'pending' } }),
    /**
     * 確認中の通報数
     */
    prisma.report.count({ where: { status: 'reviewed' } }),
    /**
     * 対応済みの通報数
     */
    prisma.report.count({ where: { status: 'resolved' } }),
    /**
     * 却下した通報数
     */
    prisma.report.count({ where: { status: 'dismissed' } }),
    /**
     * 対象種類ごとの通報数
     *
     * groupBy: targetTypeでグループ化
     */
    prisma.report.groupBy({
      by: ['targetType'],
      _count: true,
    }),
  ])

  // ------------------------------------------------------------
  // 結果を整形して返却
  // ------------------------------------------------------------

  return {
    stats: {
      pending,
      reviewed,
      resolved,
      dismissed,
      /**
       * 総数を計算
       */
      total: pending + reviewed + resolved + dismissed,
      /**
       * 対象種類ごとの通報数をオブジェクトに変換
       *
       * reduce: 配列をオブジェクトに変換
       * 例: [{ targetType: 'post', _count: 5 }] → { post: 5 }
       */
      byType: byType.reduce((acc: Record<string, number>, item: { targetType: string; _count: number }) => {
        acc[item.targetType] = item._count
        return acc
      }, {}),
    },
  }
}
