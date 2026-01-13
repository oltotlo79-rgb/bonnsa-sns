'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { CommentCard } from './CommentCard'
import { getComments } from '@/lib/actions/comment'

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

type CommentListProps = {
  postId: string
  initialComments: Comment[]
  initialNextCursor?: string
  currentUserId?: string
}

export function CommentList({
  postId,
  initialComments,
  initialNextCursor,
  currentUserId,
}: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialNextCursor)
  const [loading, setLoading] = useState(false)

  // initialCommentsが変更されたら状態を更新
  useEffect(() => {
    setComments(initialComments)
    setNextCursor(initialNextCursor)
  }, [initialComments, initialNextCursor])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return

    setLoading(true)
    const result = await getComments(postId, nextCursor)

    if (result.comments) {
      setComments(prev => [...prev, ...result.comments as Comment[]])
      setNextCursor(result.nextCursor)
    }
    setLoading(false)
  }, [postId, nextCursor, loading])

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        まだコメントはありません。
        <br />
        最初のコメントを投稿しましょう！
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentCard
          key={comment.id}
          comment={comment}
          postId={postId}
          currentUserId={currentUserId}
        />
      ))}

      {nextCursor && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? '読み込み中...' : 'さらに読み込む'}
          </Button>
        </div>
      )}
    </div>
  )
}
