// セキュリティログ
// 注意: 本番環境ではログ管理サービス（CloudWatch, Datadog等）への連携を推奨

type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGIN_LOCKOUT'
  | 'REGISTER_SUCCESS'
  | 'REGISTER_FAILURE'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS'
  | 'ADMIN_ACTION'
  | 'SUSPICIOUS_ACTIVITY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED_ACCESS'

interface SecurityLogEntry {
  timestamp: string
  type: SecurityEventType
  userId?: string
  ip?: string
  userAgent?: string
  details?: Record<string, unknown>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// ログエントリをフォーマット
function formatLogEntry(entry: SecurityLogEntry): string {
  return JSON.stringify({
    ...entry,
    env: process.env.NODE_ENV,
    app: 'bon-log',
  })
}

// コンソールへのログ出力（本番ではログ管理サービスに送信）
function writeLog(entry: SecurityLogEntry): void {
  const formatted = formatLogEntry(entry)

  // 重大度に応じてログレベルを変更
  switch (entry.severity) {
    case 'critical':
    case 'high':
      console.error(`[SECURITY] ${formatted}`)
      break
    case 'medium':
      console.warn(`[SECURITY] ${formatted}`)
      break
    default:
      console.log(`[SECURITY] ${formatted}`)
  }
}

// ログイン成功
export function logLoginSuccess(userId: string, ip?: string, userAgent?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'LOGIN_SUCCESS',
    userId,
    ip,
    userAgent,
    severity: 'low',
  })
}

// ログイン失敗
export function logLoginFailure(email: string, ip?: string, reason?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'LOGIN_FAILURE',
    ip,
    details: { email: maskEmail(email), reason },
    severity: 'medium',
  })
}

// ログインロックアウト
export function logLoginLockout(email: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'LOGIN_LOCKOUT',
    ip,
    details: { email: maskEmail(email) },
    severity: 'high',
  })
}

// ユーザー登録成功
export function logRegisterSuccess(userId: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'REGISTER_SUCCESS',
    userId,
    ip,
    severity: 'low',
  })
}

// 管理者アクション
export function logAdminAction(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'ADMIN_ACTION',
    userId: adminId,
    details: {
      action,
      targetType,
      targetId,
      ...details,
    },
    severity: 'medium',
  })
}

// 不審なアクティビティ
export function logSuspiciousActivity(
  description: string,
  ip?: string,
  userId?: string,
  details?: Record<string, unknown>
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'SUSPICIOUS_ACTIVITY',
    userId,
    ip,
    details: { description, ...details },
    severity: 'high',
  })
}

// レート制限超過
export function logRateLimitExceeded(
  limitType: string,
  ip?: string,
  userId?: string
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'RATE_LIMIT_EXCEEDED',
    userId,
    ip,
    details: { limitType },
    severity: 'medium',
  })
}

// 不正な入力
export function logInvalidInput(
  field: string,
  reason: string,
  ip?: string,
  userId?: string
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'INVALID_INPUT',
    userId,
    ip,
    details: { field, reason },
    severity: 'low',
  })
}

// 権限のないアクセス
export function logUnauthorizedAccess(
  resource: string,
  ip?: string,
  userId?: string
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'UNAUTHORIZED_ACCESS',
    userId,
    ip,
    details: { resource },
    severity: 'high',
  })
}

// パスワードリセットリクエスト
export function logPasswordResetRequest(email: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'PASSWORD_RESET_REQUEST',
    ip,
    details: { email: maskEmail(email) },
    severity: 'low',
  })
}

// パスワードリセット成功
export function logPasswordResetSuccess(userId: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'PASSWORD_RESET_SUCCESS',
    userId,
    ip,
    severity: 'medium',
  })
}

// メールアドレスのマスキング（プライバシー保護）
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***@***'

  const maskedLocal =
    local.length <= 2
      ? '*'.repeat(local.length)
      : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]

  return `${maskedLocal}@${domain}`
}
