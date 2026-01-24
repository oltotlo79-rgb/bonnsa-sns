import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * ヘルスチェックエンドポイント
 *
 * Dockerのヘルスチェックやロードバランサーの死活監視に使用
 *
 * レスポンス:
 * - 200: 正常
 * - 503: データベース接続エラー
 */
export async function GET() {
  try {
    // データベース接続確認
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
