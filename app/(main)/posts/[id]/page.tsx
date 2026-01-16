import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getPost } from '@/lib/actions/post'
import { getComments, getCommentCount } from '@/lib/actions/comment'
import { recordPostView } from '@/lib/actions/analytics'
import { PostCard } from '@/components/post/PostCard'
import { CommentThread } from '@/components/comment'
import Link from 'next/link'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const result = await getPost(id)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

  if (result.error || !result.post) {
    return { title: '投稿が見つかりません' }
  }

  const post = result.post
  const content = post.content || '投稿'
  const truncated = content.length > 100 ? content.slice(0, 100) + '...' : content
  const title = `${post.user.nickname}さんの投稿`

  // 投稿画像があればOG imageに使用
  const ogImage = post.media?.[0]?.url || '/og-image.jpg'

  return {
    title,
    description: truncated,
    openGraph: {
      type: 'article',
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
      publishedTime: post.createdAt?.toString(),
      authors: [post.user.nickname],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: truncated,
      images: [ogImage],
    },
  }
}

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  const [postResult, commentsResult, countResult] = await Promise.all([
    getPost(id),
    getComments(id),
    getCommentCount(id),
  ])

  if (postResult.error || !postResult.post) {
    notFound()
  }

  const post = postResult.post

  // 投稿閲覧を記録（自分以外の投稿を見た場合）
  if (session?.user?.id && post.user.id !== session.user.id) {
    // バックグラウンドで記録（レスポンスをブロックしない）
    recordPostView(post.user.id).catch(() => {})
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <Link href="/feed" className="text-sm text-muted-foreground hover:underline">
            &larr; タイムラインに戻る
          </Link>
        </div>

        <PostCard post={post} currentUserId={session?.user?.id} disableNavigation={true} />

        {/* コメントセクション */}
        <div className="border-t p-4">
          <CommentThread
            postId={id}
            comments={commentsResult.comments || []}
            nextCursor={commentsResult.nextCursor}
            currentUserId={session?.user?.id}
            commentCount={countResult.count}
          />
        </div>
      </div>
    </div>
  )
}
