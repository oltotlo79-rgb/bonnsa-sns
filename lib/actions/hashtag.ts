/**
 * ハッシュタグ機能のServer Actions
 *
 * このファイルは、ハッシュタグの管理に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 投稿へのハッシュタグ関連付け
 * - ハッシュタグの関連付け解除
 * - トレンドハッシュタグの取得
 * - ハッシュタグで投稿を検索
 * - ハッシュタグ候補の検索（オートコンプリート）
 *
 * ## ハッシュタグとは
 * 投稿に含まれる #キーワード の形式のタグです。
 * 同じタグを持つ投稿を簡単に検索・発見できます。
 *
 * ## 対応文字
 * - 英数字（a-z, A-Z, 0-9）
 * - アンダースコア（_）
 * - 日本語（ひらがな、カタカナ、漢字）
 *
 * ## データ構造
 * - Hashtag: ハッシュタグマスタ（name, count）
 * - PostHashtag: 投稿とハッシュタグの中間テーブル
 *
 * @module lib/actions/hashtag
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
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

// ============================================================
// 定数・正規表現
// ============================================================

/**
 * ハッシュタグを抽出する正規表現
 *
 * ## マッチするパターン
 * - #盆栽
 * - #bonsai
 * - #盆栽_入門
 * - #Bonsai2024
 *
 * ## Unicode範囲
 * - \u3040-\u309F: ひらがな
 * - \u30A0-\u30FF: カタカナ
 * - \u4E00-\u9FFF: 漢字（CJK統合漢字）
 */
const HASHTAG_REGEX = /#([a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+)/g

// ============================================================
// 内部関数
// ============================================================

/**
 * テキストからハッシュタグを抽出（内部関数）
 *
 * ## 処理内容
 * 1. 正規表現でハッシュタグをマッチ
 * 2. # を除去
 * 3. 小文字に変換（大文字小文字を区別しない）
 * 4. 重複を除去
 *
 * @param text - 抽出元のテキスト
 * @returns ハッシュタグ名の配列（# なし）
 *
 * @example
 * ```typescript
 * extractHashtags('今日の #盆栽 #Bonsai')
 * // → ['盆栽', 'bonsai']
 * ```
 */
function extractHashtags(text: string): string[] {
  if (!text) return []

  /**
   * 正規表現でマッチ
   */
  const matches = text.match(HASHTAG_REGEX)
  if (!matches) return []

  /**
   * # を除去して小文字に変換
   *
   * slice(1) で最初の1文字（#）を除去
   */
  const hashtags = matches.map((tag: string) => tag.slice(1).toLowerCase())

  /**
   * Set で重複を除去して配列に戻す
   */
  return [...new Set(hashtags)]
}

// ============================================================
// 投稿へのハッシュタグ関連付け
// ============================================================

/**
 * 投稿にハッシュタグを関連付け
 *
 * ## 機能概要
 * 投稿の本文からハッシュタグを抽出し、
 * データベースに関連付けを作成します。
 *
 * ## 処理フロー
 * 1. テキストからハッシュタグを抽出
 * 2. 各ハッシュタグについて:
 *    - Hashtag が存在しなければ作成、存在すれば count を +1
 *    - PostHashtag の関連付けを作成
 *
 * ## 呼び出しタイミング
 * 投稿作成時に自動的に呼び出される
 *
 * @param postId - 投稿ID
 * @param content - 投稿の本文
 *
 * @example
 * ```typescript
 * // 投稿作成後に呼び出し
 * await attachHashtagsToPost(post.id, post.content)
 * ```
 */
export async function attachHashtagsToPost(postId: string, content: string | null) {
  // ------------------------------------------------------------
  // コンテンツがない場合は終了
  // ------------------------------------------------------------
  if (!content) return

  // ------------------------------------------------------------
  // ハッシュタグを抽出
  // ------------------------------------------------------------

  const hashtagNames = extractHashtags(content)
  if (hashtagNames.length === 0) return

  try {
    // ------------------------------------------------------------
    // 各ハッシュタグを処理
    // ------------------------------------------------------------

    for (const name of hashtagNames) {
      /**
       * ハッシュタグを upsert
       *
       * upsert = update + insert
       * - 存在しない場合: 新規作成（count: 1）
       * - 存在する場合: count を +1
       */
      const hashtag = await prisma.hashtag.upsert({
        where: { name },
        update: { count: { increment: 1 } },
        create: { name, count: 1 },
      })

      /**
       * 投稿とハッシュタグの関連付けを upsert
       *
       * 複合ユニークキー postId_hashtagId で重複を防止
       */
      await prisma.postHashtag.upsert({
        where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
        update: {},  // 既存の場合は何もしない
        create: { postId, hashtagId: hashtag.id },
      })
    }
  } catch (error) {
    /**
     * ハッシュタグの処理失敗は投稿作成をブロックしない
     */
    logger.error('Attach hashtags error:', error)
  }
}

// ============================================================
// 投稿からのハッシュタグ関連付け解除
// ============================================================

/**
 * 投稿からハッシュタグの関連付けを削除
 *
 * ## 機能概要
 * 投稿削除時にハッシュタグの関連付けを解除し、
 * カウントを減少させます。
 *
 * ## 処理フロー
 * 1. 投稿に関連付けられたハッシュタグを取得
 * 2. 関連付けを削除
 * 3. 各ハッシュタグの count を -1
 * 4. count が 0 以下のハッシュタグを削除
 *
 * ## 呼び出しタイミング
 * 投稿削除時に自動的に呼び出される
 *
 * @param postId - 投稿ID
 *
 * @example
 * ```typescript
 * // 投稿削除前に呼び出し
 * await detachHashtagsFromPost(postId)
 * await prisma.post.delete({ where: { id: postId } })
 * ```
 */
export async function detachHashtagsFromPost(postId: string) {
  try {
    // ------------------------------------------------------------
    // 関連するハッシュタグを取得
    // ------------------------------------------------------------

    const postHashtags = await prisma.postHashtag.findMany({
      where: { postId },
      include: { hashtag: true },
    })

    // ------------------------------------------------------------
    // 関連付けを削除
    // ------------------------------------------------------------

    await prisma.postHashtag.deleteMany({ where: { postId } })

    // ------------------------------------------------------------
    // ハッシュタグのカウントを減少
    // ------------------------------------------------------------

    for (const ph of postHashtags) {
      /**
       * count を -1
       */
      await prisma.hashtag.update({
        where: { id: ph.hashtagId },
        data: { count: { decrement: 1 } },
      })
    }

    // ------------------------------------------------------------
    // 使用されなくなったハッシュタグを削除
    // ------------------------------------------------------------

    /**
     * count が 0 以下のハッシュタグを削除
     *
     * 使われていないハッシュタグを残さない
     */
    await prisma.hashtag.deleteMany({
      where: { count: { lte: 0 } },
    })
  } catch (error) {
    logger.error('Detach hashtags error:', error)
  }
}

// ============================================================
// トレンドハッシュタグ取得
// ============================================================

/**
 * トレンドハッシュタグを取得
 *
 * ## 機能概要
 * 現在最も多く使われているハッシュタグを取得します。
 *
 * ## 用途
 * - サイドバーの「トレンド」セクション
 * - 検索ページのおすすめタグ
 *
 * ## 並び順
 * count の多い順（人気順）
 *
 * @param limit - 取得件数（デフォルト: 10）
 * @returns ハッシュタグ配列
 *
 * @example
 * ```typescript
 * const hashtags = await getTrendingHashtags(5)
 *
 * return (
 *   <div>
 *     <h3>トレンド</h3>
 *     {hashtags.map(tag => (
 *       <Link key={tag.id} href={`/search?tag=${tag.name}`}>
 *         #{tag.name} ({tag.count})
 *       </Link>
 *     ))}
 *   </div>
 * )
 * ```
 */
export async function getTrendingHashtags(limit: number = 10) {
  try {
    // ------------------------------------------------------------
    // トレンドハッシュタグを取得
    // ------------------------------------------------------------

    const hashtags = await prisma.hashtag.findMany({
      /**
       * count > 0 のハッシュタグのみ
       */
      where: { count: { gt: 0 } },
      /**
       * 使用回数の多い順
       */
      orderBy: { count: 'desc' },
      take: limit,
    })

    return hashtags
  } catch (error) {
    logger.error('Get trending hashtags error:', error)
    return []
  }
}

// ============================================================
// ハッシュタグで投稿を検索
// ============================================================

/**
 * ハッシュタグで投稿を検索
 *
 * ## 機能概要
 * 指定されたハッシュタグを含む投稿を検索します。
 *
 * ## 検索方法
 * content に `#hashtagName` を含む投稿を検索
 * （大文字小文字を区別しない）
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 *
 * @param hashtagName - ハッシュタグ名（# なし）
 * @param options - オプション（cursor, limit）
 * @returns 投稿一覧、ハッシュタグ情報、次のカーソル
 *
 * @example
 * ```typescript
 * const { posts, hashtag, nextCursor } = await getPostsByHashtag('盆栽')
 *
 * console.log(`#${hashtag.name}: ${hashtag.count}件`)
 * ```
 */
export async function getPostsByHashtag(
  hashtagName: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const { limit = 20 } = options

  // ------------------------------------------------------------
  // 投稿を検索
  // ------------------------------------------------------------

  /**
   * content に #hashtagName を含む投稿を検索
   *
   * mode: 'insensitive' で大文字小文字を区別しない
   */
  const posts = await prisma.post.findMany({
    where: {
      isHidden: false,  // 非表示でない投稿のみ
      content: {
        contains: `#${hashtagName}`,
        mode: 'insensitive',  // 大文字小文字を区別しない
      },
    },
    include: {
      /**
       * 投稿者情報
       */
      user: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
        },
      },
      /**
       * 添付メディア
       */
      media: { orderBy: { sortOrder: 'asc' } },
      /**
       * ジャンル
       */
      genres: { include: { genre: true } },
      /**
       * いいね数・コメント数
       */
      _count: { select: { likes: true, comments: true } },
    },
    /**
     * 新しい投稿から順に
     */
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  const hasMore = posts.length === limit
  const nextCursor = hasMore ? posts[posts.length - 1]?.id : undefined

  return {
    posts,
    /**
     * ハッシュタグ情報
     * count は検索結果の件数（厳密なカウントではない）
     */
    hashtag: { name: hashtagName, count: posts.length },
    nextCursor,
  }
}

// ============================================================
// ハッシュタグ候補検索
// ============================================================

/**
 * ハッシュタグ候補を検索（オートコンプリート用）
 *
 * ## 機能概要
 * 入力中のテキストに部分一致するハッシュタグを取得します。
 *
 * ## 用途
 * - 投稿フォームのハッシュタグ入力補完
 * - 検索ボックスのサジェスト
 *
 * ## 並び順
 * count の多い順（人気のあるタグを優先）
 *
 * @param query - 検索クエリ
 * @param limit - 取得件数（デフォルト: 10）
 * @returns ハッシュタグ配列
 *
 * @example
 * ```typescript
 * // 「盆」と入力すると「盆栽」「盆栽入門」などがサジェスト
 * const suggestions = await searchHashtags('盆')
 *
 * return (
 *   <ul>
 *     {suggestions.map(tag => (
 *       <li key={tag.id} onClick={() => insertTag(tag.name)}>
 *         #{tag.name}
 *       </li>
 *     ))}
 *   </ul>
 * )
 * ```
 */
export async function searchHashtags(query: string, limit: number = 10) {
  // ------------------------------------------------------------
  // クエリのバリデーション
  // ------------------------------------------------------------

  if (!query || query.length < 1) return []

  try {
    // ------------------------------------------------------------
    // ハッシュタグを検索
    // ------------------------------------------------------------

    const hashtags = await prisma.hashtag.findMany({
      where: {
        /**
         * クエリを含むハッシュタグ（部分一致）
         *
         * mode: 'insensitive' で大文字小文字を区別しない
         */
        name: {
          contains: query.toLowerCase(),
          mode: 'insensitive',
        },
        /**
         * 使用されているハッシュタグのみ
         */
        count: { gt: 0 },
      },
      /**
       * 人気順
       */
      orderBy: { count: 'desc' },
      take: limit,
    })

    return hashtags
  } catch (error) {
    logger.error('Search hashtags error:', error)
    return []
  }
}
