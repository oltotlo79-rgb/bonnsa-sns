/**
 * メール送信抽象化レイヤー
 *
 * このファイルは、メール送信機能の抽象化を提供します。
 * 環境変数に応じて適切なプロバイダーを自動選択します。
 *
 * ## なぜ抽象化が必要か？
 *
 * ### 1. 環境の違い
 * - 開発環境: 実際にメールを送る必要がない
 * - 本番環境: 信頼性の高いサービスが必要
 *
 * ### 2. プロバイダーの切り替え
 * - コード変更なしでプロバイダーを切り替え可能
 * - テスト時はモックに置き換え可能
 *
 * ### 3. コスト最適化
 * - 開発時は無料のコンソール出力
 * - 本番は必要に応じて有料サービス
 *
 * ## サポートするプロバイダー
 * - console: コンソール出力（開発用）
 * - resend: Resend（開発・小規模本番用）
 * - azure: Azure Communication Services（大規模本番用）
 *
 * ## 環境変数
 * - EMAIL_PROVIDER: 使用するプロバイダー
 * - RESEND_API_KEY: ResendのAPIキー
 * - AZURE_COMMUNICATION_CONNECTION_STRING: Azureの接続文字列
 *
 * @module lib/email
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * logger: 環境対応ロギングユーティリティ
 *
 * メール送信のログ出力やエラー記録に使用
 */
import logger from '@/lib/logger'

// ============================================================
// 型定義
// ============================================================

/**
 * メール送信オプションの型
 *
 * ## 各プロパティの説明
 *
 * ### to
 * 送信先メールアドレス
 *
 * ### subject
 * メールの件名
 *
 * ### html
 * HTML形式のメール本文
 * リッチなデザインのメールを送る場合に使用
 *
 * ### text（オプション）
 * プレーンテキスト形式の本文
 * HTMLを表示できないクライアント用のフォールバック
 */
export interface EmailOptions {
  to: string       // 送信先
  subject: string  // 件名
  html: string     // HTML本文
  text?: string    // テキスト本文（オプション）
}

/**
 * メール送信結果の型
 *
 * ## 各プロパティの説明
 *
 * ### success
 * 送信成功ならtrue
 *
 * ### messageId（オプション）
 * 送信成功時のメッセージID
 * 配信追跡に使用
 *
 * ### error（オプション）
 * 送信失敗時のエラーメッセージ
 */
export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * メールプロバイダーのインターフェース
 *
 * ## インターフェースの役割
 * 全てのプロバイダーが実装すべきメソッドを定義
 * これにより、プロバイダーの切り替えが容易になる
 *
 * ## 実装クラス
 * - ConsoleEmailProvider
 * - ResendEmailProvider
 * - AzureEmailProvider
 */
interface EmailProvider {
  send(options: EmailOptions): Promise<EmailResult>
}

// ============================================================
// プロバイダー実装
// ============================================================

/**
 * コンソール出力プロバイダー（開発用）
 *
 * ## 機能概要
 * メールをコンソールに出力します。
 * 開発環境で実際のメール送信を避けたい場合に使用。
 *
 * ## 利点
 * - 外部サービス不要
 * - APIキー不要
 * - メール内容をすぐに確認可能
 *
 * ## 用途
 * - ローカル開発
 * - テスト実行
 */
class ConsoleEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<EmailResult> {
    /**
     * メール内容をコンソールに出力
     *
     * 区切り線で他のログと区別しやすくする
     */
    logger.log('========== EMAIL (Console Provider) ==========')
    logger.log(`To: ${options.to}`)
    logger.log(`Subject: ${options.subject}`)
    logger.log(`HTML: ${options.html}`)
    logger.log('===============================================')

    /**
     * 常に成功を返す
     *
     * messageIdはタイムスタンプベースで生成
     */
    return { success: true, messageId: `console-${Date.now()}` }
  }
}

/**
 * Resendプロバイダー（開発環境用）
 *
 * ## Resendとは？
 * 開発者フレンドリーなメール送信サービス。
 * シンプルなAPIと無料枠が魅力。
 *
 * ## 無料枠
 * - 月100通まで無料
 * - 開発・テストに最適
 *
 * ## 制限事項
 * - 無料プランでは onboarding@resend.dev からの送信のみ
 * - 独自ドメインは有料プランで利用可能
 *
 * ## 環境変数
 * - RESEND_API_KEY: APIキー
 * - EMAIL_FROM: 送信元アドレス（オプション）
 */
class ResendEmailProvider implements EmailProvider {
  /**
   * Resendクライアントインスタンス
   */
  private resend: import('resend').Resend

  /**
   * コンストラクタ
   *
   * Resendクライアントを初期化
   */
  constructor() {
    /**
     * 動的インポート
     *
     * Resendパッケージがインストールされていない環境でも
     * ビルドエラーを防ぐためrequireを使用
     */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resend } = require('resend')
    const apiKey = process.env.RESEND_API_KEY
    logger.log('Initializing Resend with API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET')
    this.resend = new Resend(apiKey)
  }

  /**
   * メール送信
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      /**
       * 送信元アドレスの設定
       *
       * 環境変数で上書き可能
       * 無料プランでは onboarding@resend.dev を使用
       */
      const fromAddress = process.env.EMAIL_FROM || 'BON-LOG <onboarding@resend.dev>'
      logger.log('Sending email via Resend:')
      logger.log('  From:', fromAddress)
      logger.log('  To:', options.to)
      logger.log('  Subject:', options.subject)

      /**
       * Resend APIでメール送信
       */
      const { data, error } = await this.resend.emails.send({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })

      /**
       * エラーチェック
       */
      if (error) {
        logger.error('Resend API error:', JSON.stringify(error))
        return { success: false, error: error.message }
      }

      logger.log('Resend success, messageId:', data?.id)
      return { success: true, messageId: data?.id }
    } catch (err) {
      /**
       * 例外処理
       *
       * ネットワークエラーなどの予期しないエラー
       */
      logger.error('Resend exception:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Azure Communication Servicesプロバイダー（本番環境用）
 *
 * ## Azure Communication Servicesとは？
 * Microsoft Azureのコミュニケーションサービス。
 * メール、SMS、ビデオ通話などを提供。
 *
 * ## 特徴
 * - エンタープライズグレードの信頼性
 * - Azureとの統合が容易
 * - 大量送信に対応
 *
 * ## 環境変数
 * - AZURE_COMMUNICATION_CONNECTION_STRING: 接続文字列
 * - AZURE_EMAIL_SENDER: 送信元アドレス
 */
class AzureEmailProvider implements EmailProvider {
  /**
   * Azure EmailClient インスタンス
   */
  private client: import('@azure/communication-email').EmailClient

  /**
   * コンストラクタ
   */
  constructor() {
    /**
     * 動的インポート
     */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EmailClient } = require('@azure/communication-email')

    /**
     * 接続文字列の取得
     *
     * Azureポータルから取得した接続文字列を使用
     */
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING
    if (!connectionString) {
      throw new Error('AZURE_COMMUNICATION_CONNECTION_STRING is not set')
    }
    this.client = new EmailClient(connectionString)
  }

  /**
   * メール送信
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      /**
       * メールメッセージの構築
       *
       * Azure特有の形式でメッセージを作成
       */
      const message = {
        senderAddress: process.env.AZURE_EMAIL_SENDER || 'DoNotReply@your-domain.azurecomm.net',
        content: {
          subject: options.subject,
          html: options.html,
          plainText: options.text,
        },
        recipients: {
          to: [{ address: options.to }],
        },
      }

      /**
       * 非同期でメール送信
       *
       * beginSend: 長時間実行操作を開始
       * pollUntilDone: 完了まで待機
       */
      const poller = await this.client.beginSend(message)
      const result = await poller.pollUntilDone()

      /**
       * 結果の確認
       */
      if (result.status === 'Succeeded') {
        return { success: true, messageId: result.id }
      } else {
        return { success: false, error: `Status: ${result.status}` }
      }
    } catch (err) {
      logger.error('Azure Email exception:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// ============================================================
// プロバイダー管理
// ============================================================

/**
 * シングルトンインスタンス
 *
 * プロバイダーは一度初期化すれば再利用可能
 */
let emailProvider: EmailProvider | null = null

/**
 * 適切なプロバイダーを取得
 *
 * ## 機能概要
 * 環境変数に基づいて適切なプロバイダーを選択し、
 * 初期化して返します。
 *
 * ## 選択ロジック
 * - EMAIL_PROVIDER=azure → AzureEmailProvider
 * - EMAIL_PROVIDER=resend → ResendEmailProvider
 * - それ以外 → ConsoleEmailProvider
 *
 * ## シングルトン
 * 一度初期化したプロバイダーを再利用
 */
function getEmailProvider(): EmailProvider {
  if (emailProvider) return emailProvider

  const provider = process.env.EMAIL_PROVIDER || 'console'

  switch (provider) {
    case 'azure':
      emailProvider = new AzureEmailProvider()
      break
    case 'resend':
      emailProvider = new ResendEmailProvider()
      break
    case 'console':
    default:
      emailProvider = new ConsoleEmailProvider()
      break
  }

  logger.log(`Email provider initialized: ${provider}`)
  return emailProvider
}

// ============================================================
// 汎用メール送信関数
// ============================================================

/**
 * メール送信関数
 *
 * ## 機能概要
 * 設定されたプロバイダーでメールを送信します。
 *
 * ## パラメータ
 * @param options - メール送信オプション
 *
 * ## 戻り値
 * @returns Promise<EmailResult> - 送信結果
 *
 * ## 使用例
 * ```typescript
 * const result = await sendEmail({
 *   to: 'user@example.com',
 *   subject: '件名',
 *   html: '<p>本文</p>',
 * })
 *
 * if (result.success) {
 *   console.log('送信成功:', result.messageId)
 * } else {
 *   console.error('送信失敗:', result.error)
 * }
 * ```
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const provider = getEmailProvider()
  return provider.send(options)
}

// ============================================================
// 特定用途のメール送信関数
// ============================================================

/**
 * パスワードリセットメール送信
 *
 * ## 機能概要
 * パスワードリセット用のメールを送信します。
 * 美しいHTMLテンプレートを使用。
 *
 * ## パラメータ
 * @param email - 送信先メールアドレス
 * @param resetUrl - パスワードリセットURL
 *
 * ## 戻り値
 * @returns Promise<EmailResult> - 送信結果
 *
 * ## テンプレートの特徴
 * - レスポンシブデザイン
 * - BON-LOGブランドカラー（緑系）
 * - 有効期限の明示（1時間）
 * - テキスト版も提供
 *
 * ## 使用例
 * ```typescript
 * await sendPasswordResetEmail(
 *   'user@example.com',
 *   'https://bon-log.com/reset-password?token=xxx'
 * )
 * ```
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<EmailResult> {
  /**
   * HTML形式のメールテンプレート
   *
   * インラインスタイルを使用（メールクライアント互換性のため）
   */
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>パスワードリセット</title>
</head>
<body style="font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2d5016 0%, #4a7c23 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">BON-LOG</h1>
    <p style="color: #e8f5e9; margin: 10px 0 0 0; font-size: 14px;">盆栽愛好家のためのSNS</p>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #2d5016; margin-top: 0;">パスワードリセットのご依頼</h2>

    <p>パスワードリセットのリクエストを受け付けました。</p>
    <p>下記のボタンをクリックして、新しいパスワードを設定してください。</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: #4a7c23; color: #fff; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold;">パスワードを再設定する</a>
    </div>

    <p style="color: #666; font-size: 14px;">
      このリンクは<strong>1時間</strong>で有効期限が切れます。<br>
      お心当たりがない場合は、このメールを無視してください。
    </p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">

    <p style="color: #999; font-size: 12px;">
      ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください：<br>
      <a href="${resetUrl}" style="color: #4a7c23; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>このメールはBON-LOGから自動送信されています。</p>
  </div>
</body>
</html>
`

  /**
   * プレーンテキスト版
   *
   * HTMLを表示できないメールクライアント用
   */
  const text = `
BON-LOG - パスワードリセット

パスワードリセットのリクエストを受け付けました。
下記のURLにアクセスして、新しいパスワードを設定してください。

${resetUrl}

このリンクは1時間で有効期限が切れます。
お心当たりがない場合は、このメールを無視してください。

---
BON-LOG
盆栽愛好家のためのSNS
`

  return sendEmail({
    to: email,
    subject: '【BON-LOG】パスワードリセットのご案内',
    html,
    text,
  })
}

/**
 * サブスクリプション期限切れ間近通知メール
 *
 * ## 機能概要
 * プレミアム会員の有効期限が近づいている時に送信します。
 *
 * ## パラメータ
 * @param email - 送信先メールアドレス
 * @param nickname - ユーザーのニックネーム
 * @param expiresAt - 有効期限日時
 *
 * ## 戻り値
 * @returns Promise<EmailResult> - 送信結果
 *
 * ## メール内容
 * - 残り日数の表示
 * - 期限切れ後に失われる機能の説明
 * - 更新ページへのリンク
 */
export async function sendSubscriptionExpiringEmail(
  email: string,
  nickname: string,
  expiresAt: Date
): Promise<EmailResult> {
  /**
   * 残り日数の計算
   *
   * ミリ秒を日数に変換し、切り上げ
   */
  const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  /**
   * 日本語形式の日付
   */
  const expirationDate = expiresAt.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  /**
   * 設定ページURL
   */
  const settingsUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'}/settings/subscription`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>プレミアム会員の有効期限について</title>
</head>
<body style="font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2d5016 0%, #4a7c23 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">BON-LOG</h1>
    <p style="color: #e8f5e9; margin: 10px 0 0 0; font-size: 14px;">盆栽愛好家のためのSNS</p>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #2d5016; margin-top: 0;">${nickname}さん、プレミアム会員の有効期限が近づいています</h2>

    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #856404;">
        <strong>有効期限: ${expirationDate}</strong><br>
        残り<strong>${daysRemaining}日</strong>で有効期限が切れます。
      </p>
    </div>

    <p>プレミアム会員が終了すると、以下の機能がご利用いただけなくなります：</p>

    <ul style="color: #666;">
      <li>予約投稿機能</li>
      <li>拡張文字数（1000文字→500文字）</li>
      <li>拡張画像添付（8枚→4枚）</li>
      <li>詳細アナリティクス</li>
      <li>広告非表示</li>
    </ul>

    <p>引き続きプレミアム機能をご利用いただくには、サブスクリプションを更新してください。</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${settingsUrl}" style="display: inline-block; background: #4a7c23; color: #fff; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold;">サブスクリプションを確認</a>
    </div>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">

    <p style="color: #999; font-size: 12px;">
      このメールは自動送信されています。ご不明な点がございましたら、サポートまでお問い合わせください。
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>このメールはBON-LOGから自動送信されています。</p>
  </div>
</body>
</html>
`

  const text = `
BON-LOG - プレミアム会員有効期限のお知らせ

${nickname}さん

プレミアム会員の有効期限が近づいています。

有効期限: ${expirationDate}
残り${daysRemaining}日で有効期限が切れます。

プレミアム会員が終了すると、以下の機能がご利用いただけなくなります：
- 予約投稿機能
- 拡張文字数（1000文字→500文字）
- 拡張画像添付（8枚→4枚）
- 詳細アナリティクス
- 広告非表示

引き続きプレミアム機能をご利用いただくには、サブスクリプションを更新してください。

サブスクリプションを確認: ${settingsUrl}

---
BON-LOG
盆栽愛好家のためのSNS
`

  return sendEmail({
    to: email,
    subject: '【BON-LOG】プレミアム会員の有効期限が近づいています',
    html,
    text,
  })
}

/**
 * サブスクリプション期限切れ通知メール
 *
 * ## 機能概要
 * プレミアム会員の有効期限が切れた時に送信します。
 *
 * ## パラメータ
 * @param email - 送信先メールアドレス
 * @param nickname - ユーザーのニックネーム
 *
 * ## 戻り値
 * @returns Promise<EmailResult> - 送信結果
 *
 * ## メール内容
 * - 期限切れの通知
 * - 失われた機能の説明
 * - 再登録への案内
 */
export async function sendSubscriptionExpiredEmail(
  email: string,
  nickname: string
): Promise<EmailResult> {
  const settingsUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'}/settings/subscription`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>プレミアム会員の有効期限が切れました</title>
</head>
<body style="font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2d5016 0%, #4a7c23 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">BON-LOG</h1>
    <p style="color: #e8f5e9; margin: 10px 0 0 0; font-size: 14px;">盆栽愛好家のためのSNS</p>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #2d5016; margin-top: 0;">${nickname}さん、プレミアム会員の有効期限が切れました</h2>

    <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #721c24;">
        <strong>プレミアム会員の有効期限が切れました。</strong>
      </p>
    </div>

    <p>プレミアム機能がご利用いただけなくなりました：</p>

    <ul style="color: #666;">
      <li>予約投稿は自動的にキャンセルされました</li>
      <li>投稿文字数が500文字に制限されます</li>
      <li>画像添付が4枚に制限されます</li>
      <li>詳細アナリティクスはご利用いただけません</li>
    </ul>

    <p>引き続きプレミアム機能をご利用いただくには、サブスクリプションを再度お申し込みください。</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${settingsUrl}" style="display: inline-block; background: #4a7c23; color: #fff; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold;">プレミアムに再登録</a>
    </div>

    <p style="color: #666;">
      BON-LOGをご利用いただきありがとうございます。<br>
      無料会員でも引き続き基本機能をお楽しみいただけます。
    </p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">

    <p style="color: #999; font-size: 12px;">
      このメールは自動送信されています。ご不明な点がございましたら、サポートまでお問い合わせください。
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>このメールはBON-LOGから自動送信されています。</p>
  </div>
</body>
</html>
`

  const text = `
BON-LOG - プレミアム会員有効期限切れのお知らせ

${nickname}さん

プレミアム会員の有効期限が切れました。

プレミアム機能がご利用いただけなくなりました：
- 予約投稿は自動的にキャンセルされました
- 投稿文字数が500文字に制限されます
- 画像添付が4枚に制限されます
- 詳細アナリティクスはご利用いただけません

引き続きプレミアム機能をご利用いただくには、サブスクリプションを再度お申し込みください。

プレミアムに再登録: ${settingsUrl}

BON-LOGをご利用いただきありがとうございます。
無料会員でも引き続き基本機能をお楽しみいただけます。

---
BON-LOG
盆栽愛好家のためのSNS
`

  return sendEmail({
    to: email,
    subject: '【BON-LOG】プレミアム会員の有効期限が切れました',
    html,
    text,
  })
}
