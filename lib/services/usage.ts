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

    // 使用量を取得（Web Analytics / Speed Insights含む）
    const periodStart = new Date()
    periodStart.setDate(1)
    periodStart.setHours(0, 0, 0, 0)
    const periodEnd = new Date()

    // v1/usage APIで帯域幅を取得
    const usageUrl = teamId
      ? `https://api.vercel.com/v1/usage?teamId=${teamId}`
      : 'https://api.vercel.com/v1/usage'

    const usageRes = await fetch(usageUrl, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })

    if (usageRes.ok) {
      const usageData = await usageRes.json()

      // 帯域幅 (Hobby: 100GB/月, Pro: 1TB/月)
      if (usageData.bandwidth) {
        const currentGB = (usageData.bandwidth.value || 0) / (1024 * 1024 * 1024)
        const limitGB = 100 // Hobby plan
        usage.push({
          current: Math.round(currentGB * 100) / 100,
          limit: limitGB,
          unit: 'GB (データ転送量/月)',
          percentage: Math.round((currentGB / limitGB) * 100),
        })
      }

      // Function実行時間 (Hobby: 100GB-hours/月)
      if (usageData.serverlessFunctionExecution) {
        const currentHours = (usageData.serverlessFunctionExecution.value || 0) / 3600
        const limitHours = 100
        usage.push({
          current: Math.round(currentHours * 100) / 100,
          limit: limitHours,
          unit: 'GB-hours (Function)',
          percentage: Math.round((currentHours / limitHours) * 100),
        })
      }
    }

    // 使用量APIが使えない場合、別のエンドポイントを試す
    if (usage.length === 0) {
      // プロジェクトのアナリティクスから帯域幅を推測
      const projectsUrl = teamId
        ? `https://api.vercel.com/v9/projects?teamId=${teamId}&limit=10`
        : 'https://api.vercel.com/v9/projects?limit=10'

      const projectsRes = await fetch(projectsUrl, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      })

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()

        // プロジェクト数を表示（使用量が取得できない場合のフォールバック）
        usage.push({
          current: projectsData.projects?.length || 0,
          limit: 200, // Hobby目安
          unit: 'プロジェクト',
          percentage: Math.round(((projectsData.projects?.length || 0) / 200) * 100),
        })
      }

      // 帯域幅はダッシュボードで確認を促す
      return {
        name: 'Vercel',
        status: 'ok',
        usage: usage.length > 0 ? usage : undefined,
        helpText: '詳細な帯域幅はダッシュボードで確認してください',
        dashboardUrl: teamId
          ? `https://vercel.com/teams/${teamId}/usage`
          : 'https://vercel.com/account/usage',
        lastUpdated: new Date().toISOString(),
      }
    }

    const maxPercentage = Math.max(...usage.map(u => u.percentage))

    return {
      name: 'Vercel',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage,
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
    // プロジェクト情報を取得してorganization_idを得る
    const projectRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300 },
      }
    )

    if (!projectRes.ok) {
      const errorText = await projectRes.text()
      throw new Error(`HTTP ${projectRes.status}: ${errorText.slice(0, 100)}`)
    }

    const project = await projectRes.json()
    const usage: ServiceUsage['usage'] = []
    const orgId = project.organization_id

    // Free tier制限値
    const LIMITS = {
      dbSize: 500, // 500MB
      storageSize: 1024, // 1GB = 1024MB
      bandwidth: 5, // 5GB
      mau: 50000, // 50,000 MAU
    }

    if (orgId) {
      // 組織の使用量を取得（billing cycleの使用量）
      const usageRes = await fetch(
        `https://api.supabase.com/v1/organizations/${orgId}/usage`,
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

        // usageDataが配列の場合（複数プロジェクト）
        const projectUsage = Array.isArray(usageData)
          ? usageData.find((u: { project_ref?: string }) => u.project_ref === projectRef) || usageData[0]
          : usageData

        // データベースサイズ
        const dbSize = projectUsage?.db_size ?? projectUsage?.usage?.db_size
        if (dbSize !== undefined) {
          const currentMB = dbSize / (1024 * 1024)
          usage.push({
            current: Math.round(currentMB * 100) / 100,
            limit: LIMITS.dbSize,
            unit: 'MB (データベース)',
            percentage: Math.round((currentMB / LIMITS.dbSize) * 100),
          })
        }

        // ファイルストレージ
        const storageSize = projectUsage?.storage_size ?? projectUsage?.usage?.storage_size
        if (storageSize !== undefined) {
          const currentMB = storageSize / (1024 * 1024)
          usage.push({
            current: Math.round(currentMB * 100) / 100,
            limit: LIMITS.storageSize,
            unit: 'MB (ストレージ)',
            percentage: Math.round((currentMB / LIMITS.storageSize) * 100),
          })
        }

        // 帯域幅（egress）
        const bandwidth = projectUsage?.total_egress ?? projectUsage?.usage?.egress ?? projectUsage?.bandwidth
        if (bandwidth !== undefined) {
          const currentGB = bandwidth / (1024 * 1024 * 1024)
          usage.push({
            current: Math.round(currentGB * 100) / 100,
            limit: LIMITS.bandwidth,
            unit: 'GB (帯域幅/月)',
            percentage: Math.round((currentGB / LIMITS.bandwidth) * 100),
          })
        }

        // MAU (Monthly Active Users)
        const mau = projectUsage?.mau ?? projectUsage?.usage?.mau ?? projectUsage?.monthly_active_users
        if (mau !== undefined) {
          usage.push({
            current: mau,
            limit: LIMITS.mau,
            unit: 'MAU',
            percentage: Math.round((mau / LIMITS.mau) * 100),
          })
        }
      }

      // usageが空の場合、別のAPIを試す
      if (usage.length === 0) {
        // 組織の詳細な使用量を取得
        const billingRes = await fetch(
          `https://api.supabase.com/v1/organizations/${orgId}/billing/usage`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            next: { revalidate: 300 },
          }
        )

        if (billingRes.ok) {
          const billingData = await billingRes.json()

          // billing APIのレスポンス形式に対応
          if (billingData.usages && Array.isArray(billingData.usages)) {
            for (const item of billingData.usages) {
              if (item.metric === 'DATABASE_SIZE' && item.usage !== undefined) {
                const currentMB = item.usage / (1024 * 1024)
                usage.push({
                  current: Math.round(currentMB * 100) / 100,
                  limit: LIMITS.dbSize,
                  unit: 'MB (データベース)',
                  percentage: Math.round((currentMB / LIMITS.dbSize) * 100),
                })
              }
              if (item.metric === 'STORAGE_SIZE' && item.usage !== undefined) {
                const currentMB = item.usage / (1024 * 1024)
                usage.push({
                  current: Math.round(currentMB * 100) / 100,
                  limit: LIMITS.storageSize,
                  unit: 'MB (ストレージ)',
                  percentage: Math.round((currentMB / LIMITS.storageSize) * 100),
                })
              }
              if (item.metric === 'EGRESS' && item.usage !== undefined) {
                const currentGB = item.usage / (1024 * 1024 * 1024)
                usage.push({
                  current: Math.round(currentGB * 100) / 100,
                  limit: LIMITS.bandwidth,
                  unit: 'GB (帯域幅/月)',
                  percentage: Math.round((currentGB / LIMITS.bandwidth) * 100),
                })
              }
              if (item.metric === 'MONTHLY_ACTIVE_USERS' && item.usage !== undefined) {
                usage.push({
                  current: item.usage,
                  limit: LIMITS.mau,
                  unit: 'MAU',
                  percentage: Math.round((item.usage / LIMITS.mau) * 100),
                })
              }
            }
          }
        }
      }
    }

    // 使用量が取得できなかった場合のフォールバック
    if (usage.length === 0) {
      return {
        name: 'Supabase',
        status: 'ok',
        helpText: '詳細な使用量はダッシュボードで確認してください',
        dashboardUrl: `https://supabase.com/dashboard/project/${projectRef}/settings/billing/usage`,
        lastUpdated: new Date().toISOString(),
      }
    }

    const maxPercentage = Math.max(...usage.map(u => u.percentage))

    return {
      name: 'Supabase',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage,
      dashboardUrl: `https://supabase.com/dashboard/project/${projectRef}/settings/billing/usage`,
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
    const usage: ServiceUsage['usage'] = []

    // 今日の日付と今月の開始日を計算
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // メール一覧を取得して送信数をカウント
    // Note: Resend APIは最大100件/リクエストなので、複数回取得
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
          // メールがない場合
          break
        }
        throw new Error(`HTTP ${emailsRes.status}`)
      }

      const emailsData = await emailsRes.json()

      if (emailsData.data && Array.isArray(emailsData.data)) {
        allEmails = [...allEmails, ...emailsData.data]

        // 今月以前のメールが出てきたら終了
        const oldestEmail = emailsData.data[emailsData.data.length - 1]
        if (oldestEmail && new Date(oldestEmail.created_at) < monthStart) {
          hasMore = false
        } else if (emailsData.data.length < 100) {
          hasMore = false
        } else {
          // ページネーション用のカーソルを取得
          cursor = emailsData.data[emailsData.data.length - 1]?.id
        }
      } else {
        hasMore = false
      }
    }

    // 今日の送信数をカウント
    const todayCount = allEmails.filter(
      email => new Date(email.created_at) >= todayStart
    ).length

    // 今月の送信数をカウント
    const monthCount = allEmails.filter(
      email => new Date(email.created_at) >= monthStart
    ).length

    // Free tier: 100 emails/day
    usage.push({
      current: todayCount,
      limit: 100,
      unit: '通 (今日)',
      percentage: Math.round((todayCount / 100) * 100),
    })

    // Free tier: 3,000 emails/month
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
