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
    // プロジェクト一覧を取得してビルド回数などを確認
    const projectsUrl = teamId
      ? `https://api.vercel.com/v9/projects?teamId=${teamId}&limit=100`
      : 'https://api.vercel.com/v9/projects?limit=100'

    const response = await fetch(projectsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage: ServiceUsage['usage'] = []

    // プロジェクト数
    if (data.projects) {
      const projectCount = data.projects.length
      // Hobby: 無制限, Pro: 無制限
      usage.push({
        current: projectCount,
        limit: 100, // 表示用の目安
        unit: 'プロジェクト',
        percentage: Math.min(projectCount, 100),
      })
    }

    // デプロイ情報を取得（最初のプロジェクト）
    if (data.projects && data.projects.length > 0) {
      const deploymentsUrl = teamId
        ? `https://api.vercel.com/v6/deployments?teamId=${teamId}&limit=100&state=READY`
        : `https://api.vercel.com/v6/deployments?limit=100&state=READY`

      const deploymentsRes = await fetch(deploymentsUrl, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      })

      if (deploymentsRes.ok) {
        const deploymentsData = await deploymentsRes.json()
        const thisMonth = new Date()
        thisMonth.setDate(1)
        thisMonth.setHours(0, 0, 0, 0)

        const monthlyDeployments = deploymentsData.deployments?.filter(
          (d: { createdAt: number }) => new Date(d.createdAt) >= thisMonth
        ).length || 0

        // Hobby: 100 deployments/day
        usage.push({
          current: monthlyDeployments,
          limit: 3000, // 100/day * 30days
          unit: 'デプロイ/月',
          percentage: Math.round((monthlyDeployments / 3000) * 100),
        })
      }
    }

    const maxPercentage = usage.length > 0 ? Math.max(...usage.map(u => u.percentage)) : 0

    return {
      name: 'Vercel',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage: usage.length > 0 ? usage : undefined,
      dashboardUrl: teamId
        ? `https://vercel.com/teams/${teamId}/usage`
        : 'https://vercel.com/account/usage',
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

// Supabase使用量を取得
export async function getSupabaseUsage(): Promise<ServiceUsage> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const projectRef = process.env.SUPABASE_PROJECT_REF

  if (!token || !projectRef) {
    return {
      name: 'Supabase',
      status: 'unconfigured',
      error: !token ? 'SUPABASE_ACCESS_TOKEN が未設定' : 'SUPABASE_PROJECT_REF が未設定',
      helpText: 'Account Settings → Access Tokens で作成',
      helpUrl: 'https://supabase.com/dashboard/account/tokens',
      dashboardUrl: 'https://supabase.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // プロジェクトの使用量を取得
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300 },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`)
    }

    const project = await response.json()
    const usage: ServiceUsage['usage'] = []

    // 組織の使用量を取得
    if (project.organization_id) {
      const usageRes = await fetch(
        `https://api.supabase.com/v1/organizations/${project.organization_id}/usage`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          next: { revalidate: 300 },
        }
      )

      if (usageRes.ok) {
        const usageData = await usageRes.json()

        // データベースサイズ (Free: 500MB)
        if (usageData.db_size !== undefined) {
          const currentMB = usageData.db_size / (1024 * 1024)
          const limitMB = 500
          usage.push({
            current: Math.round(currentMB * 100) / 100,
            limit: limitMB,
            unit: 'MB (データベース)',
            percentage: Math.round((currentMB / limitMB) * 100),
          })
        }

        // ストレージ (Free: 1GB)
        if (usageData.storage_size !== undefined) {
          const currentMB = usageData.storage_size / (1024 * 1024)
          const limitMB = 1024
          usage.push({
            current: Math.round(currentMB * 100) / 100,
            limit: limitMB,
            unit: 'MB (Storage)',
            percentage: Math.round((currentMB / limitMB) * 100),
          })
        }

        // 帯域幅 (Free: 5GB/月)
        if (usageData.total_egress !== undefined) {
          const currentGB = usageData.total_egress / (1024 * 1024 * 1024)
          const limitGB = 5
          usage.push({
            current: Math.round(currentGB * 100) / 100,
            limit: limitGB,
            unit: 'GB (帯域幅/月)',
            percentage: Math.round((currentGB / limitGB) * 100),
          })
        }
      }
    }

    // 使用量APIが取得できない場合でもプロジェクト情報は表示
    if (usage.length === 0) {
      usage.push({
        current: 1,
        limit: 2, // Free: 2 projects
        unit: 'プロジェクト',
        percentage: 50,
      })
    }

    const maxPercentage = Math.max(...usage.map(u => u.percentage))

    return {
      name: 'Supabase',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage,
      dashboardUrl: `https://supabase.com/dashboard/project/${projectRef}`,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Supabase',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗',
      dashboardUrl: 'https://supabase.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  }
}

// Cloudflare R2使用量を取得
export async function getCloudflareR2Usage(): Promise<ServiceUsage> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (!token || !accountId) {
    return {
      name: 'Cloudflare R2',
      status: 'unconfigured',
      error: !token ? 'CLOUDFLARE_API_TOKEN が未設定' : 'CLOUDFLARE_ACCOUNT_ID が未設定',
      helpText: 'My Profile → API Tokens で作成（R2の権限が必要）',
      helpUrl: 'https://dash.cloudflare.com/profile/api-tokens',
      dashboardUrl: 'https://dash.cloudflare.com',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // バケット一覧を取得
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.errors?.[0]?.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage: ServiceUsage['usage'] = []

    if (data.result && Array.isArray(data.result)) {
      const bucketCount = data.result.length

      usage.push({
        current: bucketCount,
        limit: 100, // 目安
        unit: 'バケット',
        percentage: Math.round((bucketCount / 100) * 100),
      })

      // R2 Free tier: 10GB storage, 1M Class A ops, 10M Class B ops
      // 詳細な使用量はAnalytics APIが必要だが、基本情報を表示
    }

    return {
      name: 'Cloudflare R2',
      status: 'ok',
      usage: usage.length > 0 ? usage : undefined,
      helpText: '詳細な使用量はダッシュボードで確認',
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
    // ドメイン情報を取得
    const domainsRes = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 },
    })

    if (!domainsRes.ok) {
      throw new Error(`HTTP ${domainsRes.status}`)
    }

    const domainsData = await domainsRes.json()
    const usage: ServiceUsage['usage'] = []

    // ドメイン数
    if (domainsData.data && Array.isArray(domainsData.data)) {
      usage.push({
        current: domainsData.data.length,
        limit: 10, // Free tier目安
        unit: 'ドメイン',
        percentage: Math.round((domainsData.data.length / 10) * 100),
      })
    }

    // 今月のメール送信数を取得（API制限あり）
    // Free tier: 100 emails/day, 3000 emails/month
    // 注: 直接的な送信数APIは限定的なため、ダッシュボードでの確認を推奨

    return {
      name: 'Resend',
      status: 'ok',
      usage: usage.length > 0 ? usage : undefined,
      helpText: '送信数: Free 100通/日, 3,000通/月',
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

// 全サービスの使用量を一括取得
export async function getAllUsage(): Promise<ServiceUsage[]> {
  const results = await Promise.allSettled([
    getVercelUsage(),
    getSupabaseUsage(),
    getCloudflareR2Usage(),
    getResendUsage(),
  ])

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }

    const names = ['Vercel', 'Supabase', 'Cloudflare R2', 'Resend']
    return {
      name: names[index],
      status: 'error' as const,
      error: '取得中にエラーが発生',
      dashboardUrl: '#',
      lastUpdated: new Date().toISOString(),
    }
  })
}
