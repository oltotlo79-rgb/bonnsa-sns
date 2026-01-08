import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth

  // 保護されたルート
  const protectedPaths = ['/feed', '/posts', '/settings', '/notifications', '/bookmarks', '/users']
  const isProtected = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  )

  // 認証ページ
  const authPaths = ['/login', '/register', '/password-reset']
  const isAuthPage = authPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  )

  // 未認証ユーザーが保護ルートにアクセスした場合
  if (isProtected && !isLoggedIn) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // 認証済みユーザーが認証ページにアクセスした場合
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/feed', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
