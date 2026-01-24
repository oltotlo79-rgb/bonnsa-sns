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
    // Organization Issues APIは新しく、より多くの機能をサポート
    const apiUrl = `https://sentry.io/api/0/organizations/${org}/issues/?query=is:unresolved+project:${project}&limit=10`
    console.log('Sentry API URL:', apiUrl)

    const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Sentry API error:', response.status, errorText)

      let helpMessage = ''
      if (response.status === 403) {
        helpMessage = 'トークンの権限不足です。Internal Integrationで作成してください。'
      } else if (response.status === 401) {
        helpMessage = 'トークンが無効です。'
      } else if (response.status === 404) {
        helpMessage = 'プロジェクトが見つかりません。SENTRY_ORG/SENTRY_PROJECTを確認してください。'
      }

      return NextResponse.json({
        success: false,
        error: `Sentry API: ${response.status}`,
        helpText: helpMessage,
        helpUrl: 'https://bon-log.sentry.io/settings/developer-settings/',
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
