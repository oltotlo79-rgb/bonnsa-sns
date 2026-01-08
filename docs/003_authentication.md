# 003: 認証システム

## 概要
NextAuth.js (Auth.js v5) を使用したユーザー認証機能を実装する。
メールアドレス + パスワードによる認証（Credentials Provider）。メール認証は不要。

## 優先度
**最高** - Phase 1

## 依存チケット
- 001: プロジェクトセットアップ
- 002: データベーススキーマ設計

---

## Todo

### NextAuth.jsセットアップ
- [x] `next-auth@beta` インストール
- [x] `@auth/prisma-adapter` インストール
- [x] `bcryptjs` インストール（パスワードハッシュ用）
- [x] `@types/bcryptjs` インストール

### 認証設定ファイル
- [x] `lib/auth.ts` - NextAuth.js設定
  - [x] PrismaAdapterの設定
  - [x] JWT セッション戦略
  - [x] Credentials Providerの設定
  - [x] コールバック設定（jwt, session）
- [x] `app/api/auth/[...nextauth]/route.ts` - APIルート
- [x] `types/next-auth.d.ts` - 型拡張（session.user.id追加）

### 認証ページUI
- [x] `app/(auth)/layout.tsx` - 認証ページ用レイアウト
- [x] `app/(auth)/login/page.tsx` - ログインページ
- [x] `app/(auth)/register/page.tsx` - 新規登録ページ
- [x] `app/(auth)/password-reset/page.tsx` - パスワードリセット依頼ページ
- [x] `app/(auth)/password-reset/confirm/page.tsx` - パスワードリセット実行ページ

### 認証コンポーネント
- [x] `components/auth/LoginForm.tsx` - ログインフォーム
- [x] `components/auth/RegisterForm.tsx` - 新規登録フォーム
- [x] `components/auth/PasswordResetForm.tsx` - パスワードリセットフォーム
- [x] `components/auth/PasswordResetConfirmForm.tsx` - 新パスワード設定フォーム
- [x] `components/auth/LogoutButton.tsx` - ログアウトボタン

### 認証ロジック
- [x] ログイン処理 (`signIn('credentials', ...)`)
- [x] 新規登録処理 (`registerUser` Server Action)
  - [x] メール重複チェック
  - [x] パスワードハッシュ化（bcrypt）
  - [x] ユーザー作成
- [x] ログアウト処理 (`signOut`)
- [ ] パスワードリセットメール送信（TODO: メール送信実装が必要）
- [ ] 新パスワード設定（TODO: トークン検証が必要）

### Middleware認証
- [x] `middleware.ts` - NextAuth.js auth() ラッパー
- [x] 保護ルート定義 (`/feed`, `/posts`, `/settings`等)
- [x] 未認証時のリダイレクト処理
- [x] 認証済みユーザーのログインページリダイレクト

### セッション管理
- [x] Server Componentでのユーザー取得 (`auth()`)
- [x] Client Componentでのユーザー取得 (`useSession`)
- [x] SessionProviderの設定
- [x] JWTベースのセッション（サーバーサイドDBセッション不要）

### バリデーション
- [x] メールアドレス形式チェック
- [x] パスワード強度チェック（最低8文字）
- [x] ニックネーム必須チェック
- [x] エラーメッセージ日本語化

### UI/UX
- [x] ローディング状態の表示
- [x] エラーメッセージの表示
- [x] 成功時のリダイレクト
- [x] フォームのアクセシビリティ対応

### テスト
- [x] ログイン成功テスト
- [x] ログイン失敗テスト（間違ったパスワード）
- [x] 新規登録成功テスト
- [x] 重複メールアドレスエラーテスト
- [ ] パスワードリセットフローテスト（TODO）
- [x] 未認証ユーザーの保護ルートアクセス制限テスト
- [x] 認証済みユーザーのログインページリダイレクトテスト

---

## 完了条件
- [x] 新規登録が正常に動作する
- [x] ログイン/ログアウトが正常に動作する
- [ ] パスワードリセットが正常に動作する（TODO）
- [x] 未認証ユーザーが保護ルートにアクセスできない
- [x] 認証済みユーザーがログインページにアクセスするとリダイレクトされる

## 参考コード

### lib/auth.ts
```typescript
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) {
          return null
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.nickname,
          image: user.avatarUrl,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})

// ユーザー登録関数
export async function registerUser(data: {
  email: string
  password: string
  nickname: string
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  })

  if (existingUser) {
    return { error: 'このメールアドレスは既に登録されています' }
  }

  const hashedPassword = await bcrypt.hash(data.password, 10)

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      nickname: data.nickname,
    },
  })

  return { success: true, userId: user.id }
}
```

### middleware.ts
```typescript
import { auth } from '@/lib/auth'

export default auth((req) => {
  const isLoggedIn = !!req.auth

  const protectedPaths = ['/feed', '/posts', '/settings', '/notifications', '/bookmarks', '/users']
  const authPaths = ['/login', '/register']

  const isProtected = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  )
  const isAuthPage = authPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !isLoggedIn) {
    const redirectUrl = new URL('/login', req.nextUrl)
    redirectUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return Response.redirect(redirectUrl)
  }

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL('/feed', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

### components/auth/LoginForm.tsx
```typescript
'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirect: false,
    })

    if (result?.error) {
      setError('メールアドレスまたはパスワードが間違っています')
      setLoading(false)
      return
    }

    router.push('/feed')
    router.refresh()
  }

  return (
    <form action={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  )
}
```

### Server Actionsでの認証チェック
```typescript
// lib/actions/user.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const nickname = formData.get('nickname') as string
  const bio = formData.get('bio') as string

  await prisma.user.update({
    where: { id: session.user.id },
    data: { nickname, bio },
  })

  return { success: true }
}
```
