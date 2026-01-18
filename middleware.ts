import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

// セキュリティヘッダーを追加する関数
function addSecurityHeaders(response: NextResponse): NextResponse {
  // XSS保護
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // コンテンツタイプスニッフィング防止
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // クリックジャッキング防止
  response.headers.set('X-Frame-Options', 'DENY')

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions Policy（旧Feature-Policy）
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  )

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.jsのために必要
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.blob.core.windows.net https://*.r2.dev https://images.unsplash.com https://*.tile.openstreetmap.org",
    "media-src 'self' blob: https://*.blob.core.windows.net https://*.r2.dev",
    "connect-src 'self' https://*.blob.core.windows.net https://*.r2.dev",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '))

  // HTTPS強制（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { nextUrl } = req

  // 認証済みユーザーが認証ページにアクセスした場合 → フィードへリダイレクト
  const authOnlyPaths = ['/login', '/register', '/password-reset']
  const isAuthPage = authOnlyPaths.some((path) =>
    nextUrl.pathname.startsWith(path)
  )

  if (isAuthPage && isLoggedIn) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/feed', nextUrl)))
  }

  // セキュリティヘッダーを追加してレスポンスを返す
  return addSecurityHeaders(NextResponse.next())
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}