/**
 * 検索結果キャッシングユーティリティ
 *
 * このファイルは、検索結果のキャッシュ機能を提供します。
 * 同じ検索クエリに対する重複クエリを削減し、
 * レスポンス速度を向上させます。
 *
 * ## なぜ検索結果をキャッシュするか？
 *
 * ### 1. データベース負荷の軽減
 * - 検索クエリはデータベースに負荷がかかりやすい
 * - LIKE検索やフルテキスト検索は特に重い
 * - キャッシュにより同じクエリの再実行を防止
 *
 * ### 2. レスポンス速度の向上
 * - Redis: 1ms以下
 * - データベース: 10-100ms
 * - キャッシュヒット時は大幅に高速化
 *
 * ### 3. コスト削減
 * - クラウドDBは使用量課金が多い
 * - クエリ数を減らすことでコスト削減
 *
 * ## 設計方針
 * - Redis対応（分散環境対応）
 * - インメモリフォールバック（開発環境）
 * - TTL（Time To Live）によるキャッシュ自動失効
 *
 * @module lib/search-cache
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * getRedisClient: Redisクライアント取得関数
 *
 * キャッシュの保存・取得に使用
 */
import { getRedisClient } from './redis'

/**
 * logger: 環境対応ロギングユーティリティ
 *
 * エラー発生時のログ出力に使用
 */
import logger from '@/lib/logger'

// ============================================================
// 型定義
// ============================================================

/**
 * キャッシュオプションの型
 *
 * ### ttlSeconds
 * キャッシュの有効期限（秒）
 * この時間が経過すると自動的に削除されます
 */
interface CacheOptions {
  ttlSeconds?: number
}

// ============================================================
// 定数定義
// ============================================================

/**
 * デフォルトのTTL（秒）
 *
 * 5分 = 300秒
 *
 * ## 設定値の根拠
 * - 短すぎる: キャッシュヒット率が低下
 * - 長すぎる: 古いデータが表示される
 * - 5分は検索結果の鮮度とパフォーマンスのバランス
 */
const DEFAULT_TTL = 300 // 5分

// ============================================================
// 基本操作関数
// ============================================================

/**
 * 検索結果をキャッシュに保存
 *
 * ## 機能概要
 * 検索結果をRedisにJSON形式で保存します。
 *
 * ## パラメータ
 * @param key - キャッシュキー
 * @param data - キャッシュするデータ
 * @param options - キャッシュオプション
 *
 * ## ジェネリック型 <T>
 * 任意の型のデータをキャッシュ可能
 * 型安全性を維持しつつ柔軟に使用できます
 *
 * ## キーのプレフィックス
 * "search:" を付けて名前空間を分離
 * 他のRedisデータと衝突しないようにします
 *
 * ## 使用例
 * ```typescript
 * await cacheSearchResult('posts:q:bonsai', searchResults, { ttlSeconds: 600 })
 * ```
 */
export async function cacheSearchResult<T>(
  key: string,
  data: T,
  options: CacheOptions = {}
): Promise<void> {
  /**
   * TTLの設定
   *
   * 指定がなければデフォルト値を使用
   */
  const { ttlSeconds = DEFAULT_TTL } = options
  const redis = getRedisClient()

  /**
   * キャッシュキーの生成
   *
   * "search:" プレフィックスで名前空間を分離
   */
  const cacheKey = `search:${key}`

  try {
    /**
     * JSON形式でRedisに保存
     *
     * ex: 有効期限（秒）を指定
     */
    await redis.set(cacheKey, JSON.stringify(data), { ex: ttlSeconds })
  } catch (error) {
    /**
     * エラー処理
     *
     * キャッシュ失敗は致命的ではないので、
     * ログを出力して続行
     */
    logger.error('Cache set error:', error)
  }
}

/**
 * キャッシュから検索結果を取得
 *
 * ## 機能概要
 * Redisから検索結果を取得し、元の型に復元します。
 *
 * ## パラメータ
 * @param key - キャッシュキー
 *
 * ## 戻り値
 * @returns Promise<T | null>
 *   - キャッシュヒット: キャッシュされたデータ
 *   - キャッシュミス: null
 *
 * ## 使用例
 * ```typescript
 * const cached = await getCachedSearchResult<SearchResult[]>('posts:q:bonsai')
 * if (cached) {
 *   return cached  // キャッシュヒット
 * }
 * // キャッシュミス: データベースから取得
 * ```
 */
export async function getCachedSearchResult<T>(key: string): Promise<T | null> {
  const redis = getRedisClient()
  const cacheKey = `search:${key}`

  try {
    /**
     * Redisから値を取得
     */
    const data = await redis.get(cacheKey)

    /**
     * キャッシュミスの場合
     */
    if (!data) return null

    /**
     * JSONをパースして元の型に復元
     *
     * as T: 型アサーションで正しい型を指定
     */
    return JSON.parse(data) as T
  } catch (error) {
    /**
     * エラー処理
     *
     * パースエラーや接続エラーの場合は
     * nullを返してデータベースから取得させる
     */
    logger.error('Cache get error:', error)
    return null
  }
}

/**
 * 検索キャッシュを無効化（削除）
 *
 * ## 機能概要
 * 指定したキーのキャッシュを削除します。
 * データ更新後にキャッシュをクリアする際に使用します。
 *
 * ## パラメータ
 * @param pattern - 削除するキーのパターン（オプション）
 *
 * ## 注意点
 * パターン指定での一括削除は実装が複雑なため、
 * 現在は個別キーの削除のみサポートしています。
 *
 * ## 使用例
 * ```typescript
 * // 特定の検索キャッシュを削除
 * await invalidateSearchCache('posts:q:bonsai')
 *
 * // 新しい投稿が作成された後など
 * await invalidateSearchCache('posts:recent')
 * ```
 */
export async function invalidateSearchCache(pattern?: string): Promise<void> {
  /**
   * パターン指定での削除
   *
   * 注意: Redisのパターンマッチ削除（KEYS + DEL）は
   * 大規模環境では推奨されません。
   * SCANコマンドを使った実装を検討してください。
   */
  if (pattern) {
    const redis = getRedisClient()
    const key = `search:${pattern}`
    try {
      await redis.del(key)
    } catch (error) {
      logger.error('Cache invalidation error:', error)
    }
  }
}

// ============================================================
// キー生成関数
// ============================================================

/**
 * 検索クエリからキャッシュキーを生成
 *
 * ## 機能概要
 * 検索パラメータから一意のキャッシュキーを生成します。
 * 同じパラメータの検索は同じキーになるため、
 * キャッシュが正しくヒットします。
 *
 * ## パラメータ
 * @param params - 検索パラメータ
 *   - type: 検索対象（posts, users, shops, events）
 *   - query: 検索キーワード
 *   - genreId: ジャンルID
 *   - page: ページ番号
 *   - limit: 取得件数
 *   - sortBy: ソート順
 *
 * ## 戻り値
 * @returns string - キャッシュキー
 *
 * ## キーの形式
 * "type:q:query:g:genreId:p:page:l:limit:s:sortBy"
 * 例: "posts:q:松柏:g:genre1:p:1:l:20"
 *
 * ## なぜこの形式か？
 * - 人間が読みやすい
 * - デバッグしやすい
 * - パラメータの順序を統一
 *
 * ## 使用例
 * ```typescript
 * const key = generateSearchCacheKey({
 *   type: 'posts',
 *   query: '松柏',
 *   page: 1,
 *   limit: 20
 * })
 * // "posts:q:松柏:p:1:l:20"
 * ```
 */
export function generateSearchCacheKey(params: {
  type: 'posts' | 'users' | 'shops' | 'events'  // 検索対象
  query?: string        // 検索キーワード
  genreId?: string      // ジャンルID
  page?: number         // ページ番号
  limit?: number        // 取得件数
  sortBy?: string       // ソート順
}): string {
  /**
   * キーの構成要素を格納する配列
   *
   * 最初の要素は必ずtype
   */
  const parts: string[] = [params.type]

  /**
   * 各パラメータが存在する場合のみキーに追加
   *
   * これにより、同じパラメータセットは
   * 常に同じキーを生成します
   */
  if (params.query) {
    /**
     * クエリの正規化
     *
     * - 小文字に変換: 大文字小文字を区別しない
     * - trim(): 前後の空白を除去
     */
    parts.push(`q:${params.query.toLowerCase().trim()}`)
  }
  if (params.genreId) {
    parts.push(`g:${params.genreId}`)
  }
  if (params.page) {
    parts.push(`p:${params.page}`)
  }
  if (params.limit) {
    parts.push(`l:${params.limit}`)
  }
  if (params.sortBy) {
    parts.push(`s:${params.sortBy}`)
  }

  /**
   * 配列をコロンで結合してキーを生成
   */
  return parts.join(':')
}

// ============================================================
// 高レベル関数
// ============================================================

/**
 * キャッシュ付き検索実行
 *
 * ## 機能概要
 * キャッシュチェック → 検索実行 → キャッシュ保存を
 * 一連の流れで実行するヘルパー関数です。
 *
 * ## パラメータ
 * @param cacheKey - キャッシュキー
 * @param searchFn - キャッシュミス時に実行する検索関数
 * @param options - キャッシュオプション
 *
 * ## 戻り値
 * @returns Promise<T> - 検索結果（キャッシュまたは新規）
 *
 * ## 処理フロー
 * 1. キャッシュから取得を試行
 * 2. キャッシュヒット → キャッシュされた結果を返す
 * 3. キャッシュミス → searchFnを実行
 * 4. 結果をキャッシュに保存
 * 5. 結果を返す
 *
 * ## 使用例
 * ```typescript
 * const results = await cachedSearch(
 *   generateSearchCacheKey({ type: 'posts', query: '松柏' }),
 *   async () => {
 *     // 実際の検索処理
 *     return await prisma.post.findMany({ where: { ... } })
 *   },
 *   { ttlSeconds: 300 }
 * )
 * ```
 *
 * ## Cache-Aside パターン
 * この実装は「Cache-Aside」パターンを使用しています。
 * アプリケーションがキャッシュとデータベースの
 * 両方を管理する一般的なパターンです。
 */
export async function cachedSearch<T>(
  cacheKey: string,
  searchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  /**
   * キャッシュからの取得を試行
   */
  const cached = await getCachedSearchResult<T>(cacheKey)

  /**
   * キャッシュヒット
   *
   * nullでない場合はキャッシュされたデータを返す
   */
  if (cached !== null) {
    return cached
  }

  /**
   * キャッシュミス時は検索実行
   *
   * searchFn()を呼び出して実際の検索を実行
   */
  const result = await searchFn()

  /**
   * 結果をキャッシュに保存
   *
   * 非同期で保存（awaitして待つ）
   */
  await cacheSearchResult(cacheKey, result, options)

  return result
}
