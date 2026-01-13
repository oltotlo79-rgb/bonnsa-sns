'use client'

import { useRouter } from 'next/navigation'
import { CommentForm } from './CommentForm'
import { CommentList } from './CommentList'

type Comment = {
  id: string
  content: string
  createdAt: string | Date
  parentId: string | null
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  likeCount: number
  replyCount?: number
}

type CommentThreadProps = {
  postId: string
  comments: Comment[]
  nextCursor?: string
  currentUserId?: string
  commentCount: number
}

export function CommentThread({
  postId,
  comments,
  nextCursor,
  currentUserId,
  commentCount,
}: CommentThreadProps) {
  const router = useRouter()

  function handleCommentSuccess() {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">
          コメント
          {commentCount > 0 && (
            <span className="ml-2 text-muted-foreground font-normal">
              ({commentCount})
            </span>
          )}
        </h3>
      </div>

      {currentUserId ? (
        <CommentForm postId={postId} onSuccess={handleCommentSuccess} />
      ) : (
        <div className="text-center py-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            コメントするには
            <a href="/login" className="text-primary hover:underline mx-1">
              ログイン
            </a>
            してください
          </p>
        </div>
      )}

      <CommentList
        postId={postId}
        initialComments={comments}
        initialNextCursor={nextCursor}
        currentUserId={currentUserId}
      />
    </div>
  )
}
