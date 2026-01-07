import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

type QuotedPostProps = {
  post: {
    id: string
    content: string | null
    created_at: string
    user: {
      id: string
      nickname: string
      avatar_url: string | null
    }
  }
}

export function QuotedPost({ post }: QuotedPostProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: ja,
  })

  return (
    <Link
      href={`/posts/${post.id}`}
      className="block border rounded-lg p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex-shrink-0">
          {post.user.avatar_url ? (
            <Image
              src={post.user.avatar_url}
              alt={post.user.nickname}
              width={20}
              height={20}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              {post.user.nickname.charAt(0)}
            </div>
          )}
        </div>
        <span className="text-sm font-medium truncate">{post.user.nickname}</span>
        <span className="text-xs text-muted-foreground">{timeAgo}</span>
      </div>

      {post.content && (
        <p className="text-sm mt-2 line-clamp-3 whitespace-pre-wrap">{post.content}</p>
      )}
    </Link>
  )
}
