import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/actions/admin'
import { prisma } from '@/lib/db'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import {
  getVercelUsage,
  getResendUsage,
  type ServiceUsage,
} from '@/lib/services/usage'

// Cloudflare R2使用量をS3 APIで正確に取得
async function getCloudflareR2UsageWithS3(): Promise<ServiceUsage> {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    const missing = []
    if (!accountId) missing.push('R2_ACCOUNT_ID')
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID')
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY')
    if (!bucketName) missing.push('R2_BUCKET_NAME')

    return {
      name: 'Cloudflare R2',
      status: 'unconfigured',
      error: `${missing.join(', ')} が未設定`,
      helpText: 'R2 API認証情報を設定してください',
      helpUrl: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens',
      dashboardUrl: `https://dash.cloudflare.com/${accountId || ''}/r2/overview`,
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    // S3クライアントを作成（R2のエンドポイントを指定）
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    // 全オブジェクトを列挙してサイズを合計
    let totalSize = 0
    let totalObjects = 0
    let continuationToken: string | undefined

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })

      const response = await s3Client.send(command)

      if (response.Contents) {
        for (const obj of response.Contents) {
          totalSize += obj.Size || 0
          totalObjects++
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken)

    const FREE_TIER_GB = 10
    const PRICE_PER_GB = 0.015

    // Cloudflareと同じ10進法で計算 (1GB = 1,000,000,000 bytes)
    const storageGB = totalSize / (1000 * 1000 * 1000)
    const storageMB = totalSize / (1000 * 1000)

    const usage: ServiceUsage['usage'] = []

    // ストレージ使用量（MBまたはGBで表示）
    if (storageGB >= 1) {
      usage.push({
        current: Math.round(storageGB * 100) / 100,
        limit: FREE_TIER_GB,
        unit: 'GB (ストレージ)',
        percentage: Math.round((storageGB / FREE_TIER_GB) * 100),
      })
    } else {
      // 10進法: 10GB = 10,000 MB
      usage.push({
        current: Math.round(storageMB * 100) / 100,
        limit: FREE_TIER_GB * 1000,
        unit: 'MB (ストレージ)',
        percentage: Math.round((storageMB / (FREE_TIER_GB * 1000)) * 100),
      })
    }

    // オブジェクト数
    usage.push({
      current: totalObjects,
      limit: 0,
      unit: 'オブジェクト',
      percentage: 0,
    })

    // コスト計算
    const billableGB = Math.max(0, storageGB - FREE_TIER_GB)
    const estimatedCost = billableGB * PRICE_PER_GB

    const maxPercentage = Math.max(
      ...usage.filter(u => u.limit > 0).map(u => u.percentage ?? 0),
      0
    )

    return {
      name: 'Cloudflare R2',
      status: maxPercentage >= 100 ? 'error' : maxPercentage >= 90 ? 'warning' : 'ok',
      usage,
      helpText: estimatedCost > 0
        ? `推定コスト: $${estimatedCost.toFixed(2)}/月 (10GB超過分)`
        : '無料枠内 (10GB/月)',
      dashboardUrl: `https://dash.cloudflare.com/${accountId}/r2/overview`,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('R2 S3 API error:', error)
    return {
      name: 'Cloudflare R2',
      status: 'error',
      error: error instanceof Error ? error.message : 'S3 API接続エラー',
      dashboardUrl: `https://dash.cloudflare.com/${accountId}/r2/overview`,
      lastUpdated: new Date().toISOString(),
    }
  }
}

// Supabaseの使用量をManagement APIで取得
async function getSupabaseUsageFromDB(): Promise<ServiceUsage> {
  const projectRef = extractProjectRef()
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  // Free tier制限値
  const LIMITS = {
    dbSizeGB: 0.5, // 500MB
    storageSizeGB: 1, // 1GB
    egressGB: 5, // 5GB
    mau: 50000,
  }

  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/settings/billing/usage`
    : 'https://supabase.com/dashboard'

  // Management APIトークンがない場合はDB直接クエリにフォールバック
  if (!accessToken || !projectRef) {
    return getSupabaseUsageFromDBFallback(projectRef, LIMITS, dashboardUrl)
  }

  try {
    // Supabase Management APIで使用量を取得
    // 日付範囲を指定（今月の1日から今日まで）
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const endDate = now.toISOString().split('T')[0]

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/daily-stats?interval=day`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        next: { revalidate: 300 },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Supabase API error:', response.status, errorText)
      return getSupabaseUsageFromDBFallback(projectRef, LIMITS, dashboardUrl)
    }

    const data = await response.json()
    const usage: ServiceUsage['usage'] = []

    // daily-statsの最新データを取得
    const latestStats = Array.isArray(data) && data.length > 0 ? data[data.length - 1] : data

    // データベースサイズ (バイト単位で返される場合とGB単位の場合がある)
    const dbSize = latestStats?.total_db_size_bytes ?? latestStats?.db_size
    if (dbSize !== undefined) {
      // 値が1より小さければ既にGB単位、大きければバイト単位
      const dbSizeGB = dbSize < 10 ? dbSize : dbSize / (1000 * 1000 * 1000)
      usage.push({
        current: Math.round(dbSizeGB * 1000) / 1000,
        limit: LIMITS.dbSizeGB,
        unit: 'GB (データベース)',
        percentage: Math.round((dbSizeGB / LIMITS.dbSizeGB) * 100),
      })
    }

    // ストレージサイズ
    const storageSize = latestStats?.total_storage_size_bytes ?? latestStats?.storage_size
    if (storageSize !== undefined) {
      const storageSizeGB = storageSize < 10 ? storageSize : storageSize / (1000 * 1000 * 1000)
      usage.push({
        current: Math.round(storageSizeGB * 1000) / 1000,
        limit: LIMITS.storageSizeGB,
        unit: 'GB (ストレージ)',
        percentage: Math.round((storageSizeGB / LIMITS.storageSizeGB) * 100),
      })
    }

    // 帯域幅 (Egress) - 月間合計
    const egress = latestStats?.total_egress_modified ?? latestStats?.db_egress
    if (egress !== undefined) {
      const egressGB = egress < 100 ? egress : egress / (1000 * 1000 * 1000)
      usage.push({
        current: Math.round(egressGB * 1000) / 1000,
        limit: LIMITS.egressGB,
        unit: 'GB (帯域幅)',
        percentage: Math.round((egressGB / LIMITS.egressGB) * 100),
      })
    }

    // MAU
    const mau = latestStats?.total_auth_billing_period_mau ?? latestStats?.monthly_active_users
    if (mau !== undefined) {
      usage.push({
        current: mau,
        limit: LIMITS.mau,
        unit: 'MAU',
        percentage: Math.round((mau / LIMITS.mau) * 100),
      })
    }

    // データが取得できなかった場合はフォールバック
    if (usage.length === 0) {
      console.error('Supabase API returned no usable data:', JSON.stringify(data).slice(0, 500))
      return getSupabaseUsageFromDBFallback(projectRef, LIMITS, dashboardUrl)
    }

    const maxPercentage = Math.max(...usage.filter(u => u.limit > 0).map(u => u.percentage), 0)

    return {
      name: 'Supabase',
      status: maxPercentage >= 100 ? 'error' : maxPercentage >= 90 ? 'warning' : 'ok',
      usage,
      dashboardUrl,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Supabase usage error:', error)
    return getSupabaseUsageFromDBFallback(projectRef, LIMITS, dashboardUrl)
  }
}

// フォールバック: Prismaで直接取得
async function getSupabaseUsageFromDBFallback(
  projectRef: string | undefined,
  LIMITS: { dbSizeGB: number; storageSizeGB: number; egressGB: number; mau: number },
  dashboardUrl: string
): Promise<ServiceUsage> {
  const usage: ServiceUsage['usage'] = []

  try {
    // データベースサイズ（pg_database_size）
    const dbSizeResult = await prisma.$queryRaw<{ size: bigint }[]>`
      SELECT pg_database_size(current_database()) as size
    `

    if (dbSizeResult && dbSizeResult[0]) {
      const sizeBytes = Number(dbSizeResult[0].size)
      const currentGB = sizeBytes / (1000 * 1000 * 1000)

      if (currentGB >= 0.01) {
        usage.push({
          current: Math.round(currentGB * 1000) / 1000,
          limit: LIMITS.dbSizeGB,
          unit: 'GB (DB・参考値)',
          percentage: Math.round((currentGB / LIMITS.dbSizeGB) * 100),
        })
      } else {
        const currentMB = sizeBytes / (1000 * 1000)
        usage.push({
          current: Math.round(currentMB * 100) / 100,
          limit: LIMITS.dbSizeGB * 1000,
          unit: 'MB (DB・参考値)',
          percentage: Math.round((currentMB / (LIMITS.dbSizeGB * 1000)) * 100),
        })
      }
    }

    // ユーザー数
    const userCount = await prisma.user.count()
    usage.push({
      current: userCount,
      limit: LIMITS.mau,
      unit: 'MAU (ユーザー数)',
      percentage: Math.round((userCount / LIMITS.mau) * 100),
    })

  } catch (error) {
    console.error('Supabase DB fallback error:', error)
    return {
      name: 'Supabase',
      status: 'error',
      error: error instanceof Error ? error.message : 'データベースクエリに失敗',
      dashboardUrl,
      lastUpdated: new Date().toISOString(),
    }
  }

  const maxPercentage = usage.length > 0 ? Math.max(...usage.map(u => u.percentage)) : 0

  return {
    name: 'Supabase',
    status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
    usage,
    helpText: '正確な値にはSUPABASE_ACCESS_TOKENが必要',
    helpUrl: 'https://supabase.com/dashboard/account/tokens',
    dashboardUrl,
    lastUpdated: new Date().toISOString(),
  }
}

// DATABASE_URLからproject refを抽出
function extractProjectRef(): string | undefined {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return undefined

  // postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com
  const match = dbUrl.match(/postgres\.([a-z0-9]+):/)
  return match ? match[1] : undefined
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

    // 全サービスの使用量を並列取得
    const results = await Promise.allSettled([
      getVercelUsage(),
      getSupabaseUsageFromDB(), // Prismaを使用
      getCloudflareR2UsageWithS3(), // S3 APIで正確なストレージ取得
      getResendUsage(),
    ])

    const usage = results.map((result, index) => {
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

    return NextResponse.json({
      success: true,
      data: usage,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
