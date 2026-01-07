'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { MessageCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { CommentForm } from './CommentForm'
import { CommentLikeButton } from './CommentLikeButton'
import { deleteComment, getReplies } from '@/lib/actions/comment'

type Comment = {
  id: string
  content: string
  created_at: string
  parent_id: string | null
  user: {
    id: string
    nickname: string
    avatar_url: string | null
  }
  likeCount: number
  replyCount?: number
  isLiked?: boolean
}

type CommentCardProps = {
  comment: Comment
  postId: string
  currentUserId?: string
  isReply?: boolean
}

export function CommentCard({
  comment,
  postId,
  currentUserId,
  isReply = false,
}: CommentCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies] = useState<Comment[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isOwner = currentUserId === comment.user.id
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: ja,
  })

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteComment(comment.id)
    if (result.error) {
      alert(result.error)
    }
    setIsDeleting(false)
  }

  async function handleToggleReplies() {
    if (showReplies) {
      setShowReplies(false)
      return
    }

    if (replies.length === 0 && comment.replyCount && comment.replyCount > 0) {
      setLoadingReplies(true)
      const result = await getReplies(comment.id)
      if (result.replies) {
        setReplies(result.replies as Comment[])
      }
      setLoadingReplies(false)
    }

    setShowReplies(true)
  }

  function handleReplySuccess() {
    setShowReplyForm(false)
    // 返信を再取得
    getReplies(comment.id).then(result => {
      if (result.replies) {
        setReplies(result.replies as Comment[])
        setShowReplies(true)
      }
    })
  }

  return (
    <div className={`${isReply ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}>
      <div className="flex gap-3">
        <Link href={`/users/${comment.user.id}`}>
          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
            {comment.user.avatar_url ? (
              <Image
                src={comment.user.avatar_url}
                alt={comment.user.nickname}
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                {comment.user.nickname[0]}
              </div>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/users/${comment.user.id}`}
              className="font-medium hover:underline truncate"
            >
              {comment.user.nickname}
            </Link>
            <span className="text-muted-foreground text-xs">{timeAgo}</span>
          </div>

          <p className="text-sm mt-1 whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          <div className="flex items-center gap-4 mt-2">
            {currentUserId ? (
              <CommentLikeButton
                commentId={comment.id}
                postId={postId}
                initialLiked={comment.isLiked ?? false}
                initialCount={comment.likeCount}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground"
                asChild
              >
                <a href="/login">
                  <span className="text-xs">{comment.likeCount}</span>
                </a>
              </Button>
            )}

            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                <span className="text-xs">返信</span>
              </Button>
            )}

            {isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>コメントを削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      このコメントを削除してもよろしいですか？
                      {!isReply && comment.replyCount && comment.replyCount > 0 && (
                        <span className="block mt-2 text-destructive">
                          このコメントには{comment.replyCount}件の返信があります。
                          返信もすべて削除されます。
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      削除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* 返信フォーム */}
          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                onSuccess={handleReplySuccess}
                onCancel={() => setShowReplyForm(false)}
                placeholder={`@${comment.user.nickname} への返信...`}
                autoFocus
              />
            </div>
          )}

          {/* 返信を表示ボタン */}
          {!isReply && comment.replyCount && comment.replyCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-primary"
              onClick={handleToggleReplies}
              disabled={loadingReplies}
            >
              {loadingReplies ? (
                '読み込み中...'
              ) : showReplies ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  返信を非表示
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  {comment.replyCount}件の返信を表示
                </>
              )}
            </Button>
          )}

          {/* 返信一覧 */}
          {showReplies && replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {replies.map((reply) => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  currentUserId={currentUserId}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
