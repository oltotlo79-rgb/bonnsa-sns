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

/**
 * 許可されたオリジンを取得
 */
function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const additionalOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []

  try {
    const appOrigin = new URL(appUrl).origin
    return [appOrigin, ...additionalOrigins].filter(Boolean)
  } catch {
    return ['http://localhost:3000', ...additionalOrigins].filter(Boolean)
  }
}

/**
 * Originヘッダーを検証（Server Actions用）
 *
 * POSTリクエストに対してOriginヘッダーを検証し、
 * クロスオリジンからの不正なリクエストをブロック
 */
function validateOriginHeader(request: NextRequest): NextResponse | null {
  // POSTリクエスト以外はスキップ
  if (request.method !== 'POST') {
    return null
  }

  // APIルートでのOrigin検証（Server Actions含む）
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Originヘッダーがある場合は検証
  if (origin) {
    const allowedOrigins = getAllowedOrigins()

    if (!allowedOrigins.includes(origin)) {
      console.warn(`[SECURITY] Blocked request from unauthorized origin: ${origin}`)
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized origin' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  // Refererヘッダーがある場合も検証（バックアップ）
  if (!origin && referer) {
    try {
      const refererOrigin = new URL(referer).origin
      const allowedOrigins = getAllowedOrigins()

      if (!allowedOrigins.includes(refererOrigin)) {
        console.warn(`[SECURITY] Blocked request from unauthorized referer: ${refererOrigin}`)
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized origin' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    } catch {
      // Refererのパースに失敗した場合は続行
    }
  }

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

  // Cross-Origin セキュリティヘッダー（追加）
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  // Content Security Policy
  // セキュリティ強化版 - Google AdSense互換
  //
  // 注意事項:
  // - 'unsafe-inline' (script): Google AdSense動的スクリプト用（nonce移行を検討）
  // - 'unsafe-inline' (style): Tailwind CSS + インラインスタイル用
  // - 'wasm-unsafe-eval': WASM使用時のみ必要（現在不要）
  //
  // 将来の改善:
  // - script-srcをnonce-basedに移行（next/script対応）
  // - report-uriでCSP違反をモニタリング
  const cspDirectives = [
    "default-src 'self'",
    // script-src: 'unsafe-eval'を削除（本番Next.jsでは不要）
    // Google AdSenseは'unsafe-inline'が必要
    "script-src 'self' 'unsafe-inline' https://*.googlesyndication.com https://*.googletagservices.com https://*.google.com https://*.googleadservices.com https://*.doubleclick.net https://*.adtrafficquality.google",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.blob.core.windows.net https://*.r2.dev https://images.unsplash.com https://*.tile.openstreetmap.org https://*.googlesyndication.com https://*.google.com https://*.google.co.jp https://*.doubleclick.net https://*.gstatic.com https://*.adtrafficquality.google",
    "media-src 'self' blob: https://*.blob.core.windows.net https://*.r2.dev",
    "connect-src 'self' https://*.blob.core.windows.net https://*.r2.dev https://*.r2.cloudflarestorage.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.google-analytics.com https://*.adtrafficquality.google",
    "frame-src https://*.doubleclick.net https://*.google.com https://*.googlesyndication.com https://*.adtrafficquality.google",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // オブジェクト埋め込み禁止（Flash等の脆弱性対策）
    "object-src 'none'",
    // HTTP→HTTPSへの自動アップグレード
    "upgrade-insecure-requests",
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

/**
 * メンテナンス中にアクセス可能なパス
 */
const MAINTENANCE_ALLOWED_PATHS = [
  '/',
  '/login',
  '/register',
  '/password-reset',
  '/maintenance',
  '/api/auth', // NextAuth APIは許可
]

/**
 * パスがメンテナンス中でもアクセス可能かチェック
 */
function isMaintenanceAllowedPath(pathname: string): boolean {
  return MAINTENANCE_ALLOWED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  )
}

export default auth(async (req) => {
  const { nextUrl } = req

  // Server Actions（POSTリクエスト）のOrigin検証
  // ただし、外部Webhook用のAPIは除外
  const webhookPaths = ['/api/webhooks/', '/api/cron/']
  const isWebhook = webhookPaths.some((path) => nextUrl.pathname.startsWith(path))

  if (!isWebhook) {
    const originError = validateOriginHeader(req)
    if (originError) {
      return originError
    }
  }

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
  const userId = req.auth?.user?.id

  // メンテナンスモードのチェック（動的インポートでEdge互換）
  // 静的ファイルとメンテナンスページ自体はスキップ
  if (
    !nextUrl.pathname.startsWith('/_next') &&
    !nextUrl.pathname.startsWith('/api/') &&
    nextUrl.pathname !== '/maintenance'
  ) {
    try {
      // データベースから直接メンテナンス設定を取得
      // Edge Runtimeでは@prisma/client/edgeを使用するか、
      // 代わりにAPI経由で取得する必要がある
      // ここではfetch APIを使ってAPI経由でチェック
      const baseUrl = nextUrl.origin
      const maintenanceResponse = await fetch(
        `${baseUrl}/api/maintenance/status`,
        {
          headers: {
            cookie: req.headers.get('cookie') || '',
          },
          cache: 'no-store',
        }
      )

      if (maintenanceResponse.ok) {
        const { isMaintenanceMode, isAdmin } = await maintenanceResponse.json()

        // メンテナンス中かつ管理者でない場合
        if (isMaintenanceMode && !isAdmin) {
          // 許可されたパス以外はメンテナンスページへリダイレクト
          if (!isMaintenanceAllowedPath(nextUrl.pathname)) {
            return addSecurityHeaders(
              NextResponse.redirect(new URL('/maintenance', nextUrl))
            )
          }
        }
      }
    } catch (error) {
      // メンテナンスチェックに失敗しても続行
      console.error('Maintenance check failed:', error)
    }
  }

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
