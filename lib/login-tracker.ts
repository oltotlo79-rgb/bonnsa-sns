// ログイン試行追跡（Redis対応、インメモリフォールバック付き）
// UPSTASH_REDIS_REST_URL と UPSTASH_REDIS_REST_TOKEN が設定されている場合は Redis を使用

import { getRedisClient } from './redis'

// 設定
const MAX_ATTEMPTS = 5           // 最大試行回数
const WINDOW_SECONDS = 15 * 60   // 15分
const LOCKOUT_SECONDS = 30 * 60  // ロックアウト時間: 30分

export interface LoginCheckResult {
  allowed: boolean
  remainingAttempts: number
  lockedUntil: number | null
  message?: string
}

interface LoginAttemptData {
  count: number
  lockedUntil: number | null
}

// ログイン試行データを取得
async function getAttemptData(key: string): Promise<LoginAttemptData | null> {
  const redis = getRedisClient()
  const data = await redis.get(key)
  if (!data) return null
  try {
    return JSON.parse(data) as LoginAttemptData
  } catch {
    return null
  }
}

// ログイン試行データを保存
async function setAttemptData(key: string, data: LoginAttemptData, ttlSeconds: number): Promise<void> {
  const redis = getRedisClient()
  await redis.set(key, JSON.stringify(data), { ex: ttlSeconds })
}

// ログイン試行をチェック
export async function checkLoginAttempt(identifier: string): Promise<LoginCheckResult> {
  const key = `login_attempt:${identifier}`
  const now = Date.now()

  try {
    const data = await getAttemptData(key)

    // 新規ユーザー
    if (!data) {
      return {
        allowed: true,
        remainingAttempts: MAX_ATTEMPTS,
        lockedUntil: null,
      }
    }

    // ロックアウト中かチェック
    if (data.lockedUntil && data.lockedUntil > now) {
      const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000)
      const remainingMinutes = Math.ceil(remainingSeconds / 60)
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: data.lockedUntil,
        message: `アカウントが一時的にロックされています。${remainingMinutes}分後に再試行してください。`,
      }
    }

    // ウィンドウ内で試行回数をチェック
    if (data.count >= MAX_ATTEMPTS) {
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: data.lockedUntil,
        message: 'ログイン試行回数の上限に達しました。しばらく待ってから再試行してください。',
      }
    }

    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - data.count,
      lockedUntil: null,
    }
  } catch (error) {
    console.error('Login attempt check error:', error)
    // エラー時は許可（フェイルオープン）
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      lockedUntil: null,
    }
  }
}

// ログイン失敗を記録
export async function recordFailedLogin(identifier: string): Promise<LoginCheckResult> {
  const key = `login_attempt:${identifier}`
  const now = Date.now()

  try {
    const existing = await getAttemptData(key)

    if (!existing) {
      // 新規
      await setAttemptData(key, { count: 1, lockedUntil: null }, WINDOW_SECONDS)
      return {
        allowed: true,
        remainingAttempts: MAX_ATTEMPTS - 1,
        lockedUntil: null,
      }
    }

    // カウントを増加
    const newCount = existing.count + 1

    // 上限に達した場合、ロックアウト
    if (newCount >= MAX_ATTEMPTS) {
      const lockedUntil = now + LOCKOUT_SECONDS * 1000
      await setAttemptData(key, { count: newCount, lockedUntil }, LOCKOUT_SECONDS)
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil,
        message: `ログイン試行回数の上限に達しました。${LOCKOUT_SECONDS / 60}分後に再試行してください。`,
      }
    }

    await setAttemptData(key, { count: newCount, lockedUntil: null }, WINDOW_SECONDS)
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - newCount,
      lockedUntil: null,
    }
  } catch (error) {
    console.error('Record failed login error:', error)
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - 1,
      lockedUntil: null,
    }
  }
}

// ログイン成功時にリセット
export async function resetLoginAttempts(identifier: string): Promise<void> {
  const redis = getRedisClient()
  const key = `login_attempt:${identifier}`
  try {
    await redis.del(key)
  } catch (error) {
    console.error('Reset login attempts error:', error)
  }
}

// IPとメールの組み合わせでキーを生成
export function getLoginKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`
}
