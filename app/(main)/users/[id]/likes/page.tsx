import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: user } = await supabase
    .from('users')
    .select('nickname')
    .eq('id', id)
    .single()

  return {
    title: user ? `${user.nickname}のいいね - BON-LOG` : 'ユーザーが見つかりません',
  }
}

export default async function UserLikesPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: user } = await supabase
    .from('users')
    .select('id, nickname')
    .eq('id', id)
    .single()

  if (!user) {
    notFound()
  }

  const { data: likes } = await supabase
    .from('likes')
    .select(`
      post:posts(
        id,
        content,
        created_at,
        user:users(id, nickname, avatar_url)
      )
    `)
    .eq('user_id', id)
    .not('post_id', 'is', null)
    .order('created_at', { ascending: false })

  const posts = likes?.map(l => l.post).filter(Boolean) || []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={`/users/${id}`} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">いいねした投稿</h1>
        </div>

        {posts.length > 0 ? (
          <div className="divide-y">
            {posts.map((post: { id: string; content: string; created_at: string; user: { id: string; nickname: string; avatar_url: string | null } }) => (
              <div key={post.id} className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  {post.user.nickname}
                </p>
                <p className="whitespace-pre-wrap">{post.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(post.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            いいねした投稿がありません
          </p>
        )}
      </div>
    </div>
  )
}
