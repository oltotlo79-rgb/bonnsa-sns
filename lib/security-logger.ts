/**
 * セキュリティログユーティリティ
 *
 * このファイルは、セキュリティ関連イベントのログ記録機能を提供します。
 * 不正アクセスの検知、監査証跡の保持、インシデント対応に使用されます。
 *
 * ## セキュリティログとは？
 * 認証、アクセス制御、不正行為に関するイベントを記録するログです。
 * 以下の目的で使用されます：
 *
 * ### 1. 不正アクセスの検知
 * - 大量のログイン失敗
 * - ブルートフォース攻撃
 * - 異常なアクセスパターン
 *
 * ### 2. 監査証跡（Audit Trail）
 * - 管理者のアクション記録
 * - コンプライアンス対応
 * - 事後調査のための証拠
 *
 * ### 3. インシデント対応
 * - 攻撃の発生時刻特定
 * - 影響範囲の調査
 * - 原因分析
 *
 * ## 本番環境での推奨事項
 * 現在はコンソール出力ですが、本番環境では以下のサービスへの
 * 連携を推奨します：
 * - AWS CloudWatch Logs
 * - Datadog
 * - Splunk
 * - New Relic
 *
 * @module lib/security-logger
 */

// ============================================================
// 型定義
// ============================================================

/**
 * セキュリティイベントの種類
 *
 * ## イベントタイプの説明
 *
 * ### 認証関連
 * - LOGIN_SUCCESS: ログイン成功
 * - LOGIN_FAILURE: ログイン失敗（パスワード間違いなど）
 * - LOGIN_LOCKOUT: アカウントロックアウト（試行回数超過）
 * - REGISTER_SUCCESS: 新規登録成功
 * - REGISTER_FAILURE: 新規登録失敗
 *
 * ### パスワード関連
 * - PASSWORD_RESET_REQUEST: パスワードリセット要求
 * - PASSWORD_RESET_SUCCESS: パスワードリセット完了
 *
 * ### アクセス関連
 * - ADMIN_ACTION: 管理者による操作
 * - SUSPICIOUS_ACTIVITY: 不審なアクティビティ
 * - RATE_LIMIT_EXCEEDED: レート制限超過
 * - INVALID_INPUT: 不正な入力検知
 * - UNAUTHORIZED_ACCESS: 権限のないアクセス
 */
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

/**
 * セキュリティログエントリの型
 *
 * ## 各フィールドの説明
 *
 * ### timestamp
 * イベント発生時刻（ISO 8601形式）
 * 例: "2024-01-15T10:30:00.000Z"
 *
 * ### type
 * イベントの種類（SecurityEventType）
 *
 * ### userId（オプション）
 * 関連するユーザーのID
 * 未認証の場合はundefined
 *
 * ### ip（オプション）
 * クライアントのIPアドレス
 * プロキシ経由の場合は元のIPを取得
 *
 * ### userAgent（オプション）
 * ブラウザやクライアントの識別情報
 *
 * ### details（オプション）
 * 追加の詳細情報（任意のキーバリュー）
 *
 * ### severity
 * 重大度レベル
 * - low: 通常の情報（ログイン成功など）
 * - medium: 注意が必要（ログイン失敗など）
 * - high: 警告（不審なアクティビティなど）
 * - critical: 緊急対応が必要
 */
interface SecurityLogEntry {
  timestamp: string
  type: SecurityEventType
  userId?: string
  ip?: string
  userAgent?: string
  details?: Record<string, unknown>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// ============================================================
// 内部ヘルパー関数
// ============================================================

/**
 * ログエントリをJSON形式にフォーマット
 *
 * ## 機能概要
 * ログエントリに追加情報を付与し、JSON文字列に変換します。
 *
 * ## パラメータ
 * @param entry - セキュリティログエントリ
 *
 * ## 戻り値
 * @returns string - JSON形式の文字列
 *
 * ## 追加される情報
 * - env: 実行環境（development/production）
 * - app: アプリケーション名
 *
 * ## 構造化ログ
 * JSON形式にすることで、ログ管理サービスでの
 * パース、検索、集計が容易になります。
 */
function formatLogEntry(entry: SecurityLogEntry): string {
  return JSON.stringify({
    ...entry,
    env: process.env.NODE_ENV,
    app: 'bon-log',
  })
}

/**
 * ログを出力する内部関数
 *
 * ## 機能概要
 * 重大度に応じて適切なログレベルで出力します。
 *
 * ## パラメータ
 * @param entry - セキュリティログエントリ
 *
 * ## ログレベルのマッピング
 * - critical/high → console.error（エラーとして記録）
 * - medium → console.warn（警告として記録）
 * - low → console.log（情報として記録）
 *
 * ## [SECURITY]プレフィックス
 * セキュリティログであることを明示するプレフィックス。
 * ログ検索やフィルタリング時に役立ちます。
 *
 * ## 本番環境での拡張
 * ここでログ管理サービスへの送信を追加することで、
 * 集中管理されたログ基盤に連携できます。
 */
function writeLog(entry: SecurityLogEntry): void {
  const formatted = formatLogEntry(entry)

  /**
   * 重大度に応じてログレベルを変更
   *
   * switch文で各重大度に適切なメソッドをマッピング
   */
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

// ============================================================
// 認証関連ログ関数
// ============================================================

/**
 * ログイン成功を記録
 *
 * ## 機能概要
 * ユーザーがログインに成功した際のログを記録します。
 *
 * ## パラメータ
 * @param userId - ログインしたユーザーのID
 * @param ip - クライアントのIPアドレス（オプション）
 * @param userAgent - ブラウザ情報（オプション）
 *
 * ## 重大度: low
 * 正常な操作のため、情報レベルとして記録
 *
 * ## 使用例
 * ```typescript
 * await signIn('credentials', { email, password })
 * logLoginSuccess(user.id, getClientIp(request), request.headers.get('user-agent'))
 * ```
 */
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

/**
 * ログイン失敗を記録
 *
 * ## 機能概要
 * ログイン試行が失敗した際のログを記録します。
 *
 * ## パラメータ
 * @param email - 試行されたメールアドレス（マスキング処理あり）
 * @param ip - クライアントのIPアドレス（オプション）
 * @param reason - 失敗理由（オプション）
 *
 * ## 重大度: medium
 * 連続失敗は攻撃の可能性があるため、注意レベル
 *
 * ## プライバシー保護
 * メールアドレスはmaskEmail関数でマスキングされます。
 * ログにメールアドレスの完全な形式を残さないことで、
 * ログ漏洩時のリスクを軽減します。
 *
 * ## 使用例
 * ```typescript
 * const user = await prisma.user.findUnique({ where: { email } })
 * if (!user) {
 *   logLoginFailure(email, ip, 'User not found')
 *   return { error: 'メールアドレスまたはパスワードが正しくありません' }
 * }
 * ```
 */
export function logLoginFailure(email: string, ip?: string, reason?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'LOGIN_FAILURE',
    ip,
    details: { email: maskEmail(email), reason },
    severity: 'medium',
  })
}

/**
 * ログインロックアウトを記録
 *
 * ## 機能概要
 * ログイン試行回数超過によるロックアウトを記録します。
 *
 * ## パラメータ
 * @param email - ロックアウトされたメールアドレス
 * @param ip - クライアントのIPアドレス（オプション）
 *
 * ## 重大度: high
 * ブルートフォース攻撃の可能性があるため、警告レベル
 *
 * ## アラート対象
 * 本番環境では、このイベントが多発した場合に
 * 管理者へのアラート通知を設定することを推奨します。
 */
export function logLoginLockout(email: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'LOGIN_LOCKOUT',
    ip,
    details: { email: maskEmail(email) },
    severity: 'high',
  })
}

/**
 * ユーザー登録成功を記録
 *
 * ## 機能概要
 * 新規ユーザー登録が完了した際のログを記録します。
 *
 * ## パラメータ
 * @param userId - 作成されたユーザーのID
 * @param ip - クライアントのIPアドレス（オプション）
 *
 * ## 重大度: low
 * 正常な操作のため、情報レベルとして記録
 */
export function logRegisterSuccess(userId: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'REGISTER_SUCCESS',
    userId,
    ip,
    severity: 'low',
  })
}

// ============================================================
// 管理者アクションログ関数
// ============================================================

/**
 * 管理者アクションを記録
 *
 * ## 機能概要
 * 管理者による重要な操作を記録します。
 * 監査証跡として、誰が何をいつ行ったかを追跡できます。
 *
 * ## パラメータ
 * @param adminId - 操作を行った管理者のID
 * @param action - 実行されたアクション（例: "delete_user", "ban_user"）
 * @param targetType - 対象の種類（例: "user", "post", "comment"）
 * @param targetId - 対象のID
 * @param details - 追加の詳細情報
 *
 * ## 重大度: medium
 * 管理操作は影響が大きいため、注意レベル
 *
 * ## 使用例
 * ```typescript
 * await prisma.user.delete({ where: { id: targetUserId } })
 * logAdminAction(
 *   session.user.id,
 *   'delete_user',
 *   'user',
 *   targetUserId,
 *   { reason: '利用規約違反' }
 * )
 * ```
 */
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

// ============================================================
// 異常検知ログ関数
// ============================================================

/**
 * 不審なアクティビティを記録
 *
 * ## 機能概要
 * システムが検知した不審な行動パターンを記録します。
 *
 * ## パラメータ
 * @param description - 不審なアクティビティの説明
 * @param ip - クライアントのIPアドレス（オプション）
 * @param userId - 関連するユーザーID（オプション）
 * @param details - 追加の詳細情報
 *
 * ## 重大度: high
 * セキュリティリスクがあるため、警告レベル
 *
 * ## 検知対象の例
 * - 異常に高頻度のAPI呼び出し
 * - 通常と異なるアクセスパターン
 * - 既知の攻撃パターンとの一致
 *
 * ## 使用例
 * ```typescript
 * if (requestsPerMinute > 1000) {
 *   logSuspiciousActivity(
 *     'Abnormally high request rate',
 *     ip,
 *     userId,
 *     { requestsPerMinute }
 *   )
 * }
 * ```
 */
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

/**
 * レート制限超過を記録
 *
 * ## 機能概要
 * APIのレート制限を超過した際のログを記録します。
 *
 * ## パラメータ
 * @param limitType - 制限の種類（例: "api", "login", "upload"）
 * @param ip - クライアントのIPアドレス（オプション）
 * @param userId - 関連するユーザーID（オプション）
 *
 * ## 重大度: medium
 * 悪意のない過剰使用の可能性もあるため、注意レベル
 *
 * ## 使用例
 * ```typescript
 * const result = await rateLimit(key, options)
 * if (!result.success) {
 *   logRateLimitExceeded('api', ip, userId)
 *   return new Response('Too many requests', { status: 429 })
 * }
 * ```
 */
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

/**
 * 不正な入力を記録
 *
 * ## 機能概要
 * バリデーションで検出された不正な入力を記録します。
 *
 * ## パラメータ
 * @param field - 問題のあったフィールド名
 * @param reason - 不正と判断された理由
 * @param ip - クライアントのIPアドレス（オプション）
 * @param userId - 関連するユーザーID（オプション）
 *
 * ## 重大度: low
 * 入力ミスの可能性もあるため、情報レベル
 *
 * ## 使用場面
 * - XSS攻撃パターンの検出
 * - SQLインジェクションパターンの検出
 * - 明らかに不正な形式の入力
 */
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

/**
 * 権限のないアクセスを記録
 *
 * ## 機能概要
 * 認可されていないリソースへのアクセス試行を記録します。
 *
 * ## パラメータ
 * @param resource - アクセスされたリソース（例: "/admin/users"）
 * @param ip - クライアントのIPアドレス（オプション）
 * @param userId - 関連するユーザーID（オプション）
 *
 * ## 重大度: high
 * 権限昇格攻撃の可能性があるため、警告レベル
 *
 * ## 使用例
 * ```typescript
 * if (!user.isAdmin) {
 *   logUnauthorizedAccess('/admin/dashboard', ip, user.id)
 *   return redirect('/403')
 * }
 * ```
 */
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

// ============================================================
// パスワードリセット関連ログ関数
// ============================================================

/**
 * パスワードリセットリクエストを記録
 *
 * ## 機能概要
 * パスワードリセットの要求を記録します。
 *
 * ## パラメータ
 * @param email - リセット対象のメールアドレス
 * @param ip - クライアントのIPアドレス（オプション）
 *
 * ## 重大度: low
 * 正常な操作のため、情報レベル
 *
 * ## プライバシー保護
 * メールアドレスはマスキングして記録
 */
export function logPasswordResetRequest(email: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'PASSWORD_RESET_REQUEST',
    ip,
    details: { email: maskEmail(email) },
    severity: 'low',
  })
}

/**
 * パスワードリセット成功を記録
 *
 * ## 機能概要
 * パスワードリセットが完了した際のログを記録します。
 *
 * ## パラメータ
 * @param userId - パスワードをリセットしたユーザーのID
 * @param ip - クライアントのIPアドレス（オプション）
 *
 * ## 重大度: medium
 * 認証情報の変更のため、注意レベル
 */
export function logPasswordResetSuccess(userId: string, ip?: string): void {
  writeLog({
    timestamp: new Date().toISOString(),
    type: 'PASSWORD_RESET_SUCCESS',
    userId,
    ip,
    severity: 'medium',
  })
}

// ============================================================
// プライバシー保護ヘルパー関数
// ============================================================

/**
 * メールアドレスをマスキング
 *
 * ## 機能概要
 * メールアドレスの一部を隠し、ログ上でのプライバシーを保護します。
 *
 * ## パラメータ
 * @param email - マスキング対象のメールアドレス
 *
 * ## 戻り値
 * @returns string - マスキングされたメールアドレス
 *
 * ## マスキングルール
 * - ローカル部が2文字以下: すべて * に置換
 * - ローカル部が3文字以上: 最初と最後の文字を残し、中間を * に
 * - ドメイン部: そのまま表示
 *
 * ## 変換例
 * - "test@example.com" → "t**t@example.com"
 * - "ab@example.com" → "**@example.com"
 * - "a@example.com" → "*@example.com"
 *
 * ## なぜマスキングが必要か？
 * - ログ漏洩時のリスク軽減
 * - GDPRなどのプライバシー規制への対応
 * - 調査には十分な情報を残しつつ、完全な情報は隠す
 */
function maskEmail(email: string): string {
  /**
   * メールアドレスを@で分割
   *
   * 分割代入でローカル部とドメイン部を取得
   */
  const [local, domain] = email.split('@')

  /**
   * 不正な形式のメールアドレスの場合
   *
   * @が含まれていない場合は完全にマスク
   */
  if (!local || !domain) return '***@***'

  /**
   * ローカル部のマスキング
   *
   * 条件分岐:
   * - 2文字以下: すべて * に置換
   * - 3文字以上: 最初と最後の文字を残す
   */
  const maskedLocal =
    local.length <= 2
      ? '*'.repeat(local.length)  // '*'.repeat(2) → '**'
      : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]

  return `${maskedLocal}@${domain}`
}
