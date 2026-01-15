/**
 * 予約投稿の公開バッチスクリプト
 *
 * 使用方法:
 * npx ts-node scripts/publish-scheduled-posts.ts
 *
 * cronで毎分実行する場合:
 * * * * * * cd /path/to/project && npx ts-node scripts/publish-scheduled-posts.ts >> /var/log/cron.log 2>&1
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function publishScheduledPosts() {
  const now = new Date()
  console.log(`[${now.toISOString()}] 予約投稿の公開処理を開始...`)

  try {
    // 公開時刻を過ぎた予約投稿を取得
    const scheduledPosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: now },
      },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        genres: true,
      },
    })

    console.log(`  対象件数: ${scheduledPosts.length}件`)

    let successCount = 0
    let failCount = 0

    for (const scheduled of scheduledPosts) {
      try {
        // 投稿を作成
        const post = await prisma.post.create({
          data: {
            userId: scheduled.userId,
            content: scheduled.content,
            media: scheduled.media.length > 0 ? {
              create: scheduled.media.map((m) => ({
                url: m.url,
                type: m.type,
                sortOrder: m.sortOrder,
              })),
            } : undefined,
            genres: scheduled.genres.length > 0 ? {
              create: scheduled.genres.map((g) => ({
                genreId: g.genreId,
              })),
            } : undefined,
          },
        })

        // 予約投稿のステータスを更新
        await prisma.scheduledPost.update({
          where: { id: scheduled.id },
          data: {
            status: 'published',
            publishedPostId: post.id,
          },
        })

        successCount++
        console.log(`  [成功] ID: ${scheduled.id} -> Post ID: ${post.id}`)
      } catch (error) {
        // エラー時はステータスを失敗に
        await prisma.scheduledPost.update({
          where: { id: scheduled.id },
          data: { status: 'failed' },
        })

        failCount++
        console.error(`  [失敗] ID: ${scheduled.id}`, error)
      }
    }

    console.log(`[${new Date().toISOString()}] 処理完了: 成功=${successCount}, 失敗=${failCount}`)
  } catch (error) {
    console.error('予約投稿の公開処理でエラーが発生:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

publishScheduledPosts()
