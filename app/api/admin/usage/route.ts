import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/actions/admin'
import { prisma } from '@/lib/db'
import {
  getVercelUsage,
  getCloudflareR2Usage,
  getResendUsage,
  type ServiceUsage,
} from '@/lib/services/usage'

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
      getCloudflareR2Usage(),
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
