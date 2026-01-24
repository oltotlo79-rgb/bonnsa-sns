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

// Supabaseの使用量をPrismaで直接取得
async function getSupabaseUsageFromDB(): Promise<ServiceUsage> {
  const projectRef = extractProjectRef()

  // Free tier制限値
  const LIMITS = {
    dbSize: 500, // 500MB
    storageSize: 1024, // 1GB = 1024MB
    mau: 50000, // 50,000 MAU
  }

  const usage: ServiceUsage['usage'] = []

  try {
    // データベースサイズを取得
    const dbSizeResult = await prisma.$queryRaw<{ size: bigint }[]>`
      SELECT pg_database_size(current_database()) as size
    `
    if (dbSizeResult && dbSizeResult[0]) {
      const sizeBytes = Number(dbSizeResult[0].size)
      const currentMB = sizeBytes / (1024 * 1024)
      usage.push({
        current: Math.round(currentMB * 100) / 100,
        limit: LIMITS.dbSize,
        unit: 'MB (データベース)',
        percentage: Math.round((currentMB / LIMITS.dbSize) * 100),
      })
    }

    // テーブルごとのサイズ詳細（参考情報）
    const tableSizes = await prisma.$queryRaw<{ table_name: string; size: bigint }[]>`
      SELECT
        relname as table_name,
        pg_total_relation_size(relid) as size
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 5
    `

    // ユーザー数（MAUの代わりに総ユーザー数を表示）
    const userCount = await prisma.user.count()
    usage.push({
      current: userCount,
      limit: LIMITS.mau,
      unit: 'ユーザー (MAU参考)',
      percentage: Math.round((userCount / LIMITS.mau) * 100),
    })

    // Storageバケットのサイズを取得（Supabase Storage使用時）
    // 注: Storage APIが別途必要なため、ここではスキップ
    // 代わりにPostMediaテーブルのファイル数を表示
    const mediaCount = await prisma.postMedia.count()
    const avgMediaSize = 0.5 // 平均0.5MB/ファイルと仮定
    const estimatedStorageMB = mediaCount * avgMediaSize
    usage.push({
      current: Math.round(estimatedStorageMB * 100) / 100,
      limit: LIMITS.storageSize,
      unit: `MB (推定: ${mediaCount}ファイル)`,
      percentage: Math.round((estimatedStorageMB / LIMITS.storageSize) * 100),
    })

  } catch (error) {
    console.error('Supabase usage error:', error)
    return {
      name: 'Supabase',
      status: 'error',
      error: error instanceof Error ? error.message : 'データベースクエリに失敗',
      dashboardUrl: projectRef
        ? `https://supabase.com/dashboard/project/${projectRef}/settings/billing/usage`
        : 'https://supabase.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  }

  const maxPercentage = usage.length > 0 ? Math.max(...usage.map(u => u.percentage)) : 0

  return {
    name: 'Supabase',
    status: maxPercentage >= 90 ? 'warning' : maxPercentage >= 100 ? 'error' : 'ok',
    usage,
    helpText: '帯域幅はダッシュボードで確認',
    dashboardUrl: projectRef
      ? `https://supabase.com/dashboard/project/${projectRef}/settings/billing/usage`
      : 'https://supabase.com/dashboard',
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
