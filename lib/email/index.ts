/**
 * メール送信抽象化レイヤー
 * 環境変数に応じて適切なプロバイダーを自動選択
 *
 * - 本番環境 (EMAIL_PROVIDER=azure): Azure Communication Services
 * - 開発環境 (EMAIL_PROVIDER=resend): Resend
 * - 開発環境 (EMAIL_PROVIDER=console または未設定): コンソール出力
 */

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// メールプロバイダーのインターフェース
interface EmailProvider {
  send(options: EmailOptions): Promise<EmailResult>
}

// コンソール出力プロバイダー（開発用）
class ConsoleEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<EmailResult> {
    console.log('========== EMAIL (Console Provider) ==========')
    console.log(`To: ${options.to}`)
    console.log(`Subject: ${options.subject}`)
    console.log(`HTML: ${options.html}`)
    console.log('===============================================')
    return { success: true, messageId: `console-${Date.now()}` }
  }
}

// Resendプロバイダー（開発環境用）
class ResendEmailProvider implements EmailProvider {
  private resend: import('resend').Resend

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resend } = require('resend')
    const apiKey = process.env.RESEND_API_KEY
    console.log('Initializing Resend with API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET')
    this.resend = new Resend(apiKey)
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      // Resend無料プランではonboarding@resend.devを使用する必要がある
      const fromAddress = process.env.EMAIL_FROM || 'BON-LOG <onboarding@resend.dev>'
      console.log('Sending email via Resend:')
      console.log('  From:', fromAddress)
      console.log('  To:', options.to)
      console.log('  Subject:', options.subject)

      const { data, error } = await this.resend.emails.send({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })

      if (error) {
        console.error('Resend API error:', JSON.stringify(error))
        return { success: false, error: error.message }
      }

      console.log('Resend success, messageId:', data?.id)
      return { success: true, messageId: data?.id }
    } catch (err) {
      console.error('Resend exception:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// Azure Communication Servicesプロバイダー（本番環境用）
class AzureEmailProvider implements EmailProvider {
  private client: import('@azure/communication-email').EmailClient

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EmailClient } = require('@azure/communication-email')
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING
    if (!connectionString) {
      throw new Error('AZURE_COMMUNICATION_CONNECTION_STRING is not set')
    }
    this.client = new EmailClient(connectionString)
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
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

      const poller = await this.client.beginSend(message)
      const result = await poller.pollUntilDone()

      if (result.status === 'Succeeded') {
        return { success: true, messageId: result.id }
      } else {
        return { success: false, error: `Status: ${result.status}` }
      }
    } catch (err) {
      console.error('Azure Email exception:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// プロバイダーのシングルトンインスタンス
let emailProvider: EmailProvider | null = null

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

  console.log(`Email provider initialized: ${provider}`)
  return emailProvider
}

// メール送信関数
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const provider = getEmailProvider()
  return provider.send(options)
}

// パスワードリセットメール送信用のヘルパー関数
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<EmailResult> {
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
