// ログイン試行追跡（インメモリ）
// 注意: 本番環境では Redis や DB を使用することを推奨

interface LoginAttempt {
  count: number
  firstAttemptTime: number
  lockedUntil: number | null
}

const loginAttempts = new Map<string, LoginAttempt>()

// 設定
const MAX_ATTEMPTS = 5           // 最大試行回数
const WINDOW_MS = 15 * 60 * 1000 // 15分
const LOCKOUT_MS = 30 * 60 * 1000 // ロックアウト時間: 30分

// 古いエントリをクリーンアップ
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, attempt] of loginAttempts.entries()) {
    // ロックアウト解除済み、かつウィンドウ外のエントリを削除
    if (
      (!attempt.lockedUntil || attempt.lockedUntil < now) &&
      attempt.firstAttemptTime + WINDOW_MS < now
    ) {
      loginAttempts.delete(key)
    }
  }
}, 60000) // 1分ごと

if (typeof process !== 'undefined') {
  process.on('exit', () => clearInterval(cleanupInterval))
}

export interface LoginCheckResult {
  allowed: boolean
  remainingAttempts: number
  lockedUntil: number | null
  message?: string
}

// ログイン試行をチェック
export function checkLoginAttempt(identifier: string): LoginCheckResult {
  const now = Date.now()
  const attempt = loginAttempts.get(identifier)

  // 新規ユーザー
  if (!attempt) {
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      lockedUntil: null,
    }
  }

  // ロックアウト中かチェック
  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    const remainingSeconds = Math.ceil((attempt.lockedUntil - now) / 1000)
    const remainingMinutes = Math.ceil(remainingSeconds / 60)
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: attempt.lockedUntil,
      message: `アカウントが一時的にロックされています。${remainingMinutes}分後に再試行してください。`,
    }
  }

  // ロックアウト解除済み、またはウィンドウ外
  if (
    (attempt.lockedUntil && attempt.lockedUntil <= now) ||
    attempt.firstAttemptTime + WINDOW_MS < now
  ) {
    loginAttempts.delete(identifier)
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      lockedUntil: null,
    }
  }

  // ウィンドウ内で試行回数をチェック
  if (attempt.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: attempt.lockedUntil,
      message: 'ログイン試行回数の上限に達しました。しばらく待ってから再試行してください。',
    }
  }

  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - attempt.count,
    lockedUntil: null,
  }
}

// ログイン失敗を記録
export function recordFailedLogin(identifier: string): LoginCheckResult {
  const now = Date.now()
  const existing = loginAttempts.get(identifier)

  if (!existing || existing.firstAttemptTime + WINDOW_MS < now) {
    // 新規または期限切れ
    loginAttempts.set(identifier, {
      count: 1,
      firstAttemptTime: now,
      lockedUntil: null,
    })
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - 1,
      lockedUntil: null,
    }
  }

  // カウントを増加
  existing.count++

  // 上限に達した場合、ロックアウト
  if (existing.count >= MAX_ATTEMPTS) {
    existing.lockedUntil = now + LOCKOUT_MS
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: existing.lockedUntil,
      message: `ログイン試行回数の上限に達しました。${LOCKOUT_MS / 60000}分後に再試行してください。`,
    }
  }

  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - existing.count,
    lockedUntil: null,
  }
}

// ログイン成功時にリセット
export function resetLoginAttempts(identifier: string): void {
  loginAttempts.delete(identifier)
}

// IPとメールの組み合わせでキーを生成
export function getLoginKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`
}
