import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/actions/admin'

export interface SentryIssue {
  id: string
  shortId: string
  title: string
  culprit: string
  level: 'error' | 'warning' | 'info' | 'debug' | 'fatal'
  status: string
  count: string
  userCount: number
  firstSeen: string
  lastSeen: string
  permalink: string
}

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdminUser = await isAdmin()
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Internal Integration トークン (SENTRY_API_TOKEN) を優先、なければ SENTRY_AUTH_TOKEN を使用
    const authToken = process.env.SENTRY_API_TOKEN || process.env.SENTRY_AUTH_TOKEN
    const org = process.env.SENTRY_ORG || 'bon-log'
    const project = process.env.SENTRY_PROJECT || 'bonsai-sns'

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'SENTRY_API_TOKEN が未設定',
        helpText: 'Internal Integrationでトークンを作成し、SENTRY_API_TOKENに設定してください',
        helpUrl: 'https://bon-log.sentry.io/settings/developer-settings/',
      })
    }

    // Sentry API: 組織のIssue一覧を取得（プロジェクトでフィルタ）
    // USリージョンを使用（bon-logはUSリージョン）
    let baseUrl = process.env.SENTRY_API_URL || 'https://us.sentry.io'

    // sntrys_ トークンの場合、埋め込まれたリージョンURLを使用
    if (authToken.startsWith('sntrys_')) {
      try {
        // sntrys_<base64payload>_<signature> の形式
        const parts = authToken.split('_')
        if (parts.length >= 2) {
          const payloadBase64 = parts[1]
          const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
          if (payload.region_url) {
            baseUrl = payload.region_url
          }
        }
      } catch {
        // Internal Integration トークンの場合はここに来る、USリージョンを使用
      }
    }

    const apiUrl = `${baseUrl}/api/0/organizations/${org}/issues/?query=is:unresolved+project:${project}&limit=10`

    const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      // サーバーログには詳細を記録（本番環境ではログ管理システムで保護）
      console.error('Sentry API error:', response.status)

      let helpMessage = ''
      try {
        const errorJson = JSON.parse(errorText)
        // エラー詳細はログのみに記録し、クライアントには返さない
        console.error('Sentry API error detail:', errorJson.detail || errorText)
      } catch {
        console.error('Sentry API error detail:', errorText)
      }

      if (response.status === 403) {
        helpMessage = 'トークンの権限不足です。Internal Integrationで作成してください。'
      } else if (response.status === 401) {
        helpMessage = 'トークンが無効です。設定を確認してください。'
      } else if (response.status === 400) {
        helpMessage = 'リクエストエラーが発生しました。'
      } else if (response.status === 404) {
        helpMessage = 'プロジェクトが見つかりません。設定を確認してください。'
      }

      // クライアントには一般的なエラー情報のみを返す（機密情報は含めない）
      return NextResponse.json({
        success: false,
        error: `Sentry API: ${response.status}`,
        helpText: helpMessage,
        helpUrl: 'https://sentry.io/settings/developer-settings/',
      })
    }

    const issues: SentryIssue[] = await response.json()

    return NextResponse.json({
      success: true,
      issues: issues.map(issue => ({
        id: issue.id,
        shortId: issue.shortId,
        title: issue.title,
        culprit: issue.culprit,
        level: issue.level,
        status: issue.status,
        count: issue.count,
        userCount: issue.userCount,
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        permalink: issue.permalink,
      })),
      dashboardUrl: `https://${org}.sentry.io/issues/`,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Sentry API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
