'use client'

import { CommentForm } from './CommentForm'

type ReplyFormProps = {
  postId: string
  parentId: string
  replyToNickname: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function ReplyForm({
  postId,
  parentId,
  replyToNickname,
  onSuccess,
  onCancel,
}: ReplyFormProps) {
  return (
    <CommentForm
      postId={postId}
      parentId={parentId}
      onSuccess={onSuccess}
      onCancel={onCancel}
      placeholder={`@${replyToNickname} への返信...`}
      autoFocus
    />
  )
}
