import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileHeader } from '@/components/user/ProfileHeader'

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
    title: user ? `${user.nickname} - BON-LOG` : 'ユーザーが見つかりません',
  }
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // ユーザー基本情報を取得
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !user) {
    notFound()
  }

  // カウントを別々に取得
  const [postsCount, followersCount, followingCount] = await Promise.all([
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
  ])

  // ユーザーオブジェクトにカウントを追加
  const userWithCounts = {
    ...user,
    postsCount: postsCount.count || 0,
    followersCount: followersCount.count || 0,
    followingCount: followingCount.count || 0,
  }

  const isOwner = currentUser?.id === user.id

  // フォロー状態を取得
  let isFollowing = false
  if (currentUser && !isOwner) {
    const { data: follow } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', id)
      .single()

    isFollowing = !!follow
  }

  // 最近の投稿を取得
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      user:users(id, nickname, avatar_url)
    `)
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ProfileHeader
        user={userWithCounts}
        isOwner={isOwner}
        isFollowing={isFollowing}
      />

      {/* 投稿一覧 */}
      <div className="bg-card rounded-lg border">
        <h2 className="px-4 py-3 font-bold border-b">投稿</h2>

        {posts && posts.length > 0 ? (
          <div className="divide-y">
            {posts.map((post) => (
              <div key={post.id} className="p-4">
                <p className="whitespace-pre-wrap">{post.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(post.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            まだ投稿がありません
          </p>
        )}
      </div>
    </div>
  )
}
