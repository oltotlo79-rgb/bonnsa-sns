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
      error: 'VERCEL_TOKEN が設定されていません',
      dashboardUrl: 'https://vercel.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const url = teamId
      ? `https://api.vercel.com/v1/usage?teamId=${teamId}`
      : 'https://api.vercel.com/v1/usage'

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 }, // 5分キャッシュ
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    // Vercel API response structure varies, handle common fields
    const usage: ServiceUsage['usage'] = []

    if (data.bandwidth) {
      usage.push({
        current: data.bandwidth.used || 0,
        limit: data.bandwidth.limit || 100 * 1024 * 1024 * 1024, // 100GB default
        unit: 'GB (帯域幅)',
        percentage: Math.round(((data.bandwidth.used || 0) / (data.bandwidth.limit || 100 * 1024 * 1024 * 1024)) * 100),
      })
    }

    if (data.builds) {
      usage.push({
        current: data.builds.used || 0,
        limit: data.builds.limit || 6000,
        unit: '分 (ビルド時間)',
        percentage: Math.round(((data.builds.used || 0) / (data.builds.limit || 6000)) * 100),
      })
    }

    if (data.serverlessFunctionExecution) {
      usage.push({
        current: data.serverlessFunctionExecution.used || 0,
        limit: data.serverlessFunctionExecution.limit || 100 * 60 * 60, // 100時間
        unit: '秒 (Serverless実行)',
        percentage: Math.round(((data.serverlessFunctionExecution.used || 0) / (data.serverlessFunctionExecution.limit || 100 * 60 * 60)) * 100),
      })
    }

    const maxPercentage = usage.length > 0 ? Math.max(...usage.map(u => u.percentage)) : 0

    return {
      name: 'Vercel',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage: usage.length > 0 ? usage : undefined,
      dashboardUrl: 'https://vercel.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Vercel',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗しました',
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
      error: 'SUPABASE_ACCESS_TOKEN または SUPABASE_PROJECT_REF が設定されていません',
      dashboardUrl: 'https://supabase.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/usage`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage: ServiceUsage['usage'] = []

    // Database size
    if (data.db_size) {
      const limitGB = 0.5 // Free tier: 500MB
      const currentGB = data.db_size / (1024 * 1024 * 1024)
      usage.push({
        current: Math.round(currentGB * 100) / 100,
        limit: limitGB,
        unit: 'GB (データベース)',
        percentage: Math.round((currentGB / limitGB) * 100),
      })
    }

    // Storage
    if (data.storage_size) {
      const limitGB = 1 // Free tier: 1GB
      const currentGB = data.storage_size / (1024 * 1024 * 1024)
      usage.push({
        current: Math.round(currentGB * 100) / 100,
        limit: limitGB,
        unit: 'GB (ストレージ)',
        percentage: Math.round((currentGB / limitGB) * 100),
      })
    }

    // Bandwidth
    if (data.bandwidth) {
      const limitGB = 2 // Free tier: 2GB
      const currentGB = data.bandwidth / (1024 * 1024 * 1024)
      usage.push({
        current: Math.round(currentGB * 100) / 100,
        limit: limitGB,
        unit: 'GB (帯域幅)',
        percentage: Math.round((currentGB / limitGB) * 100),
      })
    }

    const maxPercentage = usage.length > 0 ? Math.max(...usage.map(u => u.percentage)) : 0

    return {
      name: 'Supabase',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage: usage.length > 0 ? usage : undefined,
      dashboardUrl: `https://supabase.com/dashboard/project/${projectRef}`,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Supabase',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗しました',
      dashboardUrl: 'https://supabase.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  }
}

// Upstash使用量を取得
export async function getUpstashUsage(): Promise<ServiceUsage> {
  const email = process.env.UPSTASH_EMAIL
  const apiKey = process.env.UPSTASH_API_KEY
  const databaseId = process.env.UPSTASH_REDIS_DATABASE_ID

  if (!email || !apiKey) {
    return {
      name: 'Upstash',
      status: 'unconfigured',
      error: 'UPSTASH_EMAIL または UPSTASH_API_KEY が設定されていません',
      dashboardUrl: 'https://console.upstash.com',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // データベース一覧を取得
    const listUrl = databaseId
      ? `https://api.upstash.com/v2/redis/database/${databaseId}`
      : 'https://api.upstash.com/v2/redis/databases'

    const response = await fetch(listUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${email}:${apiKey}`).toString('base64')}`,
      },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage: ServiceUsage['usage'] = []

    // 単一データベースまたは配列の最初のものを使用
    const db = Array.isArray(data) ? data[0] : data

    if (db) {
      // Daily commands limit (Free tier: 10,000/day)
      if (db.daily_request_count !== undefined) {
        const limit = db.daily_request_limit || 10000
        usage.push({
          current: db.daily_request_count,
          limit: limit,
          unit: 'リクエスト/日',
          percentage: Math.round((db.daily_request_count / limit) * 100),
        })
      }

      // Storage (Free tier: 256MB)
      if (db.disk_threshold !== undefined && db.disk_usage !== undefined) {
        const currentMB = db.disk_usage / (1024 * 1024)
        const limitMB = db.disk_threshold / (1024 * 1024)
        usage.push({
          current: Math.round(currentMB * 100) / 100,
          limit: Math.round(limitMB * 100) / 100,
          unit: 'MB (ストレージ)',
          percentage: Math.round((currentMB / limitMB) * 100),
        })
      }
    }

    const maxPercentage = usage.length > 0 ? Math.max(...usage.map(u => u.percentage)) : 0

    return {
      name: 'Upstash',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage: usage.length > 0 ? usage : undefined,
      dashboardUrl: 'https://console.upstash.com',
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Upstash',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗しました',
      dashboardUrl: 'https://console.upstash.com',
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
      error: 'CLOUDFLARE_API_TOKEN または CLOUDFLARE_ACCOUNT_ID が設定されていません',
      dashboardUrl: 'https://dash.cloudflare.com',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // バケット一覧を取得してストレージ使用量を計算
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 300 },
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage: ServiceUsage['usage'] = []

    if (data.result && Array.isArray(data.result)) {
      // Free tier: 10GB storage, 1M Class A ops, 10M Class B ops
      const totalBuckets = data.result.length

      usage.push({
        current: totalBuckets,
        limit: 100, // バケット数の目安
        unit: 'バケット',
        percentage: Math.round((totalBuckets / 100) * 100),
      })

      // Note: 詳細なストレージ使用量はAnalytics APIが必要
      // ここでは基本的なバケット情報のみ
    }

    // R2は使用量超過で課金されるため、常にokとして返す
    return {
      name: 'Cloudflare R2',
      status: 'ok',
      usage: usage.length > 0 ? usage : undefined,
      dashboardUrl: `https://dash.cloudflare.com/${accountId}/r2`,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Cloudflare R2',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗しました',
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
      error: 'RESEND_API_KEY が設定されていません',
      dashboardUrl: 'https://resend.com/emails',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // ドメイン情報を取得（間接的な使用状況確認）
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage: ServiceUsage['usage'] = []

    // Free tier: 100 emails/day, 3000 emails/month
    // Note: Resend APIでは直接的な送信数取得が限られているため、
    // ドメイン数を表示（実際の使用量はダッシュボードで確認）
    if (data.data && Array.isArray(data.data)) {
      usage.push({
        current: data.data.length,
        limit: 10, // 目安
        unit: 'ドメイン',
        percentage: Math.round((data.data.length / 10) * 100),
      })
    }

    return {
      name: 'Resend',
      status: 'ok',
      usage: usage.length > 0 ? usage : undefined,
      error: '詳細な送信数はダッシュボードで確認してください',
      dashboardUrl: 'https://resend.com/emails',
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Resend',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗しました',
      dashboardUrl: 'https://resend.com/emails',
      lastUpdated: new Date().toISOString(),
    }
  }
}

// Stripe使用量を取得
export async function getStripeUsage(): Promise<ServiceUsage> {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    return {
      name: 'Stripe',
      status: 'unconfigured',
      error: 'STRIPE_SECRET_KEY が設定されていません',
      dashboardUrl: 'https://dashboard.stripe.com',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // 残高を取得
    const response = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${secretKey}` },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage: ServiceUsage['usage'] = []

    // 利用可能残高を表示
    if (data.available && data.available.length > 0) {
      const balance = data.available[0]
      usage.push({
        current: balance.amount / 100, // centからの変換
        limit: 0, // Stripeには制限なし
        unit: `${balance.currency.toUpperCase()} (残高)`,
        percentage: 0,
      })
    }

    // 保留中の残高
    if (data.pending && data.pending.length > 0) {
      const pending = data.pending[0]
      usage.push({
        current: pending.amount / 100,
        limit: 0,
        unit: `${pending.currency.toUpperCase()} (保留中)`,
        percentage: 0,
      })
    }

    return {
      name: 'Stripe',
      status: 'ok',
      usage: usage.length > 0 ? usage : undefined,
      dashboardUrl: 'https://dashboard.stripe.com',
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Stripe',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗しました',
      dashboardUrl: 'https://dashboard.stripe.com',
      lastUpdated: new Date().toISOString(),
    }
  }
}

// Sentry使用量を取得
export async function getSentryUsage(): Promise<ServiceUsage> {
  const authToken = process.env.SENTRY_AUTH_TOKEN
  const org = process.env.SENTRY_ORG

  if (!authToken || !org) {
    return {
      name: 'Sentry',
      status: 'unconfigured',
      error: 'SENTRY_AUTH_TOKEN または SENTRY_ORG が設定されていません',
      dashboardUrl: 'https://sentry.io',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // Organization stats を取得
    const response = await fetch(
      `https://sentry.io/api/0/organizations/${org}/stats_v2/?field=sum(quantity)&groupBy=outcome&category=error&interval=1d&statsPeriod=30d`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        next: { revalidate: 300 },
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage: ServiceUsage['usage'] = []

    // イベント数を集計
    if (data.groups && Array.isArray(data.groups)) {
      let totalEvents = 0
      for (const group of data.groups) {
        if (group.totals && group.totals['sum(quantity)']) {
          totalEvents += group.totals['sum(quantity)']
        }
      }

      // Free tier: 5K errors/month
      const limit = 5000
      usage.push({
        current: totalEvents,
        limit: limit,
        unit: 'エラー/月',
        percentage: Math.round((totalEvents / limit) * 100),
      })
    }

    const maxPercentage = usage.length > 0 ? Math.max(...usage.map(u => u.percentage)) : 0

    return {
      name: 'Sentry',
      status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
      usage: usage.length > 0 ? usage : undefined,
      dashboardUrl: `https://sentry.io/organizations/${org}/stats/`,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Sentry',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗しました',
      dashboardUrl: 'https://sentry.io',
      lastUpdated: new Date().toISOString(),
    }
  }
}

// 全サービスの使用量を一括取得
export async function getAllUsage(): Promise<ServiceUsage[]> {
  const results = await Promise.allSettled([
    getVercelUsage(),
    getSupabaseUsage(),
    getUpstashUsage(),
    getCloudflareR2Usage(),
    getResendUsage(),
    getStripeUsage(),
    getSentryUsage(),
  ])

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }

    const names = ['Vercel', 'Supabase', 'Upstash', 'Cloudflare R2', 'Resend', 'Stripe', 'Sentry']
    return {
      name: names[index],
      status: 'error' as const,
      error: '取得中にエラーが発生しました',
      dashboardUrl: '#',
      lastUpdated: new Date().toISOString(),
    }
  })
}
