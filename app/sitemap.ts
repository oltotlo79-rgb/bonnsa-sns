import { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/shops`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]

  // 公開ユーザーページ
  const users = await prisma.user.findMany({
    where: { isPublic: true, isSuspended: false },
    select: { id: true, updatedAt: true },
    take: 1000,
    orderBy: { updatedAt: 'desc' },
  })

  const userPages: MetadataRoute.Sitemap = users.map((user: typeof users[number]) => ({
    url: `${baseUrl}/users/${user.id}`,
    lastModified: user.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // 投稿ページ（公開ユーザーの投稿のみ）
  const posts = await prisma.post.findMany({
    where: {
      user: { isPublic: true, isSuspended: false },
      repostPostId: null, // リポストは除外
    },
    select: { id: true, createdAt: true },
    take: 5000,
    orderBy: { createdAt: 'desc' },
  })

  const postPages: MetadataRoute.Sitemap = posts.map((post: typeof posts[number]) => ({
    url: `${baseUrl}/posts/${post.id}`,
    lastModified: post.createdAt,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  // 盆栽園ページ
  const shops = await prisma.bonsaiShop.findMany({
    select: { id: true, updatedAt: true },
    take: 1000,
    orderBy: { updatedAt: 'desc' },
  })

  const shopPages: MetadataRoute.Sitemap = shops.map((shop: typeof shops[number]) => ({
    url: `${baseUrl}/shops/${shop.id}`,
    lastModified: shop.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // イベントページ（今後開催予定のもの優先）
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { endDate: { gte: new Date() } },
        { endDate: null, startDate: { gte: new Date() } },
      ],
    },
    select: { id: true, createdAt: true },
    take: 500,
    orderBy: { startDate: 'asc' },
  })

  const eventPages: MetadataRoute.Sitemap = events.map((event: typeof events[number]) => ({
    url: `${baseUrl}/events/${event.id}`,
    lastModified: event.createdAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...userPages, ...postPages, ...shopPages, ...eventPages]
}
