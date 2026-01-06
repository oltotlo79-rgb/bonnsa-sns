# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3000)
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動
npm run lint     # ESLint実行
```

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript (strict mode)
- **スタイリング**: Tailwind CSS 4 + shadcn/ui
- **状態管理**: React Query (サーバー状態) + Zustand (クライアント状態)
- **BaaS**: Supabase (認証・データベース・ストレージ・リアルタイム)
- **データベース**: PostgreSQL (Supabase)
- **地図**: Leaflet + OpenStreetMap
- **リアルタイム通知**: WebSocket (Socket.io)
- **画像処理**: Sharp

## Next.js App Router ベストプラクティス

### Server Components vs Client Components
- **デフォルトはServer Component**を使用
- `'use client'`は以下の場合のみ使用:
  - `useState`, `useEffect`等のReact Hooks使用時
  - `onClick`, `onChange`等のイベントハンドラ使用時
  - ブラウザAPI（`window`, `localStorage`等）使用時
- Client Componentは**できるだけ末端（リーフ）に配置**し、Server Componentでラップ

```typescript
// ❌ 悪い例: ページ全体をClient Componentにする
'use client'
export default function Page() { ... }

// ✅ 良い例: インタラクティブ部分のみClient Component
// app/posts/page.tsx (Server Component)
export default async function Page() {
  const posts = await getPosts()
  return <PostList posts={posts} /> // Server Component
}

// components/post/LikeButton.tsx (Client Component)
'use client'
export function LikeButton({ postId }: { postId: string }) {
  const [liked, setLiked] = useState(false)
  return <button onClick={() => setLiked(!liked)}>...</button>
}
```

### データフェッチング
- **Server Componentで直接async/await**を使用
- 複数のデータ取得は**Promise.all**で並列実行
- API Routeを経由せず、直接DB/外部APIにアクセス

```typescript
// ✅ Server Componentでの直接フェッチ
export default async function PostPage({ params }: { params: { id: string } }) {
  const [post, comments] = await Promise.all([
    getPost(params.id),
    getComments(params.id)
  ])
  return <PostDetail post={post} comments={comments} />
}
```

### Server Actions
- フォーム送信・データ変更は**Server Actions**を使用
- `'use server'`ディレクティブで定義
- `revalidatePath`/`revalidateTag`でキャッシュ更新

```typescript
// lib/actions/post.ts
'use server'

export async function createPost(formData: FormData) {
  const content = formData.get('content') as string
  await db.post.create({ data: { content } })
  revalidatePath('/feed')
}

// components/post/PostForm.tsx
'use client'
import { createPost } from '@/lib/actions/post'

export function PostForm() {
  return (
    <form action={createPost}>
      <textarea name="content" />
      <button type="submit">投稿</button>
    </form>
  )
}
```

### ファイル規約
各ルートディレクトリで以下のファイルを活用:
- `page.tsx` - ルートのUI
- `layout.tsx` - 共有レイアウト（再レンダリングされない）
- `loading.tsx` - Suspenseフォールバック
- `error.tsx` - エラーバウンダリ（`'use client'`必須）
- `not-found.tsx` - 404ページ

```
app/posts/[id]/
├── page.tsx      # 投稿詳細
├── loading.tsx   # ローディングスケルトン
├── error.tsx     # エラー表示
└── not-found.tsx # 投稿が見つからない場合
```

### Route Groups
- `(フォルダ名)`でURLに影響を与えずにルートを整理
- レイアウトの共有範囲を制御

```
app/
├── (auth)/           # 認証用レイアウト
│   ├── layout.tsx    # 認証ページ専用レイアウト
│   ├── login/
│   └── register/
├── (main)/           # メインアプリレイアウト
│   ├── layout.tsx    # 3カラムレイアウト
│   ├── feed/
│   └── posts/
```

### Metadata
- 静的メタデータは`export const metadata`
- 動的メタデータは`generateMetadata`関数

```typescript
// 静的
export const metadata: Metadata = {
  title: '盆栽SNS',
  description: '盆栽愛好家のためのSNS',
}

// 動的
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.id)
  return { title: post.title }
}
```

### キャッシュ戦略
- `fetch`のデフォルトはキャッシュ有効
- 動的データには`cache: 'no-store'`または`revalidate`を指定
- 認証が必要なデータは`cookies()`/`headers()`使用で自動的に動的に

```typescript
// キャッシュなし（常に最新）
const data = await fetch(url, { cache: 'no-store' })

// 時間ベースの再検証（60秒）
const data = await fetch(url, { next: { revalidate: 60 } })

// ページレベルの再検証設定
export const revalidate = 60
```

### コンポーネント設計原則
1. **Compositionパターン**: Server ComponentからClient Componentに`children`として渡す
2. **データのシリアライズ**: Client Componentに渡すpropsはシリアライズ可能なもののみ
3. **Suspenseの活用**: 重いコンポーネントは`<Suspense>`でラップ

```typescript
// ✅ Compositionパターン
// layout.tsx (Server Component)
export default function Layout({ children }) {
  return (
    <div>
      <ServerSidebar />  {/* Server Component */}
      <ClientWrapper>    {/* Client Component */}
        {children}       {/* Server/Client どちらでもOK */}
      </ClientWrapper>
    </div>
  )
}
```

### Dynamic Routes
- `[id]` - 単一の動的セグメント
- `[...slug]` - キャッチオールセグメント
- `[[...slug]]` - オプショナルキャッチオール

```typescript
// app/posts/[id]/page.tsx
export default async function PostPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)
  return <PostDetail post={post} />
}

// generateStaticParams で静的生成
export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((post) => ({ id: post.id }))
}
```

### Parallel Routes
- `@folder`で同一レイアウト内に複数のページを同時表示
- モーダル、サイドバー、条件付き表示に活用

```
app/
├── @modal/           # モーダル用スロット
│   ├── (.)posts/[id]/page.tsx  # インターセプト
│   └── default.tsx   # デフォルト（何も表示しない）
├── layout.tsx        # {children, modal} を受け取る
└── page.tsx
```

```typescript
// app/layout.tsx
export default function Layout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
```

### Intercepting Routes
- `(.)` - 同じレベル
- `(..)` - 1つ上のレベル
- `(..)(..)` - 2つ上のレベル
- `(...)` - ルートから

```
app/
├── @modal/
│   └── (.)posts/[id]/  # /posts/[id]をインターセプト（モーダル表示）
│       └── page.tsx
└── posts/
    └── [id]/
        └── page.tsx    # 直接アクセス時（フルページ表示）
```

### Route Handlers (API Routes)
- `app/api/`配下に`route.ts`を作成
- HTTP メソッドごとに関数をエクスポート
- Server Actionsで対応できない外部連携やWebhookで使用

```typescript
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = searchParams.get('page') ?? '1'
  const posts = await getPosts(parseInt(page))
  return NextResponse.json(posts)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const post = await createPost(body)
  return NextResponse.json(post, { status: 201 })
}

// app/api/posts/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const post = await getPost(id)
  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(post)
}
```

### Middleware
- `middleware.ts`をプロジェクトルートに配置
- 認証チェック、リダイレクト、ヘッダー操作に使用
- Edge Runtimeで実行される

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')

  // 未認証ユーザーをログインページへリダイレクト
  if (!token && request.nextUrl.pathname.startsWith('/feed')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/feed/:path*', '/posts/:path*', '/settings/:path*']
}
```

### Image最適化
- `next/image`を必ず使用（自動最適化、WebP変換、遅延読み込み）
- 外部画像は`next.config.ts`で許可設定が必要

```typescript
import Image from 'next/image'

// ✅ 良い例
<Image
  src="/profile.jpg"
  alt="プロフィール画像"
  width={200}
  height={200}
  priority  // LCP画像にはpriorityを付与
/>

// 外部画像（Azure Blob Storage）
<Image
  src="https://yourstorage.blob.core.windows.net/images/photo.jpg"
  alt="投稿画像"
  width={600}
  height={400}
  sizes="(max-width: 768px) 100vw, 600px"
/>
```

```typescript
// next.config.ts
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
      },
    ],
  },
}
```

### Link コンポーネント
- 内部リンクは必ず`next/link`を使用（プリフェッチ、クライアントサイドナビゲーション）
- 外部リンクは通常の`<a>`タグ

```typescript
import Link from 'next/link'

// ✅ 内部リンク
<Link href="/posts/123">投稿を見る</Link>
<Link href="/users/456" prefetch={false}>ユーザーページ</Link>

// ✅ 動的パス
<Link href={`/posts/${post.id}`}>{post.title}</Link>

// ❌ 内部リンクでaタグは使わない
<a href="/posts/123">投稿を見る</a>
```

### Streaming と Suspense
- 重いデータ取得を`<Suspense>`でラップして段階的に表示
- `loading.tsx`はページ全体のフォールバック

```typescript
import { Suspense } from 'react'

export default function FeedPage() {
  return (
    <div>
      <h1>タイムライン</h1>
      {/* 軽いコンポーネントは即座に表示 */}
      <PostForm />

      {/* 重いコンポーネントはストリーミング */}
      <Suspense fallback={<PostListSkeleton />}>
        <PostList />  {/* async Server Component */}
      </Suspense>

      <Suspense fallback={<RecommendedUsersSkeleton />}>
        <RecommendedUsers />
      </Suspense>
    </div>
  )
}
```

### エラーハンドリング
- `error.tsx`は`'use client'`必須
- `reset`関数で再試行可能
- `global-error.tsx`でルートレイアウトのエラーをキャッチ

```typescript
// app/posts/[id]/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>エラーが発生しました</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>再試行</button>
    </div>
  )
}
```

```typescript
// not-found.tsx - notFound()関数と連携
import { notFound } from 'next/navigation'

export default async function PostPage({ params }) {
  const post = await getPost(params.id)
  if (!post) {
    notFound()  // not-found.tsx を表示
  }
  return <PostDetail post={post} />
}
```

### Dynamic Import（動的インポート）
- 重いライブラリは`next/dynamic`で遅延読み込み
- SSR不要なコンポーネントは`ssr: false`

```typescript
import dynamic from 'next/dynamic'

// Leaflet地図（SSR不可）
const MapComponent = dynamic(
  () => import('@/components/shop/Map'),
  {
    ssr: false,
    loading: () => <MapSkeleton />
  }
)

// 重いエディタコンポーネント
const RichEditor = dynamic(
  () => import('@/components/common/RichEditor'),
  { loading: () => <EditorSkeleton /> }
)
```

### セキュリティ
- Server Actionsでは必ず認証・認可チェック
- ユーザー入力は必ずバリデーション（zodを推奨）
- 機密情報は環境変数（`NEXT_PUBLIC_`なしはサーバーのみ）

```typescript
// lib/actions/post.ts
'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'

const createPostSchema = z.object({
  content: z.string().min(1).max(500),
  genreIds: z.array(z.string()).max(3),
})

export async function createPost(formData: FormData) {
  // 認証チェック
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  // バリデーション
  const validated = createPostSchema.parse({
    content: formData.get('content'),
    genreIds: formData.getAll('genreIds'),
  })

  // 投稿制限チェック
  const todayPosts = await countTodayPosts(session.user.id)
  if (todayPosts >= 20) {
    throw new Error('1日の投稿上限に達しました')
  }

  await db.post.create({ ... })
  revalidatePath('/feed')
}
```

### パフォーマンス最適化
1. **部分的プリレンダリング（PPR）**: 静的シェル + 動的コンテンツ
2. **React Cache**: 同一リクエスト内でのデータ重複取得を防止
3. **unstable_cache**: リクエスト間でのキャッシュ

```typescript
import { cache } from 'react'
import { unstable_cache } from 'next/cache'

// リクエスト内でメモ化（同じリクエストで複数回呼ばれても1回だけ実行）
export const getUser = cache(async (id: string) => {
  return await db.user.findUnique({ where: { id } })
})

// リクエスト間でキャッシュ
export const getPopularPosts = unstable_cache(
  async () => {
    return await db.post.findMany({
      orderBy: { likeCount: 'desc' },
      take: 10,
    })
  },
  ['popular-posts'],
  { revalidate: 3600 }  // 1時間
)
```

## Supabase + Next.js App Router ベストプラクティス

### インストール

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### クライアント設定

環境ごとに異なるSupabaseクライアントを使い分ける:

```
lib/supabase/
├── client.ts      # ブラウザ用（Client Component）
├── server.ts      # Server Component / Route Handler用
├── middleware.ts  # Middleware用
└── admin.ts       # 管理者用（Service Role）
```

```typescript
// lib/supabase/client.ts - ブラウザ用
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts - Server Component / Route Handler用
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Componentからの呼び出し時は無視
          }
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/middleware.ts - Middleware用
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // セッション更新（重要：getUser()を必ず呼ぶ）
  const { data: { user } } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
```

```typescript
// lib/supabase/admin.ts - Service Role用（サーバーサイドのみ）
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // 公開禁止！
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
```

### Middleware認証

```typescript
// middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  // 認証が必要なルートの保護
  const protectedPaths = ['/feed', '/posts', '/settings', '/notifications']
  const isProtected = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // 認証済みユーザーのログインページアクセス
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Server Component でのデータ取得

```typescript
// app/(main)/feed/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function FeedPage() {
  const supabase = await createClient()

  // 認証チェック
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // データ取得
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(id, nickname, avatar_url),
      likes(count),
      comments(count)
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  return <PostList posts={posts} />
}
```

### Server Actions での使用

```typescript
// lib/actions/post.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createPostSchema = z.object({
  content: z.string().min(1).max(500),
  genreIds: z.array(z.string()).max(3),
})

export async function createPost(formData: FormData) {
  const supabase = await createClient()

  // 認証チェック
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ログインが必要です' }
  }

  // バリデーション
  const result = createPostSchema.safeParse({
    content: formData.get('content'),
    genreIds: formData.getAll('genreIds'),
  })

  if (!result.success) {
    return { error: result.error.flatten() }
  }

  // 投稿制限チェック
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', today)

  if (count && count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  // 投稿作成
  const { error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      content: result.data.content,
    })

  if (error) {
    return { error: '投稿に失敗しました' }
  }

  revalidatePath('/feed')
  return { success: true }
}
```

### Client Component での使用

```typescript
// components/post/LikeButton.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useOptimistic } from 'react'

export function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: {
  postId: string
  initialLiked: boolean
  initialCount: number
}) {
  const supabase = createClient()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)

  async function toggleLike() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Optimistic update
    setLiked(!liked)
    setCount(prev => liked ? prev - 1 : prev + 1)

    if (liked) {
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: user.id })
    }
  }

  return (
    <button onClick={toggleLike}>
      {liked ? '❤️' : '🤍'} {count}
    </button>
  )
}
```

### 認証フロー

```typescript
// app/(auth)/login/page.tsx
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return <LoginForm />
}
```

```typescript
// components/auth/LoginForm.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      return
    }

    router.push('/feed')
    router.refresh()  // Server Componentを再レンダリング
  }

  return (
    <form action={handleLogin}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit">ログイン</button>
    </form>
  )
}
```

```typescript
// OAuth認証
async function handleGoogleLogin() {
  const supabase = createClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${location.origin}/auth/callback`,
    },
  })
}
```

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/feed'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

### リアルタイムサブスクリプション

```typescript
// components/notification/NotificationListener.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function NotificationListener({ userId }: { userId: string }) {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // 新しい通知を受信
          console.log('新しい通知:', payload.new)
          router.refresh()  // Server Componentを再取得
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, router, supabase])

  return null
}
```

```typescript
// タイムラインのリアルタイム更新
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function RealtimePosts({ initialPosts }: { initialPosts: Post[] }) {
  const supabase = createClient()
  const [posts, setPosts] = useState(initialPosts)

  useEffect(() => {
    const channel = supabase
      .channel('posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          // 新しい投稿をフェッチ（リレーション含む）
          const { data } = await supabase
            .from('posts')
            .select('*, user:users(*)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setPosts(prev => [data, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return <PostList posts={posts} />
}
```

### Storage（画像・動画アップロード）

```typescript
// lib/actions/upload.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export async function uploadImage(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  // ファイルサイズチェック（5MB）
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'ファイルサイズは5MB以下にしてください' }
  }

  // MIMEタイプチェック
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: '対応していないファイル形式です' }
  }

  const ext = file.name.split('.').pop()
  const fileName = `${user.id}/${uuidv4()}.${ext}`

  const { error } = await supabase.storage
    .from('post-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    return { error: 'アップロードに失敗しました' }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('post-images')
    .getPublicUrl(fileName)

  return { url: publicUrl }
}
```

```typescript
// components/post/ImageUploader.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export function ImageUploader({
  onUpload,
}: {
  onUpload: (url: string) => void
}) {
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`

    const { error } = await supabase.storage
      .from('post-images')
      .upload(fileName, file)

    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName)
      onUpload(publicUrl)
    }

    setUploading(false)
  }

  return (
    <input
      type="file"
      accept="image/*"
      onChange={handleUpload}
      disabled={uploading}
    />
  )
}
```

### Row Level Security (RLS)

```sql
-- Supabase SQL Editor で設定

-- ユーザーは自分のプロフィールのみ編集可能
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 公開投稿は誰でも閲覧可能
CREATE POLICY "Public posts are viewable by everyone"
ON posts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = posts.user_id
    AND users.is_public = true
  )
);

-- 投稿は本人のみ削除可能
CREATE POLICY "Users can delete own posts"
ON posts FOR DELETE
USING (auth.uid() = user_id);

-- フォロワーのみ非公開ユーザーの投稿を閲覧可能
CREATE POLICY "Followers can view private posts"
ON posts FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM follows
    WHERE follows.follower_id = auth.uid()
    AND follows.following_id = posts.user_id
  )
);
```

### 型生成

```bash
# Supabase CLIで型を生成
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts
```

```typescript
// types/supabase.ts の使用例
import { Database } from '@/types/supabase'

type Post = Database['public']['Tables']['posts']['Row']
type PostInsert = Database['public']['Tables']['posts']['Insert']
type PostUpdate = Database['public']['Tables']['posts']['Update']
```

### 環境変数

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...  # 公開可能
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...      # サーバーのみ、公開禁止！
```

### next.config.ts 設定

```typescript
// next.config.ts
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

export default nextConfig
```

## アーキテクチャ

### ディレクトリ構成（予定）
```
app/
├── (auth)/           # 認証関連ページ (login, register)
├── (main)/           # メインレイアウト
│   ├── feed/         # タイムライン
│   ├── posts/        # 投稿詳細
│   ├── users/        # ユーザープロフィール
│   ├── search/       # 検索
│   ├── shops/        # 盆栽園マップ
│   ├── events/       # イベント
│   └── notifications/# 通知
├── admin/            # 管理者ダッシュボード
└── api/              # APIルート
    ├── auth/
    ├── users/
    ├── posts/
    ├── comments/
    ├── shops/
    ├── events/
    ├── notifications/
    └── admin/
components/
├── ui/               # shadcn/uiコンポーネント
├── post/             # 投稿関連
├── user/             # ユーザー関連
├── shop/             # 盆栽園関連
├── event/            # イベント関連
└── common/           # 共通コンポーネント
lib/
├── supabase/         # Supabaseクライアント
│   ├── client.ts     # ブラウザ用
│   ├── server.ts     # Server Component用
│   ├── middleware.ts # Middleware用
│   └── admin.ts      # Service Role用
├── actions/          # Server Actions
└── utils/            # ユーティリティ
types/
└── supabase.ts       # Supabase型定義（自動生成）
```

### データベース主要テーブル
- `users` - ユーザー情報
- `posts` - 投稿（テキスト500文字、画像4枚or動画1本）
- `post_genres` - 投稿ジャンル（最大3つ、松柏類・雑木類等）
- `comments` - コメント（スレッド形式）
- `likes` - いいね（投稿・コメント両対応）
- `follows` - フォロー関係
- `bonsai_shops` - 盆栽園（Googleマップ方式のレビュー）
- `events` - イベント（カレンダー表示、地域フィルタ）
- `notifications` - 通知
- `reports` - 通報

### API設計パターン
- RESTful API (Next.js API Routes)
- 認証: `/api/auth/*`
- リソース操作: `/api/{resource}`, `/api/{resource}/:id`
- ネスト: `/api/posts/:id/comments`, `/api/shops/:id/reviews`

## 主要機能

### 投稿機能
- 1日20件まで、コメント100件まで（スパム対策）
- ジャンル選択必須（松柏類、雑木類、用品・道具、施設・イベント等）
- 引用投稿・リポスト対応

### 盆栽園マップ
- Leaflet + OpenStreetMap使用
- 同一盆栽園の重複登録は自動マージ
- レビュー：星5段階 + テキスト + 画像3枚

### イベント
- カレンダー表示
- 地域フィルタ（都道府県/地方ブロック）
- 終了イベントは自動非表示

## UI/UXガイドライン

- **デザイン方向性**: 和風、落ち着いた色調（緑、茶、ベージュ系）
- **レイアウト**:
  - デスクトップ: 3カラム（左ナビ、中央コンテンツ、右サイドバー）
  - モバイル: 1カラム + ボトムナビ
- **参考**: X（旧Twitter）のシンプルなUI + 和のテイスト

## パスエイリアス

`@/*` でプロジェクトルートからインポート可能。

```typescript
import { Component } from "@/components/ui/Component";
import { db } from "@/lib/db";
```

## 環境変数（設定予定）

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...  # 公開可能
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...      # サーバーのみ、公開禁止！

# アプリケーション
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
