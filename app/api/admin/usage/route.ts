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
  const orgId = process.env.SUPABASE_ORG_ID

  // Free tier制限値
  const LIMITS = {
    dbSizeGB: 0.5, // 500MB
    storageSizeGB: 1, // 1GB
    egressGB: 5, // 5GB
    mau: 50000,
  }

  const dashboardUrl = orgId && projectRef
    ? `https://supabase.com/dashboard/org/${orgId}/usage?projectRef=${projectRef}`
    : 'https://supabase.com/dashboard'

  // 必要な設定がない場合はDB直接クエリにフォールバック
  if (!accessToken || !projectRef || !orgId) {
    const missing = []
    if (!accessToken) missing.push('SUPABASE_ACCESS_TOKEN')
    if (!projectRef) missing.push('SUPABASE_PROJECT_REF')
    if (!orgId) missing.push('SUPABASE_ORG_ID')

    return getSupabaseUsageFromDBFallback(projectRef, LIMITS, dashboardUrl, missing.join(', '))
  }

  try {
    const usage: ServiceUsage['usage'] = []

    // Organization billing usageエンドポイントを使用
    const usageResponse = await fetch(
      `https://api.supabase.com/v1/organizations/${orgId}/billing/usage`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        next: { revalidate: 300 },
      }
    )

    if (!usageResponse.ok) {
      const errorText = await usageResponse.text()
      console.error('Supabase billing API error:', usageResponse.status, errorText)
      return getSupabaseUsageFromDBFallback(projectRef, LIMITS, dashboardUrl, `API error: ${usageResponse.status}`)
    }

    const usageData = await usageResponse.json()
    console.log('Supabase usage data:', JSON.stringify(usageData).slice(0, 1000))

    // usageDataは配列の場合がある（各プロジェクトのデータ）
    const projectUsage = Array.isArray(usageData)
      ? usageData.find((u: { project_ref?: string }) => u.project_ref === projectRef) || usageData[0]
      : usageData

    // 様々なフィールド名に対応
    const dbSize = projectUsage?.db_size ?? projectUsage?.database_size ??
                   projectUsage?.usage?.db_size ?? projectUsage?.metrics?.db_size
    const storageSize = projectUsage?.storage_size ?? projectUsage?.storage ??
                        projectUsage?.usage?.storage_size ?? projectUsage?.metrics?.storage_size
    const egress = projectUsage?.egress ?? projectUsage?.db_egress ??
                   projectUsage?.usage?.egress ?? projectUsage?.metrics?.egress
    const mau = projectUsage?.mau ?? projectUsage?.monthly_active_users ??
                projectUsage?.usage?.mau ?? projectUsage?.metrics?.mau

    // DBサイズ (GB単位で返される想定)
    if (dbSize !== undefined) {
      const dbSizeGB = typeof dbSize === 'number' ?
        (dbSize > 100 ? dbSize / (1000 * 1000 * 1000) : dbSize) : 0
      usage.push({
        current: Math.round(dbSizeGB * 1000) / 1000,
        limit: LIMITS.dbSizeGB,
        unit: 'GB (データベース)',
        percentage: Math.round((dbSizeGB / LIMITS.dbSizeGB) * 100),
      })
    }

    // ストレージサイズ
    if (storageSize !== undefined) {
      const storageSizeGB = typeof storageSize === 'number' ?
        (storageSize > 100 ? storageSize / (1000 * 1000 * 1000) : storageSize) : 0
      usage.push({
        current: Math.round(storageSizeGB * 1000) / 1000,
        limit: LIMITS.storageSizeGB,
        unit: 'GB (ストレージ)',
        percentage: Math.round((storageSizeGB / LIMITS.storageSizeGB) * 100),
      })
    }

    // Egress
    if (egress !== undefined) {
      const egressGB = typeof egress === 'number' ?
        (egress > 100 ? egress / (1000 * 1000 * 1000) : egress) : 0
      usage.push({
        current: Math.round(egressGB * 1000) / 1000,
        limit: LIMITS.egressGB,
        unit: 'GB (帯域幅)',
        percentage: Math.round((egressGB / LIMITS.egressGB) * 100),
      })
    }

    // MAU
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
      console.error('Supabase API returned no usable data:', JSON.stringify(usageData).slice(0, 500))
      return getSupabaseUsageFromDBFallback(projectRef, LIMITS, dashboardUrl, 'データ形式不明')
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
    return getSupabaseUsageFromDBFallback(projectRef, LIMITS, dashboardUrl,
      error instanceof Error ? error.message : 'Unknown error')
  }
}

// フォールバック: Prismaで直接取得
async function getSupabaseUsageFromDBFallback(
  projectRef: string | undefined,
  LIMITS: { dbSizeGB: number; storageSizeGB: number; egressGB: number; mau: number },
  dashboardUrl: string,
  reason?: string
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

  // ヘルプテキストを構築
  let helpText = reason
    ? `API: ${reason}`
    : 'SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_ORG_ID を設定してください'

  return {
    name: 'Supabase',
    status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
    usage,
    helpText,
    helpUrl: 'https://supabase.com/dashboard/account/tokens',
    dashboardUrl,
    lastUpdated: new Date().toISOString(),
  }
}

// DATABASE_URLからproject refを抽出
function extractProjectRef(): string | undefined {
  // 直接指定があればそれを使用
  if (process.env.SUPABASE_PROJECT_REF) {
    return process.env.SUPABASE_PROJECT_REF
  }

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
