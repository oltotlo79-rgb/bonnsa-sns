/**
 * @fileoverview ユーザープロフィールページ
 *
 * このファイルは特定のユーザーのプロフィール情報と最近の投稿を表示するページコンポーネントです。
 *
 * 主な機能:
 * - ユーザーの基本情報（ニックネーム、自己紹介、アバター等）の表示
 * - フォロー数、フォロワー数、投稿数のカウント表示
 * - フォロー/ブロック/ミュート状態の管理
 * - 最近の投稿一覧の表示（最大10件）
 * - いいね/ブックマーク状態の表示
 * - SEO用のメタデータ生成（OGP対応）
 * - プロフィール閲覧のアナリティクス記録
 *
 * @route /users/[id]
 * @param {string} id - 表示対象ユーザーのID
 */

// Next.jsのナビゲーションユーティリティ（404ページへのリダイレクト用）
import { notFound } from 'next/navigation'

// Next.jsのメタデータ型定義（SEO設定用）
import { Metadata } from 'next'

// NextAuth.jsの認証ヘルパー（現在のセッション取得用）
import { auth } from '@/lib/auth'

// Prismaデータベースクライアント（ユーザー情報取得用）
import { prisma } from '@/lib/db'

// プレミアム会員判定ユーティリティ
import { isPremiumUser } from '@/lib/premium'

// プロフィール閲覧記録用のServer Action
import { recordProfileView } from '@/lib/actions/analytics'

// ユーザープロフィールヘッダーコンポーネント（アバター、フォローボタン等）
import { ProfileHeader } from '@/components/user/ProfileHeader'

// 投稿カードコンポーネント（個々の投稿表示用）
import { PostCard } from '@/components/post/PostCard'

/**
 * ページコンポーネントのProps型定義
 * Next.js 15以降ではparamsがPromiseとして渡される
 */
type Props = {
  params: Promise<{ id: string }>
}

/**
 * ページのメタデータを動的に生成する関数
 *
 * SEOとソーシャルシェアのためのメタデータを生成します。
 * - ページタイトル: 「{ユーザー名}さんのプロフィール」
 * - OGP（Open Graph Protocol）設定
 * - Twitterカード設定
 *
 * @param {Props} props - ページのプロパティ（ユーザーID含む）
 * @returns {Promise<Metadata>} Next.jsのMetadataオブジェクト
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // パラメータからユーザーIDを取得
  const { id } = await params

  // アプリケーションのベースURLを環境変数から取得（デフォルトは本番URL）
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

  // データベースからユーザーの基本情報を取得（メタデータ用の最小限のフィールドのみ）
  const user = await prisma.user.findUnique({
    where: { id },
    select: { nickname: true, bio: true, avatarUrl: true },
  })

  // ユーザーが存在しない場合のフォールバック
  if (!user) {
    return { title: 'ユーザーが見つかりません' }
  }

  // メタデータ用の値を準備
  const title = `${user.nickname}さんのプロフィール`
  const description = user.bio || `${user.nickname}さんのBON-LOGプロフィールページ`
  const ogImage = user.avatarUrl || '/og-image.jpg'

  // OGP・Twitterカードを含むメタデータオブジェクトを返す
  return {
    title,
    description,
    openGraph: {
      type: 'profile',
      title,
      description,
      url: `${baseUrl}/users/${id}`,
      images: [
        {
          url: ogImage,
          width: 400,
          height: 400,
          alt: `${user.nickname}のアバター`,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [ogImage],
    },
  }
}

/**
 * ユーザープロフィールページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. ユーザー情報の取得とフォロー/ブロック状態の確認
 * 2. ブロック関係のチェックと適切なUI表示
 * 3. 最近の投稿取得といいね/ブックマーク状態の反映
 * 4. プロフィール閲覧のアナリティクス記録
 *
 * @param {Props} props - ページのプロパティ
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function UserProfilePage({ params }: Props) {
  // URLパラメータからユーザーIDを取得
  const { id } = await params

  // 現在ログイン中のユーザーセッションを取得
  const session = await auth()

  // ユーザー情報とカウントを取得（投稿数、フォロワー数、フォロー数）
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          posts: true,      // 投稿数
          followers: true,  // フォロワー数
          following: true,  // フォロー中の数
        },
      },
    },
  })

  // ユーザーが存在しない場合は404ページを表示
  if (!user) {
    notFound()
  }

  // コンポーネントに渡すためにカウント情報を整形
  const userWithCounts = {
    ...user,
    postsCount: user._count.posts,
    followersCount: user._count.followers,
    followingCount: user._count.following,
  }

  // プロフィールの所有者かどうかを判定
  const isOwner = session?.user?.id === user.id

  // プロフィール閲覧を記録（自分以外のプロフィールを見た場合）
  // バックグラウンドで実行し、エラーが発生してもレスポンスをブロックしない
  if (!isOwner && session?.user?.id) {
    recordProfileView(id).catch(() => {})
  }

  // プレミアム会員状態を取得（バッジ表示用）
  const isPremium = await isPremiumUser(id)

  // フォロー/ブロック/ミュート状態の初期値を設定
  let isFollowing = false      // フォロー中か
  let isBlocked = false        // ブロック中か
  let isMuted = false          // ミュート中か
  let isBlockedByUser = false  // 相手からブロックされているか

  // ログイン中かつ他ユーザーのプロフィールを閲覧している場合、関係性を確認
  if (session?.user?.id && !isOwner) {
    // 複数のデータベースクエリを並列実行してパフォーマンスを最適化
    const [follow, block, mute, blockedBy] = await Promise.all([
      // フォロー関係をチェック
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: id,
          },
        },
      }),
      // ブロック関係をチェック（自分が相手をブロックしているか）
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: session.user.id,
            blockedId: id,
          },
        },
      }),
      // ミュート関係をチェック
      prisma.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: session.user.id,
            mutedId: id,
          },
        },
      }),
      // 相手からブロックされているかチェック
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: id,
            blockedId: session.user.id,
          },
        },
      }),
    ])

    // クエリ結果をboolean値に変換
    isFollowing = !!follow
    isBlocked = !!block
    isMuted = !!mute
    isBlockedByUser = !!blockedBy
  }

  // ブロック関係にある場合はプロフィールを表示しない
  // セキュリティとプライバシー保護のため、相互にアクセスを制限
  if (isBlocked || isBlockedByUser) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-lg border p-8 text-center">
          <h1 className="text-xl font-bold mb-2">このページは表示できません</h1>
          <p className="text-muted-foreground">
            {isBlocked
              ? 'このユーザーをブロックしています'
              : 'このユーザーからブロックされています'}
          </p>
        </div>
      </div>
    )
  }

  // 最近の投稿を取得（最大10件）
  // 関連データ（ユーザー情報、メディア、ジャンル、引用/リポスト）も同時に取得
  const posts = await prisma.post.findMany({
    where: { userId: id },
    include: {
      // 投稿者の基本情報
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      // 添付メディア（画像・動画）を並び順で取得
      media: {
        orderBy: { sortOrder: 'asc' },
      },
      // 投稿に紐づくジャンル情報
      genres: {
        include: {
          genre: true,
        },
      },
      // いいね数とコメント数のカウント
      _count: {
        select: { likes: true, comments: true },
      },
      // 引用元の投稿情報
      quotePost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
        },
      },
      // リポスト元の投稿情報（メディア含む）
      repostPost: {
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          media: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },  // 新しい順
    take: 10,  // 最大10件
  })

  // 現在のユーザーがいいね/ブックマークしているかチェック
  const currentUserId = session?.user?.id
  let likedPostIds: Set<string> = new Set()       // いいね済みの投稿IDセット
  let bookmarkedPostIds: Set<string> = new Set()  // ブックマーク済みの投稿IDセット

  // ログイン中かつ投稿が存在する場合、いいね/ブックマーク状態を取得
  if (currentUserId && posts.length > 0) {
    // 表示対象の投稿IDリストを作成
    const postIds = posts.map((p: { id: string }) => p.id)

    // いいねとブックマークを並列で取得
    const [userLikes, userBookmarks] = await Promise.all([
      // 現在のユーザーの投稿へのいいねを取得（コメントへのいいねは除外）
      prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null,
        },
        select: { postId: true },
      }),
      // 現在のユーザーのブックマークを取得
      prisma.bookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ])

    // IDをSetに変換して高速なルックアップを実現
    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
  }

  // 投稿データをPostCardコンポーネントが期待する形式に整形
  const formattedPosts = posts.map((post: typeof posts[number]) => ({
    ...post,
    likeCount: post._count.likes,           // いいね数
    commentCount: post._count.comments,     // コメント数
    genres: post.genres.map((pg: { genre: typeof post.genres[number]['genre'] }) => pg.genre),  // ジャンル配列
    isLiked: likedPostIds.has(post.id),     // いいね済みフラグ
    isBookmarked: bookmarkedPostIds.has(post.id),  // ブックマーク済みフラグ
  }))

  // プロフィールページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* プロフィールヘッダー（アバター、カバー画像、フォローボタン等） */}
      <ProfileHeader
        user={userWithCounts}
        isOwner={isOwner}
        isFollowing={isFollowing}
        isBlocked={isBlocked}
        isMuted={isMuted}
        isPremium={isPremium}
      />

      {/* 投稿一覧セクション */}
      <div className="bg-card rounded-lg border">
        <h2 className="px-4 py-3 font-bold border-b">投稿</h2>

        {/* 投稿がある場合はカードを表示、ない場合は空メッセージ */}
        {formattedPosts && formattedPosts.length > 0 ? (
          <div className="divide-y">
            {formattedPosts.map((post: typeof formattedPosts[number]) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            まだ投稿がありません
          </p>
        )}
      </div>
    </div>
  )
}
