# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3000)
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動
npm run lint     # ESLint実行

# Prisma
npx prisma generate   # Prismaクライアント生成
npx prisma db push    # スキーマをDBに反映（開発用）
npx prisma migrate dev # マイグレーション作成・実行（開発用）
npx prisma studio     # DB管理GUI起動

# Docker（PostgreSQLのみ起動 - 推奨）
docker compose up -d postgres  # PostgreSQLのみ起動
docker compose down            # コンテナ停止
docker compose down -v         # コンテナ停止 + データ削除
docker compose logs -f         # ログ確認

# Docker（開発環境フル起動）
docker compose --profile dev up -d    # PostgreSQL + Next.js(dev)起動
docker compose --profile dev down     # コンテナ停止

# Docker（本番ビルド・テスト）
docker compose --profile prod up -d   # PostgreSQL + Next.js(prod)起動
docker build -t bonsai-sns .          # イメージのみビルド

# ヘルスチェック
curl http://localhost:3000/api/health

# テスト
npm test                # ユニットテスト
npm run test:coverage   # カバレッジ付き
npm run test:e2e        # E2Eテスト
npm run test:all        # 全テスト実行
```

## CI/CD（GitHub Actions）

プルリクエスト・mainブランチへのプッシュ時に自動実行:

| ジョブ | 内容 | 実行タイミング |
|--------|------|--------------|
| lint | ESLint + TypeScript型チェック | 常時 |
| test | ユニットテスト | 常時 |
| build | ビルド確認 | 常時 |
| e2e | E2Eテスト（Playwright） | mainのみ |

ワークフロー: `.github/workflows/ci.yml`

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript (strict mode)
- **スタイリング**: Tailwind CSS 4 + shadcn/ui
- **状態管理**: React Query (サーバー状態) + Zustand (クライアント状態)
- **ORM**: Prisma
- **データベース**: PostgreSQL (開発: Docker / 本番: Azure Database for PostgreSQL)
- **認証**: NextAuth.js (Auth.js v5)
- **ストレージ**: Azure Blob Storage（本番）
- **コンテナ**: Docker + Docker Compose
- **デプロイ**: Azure Container Apps
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

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const content = formData.get('content') as string
  await prisma.post.create({
    data: {
      userId: session.user.id,
      content,
    },
  })
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
  title: 'BON-LOG',
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
import { auth } from '@/lib/auth'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isProtected = ['/feed', '/posts', '/settings'].some(path =>
    req.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
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
import { prisma } from '@/lib/db'

const createPostSchema = z.object({
  content: z.string().min(1).max(500),
  genreIds: z.array(z.string()).max(3),
})

export async function createPost(formData: FormData) {
  // 認証チェック
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // バリデーション
  const result = createPostSchema.safeParse({
    content: formData.get('content'),
    genreIds: formData.getAll('genreIds'),
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  // 投稿制限チェック
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.post.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today },
    },
  })

  if (count >= 20) {
    return { error: '1日の投稿上限に達しました' }
  }

  await prisma.post.create({ ... })
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
  return await prisma.user.findUnique({ where: { id } })
})

// リクエスト間でキャッシュ
export const getPopularPosts = unstable_cache(
  async () => {
    return await prisma.post.findMany({
      orderBy: { likes: { _count: 'desc' } },
      take: 10,
    })
  },
  ['popular-posts'],
  { revalidate: 3600 }  // 1時間
)
```

## Prisma + PostgreSQL ベストプラクティス

### セットアップ

```bash
# Prismaのインストール
npm install prisma @prisma/client

# 初期化（既存プロジェクト）
npx prisma init
```

### Prismaクライアント設定

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### スキーマ定義

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime? @map("email_verified")
  password      String?
  nickname      String
  avatarUrl     String?   @map("avatar_url")
  headerUrl     String?   @map("header_url")
  bio           String?
  location      String?
  isPublic      Boolean   @default(true) @map("is_public")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  posts         Post[]
  comments      Comment[]
  likes         Like[]
  bookmarks     Bookmark[]
  followers     Follow[]   @relation("following")
  following     Follow[]   @relation("follower")
  notifications Notification[] @relation("user")
  actorNotifications Notification[] @relation("actor")

  @@map("users")
}

model Post {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  content      String?
  quotePostId  String?  @map("quote_post_id")
  repostPostId String?  @map("repost_post_id")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  quotePost    Post?    @relation("quotes", fields: [quotePostId], references: [id])
  quotedBy     Post[]   @relation("quotes")
  repostPost   Post?    @relation("reposts", fields: [repostPostId], references: [id])
  repostedBy   Post[]   @relation("reposts")
  media        PostMedia[]
  genres       PostGenre[]
  comments     Comment[]
  likes        Like[]
  bookmarks    Bookmark[]

  @@map("posts")
}
```

### クエリパターン

```typescript
// 基本的なCRUD
// 作成
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    nickname: 'テストユーザー',
  },
})

// 読み取り（単一）
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    user: { select: { id: true, nickname: true, avatarUrl: true } },
    _count: { select: { likes: true, comments: true } },
  },
})

// 読み取り（複数）
const posts = await prisma.post.findMany({
  where: { userId: session.user.id },
  orderBy: { createdAt: 'desc' },
  take: 20,
  include: {
    user: true,
    media: { orderBy: { sortOrder: 'asc' } },
  },
})

// 更新
await prisma.user.update({
  where: { id: session.user.id },
  data: { nickname: 'New Name' },
})

// 削除
await prisma.post.delete({
  where: { id: postId },
})
```

### リレーション操作

```typescript
// ネストした作成
const post = await prisma.post.create({
  data: {
    userId: session.user.id,
    content: 'Hello World',
    media: {
      create: [
        { url: '/image1.jpg', type: 'image', sortOrder: 0 },
        { url: '/image2.jpg', type: 'image', sortOrder: 1 },
      ],
    },
    genres: {
      create: [
        { genreId: 'genre1' },
        { genreId: 'genre2' },
      ],
    },
  },
})

// リレーションのカウント
const postsWithCounts = await prisma.post.findMany({
  include: {
    _count: {
      select: { likes: true, comments: true },
    },
  },
})
// postsWithCounts[0]._count.likes でアクセス
```

### トランザクション

```typescript
// 複数操作をアトミックに実行
const [post, notification] = await prisma.$transaction([
  prisma.post.create({
    data: { userId: session.user.id, content: 'Hello' },
  }),
  prisma.notification.create({
    data: {
      userId: targetUserId,
      actorId: session.user.id,
      type: 'mention',
    },
  }),
])

// インタラクティブトランザクション
await prisma.$transaction(async (tx) => {
  const post = await tx.post.findUnique({ where: { id: postId } })
  if (!post) throw new Error('Post not found')

  await tx.like.create({
    data: { postId, userId: session.user.id },
  })
})
```

### ページネーション（カーソルベース）

```typescript
export async function getPosts(cursor?: string, limit = 20) {
  const posts = await prisma.post.findMany({
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // カーソル自体をスキップ
    }),
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true } },
    },
  })

  const hasMore = posts.length === limit
  const nextCursor = hasMore ? posts[posts.length - 1]?.id : undefined

  return { posts, nextCursor }
}
```

### マイグレーション

```bash
# 開発環境: スキーマを直接反映
npx prisma db push

# 本番環境: マイグレーションファイル作成
npx prisma migrate dev --name add_user_fields

# 本番デプロイ時
npx prisma migrate deploy
```

## NextAuth.js (Auth.js v5) 認証

### セットアップ

```bash
npm install next-auth@beta @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs
```

### 認証設定

```typescript
// lib/auth.ts
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

### 型拡張

```typescript
// types/next-auth.d.ts
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}
```

### APIルート

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

### Middleware

```typescript
// middleware.ts
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

### Server Actionsでの認証チェック

```typescript
// lib/actions/post.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // session.user.id でユーザーIDにアクセス可能
  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      content: formData.get('content') as string,
    },
  })

  return { success: true, postId: post.id }
}
```

### ログイン・ログアウト

```typescript
// components/auth/LoginForm.tsx
'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirect: false,
    })

    if (result?.error) {
      setError('メールアドレスまたはパスワードが正しくありません')
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
      <button type="submit">ログイン</button>
    </form>
  )
}
```

```typescript
// components/auth/LogoutButton.tsx
'use client'

import { signOut } from 'next-auth/react'

export function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/login' })}>
      ログアウト
    </button>
  )
}
```

### セッションプロバイダー

```typescript
// app/providers.tsx
'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}

// app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

## アーキテクチャ

### ディレクトリ構成
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
└── api/
    └── auth/
        └── [...nextauth]/  # NextAuth.js APIルート
components/
├── ui/               # shadcn/uiコンポーネント
├── post/             # 投稿関連
├── user/             # ユーザー関連
├── shop/             # 盆栽園関連
├── event/            # イベント関連
├── auth/             # 認証関連
└── common/           # 共通コンポーネント
lib/
├── db.ts             # Prismaクライアント
├── auth.ts           # NextAuth.js設定
├── actions/          # Server Actions
└── utils/            # ユーティリティ
prisma/
├── schema.prisma     # データベーススキーマ
└── migrations/       # マイグレーションファイル
types/
└── next-auth.d.ts    # NextAuth.js型拡張
```

### データベース主要テーブル
- `users` - ユーザー情報
- `accounts` - OAuth連携（NextAuth.js用）
- `sessions` - セッション（JWT使用時は不要）
- `posts` - 投稿（テキスト500文字、画像4枚or動画1本）
- `post_media` - 投稿メディア
- `post_genres` - 投稿ジャンル（最大3つ）
- `genres` - ジャンルマスタ
- `comments` - コメント（スレッド形式）
- `likes` - いいね（投稿・コメント両対応）
- `bookmarks` - ブックマーク
- `follows` - フォロー関係
- `blocks` - ブロック
- `mutes` - ミュート
- `bonsai_shops` - 盆栽園
- `shop_reviews` - 盆栽園レビュー
- `events` - イベント
- `notifications` - 通知
- `reports` - 通報

### API設計パターン
- Server Actions優先（フォーム送信、データ変更）
- Route Handlersは外部連携・Webhook用
- 認証: NextAuth.js `/api/auth/*`

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
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
```

## 環境変数

```bash
# データベース
DATABASE_URL="postgresql://user:password@localhost:5432/bonsai_sns?schema=public"

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here  # openssl rand -base64 32 で生成

# Azure Blob Storage（本番用）
AZURE_STORAGE_ACCOUNT_NAME=yourstorageaccount
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
AZURE_STORAGE_CONTAINER_NAME=uploads

# アプリケーション
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 開発環境セットアップ

### 方法1: Docker Composeで一括起動（推奨）

```bash
# 1. Docker Desktopをインストール・起動
# https://www.docker.com/products/docker-desktop/

# 2. 環境変数ファイルをコピー
cp .env.local.example .env.local

# 3. PostgreSQL + Next.jsを一括起動
docker compose up -d

# 4. ブラウザでアクセス
# http://localhost:3000

# 5. 停止
docker compose down

# データも削除する場合
docker compose down -v
```

### 方法2: PostgreSQLのみDockerで起動

```bash
# 1. PostgreSQLコンテナのみ起動
docker compose up -d postgres

# 2. 環境変数設定
cp .env.local.example .env.local

# 3. 依存関係インストール
npm install

# 4. Prismaクライアント生成
npx prisma generate

# 5. データベースにスキーマを反映
npx prisma db push

# 6. シードデータ投入（任意）
npx prisma db seed

# 7. 開発サーバー起動
npm run dev
```

### 方法3: ローカルPostgreSQLを使用

```bash
# 1. ローカルPostgreSQLを起動

# 2. 環境変数設定（DATABASE_URLを自分の環境に合わせて変更）
cp .env.local.example .env.local

# 3. 依存関係インストール
npm install

# 4. Prismaクライアント生成
npx prisma generate

# 5. データベースにスキーマを反映
npx prisma db push

# 6. シードデータ投入（任意）
npx prisma db seed

# 7. 開発サーバー起動
npm run dev
```
