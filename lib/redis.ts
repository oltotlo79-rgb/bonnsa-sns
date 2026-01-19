/**
 * Redisクライアント設定
 *
 * このファイルは、Redis（またはインメモリフォールバック）へのアクセスを提供します。
 * 本番環境ではUpstash Redisを使用し、開発環境ではインメモリストアを使用します。
 *
 * ## Redisとは？
 * 高速なインメモリデータストア。以下の用途で使用：
 * - セッション管理
 * - キャッシュ
 * - レート制限
 * - リアルタイム機能
 *
 * ## Upstash Redisとは？
 * サーバーレス環境向けのRedisサービス
 * - HTTP REST APIでアクセス（WebSocket不要）
 * - 従量課金制
 * - Vercel、Cloudflare Workersと相性が良い
 *
 * ## このファイルの設計
 * 1. インターフェースで統一されたAPI定義
 * 2. インメモリ実装（開発/テスト用）
 * 3. Upstash実装（本番用）- 公式SDKを使用
 * 4. 環境変数に基づく自動切り替え
 *
 * @module lib/redis
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * Upstash Redis公式SDK
 *
 * HTTP REST APIを内部で使用するサーバーレス対応のRedisクライアント
 */
import { Redis } from '@upstash/redis'

/**
 * logger: 環境対応ロギングユーティリティ
 *
 * どのストア実装が使用されているかをログ出力
 */
import logger from '@/lib/logger'

// ============================================================
// インターフェース定義
// ============================================================

/**
 * Redis互換ストアのインターフェース
 *
 * ## なぜインターフェースを定義するか？
 * - 異なる実装（インメモリ/Upstash）を同じ方法で使用可能
 * - テスト時にモックに置き換えやすい
 * - 将来的に別のRedisクライアントに切り替えやすい
 *
 * ## 定義されているメソッド
 * - get: キーに対応する値を取得
 * - set: キーと値をセット（TTL指定可能）
 * - del: キーを削除
 * - incr: 値をインクリメント（1増やす）
 * - expire: 有効期限を設定
 * - ttl: 残りの有効期限を取得
 */
interface RedisLikeStore {
  /**
   * キーに対応する値を取得
   * @param key - 取得するキー
   * @returns 値（存在しない場合はnull）
   */
  get(key: string): Promise<string | null>

  /**
   * キーと値をセット
   * @param key - キー
   * @param value - 値
   * @param options - オプション（ex: 有効期限秒数）
   */
  set(key: string, value: string, options?: { ex?: number }): Promise<void>

  /**
   * キーを削除
   * @param key - 削除するキー
   */
  del(key: string): Promise<void>

  /**
   * 値を1増やす（カウンターに使用）
   * @param key - インクリメントするキー
   * @returns インクリメント後の値
   */
  incr(key: string): Promise<number>

  /**
   * 有効期限を設定
   * @param key - キー
   * @param seconds - 有効期限（秒）
   */
  expire(key: string, seconds: number): Promise<void>

  /**
   * 残りの有効期限を取得
   * @param key - キー
   * @returns 残り秒数（-1: 無期限、-2: キーなし）
   */
  ttl(key: string): Promise<number>
}

// ============================================================
// インメモリストア実装
// ============================================================

/**
 * インメモリストア（開発/テスト用フォールバック）
 *
 * ## 用途
 * - ローカル開発環境
 * - テスト実行時
 * - Redis未設定時のフォールバック
 *
 * ## 制限事項
 * - サーバー再起動でデータが消える
 * - 複数インスタンス間で共有されない
 * - メモリ使用量に注意が必要
 *
 * ## 実装の詳細
 * JavaScriptのMapを使用してキー・値を保存
 * 各エントリは値と有効期限のタイムスタンプを持つ
 */
class InMemoryStore implements RedisLikeStore {
  /**
   * データストア
   *
   * Map<key, { value, expiresAt }>
   * - value: 保存された文字列値
   * - expiresAt: 有効期限のタイムスタンプ（nullは無期限）
   */
  private store = new Map<string, { value: string; expiresAt: number | null }>()

  /**
   * 期限切れエントリを削除
   *
   * ## なぜ必要か？
   * - メモリリークを防ぐ
   * - 期限切れデータが返されないことを保証
   *
   * ## 呼び出しタイミング
   * get()の前に呼び出して、期限切れエントリをクリーンアップ
   */
  private cleanExpired() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key)
      }
    }
  }

  /**
   * 値を取得
   *
   * ## 処理フロー
   * 1. 期限切れエントリをクリーンアップ
   * 2. キーに対応するエントリを取得
   * 3. 期限切れチェック（個別に再確認）
   * 4. 値を返す
   */
  async get(key: string): Promise<string | null> {
    this.cleanExpired()
    const entry = this.store.get(key)
    if (!entry) return null

    // 期限切れの場合は削除してnullを返す
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  /**
   * 値をセット
   *
   * ## options.ex について
   * - 有効期限を秒数で指定
   * - 省略時は無期限
   *
   * ## 有効期限の計算
   * Date.now() + ex * 1000
   * - Date.now(): 現在のタイムスタンプ（ミリ秒）
   * - ex * 1000: 秒をミリ秒に変換
   */
  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : null
    this.store.set(key, { value, expiresAt })
  }

  /**
   * キーを削除
   */
  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  /**
   * 値をインクリメント
   *
   * ## 動作
   * - キーが存在しない場合: 0から開始して1を返す
   * - キーが存在する場合: 現在の値+1を返す
   *
   * ## 注意
   * 有効期限は維持される（既存エントリの場合）
   */
  async incr(key: string): Promise<number> {
    const entry = this.store.get(key)
    const currentValue = entry ? parseInt(entry.value, 10) || 0 : 0
    const newValue = currentValue + 1
    this.store.set(key, { value: newValue.toString(), expiresAt: entry?.expiresAt ?? null })
    return newValue
  }

  /**
   * 有効期限を設定
   *
   * キーが存在する場合のみ有効期限を更新
   */
  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key)
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000
    }
  }

  /**
   * 残りの有効期限を取得
   *
   * ## 戻り値
   * - 正の数: 残り秒数
   * - -1: 無期限（expiresAtがnull）
   * - -2: キーが存在しない、または期限切れ
   */
  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry || !entry.expiresAt) return -1
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000)
    return remaining > 0 ? remaining : -2
  }
}

// ============================================================
// Upstash Redis実装（公式SDK使用）
// ============================================================

/**
 * Upstash Redisクライアント（本番用）
 *
 * ## Upstash公式SDKの特徴
 * - HTTP REST APIを内部で使用
 * - 自動リトライ機能
 * - 型安全なAPI
 * - サーバーレス環境に最適化
 *
 * ## 認証方法
 * - UPSTASH_REDIS_REST_URL: Upstashダッシュボードから取得
 * - UPSTASH_REDIS_REST_TOKEN: 認証トークン
 */
class UpstashRedisStore implements RedisLikeStore {
  /**
   * Upstash Redis公式クライアント
   */
  private client: Redis

  /**
   * コンストラクタ
   * @param url - Upstash REST URL
   * @param token - 認証トークン
   */
  constructor(url: string, token: string) {
    this.client = new Redis({
      url,
      token,
    })
  }

  /**
   * 値を取得（GETコマンド）
   */
  async get(key: string): Promise<string | null> {
    const result = await this.client.get<string>(key)
    return result
  }

  /**
   * 値をセット（SETコマンド）
   *
   * ## EXオプション
   * 有効期限を秒数で指定
   * SET key value EX 60 → 60秒後に期限切れ
   */
  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    if (options?.ex) {
      await this.client.set(key, value, { ex: options.ex })
    } else {
      await this.client.set(key, value)
    }
  }

  /**
   * キーを削除（DELコマンド）
   */
  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  /**
   * 値をインクリメント（INCRコマンド）
   * キーが存在しない場合は0から開始
   */
  async incr(key: string): Promise<number> {
    return await this.client.incr(key)
  }

  /**
   * 有効期限を設定（EXPIREコマンド）
   */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds)
  }

  /**
   * 残り有効期限を取得（TTLコマンド）
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key)
  }
}

// ============================================================
// シングルトンとエクスポート
// ============================================================

/**
 * シングルトンインスタンス
 *
 * ## シングルトンパターン
 * - アプリケーション全体で1つのインスタンスを共有
 * - 接続の重複を防ぐ
 * - リソースの効率的な使用
 */
let redisClient: RedisLikeStore | null = null

/**
 * Redisクライアントを取得
 *
 * ## 動作
 * 1. 既存インスタンスがあれば返す
 * 2. 環境変数をチェック
 * 3. 設定に応じてUpstash/インメモリを初期化
 *
 * ## 環境変数
 * - UPSTASH_REDIS_REST_URL: Upstash REST URL
 * - UPSTASH_REDIS_REST_TOKEN: 認証トークン
 *
 * 両方が設定されている場合のみUpstashを使用
 *
 * @returns RedisLikeStoreインスタンス
 *
 * ## 使用例
 * ```typescript
 * const redis = getRedisClient()
 * await redis.set('key', 'value', { ex: 60 })
 * const value = await redis.get('key')
 * ```
 */
export function getRedisClient(): RedisLikeStore {
  // 既存インスタンスがあれば返す
  if (redisClient) return redisClient

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (redisUrl && redisToken) {
    // Upstash Redisを使用
    logger.log('Using Upstash Redis')
    redisClient = new UpstashRedisStore(redisUrl, redisToken)
  } else {
    // インメモリフォールバック
    logger.log('Using in-memory store (Redis not configured)')
    redisClient = new InMemoryStore()
  }

  return redisClient
}

/**
 * 便利なエクスポート
 *
 * ## getterを使う理由
 * - 遅延初期化（初めてアクセスした時に初期化）
 * - シングルトンパターンのカプセル化
 *
 * ## 使用例
 * ```typescript
 * import { redis } from '@/lib/redis'
 *
 * await redis.client.set('key', 'value')
 * ```
 */
export const redis = {
  get client() {
    return getRedisClient()
  },
}
