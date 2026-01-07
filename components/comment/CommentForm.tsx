'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createComment } from '@/lib/actions/comment'

type CommentFormProps = {
  postId: string
  parentId?: string
  onSuccess?: () => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export function CommentForm({
  postId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = 'コメントを入力...',
  autoFocus = false,
}: CommentFormProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const maxLength = 500
  const remainingChars = maxLength - content.length
  const isOverLimit = remainingChars < 0
  const canSubmit = content.trim().length > 0 && !isOverLimit

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || isPending) return

    setError(null)

    const formData = new FormData()
    formData.append('postId', postId)
    formData.append('content', content)
    if (parentId) {
      formData.append('parentId', parentId)
    }

    startTransition(async () => {
      const result = await createComment(formData)

      if (result.error) {
        setError(result.error)
      } else {
        setContent('')
        onSuccess?.()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] resize-none pr-16"
          disabled={isPending}
          autoFocus={autoFocus}
        />
        <div
          className={`absolute bottom-2 right-2 text-xs ${
            isOverLimit
              ? 'text-destructive'
              : remainingChars <= 50
              ? 'text-yellow-500'
              : 'text-muted-foreground'
          }`}
        >
          {remainingChars}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            キャンセル
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit || isPending}
        >
          {isPending ? '送信中...' : parentId ? '返信する' : 'コメントする'}
        </Button>
      </div>
    </form>
  )
}
