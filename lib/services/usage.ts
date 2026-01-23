// 各クラウドサービスの使用量を取得するサービス

export interface ServiceUsage {
  name: string
  status: 'ok' | 'warning' | 'error' | 'unconfigured'
  usage?: {
    current: number
    limit: number
    unit: string
    percentage: number
  }[]
  error?: string
  helpText?: string
  helpUrl?: string
  dashboardUrl: string
  lastUpdated: string
}

// Vercel使用量を取得
export async function getVercelUsage(): Promise<ServiceUsage> {
  const token = process.env.VERCEL_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token) {
    return {
      name: 'Vercel',
      status: 'unconfigured',
      error: 'VERCEL_TOKEN が未設定',
      helpText: 'Vercel Account Settings → Tokens で作成',
      helpUrl: 'https://vercel.com/account/tokens',
      dashboardUrl: 'https://vercel.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const usage: ServiceUsage['usage'] = []

    // ユーザー情報からチームIDを取得（設定されていない場合）
    let resolvedTeamId = teamId
    if (!resolvedTeamId) {
      const userRes = await fetch('https://api.vercel.com/www/user', {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      })
      if (userRes.ok) {
        const userData = await userRes.json()
        resolvedTeamId = userData.user?.defaultTeamId
      }
    }

    // デプロイ数を取得（今月）
    const deploymentsUrl = resolvedTeamId
      ? `https://api.vercel.com/v6/deployments?teamId=${resolvedTeamId}&limit=100`
      : 'https://api.vercel.com/v6/deployments?limit=100'

    const deploymentsRes = await fetch(deploymentsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })

    if (deploymentsRes.ok) {
      const deploymentsData = await deploymentsRes.json()
      const deployments = deploymentsData.deployments || []

      // 今月のデプロイ数をカウント
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthlyDeployments = deployments.filter(
        (d: { created: number }) => new Date(d.created) >= monthStart
      ).length

      // Hobby: 無制限だが目安として表示
      usage.push({
        current: monthlyDeployments,
        limit: 100, // 目安
        unit: 'デプロイ (今月)',
        percentage: Math.min(monthlyDeployments, 100),
      })
    }

    // プロジェクト数を取得
    const projectsUrl = resolvedTeamId
      ? `https://api.vercel.com/v9/projects?teamId=${resolvedTeamId}&limit=100`
      : 'https://api.vercel.com/v9/projects?limit=100'

    const projectsRes = await fetch(projectsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })

    if (projectsRes.ok) {
      const projectsData = await projectsRes.json()
      const projectCount = projectsData.projects?.length || 0

      usage.push({
        current: projectCount,
        limit: 200, // Hobby目安
        unit: 'プロジェクト',
        percentage: Math.round((projectCount / 200) * 100),
      })
    }

    // ダッシュボードURL（チームの場合はチームページ）
    let dashboardUrl = 'https://vercel.com/account/usage'
    if (resolvedTeamId) {
      // チーム名を取得してURLを構築
      const teamsRes = await fetch(`https://api.vercel.com/v2/teams/${resolvedTeamId}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      })
      if (teamsRes.ok) {
        const teamData = await teamsRes.json()
        dashboardUrl = `https://vercel.com/${teamData.slug || teamData.name}/~/usage`
      }
    }

    return {
      name: 'Vercel',
      status: 'ok',
      usage: usage.length > 0 ? usage : undefined,
      helpText: 'bandwidth_check_dashboard',  // UsageCardsで特別処理
      dashboardUrl,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Vercel',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗',
      dashboardUrl: 'https://vercel.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  }
}

// Cloudflare R2使用量を取得
export async function getCloudflareR2Usage(): Promise<ServiceUsage> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID

  if (!token || !accountId) {
    return {
      name: 'Cloudflare R2',
      status: 'unconfigured',
      error: !token ? 'CLOUDFLARE_API_TOKEN が未設定' : 'R2_ACCOUNT_ID が未設定',
      helpText: 'My Profile → API Tokens で作成（R2の権限が必要）',
      helpUrl: 'https://dash.cloudflare.com/profile/api-tokens',
      dashboardUrl: 'https://dash.cloudflare.com',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const usage: ServiceUsage['usage'] = []

    // バケット一覧を取得
    const bucketsRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      }
    )

    if (!bucketsRes.ok) {
      const errorData = await bucketsRes.json().catch(() => ({}))
      throw new Error(errorData.errors?.[0]?.message || `HTTP ${bucketsRes.status}`)
    }

    const bucketsData = await bucketsRes.json()
    const buckets = bucketsData.result || []

    // GraphQL APIでストレージ使用量を取得
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const endDate = now.toISOString().split('T')[0]

    const graphqlQuery = {
      query: `
        query R2Storage($accountTag: String!, $startDate: Date!, $endDate: Date!) {
          viewer {
            accounts(filter: { accountTag: $accountTag }) {
              r2StorageAdaptiveGroups(
                filter: { date_geq: $startDate, date_leq: $endDate }
                limit: 1
                orderBy: [date_DESC]
              ) {
                dimensions {
                  date
                }
                max {
                  objectCount
                  payloadSize
                  metadataSize
                  uploadCount
                }
              }
            }
          }
        }
      `,
      variables: {
        accountTag: accountId,
        startDate,
        endDate,
      },
    }

    const graphqlRes = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery),
      next: { revalidate: 300 },
    })

    let storageGB = 0
    let objectCount = 0

    if (graphqlRes.ok) {
      const graphqlData = await graphqlRes.json()
      const storageData = graphqlData.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups?.[0]

      if (storageData?.max) {
        const payloadBytes = storageData.max.payloadSize || 0
        const metadataBytes = storageData.max.metadataSize || 0
        const totalBytes = payloadBytes + metadataBytes
        storageGB = totalBytes / (1024 * 1024 * 1024)
        objectCount = storageData.max.objectCount || 0
      }
    }

    // Free tier: 10GB/月
    const FREE_TIER_GB = 10
    const PRICE_PER_GB = 0.015 // $0.015/GB-month

    // ストレージ使用量
    usage.push({
      current: Math.round(storageGB * 100) / 100,
      limit: FREE_TIER_GB,
      unit: 'GB (ストレージ)',
      percentage: Math.round((storageGB / FREE_TIER_GB) * 100),
    })

    // オブジェクト数
    if (objectCount > 0) {
      usage.push({
        current: objectCount,
        limit: 0, // 制限なし
        unit: 'オブジェクト',
        percentage: 0,
      })
    }

    // バケット数
    usage.push({
      current: buckets.length,
      limit: 100,
      unit: 'バケット',
      percentage: Math.round((buckets.length / 100) * 100),
    })

    // 推定コスト計算（無料枠超過分のみ）
    const billableGB = Math.max(0, storageGB - FREE_TIER_GB)
    const estimatedCost = billableGB * PRICE_PER_GB

    const maxPercentage = Math.max(...usage.filter(u => u.limit > 0).map(u => u.percentage))

    return {
      name: 'Cloudflare R2',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage,
      helpText: estimatedCost > 0
        ? `推定コスト: $${estimatedCost.toFixed(2)}/月 (10GB超過分)`
        : '無料枠内 (10GB/月)',
      dashboardUrl: `https://dash.cloudflare.com/${accountId}/r2/overview`,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Cloudflare R2',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗',
      dashboardUrl: 'https://dash.cloudflare.com',
      lastUpdated: new Date().toISOString(),
    }
  }
}

// Resend使用量を取得
export async function getResendUsage(): Promise<ServiceUsage> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return {
      name: 'Resend',
      status: 'unconfigured',
      error: 'RESEND_API_KEY が未設定',
      helpText: 'API Keys で作成',
      helpUrl: 'https://resend.com/api-keys',
      dashboardUrl: 'https://resend.com/emails',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const usage: ServiceUsage['usage'] = []

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    let allEmails: { created_at: string }[] = []
    let hasMore = true
    let cursor: string | undefined

    // 最大5ページ（500件）まで取得
    for (let i = 0; i < 5 && hasMore; i++) {
      const emailsUrl = cursor
        ? `https://api.resend.com/emails?limit=100&cursor=${cursor}`
        : 'https://api.resend.com/emails?limit=100'

      const emailsRes = await fetch(emailsUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 300 },
      })

      if (!emailsRes.ok) {
        if (emailsRes.status === 404) {
          break
        }
        throw new Error(`HTTP ${emailsRes.status}`)
      }

      const emailsData = await emailsRes.json()

      if (emailsData.data && Array.isArray(emailsData.data)) {
        allEmails = [...allEmails, ...emailsData.data]

        const oldestEmail = emailsData.data[emailsData.data.length - 1]
        if (oldestEmail && new Date(oldestEmail.created_at) < monthStart) {
          hasMore = false
        } else if (emailsData.data.length < 100) {
          hasMore = false
        } else {
          cursor = emailsData.data[emailsData.data.length - 1]?.id
        }
      } else {
        hasMore = false
      }
    }

    const todayCount = allEmails.filter(
      email => new Date(email.created_at) >= todayStart
    ).length

    const monthCount = allEmails.filter(
      email => new Date(email.created_at) >= monthStart
    ).length

    usage.push({
      current: todayCount,
      limit: 100,
      unit: '通 (今日)',
      percentage: Math.round((todayCount / 100) * 100),
    })

    usage.push({
      current: monthCount,
      limit: 3000,
      unit: '通 (今月)',
      percentage: Math.round((monthCount / 3000) * 100),
    })

    const maxPercentage = Math.max(...usage.map(u => u.percentage))

    return {
      name: 'Resend',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage,
      dashboardUrl: 'https://resend.com/overview',
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Resend',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗',
      dashboardUrl: 'https://resend.com/emails',
      lastUpdated: new Date().toISOString(),
    }
  }
}
