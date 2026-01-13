import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config' // lib/auth ではなく config を読み込む
import { NextResponse } from 'next/server'

// Edge Runtime でも動作する auth インスタンスを生成
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { nextUrl } = req

  // 公開ページ（ログイン不要）
  const publicPaths = ['/', '/login', '/register', '/password-reset', '/verify-email']
  const isPublicPage = publicPaths.some((path) =>
    nextUrl.pathname === path || nextUrl.pathname.startsWith(path + '/')
  )

  // APIルートは除外
  const isApiRoute = nextUrl.pathname.startsWith('/api')

  // 認証済みユーザーが認証ページ（ルートページを除く）にアクセスした場合 → フィードへリダイレクト
  const authOnlyPaths = ['/login', '/register', '/password-reset']
  const isAuthPage = authOnlyPaths.some((path) =>
    nextUrl.pathname.startsWith(path)
  )
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/feed', nextUrl))
  }

  // 未認証ユーザーが公開ページ以外にアクセスした場合 → ログインへリダイレクト
  if (!isLoggedIn && !isPublicPage && !isApiRoute) {
    const url = new URL('/login', nextUrl)
    url.searchParams.set('redirect', nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}