'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

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
  postId: string
  genreId: string
  genre: {
    id: string
    name: string
    category: string
  }
}

type Post = {
  id: string
  content: string | null
  createdAt: string | Date
  user: PostUser
  media: PostMedia[]
  genres: PostGenre[]
  _count: {
    likes: number
    comments: number
  }
}

type BonsaiRelatedPostsProps = {
  posts: Post[]
  currentUserId?: string
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
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

export function BonsaiRelatedPosts({ posts }: BonsaiRelatedPostsProps) {
  if (posts.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>この盆栽に関連する投稿はまだありません</p>
        <p className="text-sm mt-2">投稿時にこの盆栽を選択すると、ここに表示されます</p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/posts/${post.id}`}
          className="block p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex gap-3">
            {/* アバター */}
            <div className="flex-shrink-0">
              <Link href={`/users/${post.user.id}`} onClick={(e) => e.stopPropagation()}>
                {post.user.avatarUrl ? (
                  <Image
                    src={post.user.avatarUrl}
                    alt={post.user.nickname}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">
                      {post.user.nickname.charAt(0)}
                    </span>
                  </div>
                )}
              </Link>
            </div>

            {/* 投稿内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold truncate">{post.user.nickname}</span>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ja })}
                </span>
              </div>

              {post.content && (
                <p className="mt-1 text-sm whitespace-pre-wrap break-words line-clamp-3">
                  {post.content}
                </p>
              )}

              {/* メディアプレビュー */}
              {post.media.length > 0 && (
                <div className="mt-2 flex gap-1">
                  {post.media.slice(0, 4).map((media, index) => (
                    <div key={media.id} className="relative w-16 h-16 bg-muted rounded overflow-hidden">
                      {media.type === 'video' ? (
                        <video src={media.url} className="w-full h-full object-cover" />
                      ) : (
                        <Image src={media.url} alt="" fill className="object-cover" />
                      )}
                      {index === 3 && post.media.length > 4 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold">
                          +{post.media.length - 4}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ジャンルタグ */}
              {post.genres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {post.genres.map((pg) => (
                    <span
                      key={pg.genreId}
                      className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground"
                    >
                      {pg.genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* アクション */}
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HeartIcon className="w-4 h-4" />
                  {post._count.likes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircleIcon className="w-4 h-4" />
                  {post._count.comments}
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
