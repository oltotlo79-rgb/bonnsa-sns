/**
 * 管理者機能のServer Actions
 *
 * このファイルは、システム管理者（Admin）向けの管理機能を提供します。
 * ユーザー管理、コンテンツ管理、統計情報の取得、監査ログなど、
 * 運営に必要な機能を実装しています。
 *
 * ## 機能概要
 * - 統計ダッシュボード（ユーザー数、投稿数、DAU等）
 * - ユーザー管理（一覧、詳細、停止/復帰、削除）
 * - 投稿管理（一覧、削除）
 * - イベント/盆栽園管理（削除）
 * - 管理者ログ（監査用アクション履歴）
 *
 * ## セキュリティ
 * すべての関数は `checkAdminPermission()` により管理者権限を確認します。
 * 管理者でないユーザーがアクセスした場合はエラーが発生します。
 *
 * ## 管理者の種類
 * AdminUserテーブルにレコードが存在するユーザーが管理者です。
 * roleフィールドにより権限レベルを区別できます。
 *
 * @module lib/actions/admin
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
 * キャッシュ再検証関数
 * データ更新後にページを再レンダリングするために使用
 */
import { revalidatePath } from 'next/cache'

// ============================================================
// 内部関数：権限チェック
// ============================================================

/**
 * 管理者権限をチェックする内部関数
 *
 * ## 処理フロー
 * 1. セッションから認証情報を取得
 * 2. 認証されていなければエラー
 * 3. AdminUserテーブルを検索
 * 4. 管理者レコードがなければエラー
 * 5. ユーザー情報と管理者情報を返す
 *
 * ## エラーハンドリング
 * throw でエラーを投げるため、呼び出し元で
 * try-catch するか、そのままクライアントにエラーが伝播します。
 *
 * @returns ユーザーと管理者情報
 * @throws 認証されていない場合、管理者権限がない場合
 *
 * @example
 * ```typescript
 * // 関数の冒頭で呼び出す
 * async function someAdminAction() {
 *   const { user, adminUser } = await checkAdminPermission()
 *   // 以降は管理者であることが保証される
 * }
 * ```
 */
async function checkAdminPermission() {
  // 認証情報を取得
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('認証が必要です')
  }

  /**
   * AdminUserテーブルを検索
   *
   * AdminUserテーブルは管理者権限を持つユーザーを管理
   * userIdで紐付けられている
   */
  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    throw new Error('管理者権限が必要です')
  }

  return { user: session.user, adminUser }
}

// ============================================================
// 統計情報取得
// ============================================================

/**
 * 管理者ダッシュボード用の統計情報を取得
 *
 * ## 取得する統計
 * - 総ユーザー数
 * - 今日の新規ユーザー数
 * - 総投稿数
 * - 今日の投稿数
 * - 未処理の通報数
 * - イベント総数
 * - 盆栽園総数
 * - 週間アクティブユーザー数
 *
 * ## パフォーマンス
 * Promise.allで8つのクエリを並列実行し、
 * レスポンス時間を最小化しています。
 *
 * @returns 統計情報オブジェクト
 *
 * @example
 * ```typescript
 * const stats = await getAdminStats()
 * // {
 * //   totalUsers: 1234,
 * //   todayUsers: 12,
 * //   totalPosts: 5678,
 * //   todayPosts: 45,
 * //   pendingReports: 3,
 * //   totalEvents: 89,
 * //   totalShops: 56,
 * //   activeUsersWeek: 234
 * // }
 * ```
 */
export async function getAdminStats() {
  // 管理者権限チェック
  await checkAdminPermission()

  /**
   * 日付の計算
   *
   * today: 今日の0時0分0秒
   * weekAgo: 7日前の0時0分0秒
   */
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  /**
   * 8つのクエリを並列実行
   *
   * Promise.allにより、すべてのクエリが同時に実行され、
   * 最も遅いクエリの完了を待って全結果が返される
   */
  const [
    totalUsers,
    todayUsers,
    totalPosts,
    todayPosts,
    pendingReports,
    totalEvents,
    totalShops,
    activeUsersWeek,
  ] = await Promise.all([
    // 総ユーザー数
    prisma.user.count(),

    // 今日登録したユーザー数
    prisma.user.count({
      where: { createdAt: { gte: today } },
    }),

    // 総投稿数
    prisma.post.count(),

    // 今日の投稿数
    prisma.post.count({
      where: { createdAt: { gte: today } },
    }),

    // 未処理の通報数（pending状態のもの）
    prisma.report.count({
      where: { status: 'pending' },
    }),

    // イベント総数
    prisma.event.count(),

    // 盆栽園総数
    prisma.bonsaiShop.count(),

    /**
     * 週間アクティブユーザー数
     *
     * 過去7日間に投稿したユーザーの数
     * someリレーションフィルタで「少なくとも1つの投稿がある」ユーザーを抽出
     */
    prisma.user.count({
      where: {
        posts: {
          some: {
            createdAt: { gte: weekAgo },
          },
        },
      },
    }),
  ])

  return {
    totalUsers,
    todayUsers,
    totalPosts,
    todayPosts,
    pendingReports,
    totalEvents,
    totalShops,
    activeUsersWeek,
  }
}

// ============================================================
// ユーザー管理
// ============================================================

/**
 * ユーザー一覧を取得（管理者用）
 *
 * ## 機能概要
 * 検索、ステータスフィルター、ソート、ページネーションに対応した
 * ユーザー一覧を取得します。
 *
 * ## オプション
 * - search: ニックネームまたはメールで検索
 * - status: all（全て）/ active（通常）/ suspended（停止中）
 * - sortBy: 並び順（createdAt / postCount / nickname）
 * - sortOrder: 昇順/降順
 * - limit/offset: ページネーション
 *
 * @param options - 検索・フィルター・ソートオプション
 * @returns ユーザー配列と総件数
 *
 * @example
 * ```typescript
 * // 停止中のユーザーを検索
 * const { users, total } = await getAdminUsers({
 *   status: 'suspended',
 *   sortBy: 'createdAt',
 *   sortOrder: 'desc',
 *   limit: 20,
 *   offset: 0
 * })
 * ```
 */
export async function getAdminUsers(options?: {
  search?: string
  status?: 'all' | 'active' | 'suspended'
  sortBy?: 'createdAt' | 'postCount' | 'nickname'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}) {
  await checkAdminPermission()

  /**
   * オプションの分割代入とデフォルト値
   */
  const {
    search,
    status = 'all',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 20,
    offset = 0,
  } = options || {}

  /**
   * 検索条件の構築
   *
   * スプレッド構文でオプションの条件を動的に追加
   * - search: ニックネームまたはメールで部分一致検索
   * - status: suspended/activeでフィルター
   */
  const where = {
    ...(search && {
      OR: [
        { nickname: { contains: search } },
        { email: { contains: search } },
      ],
    }),
    ...(status === 'suspended' && { isSuspended: true }),
    ...(status === 'active' && { isSuspended: false }),
  }

  /**
   * ユーザー取得と総件数を並列実行
   */
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        createdAt: true,
        isSuspended: true,
        suspendedAt: true,
        /**
         * _count: リレーションの件数を取得
         * 投稿数を表示するために使用
         */
        _count: {
          select: { posts: true },
        },
      },
      /**
       * 動的なソート
       *
       * postCountの場合はリレーションの件数でソート
       * それ以外は通常のフィールドでソート
       */
      orderBy:
        sortBy === 'postCount'
          ? { posts: { _count: sortOrder } }
          : { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where }),
  ])

  return { users, total }
}

/**
 * ユーザー詳細情報を取得（管理者用）
 *
 * ## 取得する情報
 * - ユーザー基本情報
 * - 投稿数、コメント数
 * - フォロワー数、フォロー数
 * - このユーザーに対する通報件数
 *
 * @param userId - 対象ユーザーのID
 * @returns ユーザー情報と通報件数
 *
 * @example
 * ```typescript
 * const { user, reportCount } = await getAdminUserDetail('user-123')
 * if (reportCount > 5) {
 *   // 通報が多いユーザーとして警告表示
 * }
 * ```
 */
export async function getAdminUserDetail(userId: string) {
  await checkAdminPermission()

  /**
   * ユーザー情報を取得
   *
   * _countで各種リレーションの件数を含める
   */
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          posts: true,
          comments: true,
          followers: true,
          following: true,
        },
      },
    },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  /**
   * 通報件数を取得
   *
   * 2つの条件で検索:
   * 1. ユーザー自体への通報（targetType: 'user'）
   * 2. このユーザーの投稿への通報（targetType: 'post'）
   *
   * まずユーザーの全投稿IDを取得し、その投稿への通報を検索
   */
  const reportCount = await prisma.report.count({
    where: {
      OR: [
        { targetType: 'user', targetId: userId },
        {
          targetType: 'post',
          targetId: {
            /**
             * サブクエリでユーザーの投稿IDを取得
             */
            in: (
              await prisma.post.findMany({
                where: { userId },
                select: { id: true },
              })
            ).map((p: { id: string }) => p.id),
          },
        },
      ],
    },
  })

  return { user, reportCount }
}

/**
 * ユーザーを停止（一時凍結）
 *
 * ## 機能概要
 * 問題のあるユーザーを一時停止状態にします。
 * 停止されたユーザーはログインできなくなります。
 *
 * ## 監査ログ
 * すべての停止操作は AdminLog に記録され、
 * 誰がいつ何を理由に停止したかを追跡できます。
 *
 * @param userId - 停止するユーザーのID
 * @param reason - 停止理由（監査ログに記録）
 * @returns 成功/失敗の結果
 *
 * @example
 * ```typescript
 * const result = await suspendUser('user-123', '利用規約違反')
 * if (result.success) {
 *   toast.success('ユーザーを停止しました')
 * }
 * ```
 */
export async function suspendUser(userId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  /**
   * ユーザーの存在確認
   */
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  /**
   * 既に停止されているかチェック
   */
  if (user.isSuspended) {
    return { error: 'このユーザーは既に停止されています' }
  }

  /**
   * トランザクションで停止処理とログ記録を同時実行
   *
   * $transaction: 複数の操作をアトミックに実行
   * 一部が失敗すれば全てロールバック
   */
  await prisma.$transaction([
    // ユーザーを停止状態に更新
    prisma.user.update({
      where: { id: userId },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
      },
    }),
    // 管理者ログを記録
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'suspend_user',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({ reason }),
      },
    }),
  ])

  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * ユーザーを復帰（停止解除）
 *
 * ## 機能概要
 * 停止中のユーザーを通常状態に戻します。
 *
 * @param userId - 復帰させるユーザーのID
 * @returns 成功/失敗の結果
 *
 * @example
 * ```typescript
 * const result = await activateUser('user-123')
 * ```
 */
export async function activateUser(userId: string) {
  const { adminUser } = await checkAdminPermission()

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  if (!user.isSuspended) {
    return { error: 'このユーザーは停止されていません' }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        isSuspended: false,
        suspendedAt: null,
      },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'activate_user',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({}),
      },
    }),
  ])

  revalidatePath('/admin/users')
  return { success: true }
}

// ============================================================
// 投稿管理
// ============================================================

/**
 * 投稿一覧を取得（管理者用）
 *
 * ## 機能概要
 * 管理者が投稿を監視するための一覧を取得します。
 * 検索、通報フィルター、ソート、ページネーションに対応。
 *
 * ## オプション
 * - search: 投稿内容で検索
 * - hasReports: 通報された投稿のみ表示
 * - sortBy: 並び順（createdAt / likeCount / reportCount）
 * - limit/offset: ページネーション
 *
 * @param options - 検索・フィルターオプション
 * @returns 投稿配列と総件数
 *
 * @example
 * ```typescript
 * // 通報された投稿のみ取得
 * const { posts, total } = await getAdminPosts({
 *   hasReports: true,
 *   sortBy: 'createdAt',
 *   sortOrder: 'desc'
 * })
 * ```
 */
export async function getAdminPosts(options?: {
  search?: string
  hasReports?: boolean
  sortBy?: 'createdAt' | 'likeCount' | 'reportCount'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}) {
  await checkAdminPermission()

  const {
    search,
    hasReports = false,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 20,
    offset = 0,
  } = options || {}

  /**
   * 通報された投稿IDを取得（hasReportsがtrueの場合）
   *
   * distinctで重複を除去
   */
  let reportedPostIds: string[] = []
  if (hasReports) {
    const reports = await prisma.report.findMany({
      where: { targetType: 'post' },
      select: { targetId: true },
      distinct: ['targetId'],
    })
    reportedPostIds = reports.map((r: typeof reports[number]) => r.targetId)
  }

  /**
   * 検索条件の構築
   */
  const where = {
    ...(search && {
      content: { contains: search },
    }),
    ...(hasReports && {
      id: { in: reportedPostIds },
    }),
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
      orderBy:
        sortBy === 'likeCount'
          ? { likes: { _count: sortOrder } }
          : { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    }),
    prisma.post.count({ where }),
  ])

  /**
   * 各投稿の通報件数を追加
   *
   * Promise.allで並列実行
   */
  const postsWithReportCount = await Promise.all(
    posts.map(async (post: typeof posts[number]) => {
      const reportCount = await prisma.report.count({
        where: { targetType: 'post', targetId: post.id },
      })
      return { ...post, reportCount }
    })
  )

  return { posts: postsWithReportCount, total }
}

/**
 * 投稿を削除（管理者権限）
 *
 * ## 機能概要
 * 管理者が投稿を強制削除します。
 * 通報内容が悪質な場合などに使用します。
 *
 * @param postId - 削除する投稿のID
 * @param reason - 削除理由（監査ログに記録）
 * @returns 成功/失敗の結果
 */
export async function deletePostByAdmin(postId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  const post = await prisma.post.findUnique({
    where: { id: postId },
  })

  if (!post) {
    return { error: '投稿が見つかりません' }
  }

  /**
   * トランザクションで削除とログ記録を同時実行
   */
  await prisma.$transaction([
    prisma.post.delete({
      where: { id: postId },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'delete_post',
        targetType: 'post',
        targetId: postId,
        details: JSON.stringify({ reason }),
      },
    }),
  ])

  revalidatePath('/admin/posts')
  return { success: true }
}

// ============================================================
// イベント/盆栽園管理
// ============================================================

/**
 * イベントを削除（管理者権限）
 *
 * @param eventId - 削除するイベントのID
 * @param reason - 削除理由（監査ログに記録）
 * @returns 成功/失敗の結果
 */
export async function deleteEventByAdmin(eventId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })

  if (!event) {
    return { error: 'イベントが見つかりません' }
  }

  await prisma.$transaction([
    prisma.event.delete({
      where: { id: eventId },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'delete_event',
        targetType: 'event',
        targetId: eventId,
        details: JSON.stringify({ reason }),
      },
    }),
  ])

  revalidatePath('/admin/events')
  return { success: true }
}

/**
 * 盆栽園を削除（管理者権限）
 *
 * @param shopId - 削除する盆栽園のID
 * @param reason - 削除理由（監査ログに記録）
 * @returns 成功/失敗の結果
 */
export async function deleteShopByAdmin(shopId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId },
  })

  if (!shop) {
    return { error: '盆栽園が見つかりません' }
  }

  await prisma.$transaction([
    prisma.bonsaiShop.delete({
      where: { id: shopId },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'delete_shop',
        targetType: 'shop',
        targetId: shopId,
        details: JSON.stringify({ reason }),
      },
    }),
  ])

  revalidatePath('/admin/shops')
  return { success: true }
}

// ============================================================
// 管理者ログ
// ============================================================

/**
 * 管理者操作ログを取得
 *
 * ## 機能概要
 * 管理者が実行したアクション（ユーザー停止、投稿削除など）の
 * 履歴を取得します。監査証跡として使用します。
 *
 * @param options - フィルター・ページネーションオプション
 * @returns ログ配列と総件数
 *
 * @example
 * ```typescript
 * // ユーザー停止のログのみ取得
 * const { logs, total } = await getAdminLogs({
 *   action: 'suspend_user',
 *   limit: 50
 * })
 * ```
 */
export async function getAdminLogs(options?: {
  action?: string
  limit?: number
  offset?: number
}) {
  await checkAdminPermission()

  const { action, limit = 50, offset = 0 } = options || {}

  const [logs, total] = await Promise.all([
    prisma.adminLog.findMany({
      where: action ? { action } : undefined,
      /**
       * 管理者のユーザー情報を含める
       * admin -> user のリレーションを辿る
       */
      include: {
        admin: {
          include: {
            user: {
              select: { id: true, nickname: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.adminLog.count({
      where: action ? { action } : undefined,
    }),
  ])

  return { logs, total }
}

// ============================================================
// 権限チェック（ページ用）
// ============================================================

/**
 * 現在のユーザーが管理者かどうかを判定
 *
 * ## 用途
 * 管理者ページへのアクセス制御に使用します。
 * ページコンポーネントの冒頭で呼び出し、
 * 管理者でなければリダイレクトします。
 *
 * @returns 管理者の場合はtrue、それ以外はfalse
 *
 * @example
 * ```typescript
 * // 管理者ページのレイアウト
 * export default async function AdminLayout({ children }) {
 *   const admin = await isAdmin()
 *   if (!admin) {
 *     redirect('/login')
 *   }
 *   return <div>{children}</div>
 * }
 * ```
 */
export async function isAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return false
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  /**
   * !!で明示的にboolean変換
   * adminUserが存在すればtrue、nullならfalse
   */
  return !!adminUser
}

/**
 * 管理者情報を取得
 *
 * ## 用途
 * 管理者のロール（役割）を確認するために使用します。
 * 例: スーパー管理者のみが特定の操作を実行できる場合など
 *
 * @returns 管理者情報またはnull
 *
 * @example
 * ```typescript
 * const adminInfo = await getAdminInfo()
 * if (adminInfo?.role === 'super_admin') {
 *   // スーパー管理者のみの処理
 * }
 * ```
 */
export async function getAdminInfo() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return null
  }

  return {
    userId: session.user.id,
    role: adminUser.role,
  }
}

// ============================================================
// ユーザー削除（完全削除）
// ============================================================

/**
 * ユーザーを完全削除（管理者権限）
 *
 * ## 機能概要
 * ユーザーをデータベースから完全に削除します。
 * 関連データ（投稿、コメント等）もカスケード削除されます。
 *
 * ## 安全対策
 * - 自分自身は削除できない
 * - 管理者ユーザーは削除できない
 *
 * ## 注意
 * この操作は取り消せません。停止（suspendUser）と異なり、
 * ユーザーデータが完全に失われます。
 *
 * @param userId - 削除するユーザーのID
 * @param reason - 削除理由（監査ログに記録）
 * @returns 成功/失敗の結果
 */
export async function deleteUserByAdmin(userId: string, reason: string) {
  const { adminUser } = await checkAdminPermission()

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  /**
   * 自分自身の削除を防止
   */
  if (userId === adminUser.userId) {
    return { error: '自分自身を削除することはできません' }
  }

  /**
   * 対象が管理者かチェック
   * 管理者同士の削除を防止
   */
  const targetAdminUser = await prisma.adminUser.findUnique({
    where: { userId },
  })

  if (targetAdminUser) {
    return { error: '管理者ユーザーは削除できません' }
  }

  await prisma.$transaction([
    /**
     * ユーザー削除
     *
     * Prismaスキーマでカスケード削除が設定されているため、
     * 関連するすべてのデータ（投稿、コメント、いいね等）も自動削除される
     */
    prisma.user.delete({
      where: { id: userId },
    }),
    /**
     * 監査ログに削除されたユーザー情報を記録
     * 後から追跡できるように
     */
    prisma.adminLog.create({
      data: {
        adminId: adminUser.userId,
        action: 'delete_user',
        targetType: 'user',
        targetId: userId,
        details: JSON.stringify({ reason, deletedEmail: user.email, deletedNickname: user.nickname }),
      },
    }),
  ])

  revalidatePath('/admin/users')
  return { success: true }
}

// ============================================================
// DAU（デイリーアクティブユーザー）
// ============================================================

/**
 * 今日のアクティブユーザー数を取得
 *
 * ## 定義
 * 「アクティブ」= 今日投稿またはコメントしたユーザー
 *
 * @returns アクティブユーザー数
 *
 * @example
 * ```typescript
 * const dau = await getDailyActiveUsers()
 * // 123
 * ```
 */
export async function getDailyActiveUsers() {
  await checkAdminPermission()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  /**
   * OR条件で投稿またはコメントしたユーザーを抽出
   *
   * some: リレーションの中に条件を満たすものが1つでもあればtrue
   */
  const activeUsers = await prisma.user.count({
    where: {
      OR: [
        {
          posts: {
            some: {
              createdAt: { gte: today },
            },
          },
        },
        {
          comments: {
            some: {
              createdAt: { gte: today },
            },
          },
        },
      ],
    },
  })

  return activeUsers
}

// ============================================================
// 統計履歴（グラフ用）
// ============================================================

/**
 * 過去N日間の統計データを取得（グラフ表示用）
 *
 * ## 取得データ
 * - 日付
 * - その日までの累計ユーザー数
 * - その日の投稿数
 * - その日のコメント数
 *
 * @param days - 取得する日数（デフォルト: 30日）
 * @returns 日付ごとの統計データ配列
 *
 * @example
 * ```typescript
 * const history = await getStatsHistory(30)
 * // [
 * //   { date: '2024-01-01', users: 100, posts: 12, comments: 45 },
 * //   { date: '2024-01-02', users: 105, posts: 15, comments: 52 },
 * //   ...
 * // ]
 * ```
 */
export async function getStatsHistory(days: number = 30) {
  await checkAdminPermission()

  const results: {
    date: string
    users: number
    posts: number
    comments: number
  }[] = []

  /**
   * 過去N日分のデータをループで取得
   *
   * i = days - 1 から 0 まで（古い日付から新しい日付の順）
   */
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)

    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const [usersCount, postsCount, commentsCount] = await Promise.all([
      /**
       * その日までの累計ユーザー数
       * lt: nextDate で「翌日より前」= その日まで
       */
      prisma.user.count({
        where: { createdAt: { lt: nextDate } },
      }),
      /**
       * その日の投稿数（その日の0時〜24時の間）
       */
      prisma.post.count({
        where: {
          createdAt: { gte: date, lt: nextDate },
        },
      }),
      /**
       * その日のコメント数
       */
      prisma.comment.count({
        where: {
          createdAt: { gte: date, lt: nextDate },
        },
      }),
    ])

    results.push({
      /**
       * ISO形式の日付文字列から日付部分のみ取得
       * 例: "2024-01-15T00:00:00.000Z" → "2024-01-15"
       */
      date: date.toISOString().split('T')[0],
      users: usersCount,
      posts: postsCount,
      comments: commentsCount,
    })
  }

  return results
}

/**
 * 期間別統計サマリーを取得
 *
 * ## 取得データ
 * 今日、過去1週間、過去1ヶ月、全期間それぞれの
 * ユーザー数、投稿数、コメント数
 *
 * @returns 期間別の統計サマリー
 *
 * @example
 * ```typescript
 * const summary = await getStatsSummary()
 * // {
 * //   users: { total: 1000, today: 5, week: 30, month: 100 },
 * //   posts: { total: 5000, today: 25, week: 180, month: 800 },
 * //   comments: { total: 15000, today: 80, week: 550, month: 2400 }
 * // }
 * ```
 */
export async function getStatsSummary() {
  await checkAdminPermission()

  /**
   * 各期間の起点日時を計算
   */
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const monthAgo = new Date(today)
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  /**
   * 12個のクエリを並列実行
   */
  const [
    totalUsers,
    todayUsers,
    weekUsers,
    monthUsers,
    totalPosts,
    todayPosts,
    weekPosts,
    monthPosts,
    totalComments,
    todayComments,
    weekComments,
    monthComments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.post.count(),
    prisma.post.count({ where: { createdAt: { gte: today } } }),
    prisma.post.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.post.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.comment.count(),
    prisma.comment.count({ where: { createdAt: { gte: today } } }),
    prisma.comment.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.comment.count({ where: { createdAt: { gte: monthAgo } } }),
  ])

  return {
    users: { total: totalUsers, today: todayUsers, week: weekUsers, month: monthUsers },
    posts: { total: totalPosts, today: todayPosts, week: weekPosts, month: monthPosts },
    comments: { total: totalComments, today: todayComments, week: weekComments, month: monthComments },
  }
}
