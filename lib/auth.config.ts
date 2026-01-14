import type { NextAuthConfig } from "next-auth";

// 公開ページ（ログイン不要）
const publicPaths = ['/', '/login', '/register', '/password-reset', '/verify-email']

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname

      // 公開ページかどうか
      const isPublicPage = publicPaths.some((path) =>
        pathname === path || pathname.startsWith(path + '/')
      )

      // APIルートは除外
      const isApiRoute = pathname.startsWith('/api')

      // 静的ファイルは除外
      const isStaticFile = pathname.startsWith('/_next') ||
        pathname.includes('.') // .png, .jpg, etc.

      // 公開ページ、APIルート、静的ファイルは許可
      if (isPublicPage || isApiRoute || isStaticFile) {
        return true
      }

      // それ以外はログインが必要
      return isLoggedIn
    },
  },
  providers: [], // ここは空にする（auth.tsで上書きする）
} satisfies NextAuthConfig;