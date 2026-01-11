import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    // Middlewareでの判定をシンプルにするための設定
    authorized({ auth, request: { nextUrl } }) {
      return true; // 判定ロジックは middleware.ts 側で書くのでここは true でOK
    },
  },
  providers: [], // ここは空にする（auth.tsで上書きする）
} satisfies NextAuthConfig;