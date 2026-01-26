/**
 * フォロー機能のServer Actions
 *
 * このファイルは、ユーザーのフォロー機能に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - フォロー/フォロー解除（トグル）
 * - フォロー状態の確認
 * - フォロワー一覧の取得
 * - フォロー中一覧の取得
 *
 * ## フォロー関係の構造
 * - followerId: フォローする人
 * - followingId: フォローされる人
 *
 * 例: AがBをフォローする場合
 * - followerId: A
 * - followingId: B
 *
 * ## フォローの効果
 * 1. フォロー先の投稿がタイムラインに表示される
 * 2. フォロー先のフォロワー数が増加する
 * 3. フォロー通知が相手に送信される
 *
 * @module lib/actions/follow
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
 * フォロワー増加記録関数
 * アナリティクス用
 */
import { recordNewFollower } from './analytics'

/**
 * レート制限
 * スパム防止、クラウド課金対策
 */
import { checkUserRateLimit } from '@/lib/rate-limit'

// ============================================================
// フォロートグル
// ============================================================

/**
 * フォローをトグル（フォロー/フォロー解除）
 *
 * ## 機能概要
 * ユーザーのフォロー状態を切り替えます。
 * - フォロー中 → フォロー解除
 * - 未フォロー → フォロー
 *
 * ## 処理フロー（フォロー時）
 * 1. 認証チェック
 * 2. 自分自身へのフォロー防止
 * 3. 現在のフォロー状態を確認
 * 4. フォローレコードを作成
 * 5. 通知を作成
 * 6. アナリティクスに記録
 *
 * ## 処理フロー（フォロー解除時）
 * 1. 認証チェック
 * 2. 現在のフォロー状態を確認
 * 3. フォローレコードを削除
 *
 * @param userId - フォロー対象のユーザーID
 * @returns 成功時は { success: true, following: boolean }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // フォローボタン
 * const handleFollow = async () => {
 *   const result = await toggleFollow(userId)
 *   if (result.success) {
 *     setIsFollowing(result.following)
 *   }
 * }
 * ```
 */
export async function toggleFollow(userId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 自分自身へのフォロー防止
  // ------------------------------------------------------------

  if (session.user.id === userId) {
    return { error: '自分自身をフォローすることはできません' }
  }

  // ------------------------------------------------------------
  // レート制限チェック
  // ------------------------------------------------------------
  const rateLimitResult = await checkUserRateLimit(session.user.id, 'engagement')
  if (!rateLimitResult.success) {
    return { error: '操作が多すぎます。しばらく待ってから再試行してください' }
  }

  // ------------------------------------------------------------
  // 現在のフォロー状態を確認
  // ------------------------------------------------------------

  /**
   * 複合ユニークキー followerId_followingId で検索
   *
   * findUnique は一意なレコードを1件取得
   * 存在しない場合は null を返す
   */
  const existingFollow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: userId,
      },
    },
  })

  if (existingFollow) {
    // ------------------------------------------------------------
    // フォロー解除
    // ------------------------------------------------------------

    /**
     * フォローレコードを削除
     *
     * 通知は削除しない（過去のフォロー通知は残す）
     */
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: userId,
        },
      },
    })

    return { success: true, following: false }
  } else {
    // ------------------------------------------------------------
    // フォロー
    // ------------------------------------------------------------

    /**
     * 対象ユーザーの公開設定を確認
     * 非公開アカウントの場合はフォローリクエストが必要
     */
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPublic: true },
    })

    if (!targetUser) {
      return { error: 'ユーザーが見つかりません' }
    }

    if (!targetUser.isPublic) {
      return { error: 'このユーザーは非公開アカウントです。フォローリクエストを送信してください', requiresRequest: true }
    }

    /**
     * フォローレコードを作成
     */
    await prisma.follow.create({
      data: {
        followerId: session.user.id,  // フォローする人（自分）
        followingId: userId,          // フォローされる人（相手）
      },
    })

    // ------------------------------------------------------------
    // 通知作成
    // ------------------------------------------------------------

    /**
     * フォロー通知を作成
     *
     * - userId: 通知を受け取る人（フォローされた人）
     * - actorId: アクションを起こした人（フォローした人）
     * - type: 'follow'
     */
    await prisma.notification.create({
      data: {
        userId,
        actorId: session.user.id,
        type: 'follow',
      },
    })

    // ------------------------------------------------------------
    // アナリティクスに記録
    // ------------------------------------------------------------

    /**
     * フォロワー増加を記録
     *
     * catch(() => {}) でエラーを無視
     * → アナリティクスの失敗でフォロー処理全体を失敗させない
     */
    recordNewFollower(userId).catch(() => {})

    return { success: true, following: true }
  }
}

// ============================================================
// フォロー状態取得
// ============================================================

/**
 * フォロー状態を確認
 *
 * ## 機能概要
 * 現在のユーザーが指定されたユーザーをフォローしているかどうかを確認します。
 *
 * ## 用途
 * - ユーザープロフィールページでフォローボタンの状態を判定
 * - フォロー/フォロー解除ボタンの表示切り替え
 *
 * ## 未ログイン時
 * セッションがない場合は常に { following: false } を返す
 *
 * @param userId - 確認対象のユーザーID
 * @returns { following: boolean }
 *
 * @example
 * ```typescript
 * const { following } = await getFollowStatus(userId)
 *
 * return (
 *   <button onClick={handleFollow}>
 *     {following ? 'フォロー中' : 'フォローする'}
 *   </button>
 * )
 * ```
 */
export async function getFollowStatus(userId: string) {
  const session = await auth()

  /**
   * 未ログイン時は false を返す
   */
  if (!session?.user?.id) {
    return { following: false }
  }

  // ------------------------------------------------------------
  // レート制限チェック（列挙攻撃対策）
  // ------------------------------------------------------------
  const rateLimitResult = await checkUserRateLimit(session.user.id, 'read')
  if (!rateLimitResult.success) {
    return { following: false, error: 'リクエストが多すぎます' }
  }

  // ------------------------------------------------------------
  // フォロー状態を確認
  // ------------------------------------------------------------

  /**
   * 複合ユニークキーで検索
   */
  const existingFollow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: userId,
      },
    },
  })

  /**
   * !! で Boolean に変換
   * null → false
   * オブジェクト → true
   */
  return { following: !!existingFollow }
}

// ============================================================
// フォロワー一覧取得
// ============================================================

/**
 * フォロワー一覧を取得
 *
 * ## 機能概要
 * 指定されたユーザーのフォロワー一覧を取得します。
 *
 * ## 用途
 * - プロフィールページの「フォロワー」タブ
 * - フォロワー一覧モーダル
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 * カーソルは followerId を使用
 *
 * @param userId - 対象のユーザーID
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns フォロワー一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // フォロワー一覧ページ
 * const { users, nextCursor } = await getFollowers(userId)
 *
 * // 無限スクロールで追加読み込み
 * const more = await getFollowers(userId, nextCursor)
 * ```
 */
export async function getFollowers(userId: string, cursor?: string, limit = 20) {
  // ------------------------------------------------------------
  // レート制限チェック（列挙攻撃対策）
  // ------------------------------------------------------------
  const session = await auth()
  if (session?.user?.id) {
    const rateLimitResult = await checkUserRateLimit(session.user.id, 'read')
    if (!rateLimitResult.success) {
      return { users: [], nextCursor: undefined, error: 'リクエストが多すぎます' }
    }
  }

  /**
   * フォロー関係を取得
   *
   * where: { followingId: userId }
   * → userId をフォローしている人（＝フォロワー）を取得
   *
   * include.follower でフォロワーのユーザー情報を結合
   */
  const followers = await prisma.follow.findMany({
    where: { followingId: userId },
    include: {
      /**
       * フォロワーのユーザー情報
       */
      follower: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    /**
     * カーソルベースページネーション
     *
     * 複合ユニークキー followerId_followingId を使用
     */
    ...(cursor && {
      cursor: {
        followerId_followingId: {
          followerId: cursor,
          followingId: userId,
        },
      },
      skip: 1, // カーソル自体をスキップ
    }),
  })

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  /**
   * limit 件取得できた場合は次のページがある
   */
  const hasMore = followers.length === limit

  return {
    /**
     * フォロワーのユーザー情報のみを抽出
     */
    users: followers.map((f: typeof followers[number]) => f.follower),
    /**
     * 次のカーソル（followerId）
     */
    nextCursor: hasMore ? followers[followers.length - 1]?.followerId : undefined,
  }
}

// ============================================================
// フォロー中一覧取得
// ============================================================

/**
 * フォロー中一覧を取得
 *
 * ## 機能概要
 * 指定されたユーザーがフォローしているユーザーの一覧を取得します。
 *
 * ## 用途
 * - プロフィールページの「フォロー中」タブ
 * - フォロー中一覧モーダル
 *
 * ## フォロワー取得との違い
 * - フォロワー: followingId = userId（自分をフォローしている人）
 * - フォロー中: followerId = userId（自分がフォローしている人）
 *
 * @param userId - 対象のユーザーID
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns フォロー中一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // フォロー中一覧ページ
 * const { users, nextCursor } = await getFollowing(userId)
 *
 * // 無限スクロールで追加読み込み
 * const more = await getFollowing(userId, nextCursor)
 * ```
 */
export async function getFollowing(userId: string, cursor?: string, limit = 20) {
  // ------------------------------------------------------------
  // レート制限チェック（列挙攻撃対策）
  // ------------------------------------------------------------
  const session = await auth()
  if (session?.user?.id) {
    const rateLimitResult = await checkUserRateLimit(session.user.id, 'read')
    if (!rateLimitResult.success) {
      return { users: [], nextCursor: undefined, error: 'リクエストが多すぎます' }
    }
  }

  /**
   * フォロー関係を取得
   *
   * where: { followerId: userId }
   * → userId がフォローしている人を取得
   *
   * include.following でフォロー先のユーザー情報を結合
   */
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    include: {
      /**
       * フォロー先のユーザー情報
       */
      following: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    /**
     * カーソルベースページネーション
     *
     * 複合ユニークキー followerId_followingId を使用
     */
    ...(cursor && {
      cursor: {
        followerId_followingId: {
          followerId: userId,
          followingId: cursor,
        },
      },
      skip: 1, // カーソル自体をスキップ
    }),
  })

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  const hasMore = following.length === limit

  return {
    /**
     * フォロー先のユーザー情報のみを抽出
     */
    users: following.map((f: typeof following[number]) => f.following),
    /**
     * 次のカーソル（followingId）
     */
    nextCursor: hasMore ? following[following.length - 1]?.followingId : undefined,
  }
}
