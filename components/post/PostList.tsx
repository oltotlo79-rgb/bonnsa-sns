import { PostCard } from './PostCard'

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

type PostListProps = {
  posts: Post[]
  currentUserId?: string
  emptyMessage?: string
}

export function PostList({ posts, currentUserId, emptyMessage = '投稿がありません' }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}
    </div>
  )
}
