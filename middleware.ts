import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const { auth } = NextAuth(authConfig)

// Basic認証のチェック
function checkBasicAuth(request: NextRequest): NextResponse | null {
  const basicAuthUser = process.env.BASIC_AUTH_USER
  const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD

  // 環境変数が設定されていない場合はBasic認証をスキップ
  if (!basicAuthUser || !basicAuthPassword) {
    return null
  }

  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    })
  }

  const [scheme, encoded] = authHeader.split(' ')

  if (scheme !== 'Basic' || !encoded) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    })
  }

  // Base64デコード
  const decoded = atob(encoded)
  const [user, password] = decoded.split(':')

  if (user !== basicAuthUser || password !== basicAuthPassword) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    })
  }

  // 認証成功
  return null
}

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
  // Google AdSense用のドメインを追加（ワイルドカードで広くカバー）
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googlesyndication.com https://*.googletagservices.com https://*.google.com https://*.googleadservices.com https://*.doubleclick.net https://*.adtrafficquality.google", // Next.js + Google AdSense
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.blob.core.windows.net https://*.r2.dev https://images.unsplash.com https://*.tile.openstreetmap.org https://*.googlesyndication.com https://*.google.com https://*.google.co.jp https://*.doubleclick.net https://*.gstatic.com https://*.adtrafficquality.google",
    "media-src 'self' blob: https://*.blob.core.windows.net https://*.r2.dev",
    "connect-src 'self' https://*.blob.core.windows.net https://*.r2.dev https://*.r2.cloudflarestorage.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.google-analytics.com https://*.adtrafficquality.google",
    "frame-src https://*.doubleclick.net https://*.google.com https://*.googlesyndication.com https://*.adtrafficquality.google",
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
  const { nextUrl } = req

  // APIルートはBasic認証をスキップ（Webhook等のため）
  if (nextUrl.pathname.startsWith('/api/')) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Basic認証チェック
  const basicAuthResponse = checkBasicAuth(req)
  if (basicAuthResponse) {
    return basicAuthResponse
  }

  const isLoggedIn = !!req.auth

  // 認証済みユーザーがトップページまたは認証ページにアクセスした場合 → フィードへリダイレクト
  const authOnlyPaths = ['/login', '/register', '/password-reset']
  const isAuthPage = authOnlyPaths.some((path) =>
    nextUrl.pathname.startsWith(path)
  )
  const isTopPage = nextUrl.pathname === '/'

  if ((isAuthPage || isTopPage) && isLoggedIn) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/feed', nextUrl)))
  }

  // セキュリティヘッダーを追加してレスポンスを返す
  return addSecurityHeaders(NextResponse.next())
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
