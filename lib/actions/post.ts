/**
 * 投稿（Post）関連のServer Actions
 *
 * このファイルは、投稿の作成、取得、削除などの
 * 基本的なCRUD操作を提供するServer Actionsを定義します。
 *
 * ## Server Actions とは？
 * Next.js の機能で、サーバーサイドで実行される関数をクライアントから
 * 直接呼び出せるようにするもの。'use server' ディレクティブで定義。
 *
 * ## 主な機能
 * - createPost: 新規投稿の作成
 * - createQuotePost: 引用投稿の作成
 * - createRepost: リポスト（リツイート相当）
 * - deletePost: 投稿の削除
 * - getPost: 単一投稿の取得
 * - getPosts: 投稿一覧の取得（タイムライン）
 * - getGenres: ジャンル一覧の取得
 * - uploadPostMedia: メディアファイルのアップロード
 *
 * ## セキュリティ
 * - 全ての変更操作で認証チェックを実施
 * - 投稿内容のサニタイズ（XSS対策）
 * - 1日の投稿制限（スパム対策）
 * - 会員種別による機能制限
 *
 * @module lib/actions/post
 */

// ============================================================
// 'use server' ディレクティブ
// ============================================================

/**
 * このファイル内の全ての関数をServer Actionsとしてマーク
 *
 * ## 効果
 * - サーバーサイドでのみ実行される
 * - クライアントからform actionやfetch経由で呼び出し可能
 * - 自動的にPOSTリクエストとして扱われる
 */
'use server'

// ============================================================
// インポート
// ============================================================

/**
 * prisma: Prismaクライアント
 *
 * データベース操作のためのORMクライアント。
 * 投稿、ユーザー、メディアなどのテーブルにアクセス。
 */
import { prisma } from '@/lib/db'

/**
 * auth: 認証ヘルパー関数
 *
 * NextAuth.js のセッション情報を取得。
 * 現在ログインしているユーザーのID、名前などにアクセス可能。
 */
import { auth } from '@/lib/auth'

/**
 * revalidatePath: キャッシュ再検証
 *
 * 指定したパスのキャッシュを無効化し、
 * 次回アクセス時に最新データを取得させる。
 */
import { revalidatePath } from 'next/cache'

/**
 * getMembershipLimits: 会員種別の制限を取得
 *
 * 無料会員とプレミアム会員で異なる制限値を返す。
 * 例: 投稿文字数、画像枚数など
 */
import { getMembershipLimits } from '@/lib/premium'

/**
 * sanitizePostContent: 投稿内容のサニタイズ
 *
 * XSS攻撃を防ぐため、危険なHTMLタグやスクリプトを除去。
 */
import { sanitizePostContent } from '@/lib/sanitize'

/**
 * レート制限関数
 *
 * スパム・DDoS対策、クラウド課金保護のために使用
 */
import { checkUserRateLimit, checkDailyLimit } from '@/lib/rate-limit'

/**
 * ハッシュタグ関連の関数
 *
 * attachHashtagsToPost: 投稿にハッシュタグを関連付け
 * detachHashtagsFromPost: 投稿からハッシュタグを削除
 */
import { attachHashtagsToPost, detachHashtagsFromPost } from './hashtag'

/**
 * notifyMentionedUsers: メンション通知
 *
 * 投稿内で@メンションされたユーザーに通知を送信。
 */
import { notifyMentionedUsers } from './mention'

/**
 * logger: ロギングユーティリティ
 *
 * エラーログの出力に使用。
 */
import logger from '@/lib/logger'

// ============================================================
// 投稿作成
// ============================================================

/**
 * 新規投稿を作成
 *
 * ## 機能概要
 * テキストとメディア（画像/動画）を含む投稿を作成します。
 * ジャンルの設定、ハッシュタグの抽出、メンション通知も行います。
 *
 * ## パラメータ
 * @param formData - フォームデータ
 *   - content: 投稿テキスト
 *   - genreIds: 選択されたジャンルIDの配列
 *   - mediaUrls: アップロード済みメディアのURL配列
 *   - mediaTypes: メディアの種類（'image' | 'video'）配列
 *
 * ## 戻り値
 * @returns Promise<{ success: true, postId: string } | { error: string }>
 *
 * ## バリデーション
 * 1. 認証チェック
 * 2. コンテンツの存在チェック（テキストまたはメディア必須）
 * 3. 文字数制限（会員種別で異なる）
 * 4. ジャンル数制限（最大3つ）
 * 5. メディア数制限（会員種別で異なる）
 * 6. 1日の投稿数制限（20件）
 *
 * ## 処理フロー
 * 1. セッション確認
 * 2. 入力データの取得とサニタイズ
 * 3. 会員種別の制限取得
 * 4. バリデーション
 * 5. 投稿作成（メディア、ジャンル含む）
 * 6. ハッシュタグの関連付け
 * 7. メンション通知の送信
 * 8. キャッシュの再検証
 *
 * ## 使用例
 * ```tsx
 * // Client Component での使用
 * const formData = new FormData()
 * formData.append('content', '黒松の剪定をしました #盆栽')
 * formData.append('genreIds', 'genre-1')
 *
 * const result = await createPost(formData)
 * if (result.success) {
 *   router.push(`/posts/${result.postId}`)
 * }
 * ```
 */
export async function createPost(formData: FormData) {
  /**
   * 認証チェック
   *
   * セッションが存在しない、またはユーザーIDがない場合はエラー
   */
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  /**
   * アカウント停止チェック
   *
   * 停止されたアカウントは投稿不可
   */
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuspended: true },
  })
  if (user?.isSuspended) {
    return { error: 'アカウントが停止されています' }
  }

  /**
   * レート制限チェック
   *
   * 1分あたりの投稿数を制限（スパム対策）
   */
  const rateLimitResult = await checkUserRateLimit(session.user.id, 'post')
  if (!rateLimitResult.success) {
    return { error: '投稿が多すぎます。しばらく待ってから再試行してください' }
  }

  /**
   * フォームデータの取得
   *
   * formData.get(): 単一値を取得
   * formData.getAll(): 同名の複数値を配列で取得
   */
  const rawContent = formData.get('content') as string
  const content = sanitizePostContent(rawContent)
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaTypes = formData.getAll('mediaTypes') as string[]

  /**
   * 会員種別に応じた制限を取得
   *
   * 無料会員: maxPostLength=500, maxImages=4, maxVideos=1
   * プレミアム会員: maxPostLength=2000, maxImages=10, maxVideos=3
   */
  const limits = await getMembershipLimits(session.user.id)

  /**
   * バリデーション: コンテンツの存在チェック
   *
   * テキストもメディアもない投稿は許可しない
   */
  if (!content && mediaUrls.length === 0) {
    return { error: 'テキストまたはメディアを入力してください' }
  }

  /**
   * バリデーション: 文字数チェック
   *
   * 会員種別で制限が異なる
   */
  if (content && content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  /**
   * バリデーション: ジャンル数チェック
   *
   * 最大3つまで選択可能（全会員共通）
   */
  if (genreIds.length > 3) {
    return { error: 'ジャンルは3つまで選択できます' }
  }

  /**
   * バリデーション: メディア数チェック
   *
   * filter(): 条件に合う要素だけを抽出
   * 画像と動画で別々にカウント
   */
  const imageCount = mediaTypes.filter((t: string) => t === 'image').length
  const videoCount = mediaTypes.filter((t: string) => t === 'video').length
  if (imageCount > limits.maxImages) {
    return { error: `画像は${limits.maxImages}枚までです` }
  }
  if (videoCount > limits.maxVideos) {
    return { error: `動画は${limits.maxVideos}本までです` }
  }

  /**
   * 投稿制限チェック（会員種別で異なる）
   *
   * スパム対策として、1日の投稿数を制限
   * 今日の0時以降の投稿数をカウント
   * 無料会員: 20件、プレミアム会員: 40件
   */
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= limits.maxDailyPosts) {
    return { error: `1日の投稿上限（${limits.maxDailyPosts}件）に達しました` }
  }

  try {
    /**
     * 投稿作成
     *
     * ネストした create で関連テーブルも同時に作成
     * - media: 投稿メディア（PostMedia テーブル）
     * - genres: 投稿ジャンル（PostGenre テーブル）
     */
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        content: content || null,
        media: mediaUrls.length > 0 ? {
          create: mediaUrls.map((url: string, index: number) => ({
            url,
            type: mediaTypes[index] || 'image',
            sortOrder: index,
          })),
        } : undefined,
        genres: genreIds.length > 0 ? {
          create: genreIds.map((genreId: string) => ({
            genreId,
          })),
        } : undefined,
      },
    })

    /**
     * ハッシュタグを関連付け
     *
     * 投稿内容から #タグ を抽出し、Hashtag テーブルに登録
     * PostHashtag テーブルで投稿とハッシュタグを関連付け
     */
    await attachHashtagsToPost(post.id, content)

    /**
     * メンションされたユーザーに通知
     *
     * 投稿内容から @ユーザー名 を抽出し、該当ユーザーに通知を送信
     */
    await notifyMentionedUsers(post.id, content, session.user.id)

    /**
     * キャッシュの再検証
     *
     * /feed ページのキャッシュを無効化し、
     * 新しい投稿がタイムラインに表示されるようにする
     */
    revalidatePath('/feed')
    return { success: true, postId: post.id }
  } catch (error) {
    logger.error('Create post error:', error)
    return { error: '投稿の作成に失敗しました' }
  }
}

// ============================================================
// 引用投稿
// ============================================================

/**
 * 引用投稿を作成
 *
 * ## 機能概要
 * 他のユーザーの投稿を引用して新しい投稿を作成します。
 * 引用元の投稿は新しい投稿内に表示されます。
 *
 * ## パラメータ
 * @param formData - フォームデータ
 *   - content: 引用コメント（必須）
 * @param quotePostId - 引用元の投稿ID
 *
 * ## 戻り値
 * @returns Promise<{ success: true, postId: string } | { error: string }>
 *
 * ## 引用投稿の特徴
 * - 引用元の投稿がカード形式で表示される
 * - 自分のコメントを追加できる
 * - 引用元の投稿者に通知が送られる
 *
 * ## 使用例
 * ```tsx
 * const formData = new FormData()
 * formData.append('content', '素晴らしい盆栽ですね！')
 *
 * const result = await createQuotePost(formData, 'post-123')
 * ```
 */
export async function createQuotePost(formData: FormData, quotePostId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  /**
   * アカウント停止チェック
   */
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuspended: true },
  })
  if (user?.isSuspended) {
    return { error: 'アカウントが停止されています' }
  }

  /**
   * レート制限チェック
   */
  const rateLimitResult = await checkUserRateLimit(session.user.id, 'post')
  if (!rateLimitResult.success) {
    return { error: '投稿が多すぎます。しばらく待ってから再試行してください' }
  }

  const rawContent = formData.get('content') as string
  const content = sanitizePostContent(rawContent)

  /**
   * 引用コメントは必須
   *
   * 通常の投稿と異なり、テキストなしの引用は許可しない
   */
  if (!content) {
    return { error: '引用コメントを入力してください' }
  }

  /**
   * 文字数制限チェック
   */
  const limits = await getMembershipLimits(session.user.id)

  if (content.length > limits.maxPostLength) {
    return { error: `投稿は${limits.maxPostLength}文字以内で入力してください` }
  }

  /**
   * 投稿制限チェック（会員種別で異なる）
   */
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= limits.maxDailyPosts) {
    return { error: `1日の投稿上限（${limits.maxDailyPosts}件）に達しました` }
  }

  try {
    /**
     * 引用投稿を作成
     *
     * quotePostId を設定することで引用投稿として識別
     */
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        content,
        quotePostId,
      },
    })

    /**
     * ハッシュタグを関連付け
     */
    await attachHashtagsToPost(post.id, content)

    /**
     * メンションされたユーザーに通知
     */
    await notifyMentionedUsers(post.id, content, session.user.id)

    /**
     * 引用元投稿者へ通知
     *
     * 自分自身の投稿を引用した場合は通知しない
     */
    const quotePost = await prisma.post.findUnique({
      where: { id: quotePostId },
      select: { userId: true },
    })

    if (quotePost && quotePost.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: quotePost.userId,
          actorId: session.user.id,
          type: 'quote',
          postId: post.id,
        },
      })
    }

    revalidatePath('/feed')
    return { success: true, postId: post.id }
  } catch (error) {
    logger.error('Create quote post error:', error)
    return { error: '引用投稿の作成に失敗しました' }
  }
}

// ============================================================
// リポスト
// ============================================================

/**
 * リポスト（リツイート相当）を作成/解除
 *
 * ## 機能概要
 * 他のユーザーの投稿をそのまま自分のタイムラインに表示する機能。
 * 既にリポスト済みの場合は解除します（トグル動作）。
 *
 * ## パラメータ
 * @param postId - リポスト対象の投稿ID
 *
 * ## 戻り値
 * @returns Promise<{ success: true, reposted: boolean } | { error: string }>
 *   - reposted: true = リポスト実行, false = リポスト解除
 *
 * ## リポストの特徴
 * - コメントなしで投稿を共有
 * - 自分のタイムラインに表示される
 * - リポスト元の投稿者に通知される（実行時のみ）
 * - 再度実行すると解除される
 *
 * ## 使用例
 * ```tsx
 * const result = await createRepost('post-123')
 * if (result.success) {
 *   console.log(result.reposted ? 'リポストしました' : 'リポストを解除しました')
 * }
 * ```
 */
export async function createRepost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  /**
   * アカウント停止チェック
   */
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuspended: true },
  })
  if (currentUser?.isSuspended) {
    return { error: 'アカウントが停止されています' }
  }

  /**
   * レート制限チェック
   */
  const rateLimitResult = await checkUserRateLimit(session.user.id, 'post')
  if (!rateLimitResult.success) {
    return { error: '操作が多すぎます。しばらく待ってから再試行してください' }
  }

  try {
    /**
     * 既にリポスト済みかチェック
     *
     * repostPostId が同じ投稿を検索
     */
    const existing = await prisma.post.findFirst({
      where: {
        userId: session.user.id,
        repostPostId: postId,
      },
    })

    if (existing) {
      /**
       * リポスト解除
       *
       * 既存のリポスト投稿を削除
       */
      await prisma.post.delete({ where: { id: existing.id } })
      revalidatePath('/feed')
      return { success: true, reposted: false }
    }

    /**
     * 投稿制限チェック（会員種別で異なる）
     *
     * リポストも通常の投稿としてカウント
     */
    const limits = await getMembershipLimits(session.user.id)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const count = await prisma.post.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: today },
      },
    })

    if (count >= limits.maxDailyPosts) {
      return { error: `1日の投稿上限（${limits.maxDailyPosts}件）に達しました` }
    }

    /**
     * リポスト作成
     *
     * content は null、repostPostId に元投稿のIDを設定
     */
    await prisma.post.create({
      data: {
        userId: session.user.id,
        repostPostId: postId,
      },
    })

    /**
     * リポスト元投稿者へ通知
     *
     * リポスト時のみ通知（解除時は通知しない）
     * 自分自身の投稿をリポストした場合は通知しない
     */
    const repostPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (repostPost && repostPost.userId !== session.user.id) {
      /**
       * 重複通知の防止
       *
       * 同じユーザーからの同じタイプの通知が既に存在するかチェック
       */
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: repostPost.userId,
          actorId: session.user.id,
          type: 'repost',
          postId,
        },
      })

      if (!existingNotification) {
        await prisma.notification.create({
          data: {
            userId: repostPost.userId,
            actorId: session.user.id,
            type: 'repost',
            postId,
          },
        })
      }
    }

    revalidatePath('/feed')
    return { success: true, reposted: true }
  } catch (error) {
    logger.error('Create repost error:', error)
    return { error: 'リポストに失敗しました' }
  }
}

// ============================================================
// 投稿削除
// ============================================================

/**
 * 投稿を削除
 *
 * ## 機能概要
 * 自分が作成した投稿を削除します。
 * 関連するデータ（いいね、コメント、ハッシュタグ等）も
 * カスケード削除されます。
 *
 * ## パラメータ
 * @param postId - 削除する投稿のID
 *
 * ## 戻り値
 * @returns Promise<{ success: true } | { error: string }>
 *
 * ## セキュリティ
 * - 投稿の所有者のみ削除可能
 * - 他人の投稿は削除できない
 *
 * ## 使用例
 * ```tsx
 * const result = await deletePost('post-123')
 * if (result.success) {
 *   toast.success('投稿を削除しました')
 * }
 * ```
 */
export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    /**
     * 投稿の所有者確認
     *
     * 自分の投稿かどうかをチェック
     */
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (!post || post.userId !== session.user.id) {
      return { error: '削除権限がありません' }
    }

    /**
     * ハッシュタグの関連付けを削除
     *
     * PostHashtag テーブルからレコードを削除
     * ハッシュタグ自体は残る（他の投稿で使用されている可能性）
     */
    await detachHashtagsFromPost(postId)

    /**
     * 投稿を削除
     *
     * Prisma スキーマで onDelete: Cascade が設定されていれば、
     * 関連するデータ（いいね、コメント等）も自動削除される
     */
    await prisma.post.delete({ where: { id: postId } })

    revalidatePath('/feed')
    return { success: true }
  } catch (error) {
    logger.error('Delete post error:', error)
    return { error: '投稿の削除に失敗しました' }
  }
}

// ============================================================
// 投稿取得（単一）
// ============================================================

/**
 * 単一の投稿を取得
 *
 * ## 機能概要
 * 投稿IDを指定して、投稿の詳細情報を取得します。
 * 投稿詳細ページで使用されます。
 *
 * ## パラメータ
 * @param postId - 取得する投稿のID
 *
 * ## 戻り値
 * @returns Promise<{ post: PostWithDetails } | { error: string }>
 *
 * ## 取得されるデータ
 * - 投稿の基本情報（ID、内容、作成日時等）
 * - 投稿者情報（ニックネーム、アバター）
 * - メディア（画像、動画）
 * - ジャンル
 * - いいね数、コメント数
 * - 引用元投稿（引用投稿の場合）
 * - リポスト元投稿（リポストの場合）
 * - 現在のユーザーがいいね/ブックマークしているか
 *
 * ## 使用例
 * ```tsx
 * // 投稿詳細ページ
 * const result = await getPost(params.postId)
 * if (result.error) {
 *   notFound()
 * }
 * return <PostDetail post={result.post} />
 * ```
 */
export async function getPost(postId: string) {
  const session = await auth()
  const currentUserId = session?.user?.id

  /**
   * 投稿を取得
   *
   * include で関連データも同時に取得
   * isHidden: false で非表示投稿を除外
   */
  const post = await prisma.post.findUnique({
    where: { id: postId, isHidden: false },
    include: {
      /**
       * 投稿者情報
       *
       * select で必要なフィールドのみ取得（パフォーマンス向上）
       */
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      /**
       * メディア（画像/動画）
       *
       * sortOrder でソートして表示順を維持
       */
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      /**
       * ジャンル
       *
       * PostGenre と Genre を JOIN
       */
      genres: {
        include: {
          genre: true,
        },
      },
      /**
       * カウント
       *
       * _count で集計クエリを効率的に実行
       */
      _count: {
        select: { likes: true, comments: true },
      },
      /**
       * 引用元投稿
       *
       * 引用投稿の場合、元の投稿情報を取得
       */
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      /**
       * リポスト元投稿
       *
       * リポストの場合、元の投稿情報を取得
       */
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!post) {
    return { error: '投稿が見つかりません' }
  }

  /**
   * 現在のユーザーがいいね/ブックマークしているかチェック
   *
   * ログインしている場合のみチェック
   */
  let isLiked = false
  let isBookmarked = false

  if (currentUserId) {
    /**
     * Promise.all で並列クエリ
     *
     * いいねとブックマークを同時にチェック
     */
    const [like, bookmark] = await Promise.all([
      prisma.like.findFirst({
        where: {
          userId: currentUserId,
          postId: postId,
          commentId: null,
        },
      }),
      prisma.bookmark.findFirst({
        where: {
          userId: currentUserId,
          postId: postId,
        },
      }),
    ])
    isLiked = !!like
    isBookmarked = !!bookmark
  }

  /**
   * レスポンスの整形
   *
   * _count を likeCount, commentCount に展開
   * genres を PostGenre[] から Genre[] に変換
   */
  return {
    post: {
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
      isLiked,
      isBookmarked,
    },
  }
}

// ============================================================
// 投稿一覧取得（タイムライン）
// ============================================================

/**
 * 投稿一覧を取得（タイムライン）
 *
 * ## 機能概要
 * ログインユーザーのタイムラインを取得します。
 * 自分とフォローしているユーザーの投稿が表示されます。
 *
 * ## パラメータ
 * @param cursor - ページネーション用カーソル（投稿ID）
 * @param limit - 取得件数（デフォルト: 20）
 *
 * ## 戻り値
 * @returns Promise<{ posts: PostWithDetails[] }>
 *
 * ## タイムラインのロジック
 * 1. ログインしている場合:
 *    - 自分の投稿
 *    - フォローしているユーザーの投稿
 *    - ブロック/ミュートしているユーザーの投稿を除外
 * 2. ログインしていない場合:
 *    - 全ての公開投稿
 *
 * ## カーソルベースページネーション
 * - cursor: 最後に取得した投稿のID
 * - cursor 指定時は、そのIDより古い投稿を取得
 * - 無限スクロールの実装に使用
 *
 * ## 使用例
 * ```tsx
 * // 初回読み込み
 * const { posts } = await getPosts()
 *
 * // 追加読み込み（無限スクロール）
 * const { posts: morePosts } = await getPosts(lastPostId, 20)
 * ```
 */
export async function getPosts(cursor?: string, limit = 20) {
  const session = await auth()
  const currentUserId = session?.user?.id

  /**
   * ユーザー関連情報の取得
   *
   * - followingUserIds: フォローしているユーザー
   * - blockedUserIds: ブロックしているユーザー
   * - mutedUserIds: ミュートしているユーザー
   */
  let followingUserIds: string[] = []
  let blockedUserIds: string[] = []
  let mutedUserIds: string[] = []

  if (currentUserId) {
    /**
     * 並列クエリでパフォーマンス向上
     */
    const [following, blocks, mutes] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      }),
      prisma.block.findMany({
        where: { blockerId: currentUserId },
        select: { blockedId: true },
      }),
      prisma.mute.findMany({
        where: { muterId: currentUserId },
        select: { mutedId: true },
      }),
    ])
    followingUserIds = following.map((f: { followingId: string }) => f.followingId)
    blockedUserIds = blocks.map((b: { blockedId: string }) => b.blockedId)
    mutedUserIds = mutes.map((m: { mutedId: string }) => m.mutedId)
  }

  /**
   * 表示対象のユーザーID
   *
   * 自分 + フォローしているユーザー
   */
  const userIdsToShow = currentUserId
    ? [currentUserId, ...followingUserIds]
    : []

  /**
   * 除外対象のユーザーID
   *
   * ブロック + ミュートしているユーザー
   */
  const excludedUserIds = [...blockedUserIds, ...mutedUserIds]

  /**
   * 投稿を取得
   */
  const posts = await prisma.post.findMany({
    where: {
      isHidden: false,
      /**
       * ログイン時のフィルタリング
       *
       * in: 指定したユーザーの投稿のみ
       * notIn: 除外するユーザーの投稿を除く
       */
      ...(currentUserId && {
        userId: {
          in: userIdsToShow,
          notIn: excludedUserIds.length > 0 ? excludedUserIds : undefined,
        },
      }),
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      genres: {
        include: {
          genre: true,
        },
      },
      _count: {
        select: { likes: true, comments: true },
      },
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    /**
     * カーソルベースページネーション
     *
     * cursor: 指定したIDの投稿を起点に
     * skip: 1: 起点自体はスキップ（前回の最後の投稿）
     */
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  /**
   * いいね/ブックマーク状態の一括取得
   *
   * 投稿ごとに個別クエリを発行するN+1問題を回避
   */
  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  if (currentUserId && posts.length > 0) {
    const postIds = posts.map((p: typeof posts[number]) => p.id)

    const [userLikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null,
        },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ])

    /**
     * Set でO(1)のルックアップを実現
     */
    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
  }

  /**
   * レスポンスの整形
   */
  return {
    posts: posts.map((post: typeof posts[number]) => ({
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
      isLiked: likedPostIds.has(post.id),
      isBookmarked: bookmarkedPostIds.has(post.id),
    })),
  }
}

// ============================================================
// ジャンル取得
// ============================================================

/**
 * ジャンル一覧を取得
 *
 * ## 機能概要
 * 投稿時に選択可能なジャンルの一覧を取得します。
 * カテゴリごとにグループ化して返します。
 *
 * ## 戻り値
 * @returns Promise<{ genres: Record<string, Genre[]> }>
 *
 * ## カテゴリ
 * - 松柏類: 黒松、赤松、五葉松など
 * - 雑木類: 楓、欅、紅葉など
 * - 草もの: 山野草、苔など
 * - 用品・道具: 鉢、道具、土など
 * - 施設・イベント: 展示会、盆栽園など
 * - その他: 上記に当てはまらないもの
 *
 * ## 使用例
 * ```tsx
 * const { genres } = await getGenres()
 *
 * return (
 *   <div>
 *     {Object.entries(genres).map(([category, items]) => (
 *       <optgroup key={category} label={category}>
 *         {items.map(genre => (
 *           <option key={genre.id} value={genre.id}>{genre.name}</option>
 *         ))}
 *       </optgroup>
 *     ))}
 *   </div>
 * )
 * ```
 */
export async function getGenres() {
  /**
   * 全ジャンルを取得
   *
   * sortOrder でソートして表示順を維持
   */
  const genres = await prisma.genre.findMany({
    orderBy: [{ sortOrder: 'asc' }],
  })

  /**
   * カテゴリごとにグループ化
   *
   * reduce で配列をオブジェクトに変換
   */
  type GenreType = typeof genres[number]
  const groupedMap = genres.reduce((acc: Record<string, GenreType[]>, genre: GenreType) => {
    if (!acc[genre.category]) {
      acc[genre.category] = []
    }
    acc[genre.category].push(genre)
    return acc
  }, {})

  /**
   * カテゴリの表示順序を定義
   *
   * データベースの順序ではなく、固定の順序で表示
   */
  const categoryOrder = ['松柏類', '雑木類', '草もの', '用品・道具', '施設・イベント', 'その他']

  /**
   * 順序通りに並べ替え
   */
  const grouped: Record<string, typeof genres> = {}
  for (const category of categoryOrder) {
    if (groupedMap[category]) {
      grouped[category] = groupedMap[category]
    }
  }

  return { genres: grouped }
}

// ============================================================
// メディアアップロード
// ============================================================

/**
 * 投稿用メディアをアップロード
 *
 * ## 機能概要
 * 投稿に添付する画像または動画をアップロードします。
 * アップロード後、URLを返します。
 *
 * ## パラメータ
 * @param formData - フォームデータ
 *   - file: アップロードするファイル
 *
 * ## 戻り値
 * @returns Promise<{
 *   success: true,
 *   url: string,    // アップロードされたファイルのURL
 *   type: 'image' | 'video'
 * } | { error: string }>
 *
 * ## 対応ファイル形式
 * - 画像: JPEG, PNG, GIF, WebP
 * - 動画: MP4, WebM, MOV
 *
 * ## ファイルサイズ制限
 * - 画像: 5MB以下
 * - 動画: 512MB以下
 *
 * ## 使用例
 * ```tsx
 * const formData = new FormData()
 * formData.append('file', selectedFile)
 *
 * const result = await uploadPostMedia(formData)
 * if (result.success) {
 *   setMediaUrls([...mediaUrls, result.url])
 *   setMediaTypes([...mediaTypes, result.type])
 * }
 * ```
 */
export async function uploadPostMedia(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  /**
   * レート制限チェック（1分あたり5回）
   *
   * R2 Class A Operations（書き込み）の課金対策
   */
  const rateLimitResult = await checkUserRateLimit(session.user.id, 'upload')
  if (!rateLimitResult.success) {
    return { error: 'アップロードが多すぎます。しばらく待ってから再試行してください' }
  }

  /**
   * 日次制限チェック（1日50回）
   *
   * 投稿を削除して再アップロードする攻撃への対策
   */
  const dailyLimitResult = await checkDailyLimit(session.user.id, 'upload')
  if (!dailyLimitResult.allowed) {
    return { error: `1日のアップロード上限（${dailyLimitResult.limit}回）に達しました` }
  }

  /**
   * ファイルの取得
   */
  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  /**
   * ファイルタイプのチェック
   *
   * MIMEタイプで判定
   */
  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    return { error: '画像または動画ファイルを選択してください' }
  }

  /**
   * ファイルサイズチェック
   *
   * 動画: 512MB以下
   * 画像: 5MB以下
   */
  const maxSize = isVideo ? 512 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: isVideo ? '動画は512MB以下にしてください' : '画像は5MB以下にしてください' }
  }

  /**
   * ストレージにアップロード
   *
   * 動的インポートでストレージモジュールを読み込み
   */
  const { uploadFile } = await import('@/lib/storage')

  /**
   * File を Buffer に変換
   *
   * arrayBuffer(): ファイルをArrayBufferとして読み込み
   * Buffer.from(): ArrayBufferをNode.js Bufferに変換
   */
  const buffer = Buffer.from(await file.arrayBuffer())
  const folder = isVideo ? 'post-videos' : 'post-images'

  /**
   * アップロード実行
   */
  const result = await uploadFile(buffer, file.name, file.type, folder)

  if (!result.success || !result.url) {
    return { error: result.error || 'アップロードに失敗しました' }
  }

  return {
    success: true,
    url: result.url,
    type: isVideo ? 'video' : 'image',
  }
}
