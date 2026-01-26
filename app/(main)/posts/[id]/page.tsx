/**
 * @file 投稿詳細ページ
 * @description 個別の投稿とそのコメントを表示するページ
 *
 * このファイルは[id]動的ルートパラメータを使用して、
 * 特定の投稿の詳細情報を表示します。
 *
 * @features
 * - 投稿内容の詳細表示（テキスト、画像、動画）
 * - 動的OGP/メタデータ生成（SNSシェア対応）
 * - コメントスレッド表示
 * - ソーシャルシェアボタン
 * - 広告バナー表示
 * - 投稿閲覧の分析記録
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes
 */

// Next.jsの404ページ表示関数
// 投稿が見つからない場合に使用
import { notFound } from 'next/navigation'

// Next.jsのメタデータ型定義
// 動的メタデータ生成に使用
import { Metadata } from 'next'

// NextAuth.jsの認証ヘルパー関数
// コメント投稿権限の確認等に使用
import { auth } from '@/lib/auth'

// 投稿データ取得のServer Action
import { getPost } from '@/lib/actions/post'

// コメント関連のServer Actions
// コメント一覧取得とコメント数取得
import { getComments, getCommentCount } from '@/lib/actions/comment'

// 投稿閲覧記録のServer Action
// 分析機能用に閲覧履歴を記録
import { recordPostView } from '@/lib/actions/analytics'

// 投稿カードコンポーネント
// 投稿のメイン表示部分
import { PostCard } from '@/components/post/PostCard'

// ソーシャルシェアボタンコンポーネント
// Twitter(X)、Facebook等への共有機能
import { ShareButtons } from '@/components/post/ShareButtons'

// コメントスレッドコンポーネント
// コメント一覧表示とコメント投稿機能
import { CommentThread } from '@/components/comment'

// 広告バナーコンポーネント
// Google AdSense等の広告表示
import { AdBanner } from '@/components/ads'

// Next.jsのリンクコンポーネント
// クライアントサイドナビゲーション用
import Link from 'next/link'

// SEO用のJSON-LD構造化データコンポーネント
import { ArticleJsonLd } from '@/components/seo/JsonLd'

/**
 * ページパラメータの型定義
 * Next.js 15以降ではparamsはPromiseとして渡される
 */
type Props = {
  params: Promise<{ id: string }>
}

/**
 * 動的メタデータ生成関数
 *
 * 投稿内容に基づいてOGP（Open Graph Protocol）メタデータを動的に生成します。
 * これによりSNSでシェアされた際に、投稿内容のプレビューが正しく表示されます。
 *
 * 生成されるメタデータ:
 * - title: 投稿者名を含むタイトル
 * - description: 投稿内容の先頭100文字
 * - OpenGraph: 記事タイプ、画像、公開日時
 * - Twitter Card: 大きな画像付きカード形式
 *
 * @param params - 動的ルートパラメータ（投稿ID）
 * @returns メタデータオブジェクト
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const result = await getPost(id)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

  // 投稿が見つからない場合のフォールバックメタデータ
  if (result.error || !result.post) {
    return { title: '投稿が見つかりません' }
  }

  const post = result.post
  // 投稿内容をdescription用に100文字以内に切り詰め
  const content = post.content || '投稿'
  const truncated = content.length > 100 ? content.slice(0, 100) + '...' : content
  const title = `${post.user.nickname}さんの投稿`

  // OG画像として投稿の最初のメディアを使用（なければデフォルト画像）
  const ogImage = post.media?.[0]?.url || '/og-image.jpg'

  return {
    title,
    description: truncated,
    openGraph: {
      type: 'article',            // 記事タイプを指定
      title,
      description: truncated,
      url: `${baseUrl}/posts/${id}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      publishedTime: post.createdAt?.toString(),  // 投稿日時
      authors: [post.user.nickname],              // 投稿者名
    },
    twitter: {
      card: 'summary_large_image',  // 大きな画像付きカード形式
      title,
      description: truncated,
      images: [ogImage],
    },
    // 正規URLを指定（重複コンテンツ対策）
    alternates: {
      canonical: `${baseUrl}/posts/${id}`,
    },
  }
}

/**
 * 投稿詳細ページコンポーネント
 *
 * 個別の投稿とそのコメントを表示するServer Componentです。
 * 複数のデータ取得を並列実行してパフォーマンスを最適化しています。
 *
 * @param params - 動的ルートパラメータ（投稿ID）
 * @returns 投稿詳細ページのJSX要素
 */
export default async function PostDetailPage({ params }: Props) {
  // URLパラメータから投稿IDを取得
  const { id } = await params
  // 現在のセッション情報を取得
  const session = await auth()

  // 投稿データ、コメント一覧、コメント数を並列取得
  const [postResult, commentsResult, countResult] = await Promise.all([
    getPost(id),              // 投稿データ取得
    getComments(id),          // コメント一覧取得（ページネーション対応）
    getCommentCount(id),      // 総コメント数取得
  ])

  // 投稿が見つからない場合は404ページを表示
  if (postResult.error || !postResult.post) {
    notFound()
  }

  const post = postResult.post
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

  // 投稿閲覧を分析用に記録
  // 自分以外の投稿を閲覧した場合のみ記録（自己閲覧は除外）
  if (session?.user?.id && post.user.id !== session.user.id) {
    // バックグラウンドで非同期実行（レスポンスをブロックしない）
    // エラーが発生しても握りつぶして処理を継続
    recordPostView(post.user.id).catch(() => {})
  }

  return (
    <>
      {/* SEO用のJSON-LD構造化データ（Article） */}
      <ArticleJsonLd
        headline={post.content ? (post.content.length > 100 ? post.content.slice(0, 100) + '...' : post.content) : '投稿'}
        datePublished={post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString()}
        author={{
          name: post.user.nickname,
          url: `${baseUrl}/users/${post.user.id}`,
        }}
        url={`${baseUrl}/posts/${id}`}
        image={post.media?.[0]?.url}
        description={post.content ? (post.content.length > 150 ? post.content.slice(0, 150) + '...' : post.content) : undefined}
      />
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border overflow-hidden">
        {/* ナビゲーションリンク - タイムラインへ戻る */}
        <div className="px-4 py-3 border-b">
          <Link href="/feed" className="text-sm text-muted-foreground hover:underline">
            &larr; タイムラインに戻る
          </Link>
        </div>

        {/* 投稿カード本体
            disableNavigation=trueで、カードクリックによるナビゲーションを無効化
            （既に詳細ページにいるため） */}
        <PostCard post={post} currentUserId={session?.user?.id} disableNavigation={true} />

        {/* シェアボタンセクション
            Twitter(X)、Facebook、コピーリンク等のシェア機能 */}
        <div className="border-t px-4 py-3">
          <ShareButtons
            url={`${process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'}/posts/${id}`}
            title={`${post.user.nickname}さんの投稿 | BON-LOG`}
            text={post.content ? (post.content.length > 100 ? post.content.slice(0, 100) + '...' : post.content) : ''}
          />
        </div>

        {/* 広告スペース
            Google AdSense等の広告を表示するエリア */}
        <div className="border-t p-4 flex justify-center">
          <AdBanner
            adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_POST_DETAIL}
            size="responsive"
            format="auto"
          />
        </div>

        {/* コメントセクション
            コメント一覧表示とコメント投稿フォームを含む */}
        <div className="border-t p-4">
          <CommentThread
            postId={id}
            comments={commentsResult.comments || []}    // コメント一覧
            nextCursor={commentsResult.nextCursor}      // ページネーション用カーソル
            currentUserId={session?.user?.id}           // 現在のユーザーID
            commentCount={countResult.count}            // 総コメント数
          />
        </div>
      </div>
    </div>
    </>
  )
}
