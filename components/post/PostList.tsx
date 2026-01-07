import { PostCard } from './PostCard'

type PostUser = {
  id: string
  nickname: string
  avatar_url: string | null
}

type PostMedia = {
  id: string
  url: string
  type: string
  sort_order: number
}

type PostGenre = {
  genre: {
    id: string
    name: string
    category: string
  }
}

type QuotePost = {
  id: string
  content: string | null
  created_at: string
  user: PostUser
}

type Post = {
  id: string
  content: string | null
  created_at: string
  user: PostUser
  media: PostMedia[]
  genres: PostGenre[]
  likes: { count: number }[]
  comments: { count: number }[]
  quote_post: QuotePost | null
  repost_post: (QuotePost & { media: PostMedia[] }) | null
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
