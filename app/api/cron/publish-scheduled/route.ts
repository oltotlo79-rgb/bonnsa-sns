import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Vercel Cron Job用 - 予約投稿の自動公開
// cron: */5 * * * * (5分ごとに実行)

export async function GET(request: NextRequest) {
  // Vercel CronまたはAPIキー認証
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // 公開時刻が過ぎた予約投稿を取得
    const scheduledPosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: now },
      },
      include: {
        user: true,
        media: { orderBy: { sortOrder: 'asc' } },
        genres: { include: { genre: true } },
      },
      take: 50, // バッチサイズ制限
    })

    if (scheduledPosts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled posts to publish',
        publishedCount: 0,
      })
    }

    let publishedCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const scheduledPost of scheduledPosts) {
      try {
        // ユーザーが有効かチェック
        if (!scheduledPost.user || scheduledPost.user.isSuspended) {
          await prisma.scheduledPost.update({
            where: { id: scheduledPost.id },
            data: { status: 'failed' },
          })
          failedCount++
          errors.push(`Post ${scheduledPost.id}: User suspended or not found`)
          continue
        }

        // トランザクションで投稿作成と予約投稿の更新を行う
        await prisma.$transaction(async (tx) => {
          // 投稿を作成
          const post = await tx.post.create({
            data: {
              userId: scheduledPost.userId,
              content: scheduledPost.content,
            },
          })

          // メディアを作成
          if (scheduledPost.media.length > 0) {
            await tx.postMedia.createMany({
              data: scheduledPost.media.map((m) => ({
                postId: post.id,
                url: m.url,
                type: m.type,
                sortOrder: m.sortOrder,
              })),
            })
          }

          // ジャンルを作成
          if (scheduledPost.genres.length > 0) {
            await tx.postGenre.createMany({
              data: scheduledPost.genres.map((g) => ({
                postId: post.id,
                genreId: g.genreId,
              })),
            })
          }

          // 予約投稿のステータスを更新
          await tx.scheduledPost.update({
            where: { id: scheduledPost.id },
            data: {
              status: 'published',
              publishedPostId: post.id,
            },
          })
        })

        publishedCount++
      } catch (error) {
        // 個別の投稿エラーをログして続行
        console.error(`Failed to publish scheduled post ${scheduledPost.id}:`, error)
        failedCount++
        errors.push(`Post ${scheduledPost.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)

        // ステータスを失敗に更新
        await prisma.scheduledPost.update({
          where: { id: scheduledPost.id },
          data: { status: 'failed' },
        }).catch(() => {
          // 更新失敗は無視
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Published ${publishedCount} scheduled posts`,
      publishedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Cron job error (publish-scheduled):', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Vercel Cron設定
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60秒タイムアウト
