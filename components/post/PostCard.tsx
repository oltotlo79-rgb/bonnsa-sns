'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { ImageGallery } from './ImageGallery'
import { QuotedPost } from './QuotedPost'
import { DeletePostButton } from './DeletePostButton'
import { LikeButton } from './LikeButton'
import { BookmarkButton } from './BookmarkButton'

type PostUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

type PostMedia = {
  id: string
  url: string
  type: string
  sortOrder: number
}

type PostGenre = {
  id: string
  name: string
  category: string
}

type QuotePost = {
  id: string
  content: string | null
  createdAt: string | Date
  user: PostUser
}

type Post = {
  id: string
  content: string | null
  createdAt: string | Date
  user: PostUser
  media: PostMedia[]
  genres: PostGenre[]
  likeCount: number
  commentCount: number
  quotePost?: QuotePost | null
  repostPost?: (QuotePost & { media: PostMedia[] }) | null
  isLiked?: boolean
  isBookmarked?: boolean
}

type PostCardProps = {
  post: Post
  currentUserId?: string
  initialLiked?: boolean
  initialBookmarked?: boolean
  disableNavigation?: boolean
}

function HeartIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function MessageCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function BookmarkIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  )
}

export function PostCard({ post, currentUserId, initialLiked, initialBookmarked, disableNavigation = false }: PostCardProps) {
  const router = useRouter()
  const isOwner = currentUserId === post.user.id
  const likesCount = post.likeCount ?? 0
  const commentsCount = post.commentCount ?? 0
  const isLiked = initialLiked ?? post.isLiked ?? false
  const isBookmarked = initialBookmarked ?? post.isBookmarked ?? false

  // リポストの場合は元の投稿を表示
  const displayPost = post.repostPost || post
  const isRepost = !!post.repostPost

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  // ハッシュタグをリンク化
  function renderContent(content: string) {
    const parts = content.split(/(#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <Link
            key={i}
            href={`/search?q=${encodeURIComponent(part)}`}
            className="text-bonsai-green hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        )
      }
      return part
    })
  }

  return (
    <article
      className={`bg-card border-b p-4 hover:bg-muted/30 transition-colors ${!disableNavigation ? 'cursor-pointer' : ''}`}
      onClick={!disableNavigation ? () => router.push(`/posts/${displayPost.id}`) : undefined}
    >
      {/* リポスト表示 */}
      {isRepost && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 ml-12">
          <RepeatIcon className="w-3 h-3" />
          <Link
            href={`/users/${post.user.id}`}
            className="hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {post.user.nickname}
          </Link>
          がリポスト
        </div>
      )}

      <div className="flex gap-3">
        {/* アバター */}
        <Link
          href={`/users/${displayPost.user.id}`}
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
            {displayPost.user.avatarUrl ? (
              <Image
                src={displayPost.user.avatarUrl}
                alt={displayPost.user.nickname}
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {displayPost.user.nickname.charAt(0)}
              </div>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          {/* ヘッダー */}
          <div className="flex items-center gap-2">
            <Link
              href={`/users/${displayPost.user.id}`}
              className="font-medium hover:underline truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {displayPost.user.nickname}
            </Link>
            <span className="text-sm text-muted-foreground">{timeAgo}</span>
            {isOwner && !isRepost && (
              <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
                <DeletePostButton postId={post.id} />
              </div>
            )}
          </div>

          {/* 本文 */}
          {displayPost.content && (
            <p className="mt-1 whitespace-pre-wrap break-words">
              {renderContent(displayPost.content)}
            </p>
          )}

          {/* メディア */}
          {'media' in displayPost && displayPost.media && displayPost.media.length > 0 && (
            <div className="mt-3">
              <ImageGallery
                images={displayPost.media}
                onMediaClick={!disableNavigation ? () => router.push(`/posts/${displayPost.id}`) : undefined}
              />
            </div>
          )}

          {/* 引用投稿 */}
          {post.quotePost && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <QuotedPost post={post.quotePost} />
            </div>
          )}

          {/* ジャンルタグ */}
          {post.genres && post.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {post.genres.map((genre) => (
                <Link
                  key={genre.id}
                  href={`/search?genre=${genre.id}`}
                  className="px-2 py-0.5 text-xs bg-muted rounded-full hover:bg-muted/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  {genre.name}
                </Link>
              ))}
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex items-center gap-4 mt-3 -ml-2" onClick={(e) => e.stopPropagation()}>
            {currentUserId ? (
              <LikeButton
                postId={displayPost.id}
                initialLiked={isLiked}
                initialCount={likesCount}
              />
            ) : (
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" asChild>
                <Link href="/login">
                  <HeartIcon className="w-4 h-4" />
                  <span className="text-xs">{likesCount > 0 && likesCount}</span>
                </Link>
              </Button>
            )}

            <Link href={`/posts/${displayPost.id}`}>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-blue-500 gap-1">
                <MessageCircleIcon className="w-4 h-4" />
                <span className="text-xs">{commentsCount > 0 && commentsCount}</span>
              </Button>
            </Link>

            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-green-500">
              <RepeatIcon className="w-4 h-4" />
            </Button>

            {currentUserId ? (
              <BookmarkButton
                postId={displayPost.id}
                initialBookmarked={isBookmarked}
              />
            ) : (
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href="/login">
                  <BookmarkIcon className="w-4 h-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
