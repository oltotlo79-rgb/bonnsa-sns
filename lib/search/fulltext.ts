/**
 * PostgreSQL全文検索ユーティリティ
 *
 * このファイルは、PostgreSQLの全文検索機能を活用した
 * 高速な検索機能を提供します。
 *
 * ## 注意事項
 * このファイルはServer Actions ('use server') から呼び出される
 * ユーティリティです。直接クライアントから呼び出すことはできません。
 *
 * ## 対応する検索方式
 *
 * ### 1. pg_bigm（推奨・日本語向け）
 * - 2-gramベースの全文検索
 * - 日本語に最適化されている
 * - 拡張機能のインストールが必要
 * - 例: 「盆栽」→「盆栽」で検索
 *
 * ### 2. pg_trgm
 * - 3-gramベースの全文検索
 * - 多くの環境で利用可能
 * - 類似度検索もサポート
 * - 例: 「盆栽」→「盆」「栽」で検索
 *
 * ### 3. LIKE検索（フォールバック）
 * - 部分一致検索
 * - 拡張機能不要
 * - パフォーマンスは劣る
 *
 * ## 環境変数
 * SEARCH_MODE で検索方式を切り替え可能:
 * - 'bigm': pg_bigmを使用
 * - 'trgm': pg_trgmを使用
 * - 'like': LIKE検索を使用（デフォルト）
 *
 * ## N-gramとは？
 * テキストをN文字ずつに分割してインデックス化する手法。
 * - 2-gram: 「盆栽」→「盆栽」
 * - 3-gram: 「盆栽園」→「盆栽園」
 * 日本語のように単語の区切りが明確でない言語で有効。
 *
 * @module lib/search/fulltext
 */

// ============================================================
// インポート
// ============================================================

/**
 * prisma: Prismaクライアント
 *
 * データベースへのアクセスに使用。
 * $queryRaw, $executeRaw で生のSQLを実行可能。
 */
import { prisma } from '@/lib/db'

/**
 * Prisma: Prisma名前空間
 *
 * Prisma.sql, Prisma.join などのSQLテンプレートタグを提供。
 * SQLインジェクション対策済みのクエリを構築できる。
 */
import { Prisma } from '@prisma/client'

/**
 * logger: ロギングユーティリティ
 *
 * エラーログの出力に使用。
 */
import logger from '@/lib/logger'

// ============================================================
// 型定義
// ============================================================

/**
 * 検索モードの型
 *
 * ## 各モードの特徴
 *
 * ### 'bigm'
 * - 日本語に最適
 * - 2文字単位で分割
 * - pg_bigm拡張が必要
 *
 * ### 'trgm'
 * - 汎用的
 * - 3文字単位で分割
 * - pg_trgm拡張が必要
 * - 類似度検索可能
 *
 * ### 'like'
 * - 最も汎用的
 * - 拡張不要
 * - パフォーマンスは劣る
 */
export type SearchMode = 'bigm' | 'trgm' | 'like'

// ============================================================
// 設定取得関数
// ============================================================

/**
 * 現在の検索モードを取得
 *
 * ## 機能概要
 * 環境変数 SEARCH_MODE から検索モードを取得します。
 * 無効な値や未設定の場合は 'like' にフォールバック。
 *
 * ## 戻り値
 * @returns SearchMode - 'bigm' | 'trgm' | 'like'
 *
 * ## 使用例
 * ```typescript
 * const mode = getSearchMode()
 * console.log(`現在の検索モード: ${mode}`)
 * ```
 */
export function getSearchMode(): SearchMode {
  /**
   * 環境変数を小文字に変換して取得
   *
   * toLowerCase(): 大文字小文字を無視するため
   * ?.: SEARCH_MODE が undefined でもエラーにならない
   */
  const mode = process.env.SEARCH_MODE?.toLowerCase()

  /**
   * 有効な値かチェックして返す
   */
  if (mode === 'bigm' || mode === 'trgm') {
    return mode
  }

  /**
   * デフォルトは 'like'（最も互換性が高い）
   */
  return 'like'
}

// ============================================================
// 拡張機能管理
// ============================================================

/**
 * PostgreSQL拡張機能が利用可能かチェック
 *
 * ## 機能概要
 * 指定した拡張機能（pg_bigm または pg_trgm）が
 * PostgreSQLにインストールされているか確認します。
 *
 * ## パラメータ
 * @param extension - チェックする拡張機能名
 *
 * ## 戻り値
 * @returns Promise<boolean> - 利用可能なら true
 *
 * ## SQLの解説
 * ```sql
 * SELECT EXISTS(
 *   SELECT 1 FROM pg_extension WHERE extname = '拡張名'
 * ) as available
 * ```
 * pg_extension: PostgreSQLの拡張機能管理テーブル
 * EXISTS: 条件に合う行が存在すれば true
 *
 * ## 使用例
 * ```typescript
 * const bigmAvailable = await checkExtensionAvailable('pg_bigm')
 * if (bigmAvailable) {
 *   console.log('pg_bigmが利用可能です')
 * }
 * ```
 */
export async function checkExtensionAvailable(extension: 'pg_bigm' | 'pg_trgm'): Promise<boolean> {
  try {
    /**
     * 拡張機能の存在をチェックするSQLを実行
     *
     * $queryRaw: 生のSQLを実行してデータを取得
     * テンプレートリテラルで ${extension} は安全にエスケープされる
     */
    const result = await prisma.$queryRaw<{ available: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = ${extension}
      ) as available
    `

    /**
     * 結果から available フラグを取得
     *
     * ?.: result が空の場合に undefined を返す
     * ?? false: undefined の場合は false を返す
     */
    return result[0]?.available ?? false
  } catch {
    /**
     * エラー発生時は false を返す
     *
     * 例: データベース接続エラー、権限エラーなど
     */
    return false
  }
}

/**
 * PostgreSQL拡張機能を有効化
 *
 * ## 機能概要
 * 指定した拡張機能をPostgreSQLにインストールします。
 *
 * ## 注意事項
 * - 管理者権限（SUPERUSER）が必要な場合があります
 * - クラウドDBでは制限される場合があります
 *
 * ## パラメータ
 * @param extension - 有効化する拡張機能名
 *
 * ## 戻り値
 * @returns Promise<boolean> - 成功なら true
 *
 * ## SQLの解説
 * ```sql
 * CREATE EXTENSION IF NOT EXISTS "pg_bigm"
 * ```
 * IF NOT EXISTS: 既にインストール済みならスキップ
 *
 * ## 使用例
 * ```typescript
 * const success = await enableExtension('pg_bigm')
 * if (success) {
 *   await createSearchIndexes()
 * }
 * ```
 */
export async function enableExtension(extension: 'pg_bigm' | 'pg_trgm'): Promise<boolean> {
  try {
    /**
     * $executeRawUnsafe を使用
     *
     * 拡張機能名は動的に指定するため、
     * 通常のテンプレートリテラルでは使用できない。
     * 入力値は固定の2値のみなのでSQLインジェクションの心配はない。
     */
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "${extension}"`)
    return true
  } catch (error) {
    /**
     * エラー時はログを出力して false を返す
     *
     * よくある失敗原因:
     * - 権限不足（CREATE EXTENSION requires superuser）
     * - 拡張機能がサーバーにインストールされていない
     */
    logger.error(`Failed to enable ${extension}:`, error)
    return false
  }
}

// ============================================================
// インデックス管理
// ============================================================

/**
 * 検索用GINインデックスを作成
 *
 * ## 機能概要
 * 現在の検索モードに応じた全文検索インデックスを作成します。
 *
 * ## GINインデックスとは？
 * Generalized Inverted Index（汎用転置インデックス）
 * 全文検索や配列検索に最適化されたインデックス形式。
 *
 * ## 作成されるインデックス
 *
 * ### pg_bigm モード
 * - posts_content_bigm_idx: 投稿内容
 * - users_nickname_bigm_idx: ユーザーのニックネーム
 * - users_bio_bigm_idx: ユーザーの自己紹介
 *
 * ### pg_trgm モード
 * - posts_content_trgm_idx: 投稿内容
 * - users_nickname_trgm_idx: ユーザーのニックネーム
 * - users_bio_trgm_idx: ユーザーの自己紹介
 *
 * ### like モード
 * インデックス不要（通常のBtreeインデックスを使用）
 *
 * ## 戻り値
 * @returns Promise<{ success: boolean; message: string }>
 *
 * ## 使用例
 * ```typescript
 * const result = await createSearchIndexes()
 * console.log(result.message)
 * ```
 */
export async function createSearchIndexes(): Promise<{ success: boolean; message: string }> {
  const mode = getSearchMode()

  try {
    if (mode === 'bigm') {
      /**
       * pg_bigm用インデックスを作成
       *
       * gin_bigm_ops: pg_bigm用の演算子クラス
       * 2-gram分割に最適化されている
       */
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS posts_content_bigm_idx
        ON posts USING gin (content gin_bigm_ops)
      `
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS users_nickname_bigm_idx
        ON users USING gin (nickname gin_bigm_ops)
      `
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS users_bio_bigm_idx
        ON users USING gin (bio gin_bigm_ops)
      `
      return { success: true, message: 'pg_bigmインデックスを作成しました' }
    } else if (mode === 'trgm') {
      /**
       * pg_trgm用インデックスを作成
       *
       * gin_trgm_ops: pg_trgm用の演算子クラス
       * 3-gram分割と類似度検索に対応
       */
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS posts_content_trgm_idx
        ON posts USING gin (content gin_trgm_ops)
      `
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS users_nickname_trgm_idx
        ON users USING gin (nickname gin_trgm_ops)
      `
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS users_bio_trgm_idx
        ON users USING gin (bio gin_trgm_ops)
      `
      return { success: true, message: 'pg_trgmインデックスを作成しました' }
    }

    /**
     * LIKE検索モードの場合
     *
     * 特別なインデックスは不要。
     * 必要に応じて通常のBtreeインデックスを使用。
     */
    return { success: true, message: 'LIKE検索モード（インデックス不要）' }
  } catch (error) {
    logger.error('Failed to create search indexes:', error)
    return { success: false, message: `インデックス作成に失敗: ${error}` }
  }
}

// ============================================================
// 投稿検索
// ============================================================

/**
 * 全文検索クエリを実行（投稿検索）
 *
 * ## 機能概要
 * 投稿の本文を全文検索し、マッチする投稿のIDを返します。
 *
 * ## パラメータ
 * @param query - 検索クエリ文字列
 * @param options - 検索オプション
 *   - excludedUserIds: 除外するユーザーIDの配列（ブロック/ミュート用）
 *   - genreIds: フィルタするジャンルIDの配列
 *   - cursor: ページネーション用カーソル
 *   - limit: 取得件数（デフォルト: 20）
 *
 * ## 戻り値
 * @returns Promise<string[]> - マッチした投稿IDの配列
 *
 * ## 検索モード別の動作
 *
 * ### pg_bigm
 * LIKE演算子を使用（インデックスが効く）
 * ```sql
 * WHERE content LIKE '%検索語%'
 * ```
 *
 * ### pg_trgm
 * 類似度演算子（%）とILIKEを組み合わせ
 * ```sql
 * WHERE content % '検索語' OR content ILIKE '%検索語%'
 * ORDER BY similarity(content, '検索語') DESC
 * ```
 *
 * ### LIKE
 * ILIKEによる部分一致検索
 * ```sql
 * WHERE content ILIKE '%検索語%'
 * ```
 *
 * ## エラー処理
 * 検索中にエラーが発生した場合、自動的にLIKE検索にフォールバック。
 *
 * ## 使用例
 * ```typescript
 * const postIds = await fulltextSearchPosts('黒松', {
 *   genreIds: ['松柏類'],
 *   limit: 10
 * })
 * ```
 */
export async function fulltextSearchPosts(
  query: string,
  options: {
    excludedUserIds?: string[]
    genreIds?: string[]
    cursor?: string
    limit?: number
  } = {}
): Promise<string[]> {
  /**
   * オプションのデフォルト値を設定
   */
  const { excludedUserIds = [], genreIds = [], cursor, limit = 20 } = options
  const mode = getSearchMode()

  /**
   * 空のクエリの場合は空配列を返す
   */
  if (!query || query.trim() === '') {
    return []
  }

  /**
   * シングルクォートをエスケープ
   *
   * SQLインジェクション対策。
   * 'を''に置換することでSQL内で安全に使用可能。
   */
  const escapedQuery = query.replace(/'/g, "''")

  try {
    let postIds: { id: string }[]

    if (mode === 'bigm') {
      /**
       * pg_bigm検索
       *
       * LIKE演算子でもGINインデックスが効く。
       * 日本語の2-gram検索に最適化。
       */
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        WHERE p.is_hidden = false
        AND p.content LIKE '%' || ${escapedQuery} || '%'
        ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${genreIds.length > 0 ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM post_genres pg
            WHERE pg.post_id = p.id
            AND pg.genre_id IN (${Prisma.join(genreIds)})
          )
        ` : Prisma.empty}
        ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      /**
       * pg_trgm検索
       *
       * %演算子: 類似度が閾値を超えるかチェック
       * similarity(): 0〜1の類似度スコアを計算
       * 類似度順でソートすることで関連性の高い結果を上位に
       */
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        WHERE p.is_hidden = false
        AND (p.content % ${escapedQuery} OR p.content ILIKE '%' || ${escapedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${genreIds.length > 0 ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM post_genres pg
            WHERE pg.post_id = p.id
            AND pg.genre_id IN (${Prisma.join(genreIds)})
          )
        ` : Prisma.empty}
        ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
        ORDER BY similarity(p.content, ${escapedQuery}) DESC, p.created_at DESC
        LIMIT ${limit}
      `
    } else {
      /**
       * LIKE検索（フォールバック）
       *
       * ILIKE: 大文字小文字を区別しない部分一致
       * インデックスが効きにくいがどの環境でも動作
       */
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        WHERE p.is_hidden = false
        AND p.content ILIKE '%' || ${escapedQuery} || '%'
        ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${genreIds.length > 0 ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM post_genres pg
            WHERE pg.post_id = p.id
            AND pg.genre_id IN (${Prisma.join(genreIds)})
          )
        ` : Prisma.empty}
        ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `
    }

    /**
     * 結果からIDのみを抽出して返す
     */
    return postIds.map(p => p.id)
  } catch (error) {
    /**
     * エラー時はLIKE検索にフォールバック
     *
     * pg_bigmやpg_trgmが正しく設定されていない場合でも
     * 検索機能が完全に停止しないようにする
     */
    logger.error('Fulltext search error:', error)
    return fulltextSearchPostsWithLike(query, options)
  }
}

/**
 * LIKE検索へのフォールバック（投稿検索）
 *
 * ## 機能概要
 * 全文検索でエラーが発生した場合のフォールバック関数。
 * 常にLIKE検索を使用します。
 *
 * ## 内部関数
 * この関数は fulltextSearchPosts から内部的に呼び出されます。
 * 外部からの直接呼び出しは想定していません。
 */
async function fulltextSearchPostsWithLike(
  query: string,
  options: {
    excludedUserIds?: string[]
    genreIds?: string[]
    cursor?: string
    limit?: number
  } = {}
): Promise<string[]> {
  const { excludedUserIds = [], genreIds = [], cursor, limit = 20 } = options
  const escapedQuery = query.replace(/'/g, "''")

  const postIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM posts p
    WHERE p.is_hidden = false
    AND p.content ILIKE '%' || ${escapedQuery} || '%'
    ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
    ${genreIds.length > 0 ? Prisma.sql`
      AND EXISTS (
        SELECT 1 FROM post_genres pg
        WHERE pg.post_id = p.id
        AND pg.genre_id IN (${Prisma.join(genreIds)})
      )
    ` : Prisma.empty}
    ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `

  return postIds.map(p => p.id)
}

// ============================================================
// ユーザー検索
// ============================================================

/**
 * 全文検索クエリを実行（ユーザー検索）
 *
 * ## 機能概要
 * ユーザーのニックネームと自己紹介文を全文検索し、
 * マッチするユーザーのIDを返します。
 *
 * ## パラメータ
 * @param query - 検索クエリ文字列
 * @param options - 検索オプション
 *   - excludedUserIds: 除外するユーザーIDの配列
 *   - currentUserId: 現在のユーザーID（自分自身を除外）
 *   - cursor: ページネーション用カーソル
 *   - limit: 取得件数（デフォルト: 20）
 *
 * ## 戻り値
 * @returns Promise<string[]> - マッチしたユーザーIDの配列
 *
 * ## 検索対象フィールド
 * - nickname: ニックネーム（表示名）
 * - bio: 自己紹介文
 *
 * ## 使用例
 * ```typescript
 * const userIds = await fulltextSearchUsers('盆栽愛好家', {
 *   currentUserId: session.user.id,
 *   limit: 10
 * })
 * ```
 */
export async function fulltextSearchUsers(
  query: string,
  options: {
    excludedUserIds?: string[]
    currentUserId?: string
    cursor?: string
    limit?: number
  } = {}
): Promise<string[]> {
  const { excludedUserIds = [], currentUserId, cursor, limit = 20 } = options
  const mode = getSearchMode()

  /**
   * 空のクエリの場合は空配列を返す
   */
  if (!query || query.trim() === '') {
    return []
  }

  const escapedQuery = query.replace(/'/g, "''")

  try {
    let userIds: { id: string }[]

    if (mode === 'bigm') {
      /**
       * pg_bigm検索（ユーザー）
       *
       * nicknameとbioの両方を検索対象にする
       */
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname LIKE '%' || ${escapedQuery} || '%' OR u.bio LIKE '%' || ${escapedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      /**
       * pg_trgm検索（ユーザー）
       *
       * GREATEST(): 複数の値の最大値を取得
       * COALESCE(): NULLの場合にデフォルト値を使用
       *
       * nicknameとbioのうち、より高い類似度でソート
       */
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname % ${escapedQuery} OR u.nickname ILIKE '%' || ${escapedQuery} || '%'
               OR u.bio % ${escapedQuery} OR u.bio ILIKE '%' || ${escapedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        ORDER BY GREATEST(
          similarity(u.nickname, ${escapedQuery}),
          COALESCE(similarity(u.bio, ${escapedQuery}), 0)
        ) DESC
        LIMIT ${limit}
      `
    } else {
      /**
       * LIKE検索（フォールバック）
       */
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname ILIKE '%' || ${escapedQuery} || '%' OR u.bio ILIKE '%' || ${escapedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        LIMIT ${limit}
      `
    }

    return userIds.map(u => u.id)
  } catch (error) {
    /**
     * エラー時はLIKE検索にフォールバック
     */
    logger.error('Fulltext user search error:', error)
    return fulltextSearchUsersWithLike(query, options)
  }
}

/**
 * LIKE検索へのフォールバック（ユーザー検索）
 *
 * 内部関数。fulltextSearchUsers でエラー発生時に使用。
 */
async function fulltextSearchUsersWithLike(
  query: string,
  options: {
    excludedUserIds?: string[]
    currentUserId?: string
    cursor?: string
    limit?: number
  } = {}
): Promise<string[]> {
  const { excludedUserIds = [], currentUserId, cursor, limit = 20 } = options
  const escapedQuery = query.replace(/'/g, "''")

  const userIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u.id
    FROM users u
    WHERE (u.nickname ILIKE '%' || ${escapedQuery} || '%' OR u.bio ILIKE '%' || ${escapedQuery} || '%')
    ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
    ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
    ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
    LIMIT ${limit}
  `

  return userIds.map(u => u.id)
}

// ============================================================
// ステータス確認
// ============================================================

/**
 * 検索モードの状態を取得
 *
 * ## 機能概要
 * 現在の検索設定と利用可能な拡張機能の情報を返します。
 * 管理画面での設定確認やデバッグに使用します。
 *
 * ## 戻り値
 * @returns Promise<{
 *   mode: SearchMode,        // 現在の検索モード
 *   bigmAvailable: boolean,  // pg_bigmが利用可能か
 *   trgmAvailable: boolean   // pg_trgmが利用可能か
 * }>
 *
 * ## 使用例
 * ```typescript
 * const status = await getSearchStatus()
 *
 * if (status.mode === 'bigm' && !status.bigmAvailable) {
 *   console.warn('pg_bigmモードが設定されていますが、拡張がインストールされていません')
 * }
 * ```
 */
export async function getSearchStatus(): Promise<{
  mode: SearchMode
  bigmAvailable: boolean
  trgmAvailable: boolean
}> {
  const mode = getSearchMode()

  /**
   * 両方の拡張機能の状態を並列でチェック
   *
   * Promise.all: 複数のPromiseを同時に実行
   * パフォーマンス向上のため
   */
  const [bigmAvailable, trgmAvailable] = await Promise.all([
    checkExtensionAvailable('pg_bigm'),
    checkExtensionAvailable('pg_trgm'),
  ])

  return { mode, bigmAvailable, trgmAvailable }
}
