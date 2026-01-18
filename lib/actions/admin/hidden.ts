/**
 * 管理者用非表示コンテンツ管理Server Actions
 *
 * このファイルは、管理者が非表示になったコンテンツを管理するための
 * サーバーサイド処理を提供します。
 *
 * ## 機能概要
 * - 非表示コンテンツ一覧の取得
 * - コンテンツの再表示（非表示解除）
 * - コンテンツの完全削除
 * - 管理者通知の管理
 *
 * ## 非表示になる原因
 * 1. **自動非表示**: 通報が一定数（AUTO_HIDE_THRESHOLD）を超えた場合
 * 2. **手動非表示**: 管理者による手動操作
 *
 * ## 対象コンテンツ
 * - post: 投稿
 * - comment: コメント
 * - event: イベント
 * - shop: 盆栽園
 * - review: レビュー
 *
 * ## 監査ログ
 * 全ての管理操作は AdminLog テーブルに記録されます。
 *
 * @module lib/actions/admin/hidden
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
// 型定義
// ============================================================

/**
 * コンテンツタイプ
 *
 * ## 各タイプの説明
 * - post: ユーザーの投稿（テキスト、画像、動画）
 * - comment: 投稿へのコメント
 * - event: イベント情報
 * - shop: 盆栽園の情報
 * - review: 盆栽園へのレビュー
 */
type ContentType = 'post' | 'comment' | 'event' | 'shop' | 'review'

// ============================================================
// 内部ヘルパー関数
// ============================================================

/**
 * 管理者権限チェック
 *
 * ## 機能概要
 * 現在のユーザーが管理者権限を持っているかを確認します。
 *
 * ## 戻り値
 * - 成功時: { error: null, adminId: string }
 * - 失敗時: { error: "エラーメッセージ", adminId: null }
 *
 * ## 使用例
 * ```typescript
 * const authResult = await checkAdminAuth()
 * if (authResult.error) {
 *   return { error: authResult.error }
 * }
 * const adminId = authResult.adminId
 * ```
 */
async function checkAdminAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', adminId: null }
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です', adminId: null }
  }

  return { error: null, adminId: adminUser.userId }
}

// ============================================================
// 非表示コンテンツ管理
// ============================================================

/**
 * 非表示コンテンツ一覧を取得
 *
 * ## 機能概要
 * 現在非表示になっている全てのコンテンツを取得します。
 * 各コンテンツタイプ（投稿、コメント、イベント等）から
 * isHidden: true のアイテムを収集します。
 *
 * ## パラメータ
 * @param options.type - 特定のコンテンツタイプのみ取得（省略時は全タイプ）
 * @param options.limit - 取得件数（デフォルト: 50）
 * @param options.offset - オフセット（ページネーション用）
 *
 * ## 戻り値
 * @returns { items: HiddenContent[] } - 成功時
 * @returns { error: string } - 失敗時
 *
 * ## 戻り値のデータ構造
 * ```typescript
 * {
 *   type: 'post',              // コンテンツタイプ
 *   id: 'abc123',              // コンテンツID
 *   content: '投稿本文...',    // コンテンツの内容
 *   createdBy: {               // 作成者情報
 *     id: string,
 *     nickname: string,
 *     avatarUrl: string | null
 *   },
 *   hiddenAt: Date,            // 非表示にされた日時
 *   reportCount: 5             // 通報件数
 * }
 * ```
 *
 * ## ソート順
 * hiddenAt の降順（新しく非表示になったものが先）
 */
export async function getHiddenContent(options?: {
  type?: ContentType
  limit?: number
  offset?: number
}) {
  const authResult = await checkAdminAuth()
  if (authResult.error) {
    return { error: authResult.error }
  }

  const { type, limit = 50, offset = 0 } = options || {}

  // 各コンテンツタイプの非表示アイテムを取得
  const results: {
    type: ContentType
    id: string
    content: string | null
    createdBy: { id: string; nickname: string; avatarUrl: string | null }
    hiddenAt: Date | null
    reportCount: number
  }[] = []

  // 投稿
  if (!type || type === 'post') {
    const hiddenPosts = await prisma.post.findMany({
      where: { isHidden: true },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const post of hiddenPosts) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'post', targetId: post.id },
      })
      results.push({
        type: 'post',
        id: post.id,
        content: post.content,
        createdBy: post.user,
        hiddenAt: post.hiddenAt,
        reportCount,
      })
    }
  }

  // コメント
  if (!type || type === 'comment') {
    const hiddenComments = await prisma.comment.findMany({
      where: { isHidden: true },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        post: {
          select: { id: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const comment of hiddenComments) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'comment', targetId: comment.id },
      })
      results.push({
        type: 'comment',
        id: comment.id,
        content: comment.content,
        createdBy: comment.user,
        hiddenAt: comment.hiddenAt,
        reportCount,
      })
    }
  }

  // イベント
  if (!type || type === 'event') {
    const hiddenEvents = await prisma.event.findMany({
      where: { isHidden: true },
      include: {
        creator: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const event of hiddenEvents) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'event', targetId: event.id },
      })
      results.push({
        type: 'event',
        id: event.id,
        content: `${event.title}${event.description ? `: ${event.description}` : ''}`,
        createdBy: event.creator,
        hiddenAt: event.hiddenAt,
        reportCount,
      })
    }
  }

  // 盆栽園
  if (!type || type === 'shop') {
    const hiddenShops = await prisma.bonsaiShop.findMany({
      where: { isHidden: true },
      include: {
        creator: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const shop of hiddenShops) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'shop', targetId: shop.id },
      })
      results.push({
        type: 'shop',
        id: shop.id,
        content: `${shop.name} (${shop.address})`,
        createdBy: shop.creator,
        hiddenAt: shop.hiddenAt,
        reportCount,
      })
    }
  }

  // レビュー
  if (!type || type === 'review') {
    const hiddenReviews = await prisma.shopReview.findMany({
      where: { isHidden: true },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        shop: {
          select: { name: true },
        },
      },
      orderBy: { hiddenAt: 'desc' },
      take: type ? limit : 10,
      skip: type ? offset : 0,
    })

    for (const review of hiddenReviews) {
      const reportCount = await prisma.report.count({
        where: { targetType: 'review', targetId: review.id },
      })
      results.push({
        type: 'review',
        id: review.id,
        content: `${review.shop.name}へのレビュー: ${review.content || '(コメントなし)'}`,
        createdBy: review.user,
        hiddenAt: review.hiddenAt,
        reportCount,
      })
    }
  }

  // 非表示日時でソート
  results.sort((a: typeof results[number], b: typeof results[number]) => {
    if (!a.hiddenAt || !b.hiddenAt) return 0
    return b.hiddenAt.getTime() - a.hiddenAt.getTime()
  })

  return { items: results }
}

/**
 * コンテンツを再表示（非表示を解除）
 *
 * ## 機能概要
 * 非表示になっているコンテンツを再び表示可能な状態に戻します。
 *
 * ## パラメータ
 * @param type - コンテンツタイプ
 * @param id - コンテンツID
 *
 * ## 戻り値
 * @returns { success: true } - 成功時
 * @returns { error: string } - 失敗時
 *
 * ## 処理フロー
 * 1. 管理者権限チェック
 * 2. コンテンツの isHidden を false に設定
 * 3. 関連する通報のステータスを 'resolved' に更新
 * 4. 管理者通知を解決済みに設定
 * 5. 管理ログに記録
 *
 * ## 使用場面
 * - 誤って非表示にされたコンテンツの復旧
 * - 通報内容を確認後、問題ないと判断された場合
 * - 修正依頼後、作成者が内容を修正した場合
 *
 * ## 使用例
 * ```typescript
 * const result = await restoreContent('post', 'post123')
 * if (result.success) {
 *   toast.success('コンテンツを再表示しました')
 * }
 * ```
 */
export async function restoreContent(type: ContentType, id: string) {
  const authResult = await checkAdminAuth()
  if (authResult.error || !authResult.adminId) {
    return { error: authResult.error || '認証エラー' }
  }

  switch (type) {
    case 'post':
      await prisma.post.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
    case 'comment':
      await prisma.comment.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
    case 'event':
      await prisma.event.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
    case 'shop':
      await prisma.bonsaiShop.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
    case 'review':
      await prisma.shopReview.update({
        where: { id },
        data: { isHidden: false, hiddenAt: null },
      })
      break
  }

  // 関連する通報のステータスを更新
  await prisma.report.updateMany({
    where: { targetType: type, targetId: id },
    data: { status: 'resolved' },
  })

  // 管理者通知を解決済みに
  await prisma.adminNotification.updateMany({
    where: { targetType: type, targetId: id, isResolved: false },
    data: { isResolved: true, resolvedAt: new Date() },
  })

  // 管理ログに記録
  await prisma.adminLog.create({
    data: {
      adminId: authResult.adminId,
      action: 'restore_content',
      targetType: type,
      targetId: id,
    },
  })

  revalidatePath('/admin/hidden')
  return { success: true }
}

/**
 * 非表示コンテンツを完全削除
 *
 * ## 機能概要
 * 非表示になっているコンテンツをデータベースから完全に削除します。
 * この操作は元に戻せません。
 *
 * ## パラメータ
 * @param type - コンテンツタイプ
 * @param id - コンテンツID
 *
 * ## 戻り値
 * @returns { success: true } - 成功時
 * @returns { error: string } - 失敗時
 *
 * ## 処理フロー
 * 1. 管理者権限チェック
 * 2. コンテンツを削除（カスケード削除で関連データも削除）
 * 3. 関連する通報を削除
 * 4. 管理者通知を解決済みに設定
 * 5. 管理ログに記録
 *
 * ## 注意事項
 * - この操作は取り消せません
 * - 関連するいいね、コメント、ブックマークなども削除されます
 * - 慎重に使用してください
 *
 * ## 使用場面
 * - 明らかに規約違反のコンテンツ
 * - 法的問題があるコンテンツ
 * - 復旧の見込みがないスパム
 *
 * ## 使用例
 * ```typescript
 * // 確認ダイアログ後に実行
 * if (confirm('完全に削除しますか？この操作は取り消せません')) {
 *   const result = await deleteHiddenContent('post', 'post123')
 * }
 * ```
 */
export async function deleteHiddenContent(type: ContentType, id: string) {
  const authResult = await checkAdminAuth()
  if (authResult.error || !authResult.adminId) {
    return { error: authResult.error || '認証エラー' }
  }

  switch (type) {
    case 'post':
      await prisma.post.delete({ where: { id } })
      break
    case 'comment':
      await prisma.comment.delete({ where: { id } })
      break
    case 'event':
      await prisma.event.delete({ where: { id } })
      break
    case 'shop':
      await prisma.bonsaiShop.delete({ where: { id } })
      break
    case 'review':
      await prisma.shopReview.delete({ where: { id } })
      break
  }

  // 関連する通報を削除
  await prisma.report.deleteMany({
    where: { targetType: type, targetId: id },
  })

  // 管理者通知を解決済みに
  await prisma.adminNotification.updateMany({
    where: { targetType: type, targetId: id, isResolved: false },
    data: { isResolved: true, resolvedAt: new Date() },
  })

  // 管理ログに記録
  await prisma.adminLog.create({
    data: {
      adminId: authResult.adminId,
      action: 'delete_hidden_content',
      targetType: type,
      targetId: id,
    },
  })

  revalidatePath('/admin/hidden')
  return { success: true }
}

// ============================================================
// 管理者通知管理
// ============================================================

/**
 * 管理者通知一覧を取得
 *
 * ## 機能概要
 * 管理者向けの通知（通報、自動非表示など）を取得します。
 *
 * ## 通知の種類
 * - 新規通報（report_received）
 * - 自動非表示発動（auto_hidden）
 * - ユーザー停止（user_suspended）
 * など
 *
 * ## パラメータ
 * @param options.unreadOnly - 未読のみ取得（デフォルト: false）
 * @param options.limit - 取得件数（デフォルト: 20）
 *
 * ## 戻り値
 * @returns { notifications: AdminNotification[], unreadCount: number }
 * @returns { error: string } - 失敗時
 *
 * ## 使用例
 * ```typescript
 * // 全通知を取得
 * const { notifications, unreadCount } = await getAdminNotifications()
 *
 * // 未読のみ取得
 * const { notifications } = await getAdminNotifications({ unreadOnly: true })
 *
 * // バッジ表示用
 * console.log(`未読: ${unreadCount}件`)
 * ```
 */
export async function getAdminNotifications(options?: {
  unreadOnly?: boolean
  limit?: number
}) {
  const authResult = await checkAdminAuth()
  if (authResult.error) {
    return { error: authResult.error }
  }

  const { unreadOnly = false, limit = 20 } = options || {}

  const notifications = await prisma.adminNotification.findMany({
    where: {
      ...(unreadOnly && { isRead: false }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const unreadCount = await prisma.adminNotification.count({
    where: { isRead: false },
  })

  return { notifications, unreadCount }
}

/**
 * 管理者通知を既読にする
 *
 * ## 機能概要
 * 指定した通知を既読状態に更新します。
 *
 * ## パラメータ
 * @param notificationId - 通知ID
 *
 * ## 戻り値
 * @returns { success: true } - 成功時
 * @returns { error: string } - 失敗時
 *
 * ## 使用例
 * ```typescript
 * // 通知をクリックした時
 * await markAdminNotificationAsRead(notification.id)
 * ```
 */
export async function markAdminNotificationAsRead(notificationId: string) {
  const authResult = await checkAdminAuth()
  if (authResult.error) {
    return { error: authResult.error }
  }

  await prisma.adminNotification.update({
    where: { id: notificationId },
    data: { isRead: true },
  })

  revalidatePath('/admin/hidden')
  return { success: true }
}

/**
 * 全ての管理者通知を既読にする
 *
 * ## 機能概要
 * 未読の全通知を一括で既読状態に更新します。
 *
 * ## 戻り値
 * @returns { success: true } - 成功時
 * @returns { error: string } - 失敗時
 *
 * ## 使用例
 * ```typescript
 * // 「すべて既読にする」ボタンがクリックされた時
 * const result = await markAllAdminNotificationsAsRead()
 * if (result.success) {
 *   toast.success('全ての通知を既読にしました')
 * }
 * ```
 */
export async function markAllAdminNotificationsAsRead() {
  const authResult = await checkAdminAuth()
  if (authResult.error) {
    return { error: authResult.error }
  }

  await prisma.adminNotification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  })

  revalidatePath('/admin/hidden')
  return { success: true }
}
