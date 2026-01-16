import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/admin/*',
          '/api/',
          '/api/*',
          '/login',
          '/register',
          '/verify-email',
          '/auth/',
          '/settings/',
          '/settings/*',
          '/feed',
          '/bookmarks',
          '/notifications',
          '/messages/',
          '/messages/*',
          '/posts/scheduled/',
          '/posts/scheduled/*',
          '/analytics',
          '/*.json$',
          '/*?*', // クエリパラメータ付きURLを除外
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/login',
          '/register',
          '/verify-email',
          '/auth/',
          '/settings/',
          '/feed',
          '/bookmarks',
          '/notifications',
          '/messages/',
          '/posts/scheduled/',
          '/analytics',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
