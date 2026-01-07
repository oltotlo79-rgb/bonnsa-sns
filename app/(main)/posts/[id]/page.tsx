import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPost } from '@/lib/actions/post'
import { getComments, getCommentCount } from '@/lib/actions/comment'
import { PostCard } from '@/components/post/PostCard'
import { CommentThread } from '@/components/comment'
import Link from 'next/link'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const result = await getPost(id)

  if (result.error || !result.post) {
    return { title: '投稿が見つかりません' }
  }

  const content = result.post.content || '投稿'
  const truncated = content.length > 50 ? content.slice(0, 50) + '...' : content

  return {
    title: `${result.post.user.nickname}: "${truncated}" - BON-LOG`,
  }
}

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [postResult, commentsResult, countResult] = await Promise.all([
    getPost(id),
    getComments(id),
    getCommentCount(id),
  ])

  if (postResult.error || !postResult.post) {
    notFound()
  }

  const post = postResult.post

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <Link href="/feed" className="text-sm text-muted-foreground hover:underline">
            &larr; タイムラインに戻る
          </Link>
        </div>

        <PostCard post={post} currentUserId={user?.id} />

        {/* コメントセクション */}
        <div className="border-t p-4">
          <CommentThread
            postId={id}
            comments={commentsResult.comments || []}
            nextCursor={commentsResult.nextCursor}
            currentUserId={user?.id}
            commentCount={countResult.count}
          />
        </div>
      </div>
    </div>
  )
}
