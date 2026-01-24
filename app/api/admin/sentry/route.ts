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

    const authToken = process.env.SENTRY_AUTH_TOKEN
    const org = process.env.SENTRY_ORG || 'bon-log'
    const project = process.env.SENTRY_PROJECT || 'javascript-nextjs'

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'SENTRY_AUTH_TOKEN が未設定',
        helpText: 'Sentry Settings → Auth Tokens で作成',
        helpUrl: 'https://bon-log.sentry.io/settings/auth-tokens/',
      })
    }

    // Sentry API: 組織のIssue一覧を取得（プロジェクトでフィルタ）
    // sntrys_トークンからリージョンURLを抽出、または環境変数から取得
    let baseUrl = process.env.SENTRY_API_URL || 'https://sentry.io'

    // sntrys_ トークンの場合、埋め込まれたリージョンURLを使用
    if (authToken.startsWith('sntrys_')) {
      try {
        const payloadBase64 = authToken.split('_')[1].split('_')[0]
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
        if (payload.region_url) {
          baseUrl = payload.region_url
        }
      } catch (e) {
        console.log('Could not parse token payload, using default URL')
      }
    }

    const apiUrl = `${baseUrl}/api/0/organizations/${org}/issues/?query=is:unresolved+project:${project}&limit=10`
    console.log('Sentry API URL:', apiUrl)
    console.log('Token prefix:', authToken.substring(0, 10) + '...')

    const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Sentry API error:', response.status, errorText)
      console.error('Request URL:', apiUrl)
      console.error('Token length:', authToken.length)

      let helpMessage = ''
      let errorDetail = ''
      try {
        const errorJson = JSON.parse(errorText)
        errorDetail = errorJson.detail || errorText
      } catch {
        errorDetail = errorText
      }

      if (response.status === 403) {
        helpMessage = 'トークンの権限不足です。Internal Integrationで作成してください。'
      } else if (response.status === 401) {
        helpMessage = `トークンが無効です。詳細: ${errorDetail}`
      } else if (response.status === 404) {
        helpMessage = 'プロジェクトが見つかりません。SENTRY_ORG/SENTRY_PROJECTを確認してください。'
      }

      return NextResponse.json({
        success: false,
        error: `Sentry API: ${response.status}`,
        helpText: helpMessage,
        helpUrl: 'https://bon-log.sentry.io/settings/developer-settings/',
        debug: {
          url: apiUrl,
          tokenLength: authToken.length,
          org,
          project,
        }
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
