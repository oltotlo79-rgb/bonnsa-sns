'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleCommentLike } from '@/lib/actions/like'

type CommentLikeButtonProps = {
  commentId: string
  postId: string
  initialLiked: boolean
  initialCount: number
}

export function CommentLikeButton({
  commentId,
  postId,
  initialLiked,
  initialCount,
}: CommentLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  async function handleToggle() {
    // Optimistic UI
    const newLiked = !liked
    setLiked(newLiked)
    setCount(prev => newLiked ? prev + 1 : prev - 1)

    startTransition(async () => {
      const result = await toggleCommentLike(commentId, postId)

      if (result.error) {
        // ロールバック
        setLiked(liked)
        setCount(initialCount)
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 px-2 ${
        liked
          ? 'text-red-500 hover:text-red-600'
          : 'text-muted-foreground hover:text-red-500'
      }`}
      onClick={handleToggle}
      disabled={isPending}
    >
      <Heart
        className={`w-4 h-4 mr-1 transition-all ${
          liked ? 'fill-current scale-110' : ''
        }`}
      />
      <span className="text-xs">{count}</span>
    </Button>
  )
}
