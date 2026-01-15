'use client'

import { useState, useTransition, useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { toggleBookmark } from '@/lib/actions/bookmark'

type BookmarkButtonProps = {
  postId: string
  initialBookmarked: boolean
}

export function BookmarkButton({
  postId,
  initialBookmarked,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()

  // propsが更新されたら状態を同期
  useEffect(() => {
    setBookmarked(initialBookmarked)
  }, [initialBookmarked])

  async function handleToggle() {
    // Optimistic UI
    const newBookmarked = !bookmarked
    setBookmarked(newBookmarked)

    startTransition(async () => {
      const result = await toggleBookmark(postId)

      if (result.error) {
        // ロールバック
        setBookmarked(bookmarked)
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
      className={`${
        bookmarked
          ? 'text-yellow-500 hover:text-yellow-600'
          : 'text-muted-foreground hover:text-yellow-500'
      }`}
      onClick={handleToggle}
      disabled={isPending}
    >
      <Bookmark
        className={`w-5 h-5 transition-all ${
          bookmarked ? 'fill-current scale-110' : ''
        }`}
      />
    </Button>
  )
}
