/**
 * 通知機能のServer Actions
 *
 * このファイルは、ユーザーへの通知に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 通知一覧の取得
 * - 既読マーク（個別・一括）
 * - 未読数の取得
 * - 通知の作成・削除（内部API）
 *
 * ## 通知タイプ
 * - like: 投稿へのいいね
 * - comment: 投稿へのコメント
 * - reply: コメントへの返信
 * - comment_like: コメントへのいいね
 * - follow: フォロー
 * - quote: 引用投稿
 *
 * ## フィルタリング
 * - ミュートしているユーザーからの通知は除外
 * - ブロック関係にあるユーザー間の通知は作成されない
 *
 * ## 重複防止
 * 同じタイプ、同じアクター、同じ対象の通知は
 * 重複して作成されないよう制御
 *
 * @module lib/actions/notification
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
 * Next.jsのキャッシュ再検証関数
 * 既読マーク後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * ミュート済みユーザーID取得関数
 * ミュートユーザーからの通知を除外するために使用
 */
import { getMutedUserIds } from './filter-helper'

// ============================================================
// 型定義
// ============================================================

/**
 * 通知タイプの定義
 *
 * ## 各タイプの説明
 * - 'like': 投稿へのいいね通知
 * - 'comment': 投稿へのコメント通知
 * - 'follow': フォロー通知
 * - 'quote': 引用投稿通知
 * - 'reply': コメントへの返信通知
 * - 'comment_like': コメントへのいいね通知
 * - 'follow_request': フォローリクエスト通知（非公開アカウント用）
 * - 'follow_request_approved': フォローリクエスト承認通知
 *
 * ## 使用例
 * ```typescript
 * const type: NotificationType = 'like'
 * ```
 */
export type NotificationType = 'like' | 'comment' | 'follow' | 'quote' | 'reply' | 'comment_like' | 'follow_request' | 'follow_request_approved'

// ============================================================
// 通知一覧取得
// ============================================================

/**
 * 通知一覧を取得
 *
 * ## 機能概要
 * 現在のユーザー宛ての通知を新しい順で取得します。
 *
 * ## 取得内容
 * - 通知情報（ID、タイプ、既読状態、作成日時）
 * - アクター情報（通知のトリガーとなったユーザー）
 * - 関連する投稿・コメントの情報
 *
 * ## フィルタリング
 * ミュートしているユーザーからの通知は自動的に除外
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns 通知一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // 通知ページでの使用
 * const { notifications, nextCursor } = await getNotifications()
 *
 * // 無限スクロールで追加読み込み
 * const more = await getNotifications(nextCursor)
 * ```
 */
export async function getNotifications(cursor?: string, limit = 20) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です', notifications: [], nextCursor: undefined }
  }

  // ------------------------------------------------------------
  // ミュートユーザーを取得
  // ------------------------------------------------------------

  /**
   * ミュートしているユーザーのIDリストを取得
   * これらのユーザーからの通知は表示しない
   */
  const mutedUserIds = await getMutedUserIds(session.user.id)

  // ------------------------------------------------------------
  // 通知を取得
  // ------------------------------------------------------------

  /**
   * 通知一覧を取得
   *
   * ## フィルタ条件
   * - userId: 自分宛ての通知
   * - actorId: ミュートユーザー以外
   *
   * ## include
   * - actor: 通知のトリガーとなったユーザー
   * - post: 関連する投稿（いいね、コメント通知など）
   * - comment: 関連するコメント（返信、コメントいいね通知など）
   */
  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      // ミュートしているユーザーからの通知を除外
      ...(mutedUserIds.length > 0 && {
        actorId: {
          notIn: mutedUserIds,
        },
      }),
    },
    include: {
      /**
       * アクター（通知を発生させたユーザー）
       * 表示に必要な最小限のフィールドのみ取得
       */
      actor: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      /**
       * 関連する投稿
       * 通知からの遷移先として使用
       */
      post: {
        select: { id: true, content: true },
      },
      /**
       * 関連するコメント
       * コメント関連の通知で使用
       */
      comment: {
        select: { id: true, content: true },
      },
    },
    /**
     * 新しい通知から順に表示
     */
    orderBy: { createdAt: 'desc' },
    take: limit,
    /**
     * カーソルベースページネーション
     */
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  // ------------------------------------------------------------
  // 結果返却
  // ------------------------------------------------------------

  return {
    notifications,
    /**
     * 次のカーソル
     * limit 件取得できた場合、次のページが存在する可能性がある
     */
    nextCursor: notifications.length === limit ? notifications[notifications.length - 1]?.id : undefined,
  }
}

// ============================================================
// 既読マーク（個別）
// ============================================================

/**
 * 通知を既読にする
 *
 * ## 機能概要
 * 指定された通知を既読状態に更新します。
 *
 * ## 用途
 * - 通知詳細を表示した時
 * - 通知をクリックして遷移した時
 *
 * ## セキュリティ
 * update の where 句で userId を指定することで、
 * 他のユーザーの通知を既読にできないよう制御
 *
 * @param notificationId - 既読にする通知のID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // 通知クリック時
 * const handleNotificationClick = async (notification) => {
 *   await markAsRead(notification.id)
 *   router.push(`/posts/${notification.postId}`)
 * }
 * ```
 */
export async function markAsRead(notificationId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 既読に更新
  // ------------------------------------------------------------

  /**
   * 通知を既読に更新
   *
   * where 句で userId を指定することで、
   * 自分の通知のみ更新可能に制限
   */
  await prisma.notification.update({
    where: {
      id: notificationId,
      userId: session.user.id, // セキュリティ: 自分の通知のみ
    },
    data: { isRead: true },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  /**
   * 通知ページのキャッシュを再検証
   */
  revalidatePath('/notifications')

  return { success: true }
}

// ============================================================
// 既読マーク（一括）
// ============================================================

/**
 * 全ての通知を既読にする
 *
 * ## 機能概要
 * 現在のユーザーの未読通知を全て既読状態に更新します。
 *
 * ## 用途
 * - 「全て既読にする」ボタン
 * - 通知ページを開いた時に自動で既読化
 *
 * ## updateMany vs update
 * - update: 1件のレコードを更新
 * - updateMany: 条件に合う複数レコードを一括更新
 *
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // 「全て既読にする」ボタン
 * const handleMarkAllAsRead = async () => {
 *   await markAllAsRead()
 *   toast.success('全ての通知を既読にしました')
 * }
 * ```
 */
export async function markAllAsRead() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 一括更新
  // ------------------------------------------------------------

  /**
   * 未読の通知を全て既読に更新
   *
   * updateMany は条件に合う全レコードを更新
   * 戻り値は { count: number }（更新した件数）
   */
  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      isRead: false,
    },
    data: { isRead: true },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath('/notifications')

  return { success: true }
}

// ============================================================
// 未読数取得
// ============================================================

/**
 * 未読通知の件数を取得
 *
 * ## 機能概要
 * 現在のユーザーの未読通知件数を返します。
 *
 * ## 用途
 * - ヘッダーの通知バッジ表示
 * - 「未読3件」のような表示
 *
 * ## フィルタリング
 * ミュートしているユーザーからの通知はカウントに含まない
 *
 * @returns { count: number }
 *
 * @example
 * ```typescript
 * // ヘッダーコンポーネント
 * const Header = async () => {
 *   const { count } = await getUnreadCount()
 *   return (
 *     <nav>
 *       <NotificationIcon badge={count > 0 ? count : undefined} />
 *     </nav>
 *   )
 * }
 * ```
 */
export async function getUnreadCount() {
  const session = await auth()

  /**
   * 未ログイン時は 0 を返す
   */
  if (!session?.user?.id) {
    return { count: 0 }
  }

  // ------------------------------------------------------------
  // ミュートユーザーを取得
  // ------------------------------------------------------------

  /**
   * ミュートしているユーザーからの通知は
   * 未読数にカウントしない
   */
  const mutedUserIds = await getMutedUserIds(session.user.id)

  // ------------------------------------------------------------
  // 未読数をカウント
  // ------------------------------------------------------------

  /**
   * 未読通知の件数をカウント
   *
   * count() はレコード数を返す
   * findMany().length より効率的
   */
  const count = await prisma.notification.count({
    where: {
      userId: session.user.id,
      isRead: false,
      // ミュートしているユーザーからの通知を除外
      ...(mutedUserIds.length > 0 && {
        actorId: {
          notIn: mutedUserIds,
        },
      }),
    },
  })

  return { count }
}

// ============================================================
// 通知作成（内部API）
// ============================================================

/**
 * 通知を作成（内部API）
 *
 * ## 機能概要
 * 新しい通知を作成します。
 * 主に他のServer Actionsから呼び出される内部APIです。
 *
 * ## 自動フィルタリング
 * 以下の場合は通知を作成しません：
 * 1. 自分自身へのアクション（自分の投稿に自分でいいね等）
 * 2. ブロック関係にある場合（双方向でチェック）
 * 3. 同じ通知が既に存在する場合（重複防止）
 *
 * ## ブロック関係のチェック
 * - AがBをブロック → AはBからの通知を受け取らない
 * - BがAをブロック → AはBへの通知を作成しない
 * 両方向でチェックして、どちらかがブロックしていれば通知しない
 *
 * @param params - 通知パラメータ
 * @param params.userId - 通知を受け取るユーザーID
 * @param params.actorId - アクションを行ったユーザーID
 * @param params.type - 通知タイプ
 * @param params.postId - 関連する投稿ID（オプション）
 * @param params.commentId - 関連するコメントID（オプション）
 * @returns { success: true }
 *
 * @example
 * ```typescript
 * // いいね時に通知を作成
 * await createNotification({
 *   userId: post.userId,        // 投稿者
 *   actorId: session.user.id,   // いいねした人
 *   type: 'like',
 *   postId: post.id,
 * })
 * ```
 */
export async function createNotification({
  userId,
  actorId,
  type,
  postId,
  commentId,
}: {
  userId: string
  actorId: string
  type: NotificationType
  postId?: string
  commentId?: string
}) {
  // ------------------------------------------------------------
  // 自分自身への通知チェック
  // ------------------------------------------------------------

  /**
   * 自分自身へのアクションは通知しない
   *
   * 例：自分の投稿に自分でコメント
   */
  if (userId === actorId) {
    return { success: true }
  }

  // ------------------------------------------------------------
  // ブロック関係チェック
  // ------------------------------------------------------------

  /**
   * ブロック関係を確認
   *
   * OR 条件で双方向チェック：
   * - blockerId: userId, blockedId: actorId → userId が actorId をブロック
   * - blockerId: actorId, blockedId: userId → actorId が userId をブロック
   *
   * どちらかがブロックしていれば通知しない
   */
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: actorId },
        { blockerId: actorId, blockedId: userId },
      ],
    },
  })

  /**
   * ブロック関係がある場合は通知しない
   */
  if (block) {
    return { success: true }
  }

  // ------------------------------------------------------------
  // 重複チェック
  // ------------------------------------------------------------

  /**
   * 同じ通知が既に存在するか確認
   *
   * 同じタイプ、同じアクター、同じ対象（投稿/コメント）の
   * 通知が既に存在する場合はスキップ
   *
   * これにより、短時間に同じアクションを繰り返しても
   * 通知が大量に作成されることを防ぐ
   */
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId,
      actorId,
      type,
      postId: postId || null,
      commentId: commentId || null,
    },
  })

  /**
   * 既に同じ通知がある場合はスキップ
   */
  if (existingNotification) {
    return { success: true }
  }

  // ------------------------------------------------------------
  // 通知作成
  // ------------------------------------------------------------

  /**
   * 新しい通知を作成
   */
  await prisma.notification.create({
    data: {
      userId,       // 通知を受け取るユーザー
      actorId,      // 通知のトリガーとなったユーザー
      type,         // 通知タイプ
      postId,       // 関連する投稿（オプション）
      commentId,    // 関連するコメント（オプション）
    },
  })

  return { success: true }
}

// ============================================================
// 通知削除（内部API）
// ============================================================

/**
 * 通知を削除（内部API）
 *
 * ## 機能概要
 * 指定された条件に合う通知を削除します。
 * 主にアクションの取り消し時に使用されます。
 *
 * ## 用途
 * - いいね解除時にいいね通知を削除
 * - フォロー解除時にフォロー通知を削除
 * - コメント削除時にコメント通知を削除
 *
 * ## deleteMany の使用
 * 条件に合う全ての通知を削除
 * 該当する通知がない場合もエラーにならない
 *
 * @param params - 削除条件
 * @param params.userId - 通知を受け取ったユーザーID
 * @param params.actorId - アクションを行ったユーザーID
 * @param params.type - 通知タイプ
 * @param params.postId - 関連する投稿ID（オプション）
 * @param params.commentId - 関連するコメントID（オプション）
 * @returns { success: true }
 *
 * @example
 * ```typescript
 * // いいね解除時に通知を削除
 * await deleteNotification({
 *   userId: post.userId,
 *   actorId: session.user.id,
 *   type: 'like',
 *   postId: post.id,
 * })
 * ```
 */
export async function deleteNotification({
  userId,
  actorId,
  type,
  postId,
  commentId,
}: {
  userId: string
  actorId: string
  type: NotificationType
  postId?: string
  commentId?: string
}) {
  /**
   * 条件に合う通知を削除
   *
   * deleteMany は条件に合う全レコードを削除
   * 該当なしでもエラーにならない（count: 0 を返す）
   *
   * postId || null の理由：
   * - postId が undefined の場合、null として検索
   * - Prismaでは null と undefined は異なる
   */
  await prisma.notification.deleteMany({
    where: {
      userId,
      actorId,
      type,
      postId: postId || null,
      commentId: commentId || null,
    },
  })

  return { success: true }
}
