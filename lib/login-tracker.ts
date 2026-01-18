/**
 * ログイン試行追跡ユーティリティ
 *
 * このファイルは、ログイン試行の追跡とアカウントロックアウト機能を提供します。
 * ブルートフォース攻撃（パスワード総当たり攻撃）からアカウントを保護します。
 *
 * ## ブルートフォース攻撃とは？
 * 可能なパスワードを片っ端から試す攻撃手法です。
 * - 辞書攻撃: よく使われるパスワードリストを試す
 * - 総当たり: すべての文字の組み合わせを試す
 *
 * ## 対策：ログイン試行制限
 * 一定回数のログイン失敗で一時的にアカウントをロックします。
 * - MAX_ATTEMPTS: 5回失敗でロック
 * - WINDOW_SECONDS: 15分間の試行窓
 * - LOCKOUT_SECONDS: 30分間のロックアウト
 *
 * ## 実装の特徴
 * - Redis対応（分散環境で正確にカウント）
 * - インメモリフォールバック（開発環境）
 * - フェイルオープン（Redis障害時は許可）
 *
 * @module lib/login-tracker
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * getRedisClient: Redisクライアント取得関数
 *
 * 試行回数のカウンターを保存するために使用
 * Redisが設定されていない場合はインメモリストアを使用
 */
import { getRedisClient } from './redis'

/**
 * logger: 環境対応ロギングユーティリティ
 *
 * エラー発生時のログ出力に使用
 */
import logger from '@/lib/logger'

// ============================================================
// 設定定数
// ============================================================

/**
 * 最大試行回数
 *
 * この回数を超えるとアカウントがロックされます。
 * 設定値: 5回
 *
 * ## 設定の根拠
 * - 少なすぎる: 正規ユーザーがタイプミスでロックされる
 * - 多すぎる: 攻撃者に多くの試行を許す
 * - 5回は一般的なバランスの取れた値
 */
const MAX_ATTEMPTS = 5           // 最大試行回数

/**
 * 試行カウントのウィンドウ時間（秒）
 *
 * この時間内の失敗回数をカウントします。
 * 設定値: 15分（900秒）
 *
 * ## ウィンドウの動作
 * 15分経過すると試行回数がリセットされます。
 * これにより、時間をおいて再試行が可能になります。
 */
const WINDOW_SECONDS = 15 * 60   // 15分

/**
 * ロックアウト時間（秒）
 *
 * ロックアウトが発動した後、この時間が経過するまで
 * ログインができません。
 * 設定値: 30分（1800秒）
 *
 * ## ロックアウトの目的
 * - 攻撃者の試行ペースを大幅に遅らせる
 * - 正規ユーザーは30分後に再試行可能
 */
const LOCKOUT_SECONDS = 30 * 60  // ロックアウト時間: 30分

// ============================================================
// 型定義
// ============================================================

/**
 * ログイン試行チェックの結果型
 *
 * ## 各プロパティの説明
 *
 * ### allowed
 * ログイン試行が許可されているかどうか
 * - true: 試行可能
 * - false: ロックアウト中または試行回数超過
 *
 * ### remainingAttempts
 * 残りの試行可能回数
 * 0の場合はこれ以上試行できません
 *
 * ### lockedUntil
 * ロックアウト解除時刻（タイムスタンプ）
 * nullの場合はロックアウトされていません
 *
 * ### message（オプション）
 * ユーザーに表示するメッセージ
 * ロックアウト時や試行回数超過時に設定
 */
export interface LoginCheckResult {
  allowed: boolean
  remainingAttempts: number
  lockedUntil: number | null
  message?: string
}

/**
 * 内部用：ログイン試行データの型
 *
 * Redisに保存するデータの形式
 *
 * ### count
 * 現在の試行回数
 *
 * ### lockedUntil
 * ロックアウト解除時刻（タイムスタンプ）
 * ロックアウトされていない場合はnull
 */
interface LoginAttemptData {
  count: number
  lockedUntil: number | null
}

// ============================================================
// 内部ヘルパー関数
// ============================================================

/**
 * ログイン試行データを取得
 *
 * ## 機能概要
 * Redisからキーに対応する試行データを取得します。
 *
 * ## パラメータ
 * @param key - Redisキー
 *
 * ## 戻り値
 * @returns LoginAttemptData | null - 試行データ、存在しない場合はnull
 *
 * ## 処理フロー
 * 1. Redisクライアントを取得
 * 2. キーに対応する値を取得
 * 3. JSON.parseでオブジェクトに変換
 * 4. パースエラー時はnullを返す
 */
async function getAttemptData(key: string): Promise<LoginAttemptData | null> {
  const redis = getRedisClient()
  const data = await redis.get(key)

  /**
   * データが存在しない場合
   */
  if (!data) return null

  /**
   * JSONパース
   *
   * try-catchでパースエラーをハンドリング
   * 不正なデータが保存されていた場合に備える
   */
  try {
    return JSON.parse(data) as LoginAttemptData
  } catch {
    return null
  }
}

/**
 * ログイン試行データを保存
 *
 * ## 機能概要
 * Redisにログイン試行データを保存します。
 *
 * ## パラメータ
 * @param key - Redisキー
 * @param data - 保存するデータ
 * @param ttlSeconds - 有効期限（秒）
 *
 * ## 処理内容
 * データをJSON文字列に変換し、TTL付きでRedisに保存
 */
async function setAttemptData(key: string, data: LoginAttemptData, ttlSeconds: number): Promise<void> {
  const redis = getRedisClient()
  await redis.set(key, JSON.stringify(data), { ex: ttlSeconds })
}

// ============================================================
// メイン関数
// ============================================================

/**
 * ログイン試行が許可されているかチェック
 *
 * ## 機能概要
 * 識別子（IP + メールアドレスなど）に対して、
 * ログイン試行が許可されているかをチェックします。
 *
 * ## パラメータ
 * @param identifier - 識別子（例: "192.168.1.1:user@example.com"）
 *
 * ## 戻り値
 * @returns Promise<LoginCheckResult> - チェック結果
 *
 * ## 処理フロー
 * 1. Redisから試行データを取得
 * 2. データなし → 新規ユーザー、許可
 * 3. ロックアウト中 → 拒否
 * 4. 試行回数超過 → 拒否
 * 5. それ以外 → 許可
 *
 * ## フェイルオープン
 * Redisエラー時は許可を返します。
 * これにより、Redis障害時でもユーザーがログインできます。
 *
 * ## 使用例
 * ```typescript
 * const result = await checkLoginAttempt(getLoginKey(ip, email))
 * if (!result.allowed) {
 *   return { error: result.message }
 * }
 * // ログイン処理を続行
 * ```
 */
export async function checkLoginAttempt(identifier: string): Promise<LoginCheckResult> {
  /**
   * Redisキーの生成
   *
   * "login_attempt:" プレフィックスで名前空間を分離
   */
  const key = `login_attempt:${identifier}`
  const now = Date.now()

  try {
    const data = await getAttemptData(key)

    /**
     * 新規ユーザー（データなし）
     *
     * まだ試行記録がない場合、フルの試行回数を許可
     */
    if (!data) {
      return {
        allowed: true,
        remainingAttempts: MAX_ATTEMPTS,
        lockedUntil: null,
      }
    }

    /**
     * ロックアウト中かチェック
     *
     * lockedUntilが設定されていて、現在時刻より未来の場合、
     * まだロックアウト期間中
     */
    if (data.lockedUntil && data.lockedUntil > now) {
      /**
       * 残り時間の計算
       *
       * ミリ秒を秒に変換し、分に丸める
       */
      const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000)
      const remainingMinutes = Math.ceil(remainingSeconds / 60)
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: data.lockedUntil,
        message: `アカウントが一時的にロックされています。${remainingMinutes}分後に再試行してください。`,
      }
    }

    /**
     * ウィンドウ内で試行回数をチェック
     *
     * MAX_ATTEMPTS以上の場合は拒否
     */
    if (data.count >= MAX_ATTEMPTS) {
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: data.lockedUntil,
        message: 'ログイン試行回数の上限に達しました。しばらく待ってから再試行してください。',
      }
    }

    /**
     * 試行許可
     *
     * まだ試行回数に余裕がある場合
     */
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - data.count,
      lockedUntil: null,
    }
  } catch (error) {
    /**
     * エラー処理（フェイルオープン）
     *
     * Redisエラー時は許可を返す
     * ユーザー体験を優先
     */
    logger.error('Login attempt check error:', error)
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      lockedUntil: null,
    }
  }
}

/**
 * ログイン失敗を記録
 *
 * ## 機能概要
 * ログイン失敗時に呼び出し、試行回数をカウントアップします。
 * 上限に達した場合はロックアウトを発動します。
 *
 * ## パラメータ
 * @param identifier - 識別子
 *
 * ## 戻り値
 * @returns Promise<LoginCheckResult> - 更新後の状態
 *
 * ## 処理フロー
 * 1. 既存の試行データを取得
 * 2. データなし → 新規作成（count: 1）
 * 3. カウントをインクリメント
 * 4. MAX_ATTEMPTS到達 → ロックアウト設定
 * 5. 更新したデータを保存
 *
 * ## 使用例
 * ```typescript
 * const isValid = await bcrypt.compare(password, user.password)
 * if (!isValid) {
 *   const result = await recordFailedLogin(getLoginKey(ip, email))
 *   if (!result.allowed) {
 *     // ロックアウトされた
 *   }
 *   return { error: 'パスワードが正しくありません' }
 * }
 * ```
 */
export async function recordFailedLogin(identifier: string): Promise<LoginCheckResult> {
  const key = `login_attempt:${identifier}`
  const now = Date.now()

  try {
    const existing = await getAttemptData(key)

    /**
     * 新規（初回失敗）
     *
     * カウントを1で初期化
     * WINDOW_SECONDSで自動削除（TTL）
     */
    if (!existing) {
      await setAttemptData(key, { count: 1, lockedUntil: null }, WINDOW_SECONDS)
      return {
        allowed: true,
        remainingAttempts: MAX_ATTEMPTS - 1,
        lockedUntil: null,
      }
    }

    /**
     * カウントを増加
     */
    const newCount = existing.count + 1

    /**
     * 上限に達した場合、ロックアウト発動
     *
     * lockedUntilを現在時刻 + ロックアウト時間に設定
     * TTLもロックアウト時間に延長
     */
    if (newCount >= MAX_ATTEMPTS) {
      const lockedUntil = now + LOCKOUT_SECONDS * 1000  // ミリ秒に変換
      await setAttemptData(key, { count: newCount, lockedUntil }, LOCKOUT_SECONDS)
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil,
        message: `ログイン試行回数の上限に達しました。${LOCKOUT_SECONDS / 60}分後に再試行してください。`,
      }
    }

    /**
     * まだ上限に達していない場合
     *
     * カウントを更新し、残り回数を返す
     */
    await setAttemptData(key, { count: newCount, lockedUntil: null }, WINDOW_SECONDS)
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - newCount,
      lockedUntil: null,
    }
  } catch (error) {
    /**
     * エラー処理（フェイルオープン）
     */
    logger.error('Record failed login error:', error)
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - 1,
      lockedUntil: null,
    }
  }
}

/**
 * ログイン成功時にカウンターをリセット
 *
 * ## 機能概要
 * ログイン成功時に呼び出し、試行記録を削除します。
 * これにより、次回の試行ではフルの回数が使えます。
 *
 * ## パラメータ
 * @param identifier - 識別子
 *
 * ## 処理内容
 * Redisからキーを削除
 *
 * ## なぜリセットが必要か？
 * 正規ユーザーが正しくログインできた場合、
 * 過去の失敗記録を保持する必要がありません。
 * リセットすることで、次回も通常通りログインできます。
 *
 * ## 使用例
 * ```typescript
 * const isValid = await bcrypt.compare(password, user.password)
 * if (isValid) {
 *   await resetLoginAttempts(getLoginKey(ip, email))
 *   // ログイン成功処理
 * }
 * ```
 */
export async function resetLoginAttempts(identifier: string): Promise<void> {
  const redis = getRedisClient()
  const key = `login_attempt:${identifier}`
  try {
    await redis.del(key)
  } catch (error) {
    /**
     * エラーはログに記録するが、ログイン自体は成功させる
     *
     * リセット失敗は致命的ではない
     */
    logger.error('Reset login attempts error:', error)
  }
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * ログイン追跡用のキーを生成
 *
 * ## 機能概要
 * IPアドレスとメールアドレスを組み合わせて、
 * 一意の識別子を生成します。
 *
 * ## パラメータ
 * @param ip - クライアントのIPアドレス
 * @param email - ログイン試行されたメールアドレス
 *
 * ## 戻り値
 * @returns string - "ip:email" 形式の識別子
 *
 * ## なぜIP + メールの組み合わせか？
 *
 * ### IPのみの場合
 * - 同一ネットワーク内のユーザーが互いに影響
 * - NAT環境で多数のユーザーが同一IPを共有
 *
 * ### メールのみの場合
 * - 攻撃者が異なるIPから攻撃可能
 * - 正規ユーザーのアカウントが標的になりやすい
 *
 * ### IP + メールの組み合わせ
 * - 特定のIP + メールの組み合わせのみをロック
 * - 正規ユーザーが別のネットワークからはログイン可能
 * - バランスの取れたセキュリティ
 *
 * ## メールアドレスの正規化
 * toLowerCase()で小文字に統一
 * "User@Example.com" と "user@example.com" を同一視
 *
 * ## 使用例
 * ```typescript
 * const key = getLoginKey(ip, email)
 * // "192.168.1.1:user@example.com"
 * const result = await checkLoginAttempt(key)
 * ```
 */
export function getLoginKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`
}
