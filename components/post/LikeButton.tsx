'use client'

import { useState, useTransition, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { togglePostLike } from '@/lib/actions/like'

type LikeButtonProps = {
  postId: string
  initialLiked: boolean
  initialCount: number
}

export function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()

  // propsが更新されたら状態を同期
  useEffect(() => {
    setLiked(initialLiked)
    setCount(initialCount)
  }, [initialLiked, initialCount])

  async function handleToggle() {
    // Optimistic UI
    const newLiked = !liked
    setLiked(newLiked)
    setCount(prev => newLiked ? prev + 1 : prev - 1)

    startTransition(async () => {
      const result = await togglePostLike(postId)

      if (result.error) {
        // ロールバック
        setLiked(liked)
        setCount(initialCount)
      } else {
        // React Queryのキャッシュを無効化して再取得
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`flex items-center gap-1 ${
        liked
          ? 'text-red-500 hover:text-red-600'
          : 'text-muted-foreground hover:text-red-500'
      }`}
      onClick={handleToggle}
      disabled={isPending}
    >
      <Heart
        className={`w-5 h-5 transition-all ${
          liked ? 'fill-current scale-110' : ''
        }`}
      />
      <span className="text-sm">{count}</span>
    </Button>
  )
}
